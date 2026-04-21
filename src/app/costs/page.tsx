import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Coffee, MagnifyingGlass, Code, ClockCountdown } from '@phosphor-icons/react/dist/ssr'
import { authOptions } from '@/lib/auth'
import {
  BUDGET_CEILING_USD,
  buildBudgetStatus,
  getDailyBuckets,
  getModelBreakdown,
  getMtdTotals,
  getProjectBreakdown,
  startOfMonthUTC,
} from '@/lib/analytics'
import { PageShell } from '@/components/PageShell'
import { DailyStackedChart, type DailyRow } from '@/components/DailyStackedChart'
import { ModelBreakdownList } from '@/components/ModelBreakdownList'
import { BudgetRemainingTile } from '@/components/BudgetRemainingTile'
import { formatUsd } from '@/lib/format'
import { sortModels } from '@/lib/models'

export const dynamic = 'force-dynamic'

export default async function CostsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const monthStart = startOfMonthUTC()
  const [totals, daily, byModel, byProject] = await Promise.all([
    getMtdTotals(monthStart),
    getDailyBuckets(monthStart),
    getModelBreakdown(monthStart),
    getProjectBreakdown(monthStart),
  ])

  const budget = buildBudgetStatus(totals.costUsd, BUDGET_CEILING_USD)

  const models = sortModels(byModel.map((m) => m.model))
  const chartRows: DailyRow[] = daily.map((b) => {
    const row: DailyRow = { day: b.day }
    for (const m of models) row[m] = b.byModel[m]?.costUsd ?? 0
    return row
  })

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <PageShell
      title="API cost"
      subtitle={`Month to date · ${monthLabel} · From instrumented scripts`}
      userEmail={session.user?.email ?? null}
    >
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroTile
          icon={<Coffee weight="duotone" size={22} />}
          label="Total token cost"
          value={formatUsd(totals.costUsd)}
          hint={`${totals.sampleCount} samples`}
        />
        <HeroTile
          icon={<MagnifyingGlass weight="duotone" size={22} />}
          label="Web search cost"
          value="—"
          hint="Not tracked by sync.py"
          muted
        />
        <HeroTile
          icon={<Code weight="duotone" size={22} />}
          label="Code execution"
          value="—"
          hint="Not tracked by sync.py"
          muted
        />
        <HeroTile
          icon={<ClockCountdown weight="duotone" size={22} />}
          label="Session runtime"
          value="—"
          hint="Not tracked by sync.py"
          muted
        />
      </section>

      <section className="mb-8">
        <BudgetRemainingTile budget={budget} />
      </section>

      <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden mb-8">
        <div className="px-6 md:px-8 py-5 border-b border-pink-100">
          <h2 className="font-display text-xl text-purple-900">Daily token cost</h2>
          <p className="text-xs text-purple-600/60 mt-1">Stacked by model, UTC days</p>
        </div>
        <div className="p-4 md:p-6">
          <DailyStackedChart rows={chartRows} models={models} unit="usd" />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="By model" subtitle="Month to date">
          <ModelBreakdownList rows={byModel} mode="usd" />
        </Card>
        <Card title="By project" subtitle="Month to date">
          {byProject.length === 0 ? (
            <div className="rounded-2xl bg-pink-50/40 border border-pink-100 p-6 text-sm text-purple-600/60 text-center">
              No project activity yet this month.
            </div>
          ) : (
            <ul className="divide-y divide-pink-100/60">
              {byProject.map((p) => {
                const pct = totals.costUsd > 0 ? (p.costUsd / totals.costUsd) * 100 : 0
                const color = p.color ?? '#a78bfa'
                return (
                  <li key={p.projectId} className="py-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="text-sm text-purple-900 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-medium text-purple-900">
                          {formatUsd(p.costUsd)}
                        </span>
                        <span className="text-xs text-purple-600/60 w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-pink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(1, pct)}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="text-[11px] text-purple-600/60 mt-1">
                      {p.sampleCount} sample{p.sampleCount === 1 ? '' : 's'}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </section>
    </PageShell>
  )
}

function HeroTile({
  icon,
  label,
  value,
  hint,
  muted,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  muted?: boolean
}) {
  return (
    <div
      className={[
        'rounded-3xl backdrop-blur-sm shadow-card p-6 border transition-shadow',
        muted
          ? 'bg-white/40 border-pink-100/60'
          : 'bg-white/70 border-pink-100 hover:shadow-card-hover',
      ].join(' ')}
    >
      <div className={`flex items-center gap-2 text-sm mb-3 ${muted ? 'text-purple-400' : 'text-purple-600'}`}>
        {icon}
        <span className="uppercase tracking-wide text-xs">{label}</span>
      </div>
      <div className={`font-display text-3xl mb-1 ${muted ? 'text-purple-400' : 'text-purple-900'}`}>
        {value}
      </div>
      <div className="text-xs text-purple-600/60">{hint}</div>
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-pink-100">
        <h2 className="font-display text-xl text-purple-900">{title}</h2>
        {subtitle ? <p className="text-xs text-purple-600/60 mt-1">{subtitle}</p> : null}
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  )
}
