'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { getModelMeta } from '@/lib/models'

type Props = {
  projects: Array<{ slug: string; name: string }>
  models: string[]
}

export function LogsFilters({ projects, models }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    next.delete('page')
    startTransition(() => {
      router.replace(`/logs${next.toString() ? `?${next}` : ''}`)
    })
  }

  const project = params.get('project') ?? ''
  const status = params.get('status') ?? ''
  const model = params.get('model') ?? ''
  const any = project || status || model

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
      <Select
        label="Project"
        value={project}
        onChange={(v) => update('project', v)}
        options={[
          { value: '', label: 'All projects' },
          ...projects.map((p) => ({ value: p.slug, label: p.name })),
        ]}
      />
      <Select
        label="Status"
        value={status}
        onChange={(v) => update('status', v)}
        options={[
          { value: '', label: 'Any status' },
          { value: 'success', label: 'Success' },
          { value: 'failure', label: 'Failure' },
          { value: 'running', label: 'Running' },
        ]}
      />
      <Select
        label="Model"
        value={model}
        onChange={(v) => update('model', v)}
        options={[
          { value: '', label: 'Any model' },
          ...models.map((m) => ({ value: m, label: getModelMeta(m).label })),
        ]}
      />
      {any ? (
        <button
          type="button"
          onClick={() => {
            startTransition(() => router.replace('/logs'))
          }}
          className="text-xs text-pink-600 hover:text-pink-700 px-2 py-1"
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-purple-600/80">
      <span className="sr-only md:not-sr-only uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-pink-100 bg-white/70 px-3 py-1.5 text-sm text-purple-900 focus:outline-none focus:ring-2 focus:ring-pink-200"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
