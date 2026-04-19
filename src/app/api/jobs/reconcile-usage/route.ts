import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// This route was designed to call Anthropic's Cost Report API
// (/v1/organizations/cost_report) as a daily reconcile job. That endpoint
// requires an ADMIN API key, which is only available on Team/Scale org tiers
// — not individual pay-as-you-go accounts. Julie is on individual, so the
// route is a graceful no-op.
//
// Canonical cost source for JulzOps = push-based webhooks (sync.py POSTs run
// summaries to /api/ingest/cost at end of each run). For a single-user
// dashboard with instrumented workflows, that gives 100% coverage.
//
// Revisit this route only if:
//   (a) the Anthropic account moves to a Team/Scale plan with admin keys, or
//   (b) there's Claude usage coming from sources that AREN'T instrumented
//       (e.g. raw Claude Code sessions, separate scripts) and we want to see
//       that usage show up alongside the instrumented automation costs.

function checkCronAuth(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({
    ok: true,
    skipped: 'admin_api_not_configured',
    note: 'Anthropic Cost Report API needs org-tier admin key; canonical source is push webhooks.',
  })
}
