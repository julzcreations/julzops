# Market Insights view — design requirements

**Status:** design spec only — do not implement yet. Julie is planning a dashboard reorganization; this doc captures what market-insights metrics need to be visible on JulzOps as part of that reorg.

**Owner:** Julie
**Drafted:** 2026-04-23
**Depends on:** `market-insights` runner (separate repo) is already POSTing per-topic run metadata to `/api/ingest/cost` as `projectSlug = market-insights-<topic_slug>` (see `market-insights/runner/julzops.py`).

---

## Why

JulzOps today surfaces aggregate spend + last 20 events. When Julie looks at the dashboard she wants to answer two specific market-insights questions at a glance, without clicking into individual events:

1. **Which topic is burning which fraction of the monthly budget?** — so she can cut/add cadences rationally rather than guessing.
2. **What's scheduled to run and when?** — so she knows what the next Monday morning will bring without having to open the market-insights repo or the dashboard's topic-config UI.

Neither question is answerable today from the existing tiles. Both are the most-common reasons Julie pulls up the market-insights repo to re-derive from cron expressions + cost docs, which is exactly the JulzOps anti-pattern.

---

## What to surface

Two purpose-built tables, plus a totals strip. See mocks below.

### Table 1 — Topic × expected monthly cost

One row per enabled topic. Sort by `$/mo desc` by default.

| Column | Source | Notes |
|---|---|---|
| Topic icon + name | `Topic.name` + emoji from slug | Visual scan |
| Slug | `Topic.slug` | Small monospace, right-aligned |
| Model | `Topic.model` | `Opus` / `Sonnet` pill — color-coded |
| Cadence | Derived from `Topic.schedule` | Humanized: "Monthly, 1st Mon" not raw cron |
| Runs/mo | Computed from schedule | See cadence table in market-insights/docs/COSTS.md |
| $/run (observed) | Rolling 30-day avg from `CostSample` | Fall back to $/run estimate if <3 samples |
| **$/mo (projected)** | `runs_per_month × $/run` | **Primary number** — bold, right-aligned |
| $/mo (actual, MTD) | Sum of `CostSample` MTD for this project | Compare column |
| Last run status | Latest `Event` for this project | ✓ / ✗ / ⏳ |

**Example rendering** (this is what it should look like — data as of plan write date):

| Topic | Slug | Model | Cadence | Runs/mo | $/run | **$/mo proj** | $/mo MTD |
|---|---|---|---|---|---|---|---|
| 🎯 Skills Radar | skills-radar | Sonnet | 2×/mo (1st + 15th) | 2 | $0.55 | **$1.10** | — |
| 🧭 Creator Market Watch | creator-market-watch | Opus | Monthly, 1st Mon | 1 | $3.80 | **$3.80** | — |
| 💼 AI Engineer Job Market | ai-engineer-job-market | Sonnet | Biweekly (1st + 3rd Mon) | 2.17 | $0.55 | **$1.19** | — |
| 🛰️ Indie Intel | indie-intel-market-watch | Sonnet | Monthly, 1st Mon | 1 | $0.55 | **$0.55** | — |
| ☕ Coffee Pain Watch | coffee-pain-watch | Opus | Monthly, 2nd Mon | 1 | $3.80 | **$3.80** | — |
| 🧠 AI Developments | daily-ai-developments | Sonnet | Biweekly (2nd + 4th Mon) | 2.17 | $0.61 | **$1.32** | — |
| 🔭 Opportunity Radar | opportunity-radar | Opus | Monthly, 3rd Mon | 1 | $3.80 | **$3.80** | — |
| | | | | | **Total** | **~$15.56/mo** | |

**Totals strip** below the table: projected monthly burn, MTD actual, delta, % of credit ceiling consumed.

### Table 2 — Schedule view (which dates, which topics)

Show the next 4 Mondays (covering ~1 month ahead). One row per Monday. Columns = topics running that date, each rendered as a pill.

| Column | Source | Notes |
|---|---|---|
| Date | Computed | Format: `Mon 5/4` (weekday + date) |
| Week-of-month | Computed | Shown subtly (W1 / W2 / W3 / W4) |
| Topics running | `Topic.nextRunAt` rolled forward via the cron | Each topic rendered as an icon + slug pill |
| Coverage status | Derived | "covered" / "light" / "empty" |
| Total $ expected | Sum over topics × $/run | Optional — shows daily spend |

**Example rendering** (May 2026):

| Date | Week | Topics running | Coverage | $ expected |
|---|---|---|---|---|
| Fri 5/1 | W1 | 🎯 skills-radar | light | $0.55 |
| Mon 5/4 | W1 | 🧭 creator-market-watch · 💼 ai-engineer-job-market · 🛰️ indie-intel | covered | $4.90 |
| Mon 5/11 | W2 | ☕ coffee-pain-watch · 🧠 ai-developments | covered | $4.41 |
| Thu 5/15 | W3 | 🎯 skills-radar | light | $0.55 |
| Mon 5/18 | W3 | 🔭 opportunity-radar · 💼 ai-engineer-job-market | covered | $4.35 |
| Mon 5/25 | W4 | 🧠 ai-developments | light | $0.61 |

**Coverage color coding:**
- `covered` — ≥2 topics or at least one Opus topic
- `light` — exactly 1 Sonnet topic
- `empty` — 0 topics → warn (should not happen given current staggering, but defensive)

**Optional stretch:** clicking a row expands to show each topic's next-after-this run, headlines from the last run, and groundbreaking history.

### Totals strip (single line, top of the view)

Renders above both tables:

```
Market Insights · 7 topics active · projected $15.56/mo · MTD $X.XX · headroom $9.44 (to $25 ceiling)
```

---

## Data model — what JulzOps already has vs. what's missing

### What already flows in (from market-insights runner → JulzOps)

- ✅ One `Project` row per topic (slug pattern `market-insights-<topic_slug>`) — seeded on first run.
- ✅ One `Event` per run with kind=`workflow_run`, status, duration, run URL.
- ⚠️ **Cost per topic is not currently flowing.** `runner/julzops.py` comment says "Cost is tracked centrally in JulzOps via the Anthropic Cost API" but that reconcile route was retired (per `julzops/docs/ARCHITECTURE.md`). Net effect: `CostSample` rows don't get written for market-insights runs today.
- ⚠️ No `Topic` metadata in JulzOps — schedule, model, cadence all live in the market-insights Neon DB, not here.

### What this view needs

**New data requirements:**
1. **Per-run cost.** Extend `runner/julzops.py` payload to include `usage.totalUsd` and `usage.byModel` (the ingest route already supports this shape — see `Case A` in `ARCHITECTURE.md`). The runner knows its own cost via Claude's SDK usage report — just has to include it in the POST.
2. **Topic metadata.** Needs either:
   - **Option A (lightweight):** A new `/api/ingest/topic-config` endpoint that accepts the topic's slug + name + model + schedule, called by the market-insights runner at the start of each run (idempotent upsert). Keeps the market-insights DB authoritative.
   - **Option B (heavier):** Replicate the `Topic` table in JulzOps's Neon via a daily sync job.
   - **Recommendation: Option A.** Matches JulzOps's push-based philosophy, no new scheduled jobs.

**Computed fields (no new data required, just logic):**
- Runs/mo from cron expression — port `computeNextRunAt` from `market-insights/src/lib/cron.ts`, add a `countRunsPerMonth` helper.
- Cadence label ("Monthly, 1st Mon") — mapping table from common cron patterns to human labels.
- Next-4-Mondays schedule projection — iterate `computeNextRunAt` 4 times from today.

### Schema changes needed in JulzOps

Minimal. Prefer adding a `TopicConfig` table (new) rather than extending `Project`:

```prisma
model TopicConfig {
  id          String   @id @default(cuid())
  projectSlug String   @unique  // "market-insights-coffee-pain-watch"
  name        String
  icon        String?
  model       String
  schedule    String   // cron expression
  enabled     Boolean  @default(true)
  updatedAt   DateTime @updatedAt
}
```

Project → TopicConfig relation is 1:1 via `projectSlug`. Keeps market-insights-specific metadata out of the generic `Project` table.

---

## Placement in the dashboard

Defer to Julie's reorg. Suggested:
- **Home dashboard (`/`)**: totals strip + compact version of Table 2 (next 3 Mondays only).
- **`/market-insights` sub-route (new):** full versions of both tables, historical spend chart, per-topic drill-down.
- **`/costs` (future):** already-planned in Phase 3 — Market Insights totals become a row in a broader cost breakdown.

---

## Explicit non-goals

- No editing topics from JulzOps. The market-insights Neon DB stays authoritative; topic edits happen via migration scripts there (see `market-insights/scripts/apply-cadence-changes-v*.ts` pattern).
- No re-triggering runs from JulzOps. Use `gh workflow run` or the market-insights GitHub Actions `workflow_dispatch` UI.
- No cost prediction beyond next 4 Mondays. Seasonality + topic churn make longer horizons noisy.
- No dashboard-internal analytics of the market-insights report content (headlines, signals). That's the market-insights dashboard's job; JulzOps is about the meta-layer (did it run, how much did it cost, when's next).

---

## Open questions for Julie before implementation

1. Should `daily-ai-developments` render as "AI Developments" (display name) or its slug? (Display name is cleaner, slug is searchable.)
2. Coverage color for week-of-month — any preference on palette (cozy warm vs. neutral)?
3. Keep MTD column even if it's empty for the first month, or hide until data accumulates?
4. Do we want a "kill switch" indicator on Table 1 (e.g. show disabled topics grayed out below enabled ones) so Julie can see at a glance what's paused?
