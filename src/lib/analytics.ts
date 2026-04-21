// Shared analytics queries for /costs, /usage, /logs, and home tiles.
// Groups CostSample rows by day + model and projects month-end spend from
// run-rate. Everything here assumes UTC day buckets — matches the Console.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// Single source of truth for Julie's self-imposed API credit ceiling.
// Override via JULZOPS_API_BUDGET_USD env var when the top-up size changes.
export const BUDGET_CEILING_USD = Number(process.env.JULZOPS_API_BUDGET_USD ?? 25)

export function startOfMonthUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function endOfMonthUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}

export function daysInMonthUTC(d = new Date()): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

export function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type MtdTotals = {
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cacheHitRate: number
  sampleCount: number
}

export async function getMtdTotals(monthStart = startOfMonthUTC()): Promise<MtdTotals> {
  const agg = await prisma.costSample.aggregate({
    _sum: {
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
    _count: { _all: true },
    where: { sampledAt: { gte: monthStart } },
  })

  const inputTokens = agg._sum.inputTokens ?? 0
  const cacheReadTokens = agg._sum.cacheReadTokens ?? 0
  const hitDenom = inputTokens + cacheReadTokens
  const cacheHitRate = hitDenom > 0 ? cacheReadTokens / hitDenom : 0

  return {
    costUsd: Number(agg._sum.costUsd ?? 0),
    inputTokens,
    outputTokens: agg._sum.outputTokens ?? 0,
    cacheReadTokens,
    cacheWriteTokens: agg._sum.cacheWriteTokens ?? 0,
    cacheHitRate,
    sampleCount: agg._count._all,
  }
}

export type BudgetStatus = {
  ceilingUsd: number
  spentUsd: number
  remainingUsd: number
  pctSpent: number
  pctRemaining: number
  projectedUsd: number
  dayOfMonth: number
  daysInMonth: number
}

export function buildBudgetStatus(
  spentUsd: number,
  ceilingUsd: number,
  now = new Date(),
): BudgetStatus {
  const dayOfMonth = now.getUTCDate()
  const daysInMonth = daysInMonthUTC(now)
  const pctSpent = ceilingUsd > 0 ? Math.min(100, (spentUsd / ceilingUsd) * 100) : 0
  const projectedUsd = dayOfMonth > 0 ? (spentUsd / dayOfMonth) * daysInMonth : 0
  return {
    ceilingUsd,
    spentUsd,
    remainingUsd: Math.max(0, ceilingUsd - spentUsd),
    pctSpent,
    pctRemaining: 100 - pctSpent,
    projectedUsd,
    dayOfMonth,
    daysInMonth,
  }
}

export type DailyBucket = {
  day: string // YYYY-MM-DD (UTC)
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  byModel: Record<string, { costUsd: number; tokens: number }>
}

// Daily buckets from `from` through today (inclusive), with every day present
// even if zero spend — gives the chart a continuous x-axis.
export async function getDailyBuckets(from: Date, now = new Date()): Promise<DailyBucket[]> {
  const rows = await prisma.costSample.findMany({
    where: { sampledAt: { gte: from } },
    select: {
      model: true,
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      sampledAt: true,
    },
  })

  const buckets = new Map<string, DailyBucket>()
  // Seed empty buckets.
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const endInclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  while (cursor <= endInclusive) {
    const key = toDayKey(cursor)
    buckets.set(key, {
      day: key,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      byModel: {},
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  for (const row of rows) {
    const key = toDayKey(row.sampledAt)
    const b = buckets.get(key)
    if (!b) continue
    const cost = Number(row.costUsd)
    const tokens = row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens
    b.costUsd += cost
    b.inputTokens += row.inputTokens
    b.outputTokens += row.outputTokens
    b.cacheReadTokens += row.cacheReadTokens
    b.cacheWriteTokens += row.cacheWriteTokens
    const m = b.byModel[row.model] ?? { costUsd: 0, tokens: 0 }
    m.costUsd += cost
    m.tokens += tokens
    b.byModel[row.model] = m
  }

  return Array.from(buckets.values()).sort((a, b) => (a.day < b.day ? -1 : 1))
}

export type ModelBreakdown = {
  model: string
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  sampleCount: number
}

export async function getModelBreakdown(from: Date): Promise<ModelBreakdown[]> {
  const grouped = await prisma.costSample.groupBy({
    by: ['model'],
    _sum: {
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
    _count: { _all: true },
    where: { sampledAt: { gte: from } },
  })

  return grouped
    .map((g) => ({
      model: g.model,
      costUsd: Number(g._sum.costUsd ?? 0),
      inputTokens: g._sum.inputTokens ?? 0,
      outputTokens: g._sum.outputTokens ?? 0,
      cacheReadTokens: g._sum.cacheReadTokens ?? 0,
      cacheWriteTokens: g._sum.cacheWriteTokens ?? 0,
      sampleCount: g._count._all,
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
}

export type ProjectBreakdown = {
  projectId: string
  slug: string
  name: string
  color: string | null
  costUsd: number
  sampleCount: number
}

export async function getProjectBreakdown(from: Date): Promise<ProjectBreakdown[]> {
  const grouped = await prisma.costSample.groupBy({
    by: ['projectId'],
    _sum: { costUsd: true },
    _count: { _all: true },
    where: { sampledAt: { gte: from }, projectId: { not: null } },
  })

  const projectIds = grouped.map((g) => g.projectId).filter((id): id is string => id !== null)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, slug: true, name: true, color: true },
  })
  const byId = new Map(projects.map((p) => [p.id, p]))

  return grouped
    .flatMap((g) => {
      if (!g.projectId) return []
      const proj = byId.get(g.projectId)
      if (!proj) return []
      return [{
        projectId: g.projectId,
        slug: proj.slug,
        name: proj.name,
        color: proj.color,
        costUsd: Number(g._sum.costUsd ?? 0),
        sampleCount: g._count._all,
      }]
    })
    .sort((a, b) => b.costUsd - a.costUsd)
}

// Per-run log row — one Event + its CostSample children rolled up.
export type RunLogRow = {
  id: string
  startedAt: string
  title: string
  status: string
  source: string
  url: string | null
  durationMs: number | null
  project: { slug: string; name: string; color: string | null }
  primaryModel: string | null
  models: string[]
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
}

export type RunLogFilter = {
  projectSlug?: string
  status?: string
  model?: string
  take?: number
  skip?: number
}

export async function getRunLogs(filter: RunLogFilter = {}): Promise<{ rows: RunLogRow[]; total: number }> {
  const take = Math.min(filter.take ?? 25, 100)
  const skip = filter.skip ?? 0

  const where: Prisma.EventWhereInput = { kind: 'workflow_run' }
  if (filter.status) where.status = filter.status
  if (filter.projectSlug) where.project = { slug: filter.projectSlug }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take,
      skip,
      include: { project: { select: { slug: true, name: true, color: true } } },
    }),
    prisma.event.count({ where }),
  ])

  // Pull CostSamples within the run's time window by project. Since ingest
  // writes CostSample.sampledAt = event.startedAt, exact-match is reliable.
  const startedAts = events.map((e) => e.startedAt)
  const projectIds = Array.from(new Set(events.map((e) => e.projectId)))
  const samples = await prisma.costSample.findMany({
    where: {
      sampledAt: { in: startedAts },
      projectId: { in: projectIds },
    },
    select: {
      projectId: true,
      sampledAt: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      costUsd: true,
    },
  })

  // Index samples by (projectId|sampledAt ISO).
  const sampleIdx = new Map<string, typeof samples>()
  for (const s of samples) {
    const key = `${s.projectId}|${s.sampledAt.toISOString()}`
    const list = sampleIdx.get(key) ?? []
    list.push(s)
    sampleIdx.set(key, list)
  }

  const rows: RunLogRow[] = events.map((e) => {
    const key = `${e.projectId}|${e.startedAt.toISOString()}`
    const runSamples = sampleIdx.get(key) ?? []
    const totals = runSamples.reduce(
      (acc, s) => ({
        inputTokens: acc.inputTokens + s.inputTokens,
        outputTokens: acc.outputTokens + s.outputTokens,
        cacheReadTokens: acc.cacheReadTokens + s.cacheReadTokens,
        cacheWriteTokens: acc.cacheWriteTokens + s.cacheWriteTokens,
        costUsd: acc.costUsd + Number(s.costUsd),
      }),
      { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
    )
    const models = runSamples.map((s) => s.model)
    // Primary model = highest-cost model on the run.
    const primary = [...runSamples].sort((a, b) => Number(b.costUsd) - Number(a.costUsd))[0]
    const meta = e.metadata as Record<string, unknown> | null
    const metaCost = meta && typeof meta.totalCostUsd === 'number' ? meta.totalCostUsd : null
    return {
      id: e.id,
      startedAt: e.startedAt.toISOString(),
      title: e.title,
      status: e.status,
      source: e.source,
      url: e.url,
      durationMs: e.durationMs,
      project: e.project,
      primaryModel: primary?.model ?? null,
      models,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
      // Fall back to event metadata total if sample lookup missed.
      costUsd: totals.costUsd > 0 ? totals.costUsd : metaCost ?? 0,
    }
  })

  if (filter.model) {
    // Model filter applies after aggregation since a run may use multiple.
    const filtered = rows.filter((r) => r.models.includes(filter.model!))
    return { rows: filtered, total: filtered.length }
  }

  return { rows, total }
}

export async function getAllKnownProjects(): Promise<Array<{ slug: string; name: string }>> {
  const rows = await prisma.project.findMany({
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function getAllKnownModels(from: Date): Promise<string[]> {
  const rows = await prisma.costSample.findMany({
    where: { sampledAt: { gte: from } },
    select: { model: true },
    distinct: ['model'],
  })
  return rows.map((r) => r.model)
}
