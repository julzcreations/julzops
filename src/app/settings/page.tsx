import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowSquareOut, Receipt, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type LinkedApp = {
  name: string
  url: string
  description: string
  icon: React.ReactNode
  accentClass: string
}

const linkedApps: LinkedApp[] = [
  {
    name: 'SubTracker',
    url: 'https://subs.julzcreations.dev',
    description: 'Flat recurring subscriptions — Notion, Figma, streaming, anything with a monthly charge.',
    icon: <Receipt weight="duotone" size={28} />,
    accentClass: 'from-pink-400 to-purple-500',
  },
]

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">
      <header className="mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-pink-600 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>
        <div className="text-xs uppercase tracking-widest text-pink-600 mb-1">JulzOps</div>
        <h1 className="font-display text-3xl md:text-4xl text-purple-900">Settings</h1>
      </header>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkle weight="fill" size={14} className="text-pink-500" />
          <h2 className="font-display text-xl text-purple-900">Linked apps</h2>
        </div>
        <p className="text-sm text-purple-700/70 mb-6">
          Other pieces of your stack that live at julzcreations.dev. Click through to jump between them.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {linkedApps.map((app) => (
            <a
              key={app.name}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-3xl bg-white/70 backdrop-blur-sm shadow-card border border-pink-100 p-6 hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`p-3 rounded-2xl bg-gradient-to-br ${app.accentClass} text-white shadow-purple-glow`}
                >
                  {app.icon}
                </div>
                <ArrowSquareOut
                  size={18}
                  className="text-purple-400 group-hover:text-pink-600 transition-colors"
                />
              </div>
              <div className="font-display text-xl text-purple-900 mb-1">{app.name}</div>
              <p className="text-sm text-purple-700/70">{app.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white/50 backdrop-blur-sm border border-pink-100 p-6">
        <h3 className="font-display text-lg text-purple-900 mb-3">About this instance</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Info label="Signed in as" value={session.user?.email ?? '—'} mono />
          <Info label="Environment" value={process.env.VERCEL_ENV ?? 'development'} />
          <Info label="Retro engine" value={process.env.RETRO_ENABLED === 'true' ? 'Enabled' : 'Disabled'} />
          <Info label="Event retention" value={`${process.env.RETENTION_DAYS ?? '90'} days`} />
        </dl>
      </section>
    </main>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-purple-600/70 mb-1">{label}</dt>
      <dd className={`text-purple-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
