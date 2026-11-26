/*
 * Five-field cron expressions (minute hour day-of-month month day-of-week), as crontab reads them: `*`, numbers,
 * ranges `a-b`, steps `*\/n` and `a-b/n`, lists `a,b`, month and weekday names (`JAN`, `MON`), 7 as Sunday, and the
 * macros `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`. When both day fields are restricted, a day matching
 * either runs (crontab's rule). Used by MCronField; usable on their own.
 */
import type { M3Locale } from './useLocale'

/** An expression read into the values each field allows. */
export interface CronSchedule {
  minutes: number[]
  hours: number[]
  days: number[]
  months: number[]
  weekdays: number[]
  /** Which fields were `*` (unrestricted) */
  any: { days: boolean; weekdays: boolean; minutes: boolean; hours: boolean; months: boolean }
  /** The fields as written (after macros), for describing steps */
  fields: string[]
}

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *',
}
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const RANGES: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]

function value(token: string, field: number): number {
  const up = token.toUpperCase()
  if (field === 3 && MONTHS.includes(up)) return MONTHS.indexOf(up) + 1
  if (field === 4 && DAYS.includes(up)) return DAYS.indexOf(up)
  if (!/^\d+$/.test(token)) throw new Error(token)
  return Number(token)
}

function expand(part: string, field: number): number[] {
  const [lo, hi] = RANGES[field]!
  const out = new Set<number>()
  for (const item of part.split(',')) {
    const [range, stepText] = item.split('/') as [string, string | undefined]
    const step = stepText === undefined ? 1 : Number(stepText)
    if (!Number.isInteger(step) || step < 1) throw new Error(item)
    let a: number, b: number
    if (range === '*') [a, b] = [lo, hi]
    else if (range.includes('-')) {
      const [x, y] = range.split('-')
      a = value(x!, field)
      b = value(y!, field)
    } else {
      a = value(range, field)
      // `5/15` means from 5 to the end, every 15
      b = stepText === undefined ? a : hi
    }
    if (a < lo || b > hi || a > b) throw new Error(item)
    for (let v = a; v <= b; v += step) out.add(field === 4 && v === 7 ? 0 : v)
  }
  return [...out].sort((x, y) => x - y)
}

/** Reads an expression; null when it isn't valid. */
export function parseCron(expression: string): CronSchedule | null {
  const text = expression.trim()
  const fields = (MACROS[text.toLowerCase()] ?? text).split(/\s+/)
  if (fields.length !== 5) return null
  try {
    const [minutes, hours, days, months, weekdays] = fields.map((f, i) => expand(f, i)) as number[][]
    return {
      minutes: minutes!, hours: hours!, days: days!, months: months!, weekdays: weekdays!,
      any: { minutes: fields[0] === '*', hours: fields[1] === '*', days: fields[2] === '*', months: fields[3] === '*', weekdays: fields[4] === '*' },
      fields,
    }
  } catch {
    return null
  }
}

/** Whether an expression is valid. */
export const isValidCron = (expression: string) => parseCron(expression) !== null

function dayMatches(s: CronSchedule, d: Date) {
  const dom = s.days.includes(d.getDate())
  const dow = s.weekdays.includes(d.getDay())
  if (s.any.days && s.any.weekdays) return true
  if (s.any.days) return dow
  if (s.any.weekdays) return dom
  return dom || dow
}

/** The next times it runs after `from` (local time), up to `count`, within four years. */
export function nextCronRuns(expression: string, count = 5, from: Date = new Date()): Date[] {
  const s = parseCron(expression)
  if (!s) return []
  const out: Date[] = []
  const d = new Date(from)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  const limit = from.getTime() + 4 * 366 * 864e5
  while (out.length < count && d.getTime() <= limit) {
    if (!s.months.includes(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1)
      d.setHours(0, 0)
      continue
    }
    if (!dayMatches(s, d)) {
      d.setDate(d.getDate() + 1)
      d.setHours(0, 0)
      continue
    }
    if (!s.hours.includes(d.getHours())) {
      d.setHours(d.getHours() + 1, 0)
      continue
    }
    if (!s.minutes.includes(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1)
      continue
    }
    out.push(new Date(d))
    d.setMinutes(d.getMinutes() + 1)
  }
  return out
}

/** The locale strings the description uses. */
export type CronStrings = Pick<M3Locale,
  'lang' | 'cronEveryMinute' | 'cronEveryNMinutes' | 'cronHourlyAt' | 'cronAt' | 'cronEveryNHoursAt' |
  'cronMinutesOfHours' | 'cronOnDaysOfMonth' | 'cronInMonths' | 'cronRange'>

/** Consecutive runs of 3 or more as `from–to`, the rest one by one. */
function compact(values: number[], name: (v: number) => string, range: string): string[] {
  const out: string[] = []
  for (let i = 0; i < values.length; i++) {
    let j = i
    while (j + 1 < values.length && values[j + 1] === values[j]! + 1) j++
    if (j - i >= 2) {
      out.push(range.replace('{from}', name(values[i]!)).replace('{to}', name(values[j]!)))
      i = j
    } else out.push(name(values[i]!))
  }
  return out
}

/** A sentence for the expression in the locale's language ("At 09:00, Monday to Friday"), or null when invalid. */
export function describeCron(expression: string, t: CronStrings): string | null {
  const s = parseCron(expression)
  if (!s) return null
  const lang = t.lang || undefined
  const list = (items: string[], type: 'conjunction' | 'disjunction' = 'conjunction') =>
    typeof Intl.ListFormat === 'function' ? new Intl.ListFormat(lang, { type }).format(items) : items.join(', ')
  const time = (h: number, m: number) => new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(new Date(2024, 0, 1, h, m))
  const weekday = (d: number) => new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2024, 0, 7 + d))
  const month = (m: number) => new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2024, m - 1, 1))
  const step = (field: string) => /^\*\/(\d+)$/.exec(field)?.[1]

  // When
  let when: string
  const [mf, hf] = s.fields
  const oneMinute = s.minutes.length === 1 ? s.minutes[0]! : null
  if (s.any.minutes && s.any.hours) when = t.cronEveryMinute
  else if (step(mf!) && s.any.hours) when = t.cronEveryNMinutes.replace('{n}', step(mf!)!)
  else if (oneMinute !== null && s.any.hours) when = t.cronHourlyAt.replace('{m}', String(oneMinute))
  else if (oneMinute !== null && step(hf!)) when = t.cronEveryNHoursAt.replace('{n}', step(hf!)!).replace('{m}', String(oneMinute))
  else if (oneMinute !== null && s.hours.length <= 6) when = t.cronAt.replace('{time}', list(s.hours.map((h) => time(h, oneMinute))))
  else {
    when = t.cronMinutesOfHours
      .replace('{minutes}', list(compact(s.minutes, String, t.cronRange)))
      .replace('{hours}', list(compact(s.hours, String, t.cronRange)))
  }

  // Which days
  const parts = [when]
  const domText = s.any.days ? '' : t.cronOnDaysOfMonth.replace('{days}', list(compact(s.days, String, t.cronRange)))
  const dowText = s.any.weekdays ? '' : list(compact(s.weekdays, weekday, t.cronRange))
  if (domText && dowText) parts.push(list([domText, dowText], 'disjunction'))
  else if (domText || dowText) parts.push(domText || dowText)
  if (!s.any.months) parts.push(t.cronInMonths.replace('{months}', list(compact(s.months, month, t.cronRange))))
  return parts.join(', ')
}
