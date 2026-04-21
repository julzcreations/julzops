'use client'

import Link from 'next/link'
import { Wallet, ArrowRight } from '@phosphor-icons/react'
import { formatUsd } from '@/lib/format'
import type { BudgetStatus } from '@/lib/analytics'

type Props = {
  budget: BudgetStatus
}

export function BudgetRemainingTile({ budget }: Props) {
  const { remainingUsd, ceilingUsd, pctSpent, pctRemaining, projectedUsd } = budget

  const tone = projectedUsd > ceilingUsd ? 'over' : pctSpent > 70 ? 'warn' : 'ok'
  const barColor =
    tone === 'over' ? 'bg-pink-500' : tone === 'warn' ? 'bg-amber-400' : 'bg-purple-400'
  const hint =
    tone === 'over'
      ? `Projected ${formatUsd(projectedUsd)} — over ceiling`
      : `Projected ${formatUsd(projectedUsd)} by month end`

  return (
    <Link
      href="/costs"
      className="group rounded-3xl bg-white/70 backdrop-blur-sm shadow-card p-6 border border-pink-100 hover:shadow-card-hover transition-shadow block"
    >
      <div className="flex items-center justify-between text-purple-600 text-sm mb-3">
        <div className="flex items-center gap-2">
          <Wallet weight="duotone" size={22} />
          <span className="uppercase tracking-wide text-xs">API budget left</span>
        </div>
        <ArrowRight
          size={14}
          className="text-purple-400 group-hover:text-pink-600 transition-colors"
        />
      </div>
      <div className="font-display text-3xl text-purple-900 mb-1">{formatUsd(remainingUsd)}</div>
      <div className="text-xs text-purple-600/60 mb-3">
        {pctRemaining.toFixed(0)}% of {formatUsd(ceilingUsd)} ceiling left
      </div>
      <div className="h-1.5 rounded-full bg-pink-100 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.min(100, pctSpent)}%` }}
        />
      </div>
      <div className="text-[11px] text-purple-600/60 mt-2">{hint}</div>
    </Link>
  )
}
