'use client'

import { useState } from 'react'
import {
  ArrowsClockwise,
  Sparkle,
  ArrowSquareOut,
  CheckCircle,
  XCircle,
  Clock,
  WarningCircle,
  Calendar,
} from '@phosphor-icons/react'
import { formatRelative, formatUsd } from '@/lib/format'

export type SwirlEvent = {
  id: string
  title: string
  status: string
  url: string | null
  startedAt: string
  metadata: Record<string, unknown> | null
}

type Props = {
  schedule: string
  nextRunLabel: string
  nextRunAtIso: string
  lastSync: SwirlEvent | null
  recentEvents: SwirlEvent[]
  posted30dCount: number
  /** Month-to-date cost for the Swirlie workspace from the Anthropic Cost API. */
  mtdCostUsd: number
}

export function SwirlSeriesCard({
  schedule,
  nextRunLabel,
  nextRunAtIso,
  lastSync,
  recentEvents,
  posted30dCount,
  mtdCostUsd,
}: Props) {
  const lastSyncMeta = (lastSync?.metadata ?? {}) as Record<string, unknown>
  const reconciled = countMetadata(lastSyncMeta, [
    'metricsRefreshed',
    'promotedToPosted',
    'twinsCreated',
    'othersCreated',
  ])
  const warnings = countMetadata(lastSyncMeta, ['unmatchedWarnings', 'agedOutToSkipped'])
  const errors = Array.isArray(lastSyncMeta.errors) ? lastSyncMeta.errors.length : 0

  return (
    <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden mb-10">
      <div className="px-6 md:px-8 py-5 border-b border-pink-100 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: '#ff8fab' }}
              aria-hidden
            />
            <h2 className="font-display text-xl text-purple-900">Swirl Series</h2>
          </div>
          <p className="text-xs text-purple-600/60 mt-1 flex items-center gap-1.5">
            <Calendar size={12} weight="duotone" />
            {schedule}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-purple-600/80">Next run</div>
          <div
            className="font-mono text-sm text-purple-900"
            title={new Date(nextRunAtIso).toUTCString()}
          >
            {nextRunLabel}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-pink-100/60">
        <SmallTile
          icon={<StatusBadge status={lastSync?.status ?? 'idle'} />}
          label="Last sync"
          value={lastSync ? formatRelative(new Date(lastSync.startedAt)) : 'No runs yet'}
          hint={
            lastSync
              ? `${reconciled} reconciled · ${warnings} warnings${errors ? ` · ${errors} errors` : ''}`
              : 'First run hasn’t fired'
          }
          link={lastSync?.url ?? null}
        />
        <SmallTile
          icon={<ArrowsClockwise size={18} weight="duotone" className="text-purple-500" />}
          label="Posted (30d)"
          value={posted30dCount.toString()}
          hint="Swirl Series + other categories"
        />
        <SmallTile
          icon={<Sparkle size={18} weight="duotone" className="text-pink-500" />}
          label="MTD cost"
          value={formatUsd(mtdCostUsd)}
          hint="Anthropic API, month-to-date"
        />
      </div>

      <div className="px-6 md:px-8 py-5 border-b border-pink-100/60">
        <div className="text-xs uppercase tracking-wide text-purple-600/80 mb-3">Manual triggers</div>
        <div className="flex flex-wrap gap-3">
          <TriggerButton kind="refresh" label="Refresh metrics now" />
          <TriggerButton kind="regen" label="Re-examine + regen now" />
        </div>
        <p className="text-xs text-purple-600/60 mt-3">
          Re-examine fires the workflow with <code className="font-mono">force_regen=true</code>, which
          drafts a fresh Scripted row even on non-script-gen days. Use after an off-script post.
        </p>
      </div>

      <div className="px-6 md:px-8 py-5">
        <div className="text-xs uppercase tracking-wide text-purple-600/80 mb-3">Recent activity</div>
        {recentEvents.length === 0 ? (
          <div className="text-sm text-purple-600/60">No Swirl Series runs recorded yet.</div>
        ) : (
          <ul className="space-y-2">
            {recentEvents.map((e) => (
              <ActivityRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const size = 18
  if (status === 'success') return <CheckCircle weight="fill" size={size} className="text-purple-500" />
  if (status === 'failure') return <XCircle weight="fill" size={size} className="text-pink-600" />
  if (status === 'running')
    return <Clock weight="fill" size={size} className="text-amber-400 animate-pulse" />
  return <Clock weight="fill" size={size} className="text-purple-300" />
}

function SmallTile({
  icon,
  label,
  value,
  hint,
  link,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  link?: string | null
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="uppercase tracking-wide text-xs text-purple-600/80">{label}</span>
      </div>
      <div className="font-display text-lg text-purple-900 leading-tight">{value}</div>
      <div className="text-xs text-purple-600/60 mt-1">{hint}</div>
    </>
  )
  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl bg-white/50 p-4 border border-pink-100/60 hover:bg-pink-50/50 transition-colors"
      >
        {inner}
      </a>
    )
  }
  return (
    <div className="rounded-2xl bg-white/50 p-4 border border-pink-100/60">{inner}</div>
  )
}

function TriggerButton({ kind, label }: { kind: 'refresh' | 'regen'; label: string }) {
  const [state, setState] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const [runsUrl, setRunsUrl] = useState<string | null>(null)

  const onClick = async () => {
    setState('pending')
    setMessage('')
    try {
      const r = await fetch('/api/swirl-series/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const json = (await r.json()) as { ok?: boolean; runsUrl?: string; error?: string }
      if (json.ok) {
        setState('ok')
        setMessage('Workflow dispatched.')
        setRunsUrl(json.runsUrl ?? null)
      } else {
        setState('error')
        setMessage(json.error ?? 'Trigger failed.')
      }
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  const baseClass =
    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50'
  const styleClass =
    kind === 'regen'
      ? 'bg-pink-600 text-white hover:bg-pink-700'
      : 'bg-purple-100 text-purple-900 hover:bg-purple-200'
  const Icon = kind === 'regen' ? Sparkle : ArrowsClockwise

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={state === 'pending'}
        className={`${baseClass} ${styleClass}`}
      >
        <Icon size={14} weight="duotone" />
        {state === 'pending' ? 'Dispatching…' : label}
      </button>
      {state !== 'idle' && (
        <div
          className={`text-xs flex items-center gap-1 ${
            state === 'error' ? 'text-pink-700' : 'text-purple-700'
          }`}
        >
          {state === 'error' && <WarningCircle size={12} weight="fill" />}
          <span>{message}</span>
          {runsUrl && (
            <a
              href={runsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-600 hover:text-pink-700"
            >
              View runs <ArrowSquareOut size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function ActivityRow({ event }: { event: SwirlEvent }) {
  const meta = (event.metadata ?? {}) as Record<string, unknown>
  const summary = describeRunMetadata(meta)
  return (
    <li className="flex items-start gap-3 py-1.5">
      <div className="mt-0.5">
        <StatusBadge status={event.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-purple-900 truncate">{event.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-purple-600/70">
          <span>{formatRelative(new Date(event.startedAt))}</span>
          {summary && <span>· {summary}</span>}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-pink-600 hover:text-pink-700"
            >
              Run <ArrowSquareOut size={10} />
            </a>
          )}
        </div>
      </div>
    </li>
  )
}

// ---- Metadata helpers ----

function countMetadata(meta: Record<string, unknown>, keys: string[]): number {
  let total = 0
  for (const k of keys) {
    const v = meta[k]
    if (typeof v === 'number') total += v
  }
  return total
}

function describeRunMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = []
  const refreshed = numOrZero(meta.metricsRefreshed)
  const promoted = numOrZero(meta.promotedToPosted)
  const twins = numOrZero(meta.twinsCreated)
  const others = numOrZero(meta.othersCreated)
  const aged = numOrZero(meta.agedOutToSkipped)
  if (refreshed) parts.push(`${refreshed} refreshed`)
  if (promoted) parts.push(`${promoted} promoted`)
  if (twins) parts.push(`${twins} off-script twin${twins === 1 ? '' : 's'}`)
  if (others) parts.push(`${others} other${others === 1 ? '' : 's'}`)
  if (aged) parts.push(`${aged} aged out`)
  if (meta.newScriptRow && typeof meta.newScriptRow === 'object') {
    const nsr = meta.newScriptRow as { reelNum?: number; slotDate?: string }
    parts.push(`new script for slot ${nsr.slotDate ?? '?'} (#${nsr.reelNum ?? '?'})`)
  }
  return parts.join(' · ')
}

function numOrZero(v: unknown): number {
  return typeof v === 'number' ? v : 0
}
