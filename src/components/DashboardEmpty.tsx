'use client'

import { signOut } from 'next-auth/react'
import { SignOut, Heartbeat, Coffee, ChartLine } from '@phosphor-icons/react'

export function DashboardEmpty({ userEmail }: { userEmail: string | null }) {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-widest text-pink-600 mb-1">JulzOps</div>
          <h1 className="font-display text-3xl md:text-4xl text-purple-900">Today</h1>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 text-sm text-purple-700 hover:text-pink-600 transition-colors"
        >
          <SignOut size={16} />
          Sign out
        </button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Tile icon={<Heartbeat weight="duotone" size={22} />} label="Running now" value="0" hint="Nothing spinning" />
        <Tile icon={<Coffee weight="duotone" size={22} />} label="Today's spend" value="$0.00" hint="Of $100 ceiling" />
        <Tile icon={<ChartLine weight="duotone" size={22} />} label="Events today" value="0" hint="No activity yet" />
      </section>

      <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card p-8 border border-pink-100">
        <h2 className="font-display text-xl text-purple-900 mb-2">Phase 1 heartbeat</h2>
        <p className="text-purple-700/70 mb-4">
          You&rsquo;re signed in as <span className="font-mono text-pink-700">{userEmail}</span>.
          Auth works, the theme loads, the deploy pipeline is live. Phase 2 adds the first real
          data source (GitHub Actions + Swirl Series cost webhook).
        </p>
        <ul className="text-sm text-purple-700/60 space-y-1 list-disc list-inside">
          <li>Next: wire up <code>/api/ingest/cost</code> + Anthropic usage report</li>
          <li>Then: first real events populate the tiles above</li>
          <li>Retro engine: built-but-disabled until 30 events or 3 projects</li>
        </ul>
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
