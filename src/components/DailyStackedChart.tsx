'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { getModelMeta, sortModels } from '@/lib/models'
import { formatUsd, formatTokens } from '@/lib/format'

export type DailyRow = {
  day: string // YYYY-MM-DD
  // Dynamic per-model values keyed by raw model id.
  [model: string]: string | number
}

type Props = {
  rows: DailyRow[]
  models: string[]
  /** What the y-axis represents — changes tooltip formatting. */
  unit: 'usd' | 'tokens'
  emptyLabel?: string
  height?: number
}

export function DailyStackedChart({ rows, models, unit, emptyLabel, height = 280 }: Props) {
  const ordered = sortModels(models)
  const hasData = rows.some((r) => ordered.some((m) => Number(r[m] ?? 0) > 0))

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-pink-50/40 border border-pink-100 text-sm text-purple-600/60"
        style={{ height }}
      >
        {emptyLabel ?? 'No data in this range yet.'}
      </div>
    )
  }

  const fmt = unit === 'usd' ? formatUsd : formatTokens

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ffe4f0" />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => {
              const [, m, dd] = d.split('-')
              return `${Number(m)}/${Number(dd)}`
            }}
            stroke="#a78bfa"
            tick={{ fill: '#7c3aed', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#a78bfa"
            tick={{ fill: '#7c3aed', fontSize: 11 }}
            tickFormatter={(v: number) => fmt(v)}
            width={55}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 228, 240, 0.4)' }}
            contentStyle={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ffe4f0',
              borderRadius: 12,
              fontSize: 12,
              color: '#4c1d95',
            }}
            labelFormatter={(label) => String(label ?? '')}
            formatter={(value, name) => [fmt(Number(value) || 0), getModelMeta(String(name)).label]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(name: string) => getModelMeta(name).label}
          />
          {ordered.map((m, i) => {
            const meta = getModelMeta(m)
            const isTop = i === ordered.length - 1
            return (
              <Bar
                key={m}
                dataKey={m}
                stackId="a"
                fill={meta.color}
                radius={isTop ? [8, 8, 0, 0] : 0}
              />
            )
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
