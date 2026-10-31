// Dates and time scales shared by MGantt and MResourceTimeline. Dates are strings: `YYYY-MM-DD` (a whole day, local)
// or a datetime (`YYYY-MM-DDTHH:mm`, local, or ISO with a zone). Inside, times are epoch ms; a date-only end is the
// last day (inclusive), so its exclusive end is the next midnight.

export const HOUR = 3_600_000
export const DAY = 86_400_000

export type TimeUnit = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
export const UNITS: TimeUnit[] = ['hour', 'day', 'week', 'month', 'quarter', 'year']

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnly(s: string | undefined | null): boolean {
  return !!s && DATE_ONLY.test(s)
}

/** Epoch ms of a date string (NaN when it isn't one) */
export function parseDate(s: string | undefined | null): number {
  if (!s) return NaN
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y!, m! - 1, d!).getTime()
  }
  // A datetime without a zone is local time
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(s)
  if (local) {
    const [, y, mo, d, h, mi, sec] = local
    return new Date(+y!, +mo! - 1, +d!, +h!, +mi!, +(sec ?? 0)).getTime()
  }
  return Date.parse(s)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A date string, local: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (with seconds when there are some) */
export function formatDate(ms: number, dateOnly: boolean): string {
  const d = new Date(ms)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (dateOnly) return date
  const s = d.getSeconds()
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}${s ? `:${pad(s)}` : ''}`
}

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Adds whole days in local time (a DST change doesn't shift the hour) */
export function addDays(ms: number, n: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** Whole local days from a to b (rounded, so DST doesn't matter) */
export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY)
}

/** The start of the unit that holds `ms` */
export function floorUnit(ms: number, unit: TimeUnit, weekStartsOn = 1): number {
  const d = new Date(ms)
  switch (unit) {
    case 'hour':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime()
    case 'day':
      return startOfDay(ms)
    case 'week': {
      const back = (d.getDay() - weekStartsOn + 7) % 7
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime()
    }
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    case 'quarter':
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime()
    case 'year':
      return new Date(d.getFullYear(), 0, 1).getTime()
  }
}

/** The start of the next unit after the one that starts at `ms` (`step` hours at a time for hours) */
export function nextUnit(ms: number, unit: TimeUnit, step = 1): number {
  const d = new Date(ms)
  switch (unit) {
    case 'hour':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + step).getTime()
    case 'day':
      return addDays(ms, 1)
    case 'week':
      return addDays(ms, 7)
    case 'month':
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    case 'quarter':
      return new Date(d.getFullYear(), d.getMonth() + 3, 1).getTime()
    case 'year':
      return new Date(d.getFullYear() + 1, 0, 1).getTime()
  }
}

/** Rounds to the nearest step: minutes for sub-day steps, else whole days (local midnights) */
export function snapTime(ms: number, stepMinutes: number): number {
  if (stepMinutes >= 1440) {
    const days = Math.round(stepMinutes / 1440)
    const day = startOfDay(ms + (12 * HOUR))
    if (days <= 1) return day
    // Steps of several days count from the epoch's local day
    const n = daysBetween(0, day)
    return addDays(day, -(((n % days) + days) % days))
  }
  const step = stepMinutes * 60_000
  const base = startOfDay(ms)
  return base + Math.round((ms - base) / step) * step
}

// ── Scales ────────────────────────────────────────────────────────────────────────────────────────────────

/** The named zoom levels: px per day each starts at */
export const SCALE_PX_PER_DAY: Record<TimeUnit, number> = {
  hour: 1152,
  day: 40,
  week: 20,
  month: 5,
  quarter: 1.2,
  year: 0.3,
}
const UNIT_DAYS: Record<TimeUnit, number> = { hour: 1 / 24, day: 1, week: 7, month: 30.44, quarter: 91.3, year: 365.25 }
// The narrowest a header cell can get with its label
const MIN_CELL: Record<TimeUnit, number> = { hour: 36, day: 26, week: 52, month: 44, quarter: 36, year: 44 }
const TOP: Record<TimeUnit, TimeUnit | null> = { hour: 'day', day: 'month', week: 'month', month: 'year', quarter: 'year', year: null }

const HOUR_STEPS = [1, 2, 3, 6, 12]

/**
 * The header's two rows for a zoom: the finest unit whose cells still fit a label, and the one above it. Hours come
 * in steps of 2, 3, 6 or 12 when single ones don't fit, before giving way to days
 */
export function unitsFor(pxPerDay: number): { bottom: TimeUnit; top: TimeUnit | null; step: number } {
  const step = HOUR_STEPS.find((s) => (s * pxPerDay) / 24 >= MIN_CELL.hour)
  if (step) return { bottom: 'hour', top: 'day', step }
  const bottom = UNITS.find((u) => u !== 'hour' && UNIT_DAYS[u] * pxPerDay >= MIN_CELL[u]) ?? 'year'
  return { bottom, top: TOP[bottom], step: 1 }
}

/** The named scale closest to a zoom */
export function nearestScale(pxPerDay: number): TimeUnit {
  let best: TimeUnit = 'day'
  let dist = Infinity
  for (const u of UNITS) {
    const d = Math.abs(Math.log(SCALE_PX_PER_DAY[u] / pxPerDay))
    if (d < dist) { dist = d; best = u }
  }
  return best
}

/** Units starting from before `from` until past `to` (hours `step` at a time, from midnight) */
export function unitStarts(from: number, to: number, unit: TimeUnit, weekStartsOn = 1, step = 1, max = 2000): number[] {
  const out: number[] = []
  let t = floorUnit(from, unit, weekStartsOn)
  if (unit === 'hour' && step > 1) t -= (new Date(t).getHours() % step) * HOUR
  for (; t < to && out.length < max; t = nextUnit(t, unit, step)) out.push(t)
  return out
}

/** A header cell's label */
export function unitLabel(ms: number, unit: TimeUnit, width: number, lang: string | undefined, quarter: string, top = false): string {
  const d = new Date(ms)
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang, o).format(d)
  switch (unit) {
    case 'hour':
      return f({ hour: 'numeric' })
    case 'day':
      if (top) return f({ weekday: 'short', day: 'numeric', month: 'short' })
      return width >= 44 ? f({ weekday: 'narrow', day: 'numeric' }) : f({ day: 'numeric' })
    case 'week':
      return f({ month: 'short', day: 'numeric' })
    case 'month':
      if (top) return f({ month: 'long', year: 'numeric' })
      return f({ month: width >= 90 ? 'long' : 'short' })
    case 'quarter':
      return quarter.replace('{n}', String(Math.floor(d.getMonth() / 3) + 1))
    case 'year':
      return f({ year: 'numeric' })
  }
}

/** Snap step (minutes) that suits a zoom, for tasks given as datetimes */
export function defaultSnap(pxPerDay: number): number {
  const pxPerHour = pxPerDay / 24
  if (pxPerHour >= 120) return 5
  if (pxPerHour >= 40) return 15
  if (pxPerHour >= 16) return 30
  if (pxPerHour >= 4) return 60
  return 1440
}

/** Whether a day is a working one */
export function isWorkingDay(ms: number, workingDays: readonly number[], holidays: ReadonlySet<string>): boolean {
  return workingDays.includes(new Date(ms).getDay()) && !holidays.has(formatDate(ms, true))
}
