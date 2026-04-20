'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  House,
  Coffee,
  ChartBar,
  ListDashes,
} from '@phosphor-icons/react'

type Tab = {
  href: string
  label: string
  icon: React.ReactNode
  matchPrefix?: boolean
}

const tabs: Tab[] = [
  { href: '/', label: 'Today', icon: <House weight="duotone" size={18} /> },
  { href: '/costs', label: 'Cost', icon: <Coffee weight="duotone" size={18} />, matchPrefix: true },
  { href: '/usage', label: 'Usage', icon: <ChartBar weight="duotone" size={18} />, matchPrefix: true },
  { href: '/logs', label: 'Logs', icon: <ListDashes weight="duotone" size={18} />, matchPrefix: true },
]

export function NavTabs() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="mb-6 -mx-6 md:mx-0 px-6 md:px-0 overflow-x-auto scrollbar-none"
    >
      <ul className="flex gap-1 md:gap-2 min-w-max">
        {tabs.map((tab) => {
          const active = tab.matchPrefix
            ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
            : pathname === tab.href
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm transition-all',
                  active
                    ? 'bg-white/80 shadow-card text-purple-900 border border-pink-100'
                    : 'text-purple-600/70 hover:text-pink-600 hover:bg-white/40 border border-transparent',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
