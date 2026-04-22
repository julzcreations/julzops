import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SignInCard } from '@/components/SignInCard'
import { DashboardView } from '@/components/DashboardView'
import { startOfTodayUTC } from '@/lib/format'
import {
  BUDGET_CEILING_USD,
  buildBudgetStatus,
  getAnthropicMtdForProject,
  getAnthropicMtdTotal,
  startOfMonthUTC,
} from '@/lib/analytics'
import {
  SCHEDULE_LABEL,
  SWIRL_PROJECT_SLUG,
  formatNextRun,
  nextSwirlRun,
} from '@/lib/swirl-series'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) return <SignInCard />

  const today = startOfTodayUTC()
  const monthStart = startOfMonthUTC()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Resolve the swirl-series project so we can scope queries to it.
  // findUnique avoids count-against-everyone-else pitfalls.
  const swirlProject = await prisma.project.findUnique({
    where: { slug: SWIRL_PROJECT_SLUG },
    select: { id: true },
  })

  const [
    runningCount,
    // Today's spend comes from AnthropicCost via the hourly Cost API pull.
    // Passing today-UTC as the range start reuses the MTD helper to mean
    // "sum from today 00:00 UTC to now" — same math, narrower window.
    todaySpendUsd,
    todayEventCount,
    // Month-to-date total drives the budget gauge. Authoritative from Anthropic.
    anthropicMtdUsd,
    // Swirl-specific MTD cost — resolves Swirlie workspace via Project.anthropicWorkspaceId.
    swirlMtdCostUsd,
    recentEvents,
    swirlRecentEvents,
    swirlLastSync,
    swirlPosted30dCount,
  ] = await Promise.all([
    prisma.event.count({ where: { status: 'running' } }),
    getAnthropicMtdTotal(today),
    prisma.event.count({ where: { startedAt: { gte: today } } }),
    getAnthropicMtdTotal(monthStart),
    getAnthropicMtdForProject(SWIRL_PROJECT_SLUG, monthStart),
    prisma.event.findMany({
      take: 20,
      orderBy: { startedAt: 'desc' },
      include: {
        project: { select: { name: true, slug: true, color: true } },
      },
    }),
    swirlProject
      ? prisma.event.findMany({
          where: { projectId: swirlProject.id },
          take: 5,
          orderBy: { startedAt: 'desc' },
        })
      : Promise.resolve([]),
    swirlProject
      ? prisma.event.findFirst({
          where: { projectId: swirlProject.id, kind: 'workflow_run' },
          orderBy: { startedAt: 'desc' },
        })
      : Promise.resolve(null),
    swirlProject
      ? prisma.event.count({
          where: {
            projectId: swirlProject.id,
            kind: 'workflow_run',
            status: 'success',
            startedAt: { gte: thirtyDaysAgo },
          },
        })
      : Promise.resolve(0),
  ])

  const budgetCeilingUsd = BUDGET_CEILING_USD
  const budget = buildBudgetStatus(anthropicMtdUsd, budgetCeilingUsd)

  const now = new Date()
  const next = nextSwirlRun(now)

  return (
    <DashboardView
      userEmail={session.user?.email ?? null}
      runningCount={runningCount}
      todaySpendUsd={todaySpendUsd}
      budgetCeilingUsd={budgetCeilingUsd}
      budget={budget}
      todayEventCount={todayEventCount}
      events={recentEvents.map((e) => ({
        id: e.id,
        title: e.title,
        source: e.source,
        kind: e.kind,
        status: e.status,
        url: e.url,
        startedAt: e.startedAt.toISOString(),
        durationMs: e.durationMs,
        metadata: e.metadata as Record<string, unknown> | null,
        project: e.project,
      }))}
      swirl={{
        schedule: SCHEDULE_LABEL,
        nextRunLabel: formatNextRun(next, now),
        nextRunAtIso: next.toISOString(),
        lastSync: swirlLastSync
          ? {
              id: swirlLastSync.id,
              title: swirlLastSync.title,
              status: swirlLastSync.status,
              url: swirlLastSync.url,
              startedAt: swirlLastSync.startedAt.toISOString(),
              metadata: swirlLastSync.metadata as Record<string, unknown> | null,
            }
          : null,
        recentEvents: swirlRecentEvents.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          url: e.url,
          startedAt: e.startedAt.toISOString(),
          metadata: e.metadata as Record<string, unknown> | null,
        })),
        posted30dCount: swirlPosted30dCount,
        mtdCostUsd: swirlMtdCostUsd,
      }}
    />
  )
}
