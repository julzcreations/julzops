// Helpers for the Swirl Series ops card.
//
// Talks to the swirl-series-automation GHA workflow via GitHub's API to
// trigger on-demand runs (workflow_dispatch). Also computes the next
// scheduled run time from the cron expression so the dashboard can show
// "Next: Wed at 11am" instead of forcing the user to read cron.

export const SWIRL_REPO = process.env.SWIRL_REPO ?? 'jw-yue/swirl-series-automation'
export const SWIRL_WORKFLOW_FILE = process.env.SWIRL_WORKFLOW_FILE ?? 'swirl-sync.yml'
export const SWIRL_PROJECT_SLUG = 'swirl-series-automation'

// Cron is `0 16 * * 1,3,5` in the swirl repo workflow — 16:00 UTC on
// Mon/Wed/Fri (= 11am CDT in summer, 10am CST in winter).
const SCHEDULE_HOUR_UTC = 16
const SCHEDULE_DAYS_OF_WEEK = new Set([1, 3, 5]) // Mon, Wed, Fri (JS getUTCDay)
export const SCHEDULE_LABEL = 'Mon / Wed / Fri at 11am America/Chicago'

/**
 * Next scheduled cron firing after `now`. If today matches the cron pattern
 * but we've already passed 16:00 UTC, walk forward to the next valid day.
 */
export function nextSwirlRun(now: Date = new Date()): Date {
  const candidate = new Date(now)
  // Search up to 14 days forward — the cron fires every other day at most,
  // so 14 covers worst-case wrap-around with margin.
  for (let i = 0; i < 14; i += 1) {
    const dayOk = SCHEDULE_DAYS_OF_WEEK.has(candidate.getUTCDay())
    if (dayOk) {
      const fire = new Date(
        Date.UTC(
          candidate.getUTCFullYear(),
          candidate.getUTCMonth(),
          candidate.getUTCDate(),
          SCHEDULE_HOUR_UTC,
          0,
          0,
        ),
      )
      if (fire.getTime() > now.getTime()) return fire
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }
  // Should be unreachable — return now+24h as a defensive default.
  return new Date(now.getTime() + 24 * 60 * 60 * 1000)
}

export type TriggerKind = 'refresh' | 'regen'

export type TriggerInput = {
  kind: TriggerKind
  targetMediaId?: string
}

export type TriggerResult =
  | { ok: true; runsUrl: string }
  | { ok: false; status: number; error: string }

/**
 * Fire the swirl-sync GHA workflow via workflow_dispatch.
 *
 * - kind 'refresh' just runs a normal sync (metrics refresh + matcher).
 * - kind 'regen' passes force_regen=true so script generation runs even
 *   on non-script-gen days.
 *
 * Returns the URL to view the workflow runs list — the API doesn't return
 * the new run's URL directly (no run_id in the dispatch response).
 *
 * Requires GH_TRIGGER_TOKEN env var with `workflow` scope on the repo.
 */
export async function triggerSwirlWorkflow(input: TriggerInput): Promise<TriggerResult> {
  const token = process.env.GH_TRIGGER_TOKEN
  if (!token) {
    return { ok: false, status: 500, error: 'GH_TRIGGER_TOKEN not configured' }
  }

  const inputs: Record<string, string> = {}
  if (input.kind === 'regen') inputs.force_regen = 'true'
  if (input.targetMediaId) inputs.target_media_id = input.targetMediaId

  const url = `https://api.github.com/repos/${SWIRL_REPO}/actions/workflows/${SWIRL_WORKFLOW_FILE}/dispatches`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, status: 502, error: `network: ${msg}` }
  }

  if (res.status !== 204) {
    let body = ''
    try {
      body = await res.text()
    } catch {
      // ignore
    }
    return { ok: false, status: res.status, error: body.slice(0, 300) || res.statusText }
  }

  return {
    ok: true,
    runsUrl: `https://github.com/${SWIRL_REPO}/actions/workflows/${SWIRL_WORKFLOW_FILE}`,
  }
}

/**
 * Pretty-format a future Date as a relative day-of-week phrase for the card.
 * "Today at 11am" / "Mon at 11am" / "Apr 22 at 11am"
 */
export function formatNextRun(next: Date, now: Date = new Date()): string {
  const localTime = next.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  })
  const sameDay =
    next.getUTCFullYear() === now.getUTCFullYear() &&
    next.getUTCMonth() === now.getUTCMonth() &&
    next.getUTCDate() === now.getUTCDate()
  if (sameDay) return `Today at ${localTime}`
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.round((next.getTime() - now.getTime()) / dayMs)
  if (days <= 6) {
    const weekday = next.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'America/Chicago',
    })
    return `${weekday} at ${localTime}`
  }
  const date = next.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
  return `${date} at ${localTime}`
}
