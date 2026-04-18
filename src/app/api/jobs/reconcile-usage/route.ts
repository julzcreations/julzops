import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel cron jobs hit this path with `Authorization: Bearer ${CRON_SECRET}`.
// Manual invocations (testing) use the same auth.
function checkCronAuth(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}

type CostReportBucket = {
  starting_at: string
  ending_at: string
  results: Array<{
    amount_usd?: number | string
    cost_usd?: number | string
    model?: string
    workspace_id?: string | null
    service_tier?: string | null
  }>
}

type CostReportResponse = {
  data: CostReportBucket[]
  has_more?: boolean
  next_page?: string | null
}

// Pull yesterday's (UTC) cost data from Anthropic's Cost Report API and upsert
// one CostSample per (model, day) rollup with source="anthropic_cost_report".
// This is the canonical $ truth that reconciles against push-based webhook data.
async function fetchYesterdayCostReport(): Promise<CostReportBucket[]> {
  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY
  if (!adminKey) throw new Error('ANTHROPIC_ADMIN_API_KEY not configured')

  const now = new Date()
  const startYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const endYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const url = new URL('https://api.anthropic.com/v1/organizations/cost_report')
  url.searchParams.set('starting_at', startYesterday.toISOString())
  url.searchParams.set('ending_at', endYesterday.toISOString())
  url.searchParams.set('bucket_width', '1d')
  url.searchParams.append('group_by[]', 'model')

  const res = await fetch(url.toString(), {
    headers: {
      'x-api-key': adminKey,
      'anthropic-version': '2023-06-01',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cost Report API ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as CostReportResponse
  return json.data ?? []
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const startedAt = new Date()
  try {
    const buckets = await fetchYesterdayCostReport()

    // Flatten into (day, model, cost) rows
    type Row = { day: Date; model: string; costUsd: number }
    const rows: Row[] = []
    for (const b of buckets) {
      const day = new Date(b.starting_at)
      for (const r of b.results) {
        const cost = Number(r.amount_usd ?? r.cost_usd ?? 0)
        if (!r.model || cost === 0) continue
        rows.push({ day, model: r.model, costUsd: cost })
      }
    }

    // Upsert: delete existing anthropic_cost_report rows for this day, insert fresh
    const upsertedModels: string[] = []
    if (rows.length > 0) {
      const day = rows[0].day
      const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000)
      await prisma.costSample.deleteMany({
        where: {
          source: 'anthropic_cost_report',
          sampledAt: { gte: day, lt: nextDay },
        },
      })
      await prisma.costSample.createMany({
        data: rows.map((r) => ({
          source: 'anthropic_cost_report',
          model: r.model,
          inputTokens: 0, // cost_report doesn't return token breakdowns; v3 may swap to usage_report
          outputTokens: 0,
          costUsd: r.costUsd,
          sampledAt: r.day,
        })),
      })
      upsertedModels.push(...rows.map((r) => r.model))
    }

    const durationMs = Date.now() - startedAt.getTime()
    // Log the reconcile itself as an Event on the JulzOps project for self-monitoring
    const self = await prisma.project.findUnique({ where: { slug: 'julzops' } })
    if (self) {
      await prisma.event.create({
        data: {
          projectId: self.id,
          source: 'julzops',
          kind: 'reconcile_usage',
          status: 'success',
          title: `Usage reconcile: ${rows.length} rows`,
          startedAt,
          endedAt: new Date(),
          durationMs,
          metadata: { upsertedModels, totalRows: rows.length },
        },
      })
    }

    return NextResponse.json({
      ok: true,
      rowsUpserted: rows.length,
      models: upsertedModels,
      durationMs,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const self = await prisma.project.findUnique({ where: { slug: 'julzops' } })
    if (self) {
      await prisma.event.create({
        data: {
          projectId: self.id,
          source: 'julzops',
          kind: 'reconcile_usage',
          status: 'failure',
          title: 'Usage reconcile failed',
          startedAt,
          endedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          metadata: { error: msg },
        },
      })
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
