# JulzOps architecture

One-sentence pitch: a single-user ops dashboard where my automations POST their run summaries at the end of each run, and I see them on one page instead of clicking between Anthropic Console, GitHub Actions, and Notion.

## The 4 moving pieces

```
 ┌──────────────────────────────┐     POST /api/ingest/cost
 │ sync.py (other repo)         │────────────────────────────┐
 │  — runs on GitHub Actions    │     (bearer-authed)        │
 │  — at end of run, ships      │                            ▼
 │    summary + cost to JulzOps │             ┌─────────────────────────┐
 └──────────────────────────────┘             │ ops.julzcreations.com   │
                                              │  — Next.js 14 on Vercel │
                                              │  — API routes + UI      │
 ┌──────────────────────────────┐             │                         │
 │ Me in a browser              │────────────▶│                         │
 │  — sign in with Google       │  GET /      │                         │
 │  — only julie.yue.2011@      │  (cookie    │                         │
 │    gmail.com allowed         │   session)  │                         │
 └──────────────────────────────┘             └────────────┬────────────┘
                                                           │ reads + writes
                                                           ▼
                                              ┌─────────────────────────┐
                                              │ Neon Postgres           │
                                              │  Project + Event +      │
                                              │  CostSample + Retro     │
                                              └─────────────────────────┘
```

## The 3 flows

**1. Ingest (data in).** A GitHub Actions workflow runs sync.py on its own schedule (10am CST daily). At the end, sync.py's `post_run_to_julzops()` POSTs a JSON summary to `/api/ingest/cost` with a shared-secret bearer token. The Next.js route validates the token, writes one `CostSample` per model + one `workflow_run` `Event`, returns 200.

**2. Render (data out).** A browser hit on `/` runs [src/app/page.tsx](../src/app/page.tsx) server-side. It checks the Google session cookie, queries Neon (today's spend, event count, last 20 events, running count), and passes data to [DashboardView.tsx](../src/components/DashboardView.tsx) which renders tiles + activity feed.

**3. Auth.** NextAuth + Google OAuth with JWT sessions. The `signIn` callback in [src/lib/auth.ts](../src/lib/auth.ts) hard-rejects any email that isn't mine. Same setup as SubTracker, locked harder.

## Push-based, not pull-based (important)

**JulzOps itself runs zero scheduled jobs.** There's no cron that wakes up and polls APIs. Every row in the database got there because something *chose* to POST to `/api/ingest/cost`.

This is the opposite of how Grafana / Helicone / Langfuse work (those poll or proxy every request). It's cheaper, faster, and simpler because:

- sync.py already has exact cost numbers from its own `track_usage()` — no reason to re-derive them from a second source.
- No polling loop = no "is it running? is it healthy?" meta-problem.
- Data lands in seconds, not minutes.
- Tradeoff: only *instrumented* workflows show up. If a script doesn't POST, JulzOps has no way to know it ran.

The one cron I almost built (`/api/jobs/reconcile-usage`) would have pulled daily rollups from Anthropic's Cost Report API as a cross-check. Retired because individual API accounts don't get admin keys, and push data is already 100% accurate for instrumented workflows.

## Adding a new data source

### Case A — Another script you own

Example: a nightly script you write for Closet Stories that calls OpenAI.

1. Seed a Project row in Neon (one-time):
   ```ts
   await prisma.project.create({
     data: { slug: 'closet-stories-nightly', name: 'Closet Stories nightly', color: '#ffb7c5' }
   })
   ```
   Or add it to [prisma/seed.ts](../prisma/seed.ts) and run `npm run db:seed`.

2. In your script, at the end of its run, POST the summary:
   ```python
   requests.post(
     os.environ['JULZOPS_INGEST_URL'],
     headers={'Authorization': f'Bearer {os.environ["JULZOPS_INGEST_SECRET"]}'},
     json={
       'projectSlug': 'closet-stories-nightly',
       'source': 'github_actions',
       'workflowTitle': f'Closet Stories nightly {today}',
       'startedAt': run_started.isoformat(),
       'endedAt': run_ended.isoformat(),
       'durationMs': int((run_ended - run_started).total_seconds() * 1000),
       'status': 'success' if not errors else 'failure',
       'runUrl': f'https://github.com/.../{run_id}',
       'metadata': { 'customField': '...' },
       'usage': {
         'totalUsd': total_cost,
         'byModel': { 'gpt-4o-mini': { 'calls': 3, 'inputTokens': 1000, 'outputTokens': 500, 'costUsd': 0.002 } }
       }
     },
     timeout=5,
   )
   ```

3. Add `JULZOPS_INGEST_URL` + `JULZOPS_INGEST_SECRET` to that repo's GitHub Actions secrets. Copy from swirl-series-automation via `gh secret list --repo ...` as reference.

4. Done. Next run of that script = new event on the dashboard.

### Case B — A third-party service with a billing/usage API

Example: Neon's usage API, Anthropic's Cost Report (if ever moved to Team tier), OpenAI's usage endpoint.

1. Check if the service publishes a usage/billing API. Many don't.
2. Create `src/app/api/jobs/poll-<service>/route.ts` — a Vercel cron that hits the API on a schedule.
3. Add the service's API key to Vercel env vars.
4. The route writes `CostSample` rows with `source="<service>"` + schedule it via `vercel.json` (add the `crons` array back):
   ```json
   { "crons": [{ "path": "/api/jobs/poll-neon", "schedule": "0 6 * * *" }] }
   ```
5. Auth the route with `Bearer ${CRON_SECRET}` like the stubbed reconcile route.

### Case C — Flat subscriptions with no API (Notion plan, Figma seat, Vercel Pro)

Don't put these in JulzOps. Use SubTracker — that's what it's for. JulzOps tracks *variable usage* (Claude API calls, run duration, failures). SubTracker tracks *flat recurring charges*. Different tools, different data shapes.

### Case D — Claude Code sessions on my laptop

Not instrumented today. Anthropic publishes OpenTelemetry metrics for Claude Code; a local OTEL collector could forward them to a future `/api/ingest/otel` endpoint. Phase 3 work.

## Data model (in [prisma/schema.prisma](../prisma/schema.prisma))

- **Project**: a thing that produces events. Identified by `slug` (e.g. `swirl-series-automation`). Currently 2 rows — `swirl-series-automation` and `julzops` itself.
- **Event**: one entry in the activity feed. `source` ("github_actions", "julzops"), `kind` ("workflow_run", "reconcile_usage"), `status` ("success" | "failure" | "running"), `metadata` (JSON blob for extras).
- **CostSample**: one per model per run. `source`, `model`, token counts, USD cost, `sampledAt`. Queried for the "Today's spend" tile.
- **Retro**: weekly Markdown digest. Built but disabled in Phase 1 — the route and model exist, the generator is Phase 3.

## Where to change things

| I want to... | File |
|---|---|
| Change how a tile looks / add a new tile | [src/components/DashboardView.tsx](../src/components/DashboardView.tsx) |
| Change what data the dashboard queries | [src/app/page.tsx](../src/app/page.tsx) (Promise.all block) |
| Add a new field or new table | [prisma/schema.prisma](../prisma/schema.prisma) → `npm run db:migrate` |
| Let a different email sign in | `ALLOWED_EMAIL` in [src/lib/auth.ts](../src/lib/auth.ts) |
| Change what sync.py sends | `post_run_to_julzops()` in the swirl-series-automation repo + payload type in [src/app/api/ingest/cost/route.ts](../src/app/api/ingest/cost/route.ts) |
| Rotate the webhook secret | `JULZOPS_INGEST_SECRET` in Vercel **and** swirl-series-automation GH Actions secrets |
| Tweak colors / fonts | [tailwind.config.ts](../tailwind.config.ts) + [src/app/globals.css](../src/app/globals.css) |
| Tweak cost model pricing when Anthropic updates rates | `MODEL_PRICING` in [src/lib/claude.ts](../src/lib/claude.ts) |

## Env vars (production, in Vercel)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection (runtime queries) |
| `DIRECT_URL` | Neon direct connection (Prisma migrations only) |
| `NEXTAUTH_URL` | `https://ops.julzcreations.com` (production only) |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `JULZOPS_INGEST_SECRET` | Bearer token sync.py uses to POST to `/api/ingest/cost` |
| `CRON_SECRET` | Auth for `/api/jobs/*` (future Vercel crons) |
| `MAX_COST_PER_RUN_USD` | Hard abort for JulzOps's own Claude calls |
| `RETRO_ENABLED` | Gates the (Phase 3) retro engine — default `false` |
| `RETRO_MODEL` | Which Claude model writes retros — default `claude-opus-4-7` |
| `RETENTION_DAYS` | Days before events get purged — default `90` |

## Stack summary

Next.js 14 App Router + TypeScript strict + NextAuth v4 (Google) + Prisma 5 + Neon Postgres + Tailwind, deployed on Vercel. Same stack as SubTracker — nothing new to learn to maintain this.

## Phases

- **Phase 1** (shipped 2026-04-18): scaffold, auth, theme, deploy, self-monitoring scaffolding.
- **Phase 2** (shipped 2026-04-18): Neon DB, `/api/ingest/cost` webhook, sync.py integration, live Today dashboard.
- **Phase 3** (not started): `/activity`, `/projects`, `/costs`, `/settings`, `/retros` routes; retro engine built-but-disabled (Opus 4.7 analyst, threshold 30 events OR 3 projects); 90-day event purge job; optional Claude Code OTEL ingestion.
