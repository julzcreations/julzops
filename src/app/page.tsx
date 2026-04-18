import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SignInCard } from '@/components/SignInCard'
import { DashboardView } from '@/components/DashboardView'
import { startOfTodayUTC } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) return <SignInCard />

  const today = startOfTodayUTC()

  const [runningCount, todaySpendAgg, todayEventCount, recentEvents] = await Promise.all([
    prisma.event.count({ where: { status: 'running' } }),
    prisma.costSample.aggregate({
      _sum: { costUsd: true },
      where: { sampledAt: { gte: today } },
    }),
    prisma.event.count({ where: { startedAt: { gte: today } } }),
    prisma.event.findMany({
      take: 20,
      orderBy: { startedAt: 'desc' },
      include: {
        project: { select: { name: true, slug: true, color: true } },
      },
    }),
  ])

  const todaySpendUsd = todaySpendAgg._sum.costUsd ? Number(todaySpendAgg._sum.costUsd) : 0
  const budgetCeilingUsd = 100

  return (
    <DashboardView
      userEmail={session.user?.email ?? null}
      runningCount={runningCount}
      todaySpendUsd={todaySpendUsd}
      budgetCeilingUsd={budgetCeilingUsd}
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
    />
  )
}
