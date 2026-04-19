import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { triggerSwirlWorkflow, type TriggerKind } from '@/lib/swirl-series'

export const runtime = 'nodejs'

type Body = {
  kind?: TriggerKind
  targetMediaId?: string
}

/**
 * POST /api/swirl-series/trigger
 *
 * Fires the swirl-sync GHA workflow on demand. Two kinds:
 *  - 'refresh' — normal sync (metrics + matcher, script gen only on M/W/F).
 *  - 'regen'   — force_regen=true (drafts a fresh Scripted row even on
 *                non-gen days).
 *
 * Optional targetMediaId narrows the run to a single IG reel — useful for
 * reprocessing one off-script post without touching the others.
 *
 * Auth: requires an authenticated NextAuth session (single-user app, the
 * trigger is only ever exposed to Julie). Returns the URL of the workflow's
 * runs page — not the specific run, since dispatches don't return run_id.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    // Empty body is allowed — defaults to a normal refresh.
  }

  const kind: TriggerKind = body.kind === 'regen' ? 'regen' : 'refresh'
  const targetMediaId = body.targetMediaId?.trim() || undefined

  const result = await triggerSwirlWorkflow({ kind, targetMediaId })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, status: result.status, error: result.error },
      { status: result.status >= 400 ? result.status : 500 },
    )
  }

  return NextResponse.json({ ok: true, runsUrl: result.runsUrl, kind })
}
