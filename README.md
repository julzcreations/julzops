# JulzOps

Cozy ops dashboard for Julie's automations. Lives at [ops.julzcreations.com](https://ops.julzcreations.com).

## Stack

- Next.js 14 App Router + TypeScript 5 strict
- NextAuth v4 + Google OAuth (single-user, restricted to Julie)
- Prisma 5 + Neon Postgres (Phase 2)
- Tailwind CSS — cozy pink/purple lo-fi theme (matches SubTracker)
- Deployed on Vercel

## What it replaces

One page that answers "is anything broken? how much am I spending?" instead of clicking between Anthropic Console, GitHub Actions, memory files on disk, cron state, and Notion.

## Local dev

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

## Phases

- **Phase 1** (this deploy): scaffold + auth + theme + deployed landing
- **Phase 2**: GitHub Actions poller + Anthropic usage webhook + Today dashboard with real data
- **Phase 3**: all routes + retro engine built-but-disabled + daily reconcile job

Full spec: `C:/Users/julie/Projects/claude-prompts/julzops.md`
