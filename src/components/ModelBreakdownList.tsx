import { getModelMeta } from '@/lib/models'
import { formatUsd, formatTokens, formatPct } from '@/lib/format'
import type { ModelBreakdown } from '@/lib/analytics'

type Props = {
  rows: ModelBreakdown[]
  mode: 'usd' | 'tokens'
}

export function ModelBreakdownList({ rows, mode }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-pink-50/40 border border-pink-100 p-6 text-sm text-purple-600/60 text-center">
        No model data yet this month.
      </div>
    )
  }

  const values = rows.map((r) =>
    mode === 'usd' ? r.costUsd : r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens,
  )
  const total = values.reduce((a, b) => a + b, 0)
  const max = Math.max(...values, 1)

  return (
    <ul className="divide-y divide-pink-100/60">
      {rows.map((r, i) => {
        const meta = getModelMeta(r.model)
        const value = values[i]
        const pctOfMax = Math.max(1, (value / max) * 100)
        const pctOfTotal = total > 0 ? value / total : 0
        const display =
          mode === 'usd' ? formatUsd(r.costUsd) : formatTokens(value)
        return (
          <li key={r.model} className="py-3">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="text-sm text-purple-900 truncate">{meta.label}</span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0">
                <span className="text-sm font-medium text-purple-900">{display}</span>
                <span className="text-xs text-purple-600/60 w-10 text-right">
                  {formatPct(pctOfTotal)}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-pink-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pctOfMax}%`, backgroundColor: meta.color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
