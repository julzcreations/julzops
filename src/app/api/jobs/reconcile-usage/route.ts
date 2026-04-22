import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Hourly pull from Anthropic Cost API. Triggered by the GHA workflow at
// .github/workflows/anthropic-cost-sync.yml with Bearer CRON_SECRET auth.
// Fetches the current UTC month's per-workspace × per-description cost
// breakdown and upserts rows into AnthropicCost. Past days become immutable
// after UTC rollover + Anthropic's ~5min data-freshness window; today's rows
// get overwritten on each pull with the growing running total.
//
// Plan:  C:\Users\julie\.claude\plans\yes-and-i-have-resilient-meerkat.md
// Docs:  https://platform.claude.com/docs/en/build-with-claude/usage-cost-api

const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report'
const ANTHROPIC_API_VERSION = '2023-06-01'
const USER_AGENT = 'JulzOps/1.0.0 (+https://github.com/jw-yue/julzops)'
// Sentinel written in place of null Anthropic workspace_id so the composite PK
// (costDate, workspaceId, description) can dedupe default-workspace rows.
// (Postgres would otherwise treat NULL as distinct in a unique constraint,
// causing hourly inserts instead of upserts.)
const DEFAULT_WORKSPACE_SENTINEL = 'default'

// Response shape for /v1/organizations/cost_report. Anthropic's public docs
// don't publish the exact schema for the Cost API response; this is inferred
// from the Usage API (which has a documented schema) and from the Cost API
// grouping semantics. The parser below is defensive about missing fields.
type CostReportResult = {
  workspace_id: string | null
  description: string
  amount?: string
  currency?: string
  // Some groupings return a nested cost object; we handle either shape.
  cost?: { amount: string; currency: string }
}

type CostReportBucket = {
  starting_at: string
  ending_at: string
  results: CostReportResult[]
}

type CostReportResponse = {
  data: CostReportBucket[]
  has_more: boolean
  next_page?: string | null
}

function checkCronAuth(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}

function startOfCurrentMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function startOfTomorrowUTC(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
}

// Cost API returns monetary values as decimal strings "in lowest units (cents)"
// per the docs. Convert cents → USD, guarding against malformed payloads.
function parseCostUsd(result: CostReportResult): number | null {
  const raw = result.amount ?? result.cost?.amount
  if (raw == null) return null
  const cents = Number(raw)
  if (!Number.isFinite(cents)) return null
  return cents / 100
}

async function fetchCostPage(
  adminKey: string,
  startingAt: string,
  endingAt: string,
  page: string | null,
): Promise<CostReportResponse> {
  const params = new URLSearchParams({
    starting_at: startingAt,
    ending_at: endingAt,
  })
  params.append('group_by[]', 'workspace_id')
  params.append('group_by[]', 'description')
  if (page) params.set('page', page)

  const res = await fetch(`${COST_REPORT_URL}?${params.toString()}`, {
    headers: {
      'x-api-key': adminKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'User-Agent': USER_AGENT,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>')
    throw new Error(
      `Anthropic Cost API ${res.status}: ${body.slice(0, 500)}`,
    )
  }
  return (await res.json()) as CostReportResponse
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY
  if (!adminKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_ADMIN_API_KEY not configured' },
      { status: 500 },
    )
  }

  const now = new Date()
  const periodStart = startOfCurrentMonthUTC(now).toISOString()
  const periodEnd = startOfTomorrowUTC(now).toISOString()

  let page: string | null = null
  let apiCalls = 0
  let rowsUpserted = 0
  let skippedMalformed = 0
  const pulledAt = new Date()

  try {
    do {
      const resp = await fetchCostPage(adminKey, periodStart, periodEnd, page)
      apiCalls++

      for (const bucket of resp.data ?? []) {
        // Cost API buckets are always 1d; starting_at is UTC midnight of that day.
        const costDate = new Date(bucket.starting_at)
        if (Number.isNaN(costDate.getTime())) {
          skippedMalformed++
          continue
        }

        for (const result of bucket.results ?? []) {
          const costUsd = parseCostUsd(result)
          if (costUsd == null) {
            skippedMalformed++
            continue
          }
          const workspaceId = result.workspace_id ?? DEFAULT_WORKSPACE_SENTINEL
          const description = result.description

          await prisma.anthropicCost.upsert({
            where: {
              costDate_workspaceId_description: {
                costDate,
                workspaceId,
                description,
              },
            },
            create: {
              costDate,
              workspaceId,
              description,
              costUsd: new Prisma.Decimal(costUsd),
              pulledAt,
            },
            update: {
              costUsd: new Prisma.Decimal(costUsd),
              pulledAt,
            },
          })
          rowsUpserted++
        }
      }

      page = resp.has_more ? resp.next_page ?? null : null
    } while (page)

    return NextResponse.json({
      ok: true,
      periodStart,
      periodEnd,
      apiCalls,
      rowsUpserted,
      skippedMalformed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[reconcile-usage] anthropic cost pull failed:', message)
    return NextResponse.json(
      { error: 'anthropic_api_failure', message },
      { status: 502 },
    )
  }
}
