// Claude cost tracking + budget guard.
// Ported from swirl-series-automation/sync.py (_run_usage / track_usage /
// check_budget / MODEL_PRICING). Every Claude call in JulzOps must go through
// callClaude() so (a) we can't blow the per-run budget and (b) every call
// lands in CostSample for JulzOps to monitor itself from day 1.

export type ModelId =
  | 'claude-opus-4-7'
  | 'claude-opus-4-7[1m]'
  | 'claude-opus-4-6'
  | 'claude-opus-4-6[1m]'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'

// Per-million-token pricing in USD. Keep in sync with anthropic.com/pricing.
export const MODEL_PRICING: Record<ModelId, { inputUsdPerM: number; outputUsdPerM: number }> = {
  'claude-opus-4-7': { inputUsdPerM: 15.0, outputUsdPerM: 75.0 },
  'claude-opus-4-7[1m]': { inputUsdPerM: 15.0, outputUsdPerM: 75.0 },
  'claude-opus-4-6': { inputUsdPerM: 15.0, outputUsdPerM: 75.0 },
  'claude-opus-4-6[1m]': { inputUsdPerM: 15.0, outputUsdPerM: 75.0 },
  'claude-sonnet-4-6': { inputUsdPerM: 3.0, outputUsdPerM: 15.0 },
  'claude-haiku-4-5-20251001': { inputUsdPerM: 0.8, outputUsdPerM: 4.0 },
}

// Hard abort if a single run exceeds this. Safety net against loops/bugs.
export const MAX_COST_PER_RUN_USD = Number(process.env.MAX_COST_PER_RUN_USD ?? '1.00')

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

// A single run's accumulator. Create one per request/job; don't share across requests.
export class RunUsageTracker {
  totalUsd = 0
  byModel: Record<string, { inputTokens: number; outputTokens: number; costUsd: number; calls: number }> = {}

  track(model: string, usage: Usage): number {
    const pricing = (MODEL_PRICING as Record<string, { inputUsdPerM: number; outputUsdPerM: number }>)[model]
    const cost = pricing
      ? (usage.input_tokens / 1_000_000) * pricing.inputUsdPerM +
        (usage.output_tokens / 1_000_000) * pricing.outputUsdPerM
      : 0
    this.totalUsd += cost
    const bucket = (this.byModel[model] ??= { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 })
    bucket.inputTokens += usage.input_tokens
    bucket.outputTokens += usage.output_tokens
    bucket.costUsd += cost
    bucket.calls += 1
    return cost
  }

  checkBudget(): void {
    if (this.totalUsd >= MAX_COST_PER_RUN_USD) {
      throw new Error(
        `Run cost $${this.totalUsd.toFixed(4)} reached max $${MAX_COST_PER_RUN_USD.toFixed(2)} \u2014 aborting.`,
      )
    }
  }
}
