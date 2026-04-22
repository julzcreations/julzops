'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  SignOut,
  Heartbeat,
  Coffee,
  ChartLine,
  ArrowSquareOut,
  CheckCircle,
  XCircle,
  Circle,
  Clock,
  Gear,
} from '@phosphor-icons/react'
import { formatUsd, formatDuration, formatRelative } from '@/lib/format'
import { SwirlSeriesCard, type SwirlEvent } from '@/components/SwirlSeriesCard'
import { BudgetRemainingTile } from '@/components/BudgetRemainingTile'
import { NavTabs } from '@/components/NavTabs'
import type { BudgetStatus } from '@/lib/analytics'

type EventRow = {
  id: string
  title: string
  source: string
  kind: string
  status: string
  url: string | null
  startedAt: string
  durationMs: number | null
  metadata: Record<string, unknown> | null
  project: { name: string; slug: string; color: string | null }
}

type SwirlSection = {
  schedule: string
  nextRunLabel: string
  nextRunAtIso: string
  lastSync: SwirlEvent | null
  recentEvents: SwirlEvent[]
  posted30dCount: number
  mtdCostUsd: number
}

type Props = {
  userEmail: string | null
  runningCount: number
  todaySpendUsd: number
  budgetCeilingUsd: number
  budget: BudgetStatus
  todayEventCount: number
  events: EventRow[]
  swirl: SwirlSection
}

export function DashboardView({
  userEmail,
  runningCount,
  todaySpendUsd,
  budgetCeilingUsd,
  budget,
  todayEventCount,
  events,
  swirl,
}: Props) {
  const spendPct = Math.min(100, (todaySpendUsd / budgetCeilingUsd) * 100)
  const spendHint =
    spendPct < 1
      ? `Of ${formatUsd(budgetCeilingUsd)} ceiling`
      : `${spendPct.toFixed(1)}% of ${formatUsd(budgetCeilingUsd)}`

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-widest text-pink-600 mb-1">JulzOps</div>
          <h1 className="font-display text-3xl md:text-4xl text-purple-900">Today</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-purple-700/70">
          <span className="hidden md:inline font-mono text-xs text-pink-700">{userEmail}</span>
          <Link
            href="/settings"
            className="flex items-center gap-2 hover:text-pink-600 transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <Gear size={16} />
            <span className="hidden md:inline">Settings</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-2 hover:text-pink-600 transition-colors"
          >
            <SignOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <NavTabs />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Tile
          icon={<Heartbeat weight="duotone" size={22} />}
          label="Running now"
          value={runningCount.toString()}
          hint={runningCount === 0 ? 'Nothing spinning' : `${runningCount} in flight`}
        />
        <Tile
          icon={<Coffee weight="duotone" size={22} />}
          label="Today's spend"
          value={formatUsd(todaySpendUsd)}
          hint={spendHint}
        />
        <Tile
          icon={<ChartLine weight="duotone" size={22} />}
          label="Events today"
          value={todayEventCount.toString()}
          hint={todayEventCount === 0 ? 'No activity yet' : 'Since 00:00 UTC'}
        />
        <BudgetRemainingTile budget={budget} />
      </section>

      <SwirlSeriesCard
        schedule={swirl.schedule}
        nextRunLabel={swirl.nextRunLabel}
        nextRunAtIso={swirl.nextRunAtIso}
        lastSync={swirl.lastSync}
        recentEvents={swirl.recentEvents}
        posted30dCount={swirl.posted30dCount}
        mtdCostUsd={swirl.mtdCostUsd}
      />

      <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-pink-100">
          <h2 className="font-display text-xl text-purple-900">Recent activity</h2>
          <p className="text-xs text-purple-600/60 mt-1">Last 20 events across all projects</p>
        </div>
        {events.length === 0 ? (
          <div className="p-10 text-center text-purple-600/60 text-sm">
            No events yet. The first Swirl Series run will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-pink-100/60">
            {events.map((e) => (
              <EventRowItem key={e.id} event={e} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-3xl bg-white/70 backdrop-blur-sm shadow-card p-6 border border-pink-100 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-2 text-purple-600 text-sm mb-3">
        {icon}
        <span className="uppercase tracking-wide text-xs">{label}</span>
      </div>
      <div className="font-display text-3xl text-purple-900 mb-1">{value}</div>
      <div className="text-xs text-purple-600/60">{hint}</div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  const size = 18
  if (status === 'success') return <CheckCircle weight="fill" size={size} className="text-purple-500" />
  if (status === 'failure') return <XCircle weight="fill" size={size} className="text-pink-600" />
  if (status === 'running') return <Circle weight="fill" size={size} className="text-amber-400 animate-pulse" />
  return <Clock weight="fill" size={size} className="text-purple-300" />
}

function EventRowItem({ event }: { event: EventRow }) {
  const cost = event.metadata && typeof event.metadata === 'object'
    ? (event.metadata as Record<string, unknown>).totalCostUsd
    : null
  const costNum = typeof cost === 'number' ? cost : null
  const color = event.project.color ?? '#a78bfa'
  return (
    <li className={`px-6 md:px-8 py-4 hover:bg-pink-50/40 transition-colors ${event.status === 'failure' ? 'bg-pink-50/60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <StatusIcon status={event.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="text-xs uppercase tracking-wide text-purple-600/80">
              {event.project.name}
            </span>
            <span className="text-xs text-purple-400">·</span>
            <span className="text-xs text-purple-500/70">{event.source}</span>
          </div>
          <div className="text-sm text-purple-900 font-medium truncate">{event.title}</div>
          <div className="flex items-center gap-3 mt-1 text-xs text-purple-600/70">
            <span>{formatRelative(new Date(event.startedAt))}</span>
            {event.durationMs ? <span>· {formatDuration(event.durationMs)}</span> : null}
            {costNum !== null ? <span>· {formatUsd(costNum)}</span> : null}
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-pink-600 hover:text-pink-700"
              >
                View run <ArrowSquareOut size={12} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}
