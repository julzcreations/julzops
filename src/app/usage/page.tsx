import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { ArrowDown, ArrowUp, Lightning, Database } from '@phosphor-icons/react/dist/ssr'
import { authOptions } from '@/lib/auth'
import {
  getDailyBuckets,
  getModelBreakdown,
  getMtdTotals,
  startOfMonthUTC,
} from '@/lib/analytics'
import { PageShell } from '@/components/PageShell'
import { DailyStackedChart, type DailyRow } from '@/components/DailyStackedChart'
import { ModelBreakdownList } from '@/components/ModelBreakdownList'
import { formatTokens, formatPct } from '@/lib/format'
import { sortModels } from '@/lib/models'

export const dynamic = 'force-dynamic'

export default async function UsagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const monthStart = startOfMonthUTC()
  const [totals, daily, byModel] = await Promise.all([
    getMtdTotals(monthStart),
    getDailyBuckets(monthStart),
    getModelBreakdown(monthStart),
  ])

  const models = sortModels(byModel.map((m) => m.model))
  const chartRows: DailyRow[] = daily.map((b) => {
    const row: DailyRow = { day: b.day }
    for (const m of models) row[m] = b.byModel[m]?.tokens ?? 0
    return row
  })

  const monthLabel = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <PageShell
      title="API usage"
      subtitle={`Month to date · ${monthLabel} · From instrumented scripts`}
      userEmail={session.user?.email ?? null}
    >
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroTile
          icon={<ArrowDown weight="duotone" size={22} />}
          label="Tokens in"
          value={formatTokens(totals.inputTokens)}
          hint={`${totals.inputTokens.toLocaleString()} total`}
        />
        <HeroTile
          icon={<ArrowUp weight="duotone" size={22} />}
          label="Tokens out"
          value={formatTokens(totals.outputTokens)}
          hint={`${totals.outputTokens.toLocaleString()} total`}
        />
        <HeroTile
          icon={<Database weight="duotone" size={22} />}
          label="Cache reads"
          value={formatTokens(totals.cacheReadTokens)}
          hint={`${formatTokens(totals.cacheWriteTokens)} writes`}
        />
        <HeroTile
          icon={<Lightning weight="duotone" size={22} />}
          label="Cache hit rate"
          value={formatPct(totals.cacheHitRate, 1)}
          hint="Reads / (reads + fresh input)"
        />
      </section>

      <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden mb-8">
        <div className="px-6 md:px-8 py-5 border-b border-pink-100">
          <h2 className="font-display text-xl text-purple-900">Daily token usage</h2>
          <p className="text-xs text-purple-600/60 mt-1">
            Total tokens (input + output + cache) stacked by model
          </p>
        </div>
        <div className="p-4 md:p-6">
          <DailyStackedChart rows={chartRows} models={models} unit="tokens" />
        </div>
      </section>

      <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card border border-pink-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-pink-100">
          <h2 className="font-display text-xl text-purple-900">By model</h2>
          <p className="text-xs text-purple-600/60 mt-1">Total tokens this month</p>
        </div>
        <div className="px-6 py-4">
          <ModelBreakdownList rows={byModel} mode="tokens" />
        </div>
      </section>
    </PageShell>
  )
}

function HeroTile({
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
