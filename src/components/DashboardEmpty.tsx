'use client'

import { signOut } from 'next-auth/react'
import { SignOut, Heartbeat, Coffee, ChartLine } from '@phosphor-icons/react'

export function DashboardEmpty({ userEmail }: { userEmail: string | null }) {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-widest text-pink-600 mb-1">julzops</div>
          <h1 className="font-display text-3xl md:text-4xl text-purple-900">today</h1>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 text-sm text-purple-700 hover:text-pink-600 transition-colors"
        >
          <SignOut size={16} />
          sign out
        </button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Tile icon={<Heartbeat weight="duotone" size={22} />} label="running now" value="0" hint="nothing spinning" />
        <Tile icon={<Coffee weight="duotone" size={22} />} label="today's spend" value="$0.00" hint="of $100 ceiling" />
        <Tile icon={<ChartLine weight="duotone" size={22} />} label="events today" value="0" hint="no activity yet" />
      </section>

      <section className="rounded-3xl bg-white/60 backdrop-blur-sm shadow-card p-8 border border-pink-100">
        <h2 className="font-display text-xl text-purple-900 mb-2">phase 1 heartbeat</h2>
        <p className="text-purple-700/70 mb-4">
          you&rsquo;re signed in as <span className="font-mono text-pink-700">{userEmail}</span>.
          auth works, the theme loads, the deploy pipeline is live. phase 2 adds the first real
          data source (github actions + swirl series cost webhook).
        </p>
        <ul className="text-sm text-purple-700/60 space-y-1 list-disc list-inside">
          <li>next: wire up <code>/api/ingest/cost</code> + anthropic usage report</li>
          <li>then: first real events populate the tiles above</li>
          <li>retro engine: built-but-disabled until 30 events or 3 projects</li>
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
