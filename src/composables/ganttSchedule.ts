// Scheduling for MGantt, as pure functions over tasks: summaries rolled up from their children, dependencies pushed
// forward (or tasks pulled as soon as possible), the critical path with each task's slack, and working days.
// Tasks are treated as immutable: what changes comes back as new objects, the rest as they were.
import { DAY, addDays, daysBetween, formatDate, isDateOnly, isWorkingDay, parseDate, startOfDay } from './_ganttTime'

/** A predecessor of a task: finish-to-start (default), start-to-start, finish-to-finish or start-to-finish */
export interface GanttDependency {
  /** The predecessor's id */
  id: string
  type?: 'FS' | 'SS' | 'FF' | 'SF'
  /** Days between them (negative overlaps them); working days with a calendar */
  lag?: number
}

/** A task. MGantt emits new arrays with new objects for whatever changed (`v-model:tasks`) */
export interface GanttTask<D = any> {
  id: string
  name: string
  /** `YYYY-MM-DD` (whole days) or a datetime (`YYYY-MM-DDTHH:mm`, local, or ISO with a zone) */
  start: string
  /** A date is the last day (inclusive); a datetime is when it ends. A milestone needs none */
  end?: string
  /** 0 to 100 */
  progress?: number
  /** `summary` is implied for a task with children (its dates and progress roll up from them) */
  type?: 'task' | 'milestone' | 'summary'
  /** The summary task it belongs to */
  parentId?: string
  /** Its predecessors: ids (finish-to-start) or `GanttDependency` */
  dependencies?: (string | GanttDependency)[]
  /** An M3 role (default `primary`; `summary` defaults to `neutral`) */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'neutral'
  /** The plan it's compared with (MGantt's `baselines`) */
  baselineStart?: string
  baselineEnd?: string
  /** `false` keeps it from being moved, resized, linked, deleted or selected */
  draggable?: boolean
  resizable?: boolean
  linkable?: boolean
  deletable?: boolean
  selectable?: boolean
  class?: string
  data?: D
}

/** Which days are worked: weekdays (0 Sunday … 6 Saturday, default Monday to Friday) and holidays (`YYYY-MM-DD`) */
export interface GanttCalendar {
  workingDays?: number[]
  holidays?: string[]
}

export interface GanttScheduleOptions {
  /** `'push'` (default) moves tasks only as late as their dependencies need; `'asap'` also pulls them back to the earliest they can start */
  mode?: 'push' | 'asap'
  /** Count durations and lags in working days (date-only tasks), starting on working days */
  calendar?: GanttCalendar
}

export interface GanttCriticalPath {
  /** Tasks with no slack (and summaries holding one) */
  tasks: string[]
  /** Dependencies on the path, as `'<predecessor>><successor>'` */
  dependencies: string[]
  /** Each task's total slack in days: how late it can finish without delaying the end */
  slack: Record<string, number>
  /** When the last task ends */
  finish: string
}

export function normalizeDependency(d: string | GanttDependency): Required<GanttDependency> {
  return typeof d === 'string' ? { id: d, type: 'FS', lag: 0 } : { id: d.id, type: d.type ?? 'FS', lag: d.lag ?? 0 }
}

/** Ids of tasks that have children */
export function summaryIds(tasks: readonly GanttTask[]): Set<string> {
  const ids = new Set(tasks.map((t) => t.id))
  const out = new Set<string>()
  for (const t of tasks) if (t.parentId && ids.has(t.parentId)) out.add(t.parentId)
  for (const t of tasks) if (t.type === 'summary') out.add(t.id)
  return out
}

export function isMilestone(t: GanttTask): boolean {
  return t.type === 'milestone' || (!t.end && t.type !== 'summary')
}

/** A task's span in ms, end exclusive: a date-only end runs to the next midnight; a milestone has none */
export function taskSpan(t: Pick<GanttTask, 'start' | 'end' | 'type'>): { start: number; end: number; dateOnly: boolean } {
  const start = parseDate(t.start)
  const dateOnly = isDateOnly(t.start)
  if (t.type === 'milestone' || !t.end) return { start, end: start, dateOnly }
  const e = parseDate(t.end)
  const end = isDateOnly(t.end) ? addDays(startOfDay(e), 1) : e
  return { start, end: Math.max(start, end), dateOnly }
}

/** The task's `start`/`end` strings for a span (end exclusive), in the format it came in */
export function spanDates(t: Pick<GanttTask, 'start' | 'end' | 'type'>, start: number, end: number): { start: string; end?: string } {
  const dateOnly = isDateOnly(t.start)
  if (t.type === 'milestone' || !t.end) return { start: formatDate(dateOnly ? startOfDay(start) : start, dateOnly) }
  if (dateOnly) {
    const s = startOfDay(start)
    const last = Math.max(s, startOfDay(end - 1))
    return { start: formatDate(s, true), end: formatDate(last, true) }
  }
  return { start: formatDate(start, false), end: formatDate(Math.max(start, end), false) }
}

/** Duration in whole days (date-only tasks) or fractions of a day */
export function taskDays(t: GanttTask): number {
  const s = taskSpan(t)
  return s.dateOnly ? daysBetween(s.start, s.end) : (s.end - s.start) / DAY
}

/**
 * Summaries take the span of their children (deepest first) and their progress, weighted by duration. Returns the
 * same array when nothing changes.
 */
export function rollupSummaries<T extends GanttTask>(tasks: readonly T[]): T[] {
  const sums = summaryIds(tasks)
  if (!sums.size) return tasks as T[]
  const kids = new Map<string, T[]>()
  for (const t of tasks) if (t.parentId && sums.has(t.parentId)) (kids.get(t.parentId) ?? kids.set(t.parentId, []).get(t.parentId)!).push(t)
  const out = new Map<string, T>()
  const visiting = new Set<string>()
  const resolve = (t: T): T => {
    if (!sums.has(t.id) || !kids.has(t.id)) return out.get(t.id) ?? t
    if (out.has(t.id)) return out.get(t.id)!
    if (visiting.has(t.id)) return t
    visiting.add(t.id)
    let start = Infinity
    let end = -Infinity
    let dateOnly = true
    let work = 0
    let done = 0
    for (const k of kids.get(t.id)!) {
      const r = resolve(k)
      const s = taskSpan(r)
      if (!Number.isFinite(s.start)) continue
      start = Math.min(start, s.start)
      end = Math.max(end, s.end)
      if (!s.dateOnly) dateOnly = false
      const w = Math.max(s.end - s.start, isMilestone(r) ? 0 : 1)
      work += w
      done += w * (r.progress ?? 0)
    }
    visiting.delete(t.id)
    if (!Number.isFinite(start)) return t
    const dates = dateOnly
      ? { start: formatDate(start, true), end: formatDate(Math.max(start, startOfDay(end - 1)), true) }
      : { start: formatDate(start, false), end: formatDate(end, false) }
    const progress = work ? Math.round(done / work) : (t.progress ?? 0)
    const next = dates.start === t.start && dates.end === t.end && progress === (t.progress ?? 0) ? t : { ...t, start: dates.start, end: dates.end, progress }
    out.set(t.id, next)
    return next
  }
  let changed = false
  const result = tasks.map((t) => {
    const r = resolve(t)
    if (r !== t) changed = true
    return r
  })
  return changed ? result : (tasks as T[])
}

// ── Working days ──────────────────────────────────────────────────────────────────────────────────────────

function calendarOf(c?: GanttCalendar) {
  return { days: c?.workingDays ?? [1, 2, 3, 4, 5], holidays: new Set(c?.holidays ?? []) }
}

/** Working days from `start` to `end`, both included (`YYYY-MM-DD`) */
export function workingDays(start: string, end: string, calendar?: GanttCalendar): number {
  const c = calendarOf(calendar)
  let n = 0
  const last = startOfDay(parseDate(end))
  for (let d = startOfDay(parseDate(start)); d <= last; d = addDays(d, 1)) if (isWorkingDay(d, c.days, c.holidays)) n++
  return n
}

/** The date `n` working days after `date` (before it when negative); 0 moves a day off to the next working day */
export function addWorkingDays(date: string, n: number, calendar?: GanttCalendar): string {
  const c = calendarOf(calendar)
  if (!c.days.length) return date
  let d = startOfDay(parseDate(date))
  while (!isWorkingDay(d, c.days, c.holidays)) d = addDays(d, 1)
  const step = n < 0 ? -1 : 1
  for (let left = Math.abs(n); left > 0; ) {
    d = addDays(d, step)
    if (isWorkingDay(d, c.days, c.holidays)) left--
  }
  return formatDate(d, true)
}

// ── Scheduling ────────────────────────────────────────────────────────────────────────────────────────────

interface Link { pred: string; succ: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number; key: string }

// Dependencies between plain tasks: one onto a summary applies to each of its tasks (as MS Project does), one
// from a summary is resolved against its span once its tasks are placed
function expandLinks(tasks: readonly GanttTask[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const sums = summaryIds(tasks)
  const kids = new Map<string, string[]>()
  for (const t of tasks) if (t.parentId && byId.has(t.parentId)) (kids.get(t.parentId) ?? kids.set(t.parentId, []).get(t.parentId)!).push(t.id)
  const leaves = (id: string, depth = 0): string[] => (sums.has(id) && kids.has(id) && depth < 100 ? kids.get(id)!.flatMap((k) => leaves(k, depth + 1)) : [id])
  const links: Link[] = []
  for (const t of tasks) {
    for (const raw of t.dependencies ?? []) {
      const d = normalizeDependency(raw)
      if (!byId.has(d.id) || d.id === t.id) continue
      for (const succ of leaves(t.id)) links.push({ pred: d.id, succ, type: d.type, lag: d.lag, key: `${d.id}>${t.id}` })
    }
  }
  return { byId, sums, kids, leaves, links }
}

// Order: a task after everything it waits for; a summary used as a predecessor after its tasks. Cycles are cut
function order(ids: string[], deps: Map<string, string[]>): string[] {
  const out: string[] = []
  const state = new Map<string, 1 | 2>()
  const visit = (id: string) => {
    if (state.get(id)) return
    state.set(id, 1)
    for (const p of deps.get(id) ?? []) if (state.get(p) !== 1) visit(p)
    state.set(id, 2)
    out.push(id)
  }
  for (const id of ids) visit(id)
  return out
}

/**
 * Moves tasks so every dependency holds: by default only later (`'push'`, what dragging a predecessor does), or as
 * soon as possible (`'asap'`), keeping each task's duration. Summaries follow their tasks. Returns the same array
 * when nothing moves.
 */
export function scheduleTasks<T extends GanttTask>(tasks: readonly T[], options: GanttScheduleOptions = {}): T[] {
  const { sums, kids, leaves, links } = expandLinks(tasks)
  const cal = options.calendar ? calendarOf(options.calendar) : null
  const spans = new Map<string, { start: number; end: number; dateOnly: boolean }>()
  for (const t of tasks) if (!sums.has(t.id)) spans.set(t.id, taskSpan(t))
  const deps = new Map<string, string[]>()
  for (const l of links) (deps.get(l.succ) ?? deps.set(l.succ, []).get(l.succ)!).push(l.pred)
  for (const s of sums) deps.set(s, [...(deps.get(s) ?? []), ...leaves(s)])
  const bySucc = new Map<string, Link[]>()
  for (const l of links) (bySucc.get(l.succ) ?? bySucc.set(l.succ, []).get(l.succ)!).push(l)

  const span = (id: string) => {
    if (!sums.has(id)) return spans.get(id)
    let start = Infinity
    let end = -Infinity
    for (const l of leaves(id)) {
      const s = spans.get(l)
      if (!s) continue
      start = Math.min(start, s.start)
      end = Math.max(end, s.end)
    }
    return Number.isFinite(start) ? { start, end, dateOnly: true } : undefined
  }
  // Shift by days, on working days with a calendar
  const shift = (ms: number, days: number, dateOnly: boolean) => {
    if (!cal || !dateOnly) return ms + days * DAY
    return parseDate(addWorkingDays(formatDate(ms, true), days, options.calendar))
  }
  const workLength = (s: { start: number; end: number }) => {
    let n = 0
    for (let d = s.start; d < s.end; d = addDays(d, 1)) if (isWorkingDay(d, cal!.days, cal!.holidays)) n++
    return n
  }

  let moved = false
  for (const id of order([...spans.keys(), ...sums], deps)) {
    if (sums.has(id)) continue
    const own = spans.get(id)!
    const incoming = bySucc.get(id)
    if (!incoming?.length || !Number.isFinite(own.start)) continue
    const dur = own.end - own.start
    let earliest = -Infinity
    for (const l of incoming) {
      const p = span(l.pred)
      if (!p) continue
      const pd = p.dateOnly && own.dateOnly
      let need: number
      if (l.type === 'FS') need = shift(p.end, l.lag, pd)
      else if (l.type === 'SS') need = shift(p.start, l.lag, pd)
      else if (l.type === 'FF') need = shift(p.end, l.lag, pd) - dur
      else need = shift(p.start, l.lag, pd) - dur
      earliest = Math.max(earliest, need)
    }
    if (!Number.isFinite(earliest)) continue
    let start = options.mode === 'asap' ? earliest : Math.max(own.start, earliest)
    if (own.dateOnly) start = startOfDay(start + 12 * 3_600_000)
    let end = start + dur
    if (cal && own.dateOnly) {
      // Starts on a working day and lasts as many working days as before
      const days = workLength(own)
      start = parseDate(addWorkingDays(formatDate(start, true), 0, options.calendar))
      end = days ? addDays(parseDate(addWorkingDays(formatDate(start, true), Math.max(0, days - 1), options.calendar)), 1) : start
    } else if (own.dateOnly) end = addDays(start, daysBetween(own.start, own.end))
    if (start !== own.start || end !== own.end) {
      spans.set(id, { start, end, dateOnly: own.dateOnly })
      moved = true
    }
  }
  if (!moved) return rollupSummaries(tasks)
  const next = tasks.map((t) => {
    if (sums.has(t.id) && kids.has(t.id)) return t
    const s = spans.get(t.id)
    const before = taskSpan(t)
    if (!s || (s.start === before.start && s.end === before.end)) return t
    return { ...t, ...spanDates(t, s.start, s.end) }
  })
  return rollupSummaries(next)
}

/**
 * The critical path over the tasks' current dates: tasks whose delay would delay the last one's end (no slack),
 * through their dependencies. Slack is in calendar days, or working days with a calendar (so a weekend between
 * two tasks isn't slack).
 */
export function criticalPath(tasks: readonly GanttTask[], options: { calendar?: GanttCalendar } = {}): GanttCriticalPath {
  const { sums, kids, leaves, links } = expandLinks(tasks)
  const real = new Map<string, { start: number; end: number }>()
  for (const t of tasks) if (!sums.has(t.id) || !kids.has(t.id)) real.set(t.id, taskSpan(t))
  const ids = [...real.keys()].filter((id) => Number.isFinite(real.get(id)!.start))
  if (!ids.length) return { tasks: [], dependencies: [], slack: {}, finish: '' }

  // Everything below runs in days: calendar days, or with a calendar working days (a day off has no length), so
  // the weekend between two tasks is neither slack nor duration
  const cal = options.calendar ? calendarOf(options.calendar) : null
  let toDays = (ms: number) => ms / DAY
  if (cal) {
    const first = startOfDay(Math.min(...ids.map((id) => real.get(id)!.start)))
    const index = new Map<number, number>()
    toDays = (ms: number) => {
      const day = startOfDay(ms)
      let n = index.get(day)
      if (n === undefined) {
        n = 0
        const step = day >= first ? 1 : -1
        for (let d = first; d !== day; d = addDays(d, step)) if (isWorkingDay(step > 0 ? d : addDays(d, -1), cal.days, cal.holidays)) n += step
        index.set(day, n)
      }
      return n + (isWorkingDay(day, cal.days, cal.holidays) ? (ms - day) / DAY : 0)
    }
  }
  const spans = new Map(ids.map((id) => [id, { start: toDays(real.get(id)!.start), end: toDays(real.get(id)!.end) }]))
  // Links from a summary come from each of its tasks
  const flat: Link[] = links.flatMap((l) => (sums.has(l.pred) && kids.has(l.pred) ? leaves(l.pred).map((p) => ({ ...l, pred: p })) : [l]))
    .filter((l) => spans.has(l.pred) && spans.has(l.succ))
  const finish = Math.max(...ids.map((id) => spans.get(id)!.end))
  const out = new Map<string, Link[]>()
  const deps = new Map<string, string[]>()
  for (const l of flat) {
    ;(out.get(l.pred) ?? out.set(l.pred, []).get(l.pred)!).push(l)
    ;(deps.get(l.succ) ?? deps.set(l.succ, []).get(l.succ)!).push(l.pred)
  }
  const late = new Map<string, number>()
  // Backward pass: successors first
  for (const id of order(ids, deps).reverse()) {
    const s = spans.get(id)!
    const dur = s.end - s.start
    let lf = finish
    for (const l of out.get(id) ?? []) {
      const ls = late.get(l.succ)
      if (ls === undefined) continue
      const succ = spans.get(l.succ)!
      const lfSucc = ls + (succ.end - succ.start)
      if (l.type === 'FS') lf = Math.min(lf, ls - l.lag)
      else if (l.type === 'SS') lf = Math.min(lf, ls - l.lag + dur)
      else if (l.type === 'FF') lf = Math.min(lf, lfSucc - l.lag)
      else lf = Math.min(lf, lfSucc - l.lag + dur)
    }
    late.set(id, lf - dur)
  }
  const slack: Record<string, number> = {}
  const critical = new Set<string>()
  for (const id of ids) {
    const days = late.get(id)! - spans.get(id)!.start
    slack[id] = Math.round(days * 1000) / 1000
    if (days < 1e-6) critical.add(id)
  }
  // A dependency is on the path when both ends are and it's what holds the successor back
  const tight = new Set<string>()
  for (const l of flat) {
    if (!critical.has(l.pred) || !critical.has(l.succ)) continue
    const p = spans.get(l.pred)!
    const s = spans.get(l.succ)!
    const from = (l.type === 'FS' || l.type === 'FF' ? p.end : p.start) + l.lag
    const to = l.type === 'FS' || l.type === 'SS' ? s.start : s.end
    if (Math.abs(to - from) < 1e-6) tight.add(l.key)
  }
  for (const s of sums) if (kids.has(s) && leaves(s).some((l) => critical.has(l))) critical.add(s)
  const end = Math.max(...ids.map((id) => real.get(id)!.end))
  const last = tasks.find((t) => real.get(t.id)?.end === end)
  return {
    tasks: tasks.filter((t) => critical.has(t.id)).map((t) => t.id),
    dependencies: [...tight],
    slack,
    finish: formatDate(isDateOnly(last?.start) ? addDays(end, -1) : end, isDateOnly(last?.start)),
  }
}
