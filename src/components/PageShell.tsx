import Link from 'next/link'
import { Gear } from '@phosphor-icons/react/dist/ssr'
import { NavTabs } from '@/components/NavTabs'

type Props = {
  title: string
  subtitle?: string
  userEmail?: string | null
  children: React.ReactNode
}

export function PageShell({ title, subtitle, userEmail, children }: Props) {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-pink-600 mb-1">JulzOps</div>
          <h1 className="font-display text-3xl md:text-4xl text-purple-900">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-purple-600/70 mt-1">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-sm text-purple-700/70 shrink-0">
          {userEmail ? (
            <span className="hidden md:inline font-mono text-xs text-pink-700">{userEmail}</span>
          ) : null}
          <Link
            href="/settings"
            className="flex items-center gap-2 hover:text-pink-600 transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <Gear size={16} />
            <span className="hidden md:inline">Settings</span>
          </Link>
        </div>
      </header>

      <NavTabs />

      {children}
    </main>
  )
}
