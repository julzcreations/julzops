// Model registry: pretty name + chart color.
// Colors mirror Claude Console's palette where sensible, then fall back to
// JulzOps's pink/purple/lavender theme.

export type ModelMeta = {
  label: string
  color: string
  order: number
}

// Raw API id → meta. Anything not matched falls back to generic meta.
const REGISTRY: Record<string, ModelMeta> = {
  'claude-opus-4-7': { label: 'Opus 4.7', color: '#c4b5fd', order: 10 },
  'claude-opus-4-6': { label: 'Opus 4.6', color: '#a78bfa', order: 20 },
  'claude-sonnet-4-6': { label: 'Sonnet 4.6', color: '#e8496b', order: 30 },
  'claude-sonnet-4-5': { label: 'Sonnet 4.5', color: '#ff6b8a', order: 31 },
  'claude-haiku-4-5-20251001': { label: 'Haiku 4.5', color: '#fbbf24', order: 40 },
  'claude-haiku-4-5': { label: 'Haiku 4.5', color: '#fbbf24', order: 41 },
}

const FALLBACK_PALETTE = ['#c8a2c8', '#ffb7c5', '#b388eb', '#fcd34d', '#7c3aed']

export function getModelMeta(id: string): ModelMeta {
  if (REGISTRY[id]) return REGISTRY[id]
  // Stable hash-ish fallback so unknown models get a consistent color.
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return {
    label: id.replace(/^claude-/, '').replace(/-/g, ' '),
    color: FALLBACK_PALETTE[sum % FALLBACK_PALETTE.length],
    order: 90,
  }
}

export function sortModels(ids: string[]): string[] {
  return [...ids].sort((a, b) => getModelMeta(a).order - getModelMeta(b).order)
}
