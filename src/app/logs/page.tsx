import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowSquareOut,
  CheckCircle,
  XCircle,
  Circle,
  Clock,
} from '@phosphor-icons/react/dist/ssr'
import { authOptions } from '@/lib/auth'
import {
  getAllKnownModels,
  getAllKnownProjects,
  getRunLogs,
  startOfMonthUTC,
} from '@/lib/analytics'
import { PageShell } from '@/components/PageShell'
import { LogsFilters } from '@/components/LogsFilters'
import { formatUsd, formatTokens, formatDuration, formatRelative } from '@/lib/format'
import { getModelMeta } from '@/lib/models'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

type PageProps = {
  searchParams: { project?: string; status?: string; model?: string; page?: string }
}

export default async function LogsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const pageNum = Math.max(1, Number(searchParams.page) || 1)
  const skip = (pageNum - 1) * PAGE_SIZE

  const [logs, projects, models] = await Promise.all([
    getRunLogs({
      projectSlug: searchParams.project,
      status: searchParams.status,
      model: searchParams.model,
      take: PAGE_SIZE,
      skip,
    }),
    getAllKnownProjects(),
    getAllKnownModels(startOfMonthUTC()),
  ])

  const hasMore = logs.rows.length === PAGE_SIZE

  const buildPageHref = (p: number) => {
    const next = new URLSearchParams()
    if (searchParams.project) next.set('project', searchParams.project)
    if (searchParams.status) next.set('status', searchParams.status)
    if (searchParams.model) next.set('model', searchParams.model)
    if (p > 1) next.set('page', String(p))
    return `/logs${next.toString() ? `?${next}` : ''}`
  }

  return (
    <PageShell
      title="Logs"
      subtitle="Per-run history across all projects"
      userEmail={session.user?.email ?? null}
    >
      <div className="mb-6">
        <LogsFilters projects={projects} models={models} />
      </div>

      {logs.rows.length === 0 ? (
        <div className="rounded-3xl bg-white/60 border border-pink-100 p-10 text-center text-sm text-purple-600/60">
          No runs match these filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-purple-600/70 border-b border-pink-100 bg-pink-50/40">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium text-right">In</th>
                  <th className="px-4 py-3 font-medium text-right">Out</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100/60">
                {logs.rows.map((r) => {
                  const meta = r.primaryModel ? getModelMeta(r.primaryModel) : null
                  const projColor = r.project.color ?? '#a78bfa'
                  return (
                    <tr key={r.id} className={r.status === 'failure' ? 'bg-pink-50/60' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-purple-600/80">
                        {formatRelative(new Date(r.startedAt))}
                        <div className="text-[11px] text-purple-500/60 font-mono">
                          {r.startedAt.replace('T', ' ').slice(0, 19)} UTC
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: projColor }}
                          />
                          <span className="text-purple-900">{r.project.name}</span>
                        </div>
                        <div className="text-[11px] text-purple-600/60 truncate max-w-[240px]">
                          {r.title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {meta ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="text-purple-900">{meta.label}</span>
                            {r.models.length > 1 ? (
                              <span className="text-[11px] text-purple-500/60">
                                +{r.models.length - 1}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-purple-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-900">
                        {formatTokens(r.inputTokens + r.cacheReadTokens)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-900">
                        {formatTokens(r.outputTokens)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-purple-900">
                        {formatUsd(r.costUsd)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                        {r.durationMs ? (
                          <div className="text-[11px] text-purple-500/60 mt-0.5">
                            {formatDuration(r.durationMs)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 text-xs"
                          >
                            View <ArrowSquareOut size={12} />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-3">
            {logs.rows.map((r) => {
              const meta = r.primaryModel ? getModelMeta(r.primaryModel) : null
              const projColor = r.project.color ?? '#a78bfa'
              return (
                <li
                  key={r.id}
                  className={[
                    'rounded-2xl bg-white/70 backdrop-blur-sm shadow-card border p-4',
                    r.status === 'failure' ? 'border-pink-300 bg-pink-50/70' : 'border-pink-100',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: projColor }}
                      />
                      <span className="text-xs uppercase tracking-wide text-purple-600/80 truncate">
                        {r.project.name}
                      </span>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-sm text-purple-900 font-medium mb-2 truncate">
                    {r.title}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-purple-600/80 mb-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-purple-500/60">
                        In
                      </div>
                      <div className="font-mono text-purple-900">
                        {formatTokens(r.inputTokens + r.cacheReadTokens)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-purple-500/60">
                        Out
                      </div>
                      <div className="font-mono text-purple-900">
                        {formatTokens(r.outputTokens)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-purple-500/60">
                        Cost
                      </div>
                      <div className="font-medium text-purple-900">{formatUsd(r.costUsd)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-purple-600/70">
                    <div className="flex items-center gap-2">
                      <span>{formatRelative(new Date(r.startedAt))}</span>
                      {meta ? (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            {meta.label}
                          </span>
                        </>
                      ) : null}
                      {r.durationMs ? <span>· {formatDuration(r.durationMs)}</span> : null}
                    </div>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-pink-600"
                      >
                        View <ArrowSquareOut size={12} />
                      </a>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>

          <nav className="flex items-center justify-between mt-6 text-sm">
            <span className="text-purple-600/70">
              Page {pageNum}
              {logs.total ? ` of ~${Math.ceil(logs.total / PAGE_SIZE)}` : ''}
            </span>
            <div className="flex gap-2">
              {pageNum > 1 ? (
                <Link
                  href={buildPageHref(pageNum - 1)}
                  className="px-3 py-1.5 rounded-xl border border-pink-100 bg-white/70 text-purple-900 hover:bg-white"
                >
                  ← Previous
                </Link>
              ) : null}
              {hasMore ? (
                <Link
                  href={buildPageHref(pageNum + 1)}
                  className="px-3 py-1.5 rounded-xl border border-pink-100 bg-white/70 text-purple-900 hover:bg-white"
                >
                  Next →
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </PageShell>
  )
}

function StatusPill({ status }: { status: string }) {
  const common = 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full'
  if (status === 'success')
    return (
      <span className={`${common} bg-purple-100 text-purple-800`}>
        <CheckCircle weight="fill" size={12} /> Success
      </span>
    )
  if (status === 'failure')
    return (
      <span className={`${common} bg-pink-100 text-pink-800`}>
        <XCircle weight="fill" size={12} /> Failure
      </span>
    )
  if (status === 'running')
    return (
      <span className={`${common} bg-amber-100 text-amber-800`}>
        <Circle weight="fill" size={12} className="animate-pulse" /> Running
      </span>
    )
  return (
    <span className={`${common} bg-pink-50 text-purple-700`}>
      <Clock weight="fill" size={12} /> {status}
    </span>
  )
}
