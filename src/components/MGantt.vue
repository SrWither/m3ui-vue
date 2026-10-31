<script setup lang="ts">
/**
 * A Gantt chart: a task list (a tree, with columns) beside a timeline of bars you drag to move, pull at the ends to
 * resize, and join with dependencies. Not an M3 spec component: M3 parts (containers, state layers, motion) on the
 * layout planning tools share (MS Project, GanttProject, Frappe Gantt).
 *
 * Tasks are a `v-model` of plain objects (`GanttTask`): dates as `YYYY-MM-DD` (whole days) or datetimes, `progress`,
 * `parentId` for summaries (their dates roll up), `dependencies` (finish-to-start, start-to-start, finish-to-finish,
 * start-to-finish, with a lag), milestones and a baseline. The zoom runs from hours to years (`v-model:scale`,
 * Ctrl + wheel, a pinch); the timeline scrolls both ways, rows and columns rendered only near the view.
 *
 * Editing: drag a bar to move it (with a mouse, or a short press with a finger), its ends to resize it, the
 * triangle under it to set the progress, the dots at its ends onto another bar to make a dependency (which end you
 * leave and reach picks the type); click or tap a dependency for its × to remove it (or Delete). A summary moves
 * with its tasks; selected bars move together. With
 * `schedule="auto"` the tasks that depend on one follow it. Rows reorder by dragging them in the list (onto the
 * middle of a row to put it inside). Every edit is undoable (Ctrl+Z / Ctrl+Shift+Z).
 *
 * Keyboard (in the list): arrows move and expand/collapse, Alt + ←/→ moves the task a step, Alt + Shift + ←/→
 * changes its end, Alt + ↑/↓ reorders it, Ctrl + ] / [ indents and outdents it, F2 renames, Enter opens it
 * (`task-dblclick`), Delete deletes.
 *
 * @slot default Above the chart: MGanttControls, filters of yours. Props: `{ gantt }`
 * @slot bar A bar's content instead of its label. Props: `{ task, selected, critical }`
 * @slot cell-<key> A cell of that column. Props: `{ task, value }`
 * @slot tooltip The card shown over a hovered or dragged bar. Props: `{ task, slack }`
 * @slot empty Shown while there are no tasks
 * @event task-click / task-dblclick / task-contextmenu `(task, event)`
 * @event link A dependency was drawn: `{ from, to, type }` (it's also added to the task)
 * @event unlink A dependency was removed: `{ from, to }`
 * @event change A drag or a key changed tasks: `{ tasks, kind }` with the changed tasks and `'move' | 'resize' | 'progress' | 'reorder' | 'rename'`
 * @event delete Tasks were deleted: `{ tasks }`
 */
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, provide, ref, shallowRef, toRaw, useSlots, watch } from 'vue'
import { GANTT_KEY, TIMELINE_CONTROLS_KEY, type GanttColumn, type GanttContext, type GanttScale } from '../composables/useGantt'
import {
  criticalPath as computeCritical,
  isMilestone,
  normalizeDependency,
  rollupSummaries,
  scheduleTasks,
  spanDates,
  summaryIds,
  taskDays,
  taskSpan,
  type GanttCalendar,
  type GanttDependency,
  type GanttScheduleOptions,
  type GanttTask,
} from '../composables/ganttSchedule'
import { DAY, addDays, daysBetween, defaultSnap, formatDate, parseDate, snapTime } from '../composables/_ganttTime'
import { arrowPath } from '../composables/flowPaths'
import { playSamples, prefersReducedMotion, sampleSpring } from '../composables/_springAnimation'
import { useLocale } from '../composables/useLocale'
import { useTimeAxis } from '../composables/_useTimeAxis'
import MTimeHeader from './_MTimeHeader.vue'
import MTimeBackground from './_MTimeBackground.vue'

const props = withDefaults(defineProps<{
  tasks?: GanttTask[]
  /** The zoom as a named level; `v-model:scale` follows Ctrl + wheel, pinches and MGanttControls */
  scale?: GanttScale
  /** The starting zoom in px per day, between the named levels (instead of `scale`'s) */
  pxPerDay?: number
  /** Selected task ids (`v-model:selection`) */
  selection?: string[]
  /** Ids of tasks whose children are hidden (`v-model:collapsed`) */
  collapsed?: string[]
  /** The task list's columns (default name, start and duration); `[]` hides the list */
  columns?: GanttColumn[]
  /** The task list's width, px (`v-model:grid-width`; drag its edge) */
  gridWidth?: number
  rowHeight?: number
  /** No editing: drag, resize, link, reorder, rename and delete off */
  readonly?: boolean
  /** `'auto'`: tasks that depend on a moved one follow it (`scheduleTasks` in push mode) */
  schedule?: 'manual' | 'auto'
  /** Working days: shaded when they aren't, and counted by `schedule="auto"` (default Monday to Friday, no holidays) */
  calendar?: GanttCalendar
  /** Highlights the tasks and dependencies whose delay delays the end */
  criticalPath?: boolean
  /** Draws each task's `baselineStart`/`baselineEnd` under it */
  baselines?: boolean
  /** Today, for the line across the timeline (default now; `null` hides it) */
  today?: string | null
  /** Minutes a datetime task snaps to (default by zoom); date-only tasks always snap to days */
  snap?: number
  weekStartsOn?: 0 | 1
  /** Zoom bounds, px per day */
  minPxPerDay?: number
  maxPxPerDay?: number
  /** Locale for dates (Intl); default the app's */
  locale?: string
  /** Accessible name */
  label?: string
  /** Asked before deleting; return false (or a promise of it) to keep them */
  beforeDelete?: (tasks: GanttTask[]) => boolean | Promise<boolean>
}>(), {
  tasks: () => [],
  scale: 'day',
  rowHeight: 40,
  readonly: false,
  schedule: 'manual',
  criticalPath: false,
  baselines: false,
  weekStartsOn: 1,
  minPxPerDay: 0.15,
  maxPxPerDay: 2400,
})

const emit = defineEmits<{
  'update:tasks': [GanttTask[]]
  'update:scale': [GanttScale]
  'update:selection': [string[]]
  'update:collapsed': [string[]]
  'update:gridWidth': [number]
  'task-click': [GanttTask, MouseEvent]
  'task-dblclick': [GanttTask, MouseEvent | KeyboardEvent]
  'task-contextmenu': [GanttTask, MouseEvent]
  link: [{ from: string; to: string; type: NonNullable<GanttDependency['type']> }]
  unlink: [{ from: string; to: string }]
  change: [{ tasks: GanttTask[]; kind: 'move' | 'resize' | 'progress' | 'reorder' | 'rename' }]
  delete: [{ tasks: GanttTask[] }]
}>()

const slots = useSlots()
const locale = useLocale()
const lang = computed(() => props.locale ?? (locale.lang === 'en' ? undefined : locale.lang))

// ── Tasks, history ────────────────────────────────────────────────────────────────────────────────────────
// What was last emitted, so a parent without v-model still sees its edits
const current = shallowRef<GanttTask[]>(props.tasks)
watch(() => props.tasks, (t) => { current.value = t })
const preview = shallowRef<GanttTask[] | null>(null)
const rolled = computed(() => rollupSummaries(toRaw(current.value)))
const shown = computed(() => preview.value ?? rolled.value)

const past: GanttTask[][] = []
const future: GanttTask[][] = []
const historyTick = ref(0)
function emitTasks(next: GanttTask[]) {
  current.value = next
  emit('update:tasks', next)
}
function commit(next: GanttTask[]) {
  next = rollupSummaries(next)
  if (next === rolled.value) return
  past.push(toRaw(current.value))
  if (past.length > 100) past.shift()
  future.length = 0
  historyTick.value++
  emitTasks(next)
}
function undo() {
  const prev = past.pop()
  if (!prev) return
  future.push(toRaw(current.value))
  historyTick.value++
  emitTasks(prev)
}
function redo() {
  const next = future.pop()
  if (!next) return
  past.push(toRaw(current.value))
  historyTick.value++
  emitTasks(next)
}
const canUndo = computed(() => (historyTick.value, past.length > 0))
const canRedo = computed(() => (historyTick.value, future.length > 0))

const byId = computed(() => new Map(shown.value.map((t) => [t.id, t])))
const sums = computed(() => summaryIds(shown.value))
const childrenOf = computed(() => {
  const m = new Map<string | undefined, GanttTask[]>()
  for (const t of shown.value) {
    const p = t.parentId && byId.value.has(t.parentId) ? t.parentId : undefined
    ;(m.get(p) ?? m.set(p, []).get(p)!).push(t)
  }
  return m
})
function descendants(id: string, out: string[] = [], depth = 0): string[] {
  if (depth > 100) return out
  for (const c of childrenOf.value.get(id) ?? []) {
    out.push(c.id)
    descendants(c.id, out, depth + 1)
  }
  return out
}

// ── Selection and folding ─────────────────────────────────────────────────────────────────────────────────
const selected = ref<string[]>(props.selection ?? [])
watch(() => props.selection, (s) => { if (s) selected.value = s })
const selectedSet = computed(() => new Set(selected.value))
function setSelection(ids: string[]) {
  const ok = ids.filter((id) => byId.value.get(id)?.selectable !== false)
  selected.value = ok
  emit('update:selection', ok)
}
const folded = ref<string[]>(props.collapsed ?? [])
watch(() => props.collapsed, (c) => { if (c) folded.value = c })
const foldedSet = computed(() => new Set(folded.value))
function setFolded(ids: string[]) {
  folded.value = ids
  emit('update:collapsed', ids)
}
function toggle(id: string, expanded?: boolean) {
  const open = expanded ?? foldedSet.value.has(id)
  setFolded(open ? folded.value.filter((x) => x !== id) : [...folded.value, id])
}

// The rows, in tree order, without what's folded away
const rows = computed(() => {
  const out: { task: GanttTask; depth: number; parent: boolean }[] = []
  const walk = (p: string | undefined, depth: number) => {
    for (const t of childrenOf.value.get(p) ?? []) {
      const kids = childrenOf.value.has(t.id)
      out.push({ task: t, depth, parent: kids })
      if (kids && !foldedSet.value.has(t.id) && depth < 100) walk(t.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return out
})
const rowIndex = computed(() => new Map(rows.value.map((r, i) => [r.task.id, i])))

// ── Zoom and time ↔ px ────────────────────────────────────────────────────────────────────────────────────
const scroller = ref<HTMLElement>()
const headerHeight = 56
const defaultColumns = computed<GanttColumn[]>(() => [
  { key: 'name', label: locale.ganttTask },
  { key: 'start', label: locale.ganttStart, width: 96 },
  { key: 'duration', label: locale.ganttDuration, width: 80, align: 'end' },
])
const columnList = computed(() => props.columns ?? defaultColumns.value)
const showGrid = computed(() => columnList.value.length > 0)
const gridW = ref(props.gridWidth ?? 320)
watch(() => props.gridWidth, (w) => { if (w !== undefined) gridW.value = w })
const listWidth = computed(() => (showGrid.value ? gridW.value : 0))

const extent = computed(() => {
  let min = Infinity
  let max = -Infinity
  for (const t of shown.value) {
    const s = taskSpan(t)
    if (!Number.isFinite(s.start)) continue
    min = Math.min(min, s.start)
    max = Math.max(max, s.end)
    if (props.baselines && t.baselineStart) {
      const b = taskSpan({ start: t.baselineStart, end: t.baselineEnd, type: t.type })
      if (Number.isFinite(b.start)) { min = Math.min(min, b.start); max = Math.max(max, b.end) }
    }
  }
  if (!Number.isFinite(min)) min = max = props.today ? parseDate(props.today) : Date.now()
  return { min, max }
})
const axis = useTimeAxis({
  scroller,
  listWidth,
  headerHeight,
  extent,
  scale: () => props.scale,
  pxPerDay: () => props.pxPerDay,
  minPxPerDay: () => props.minPxPerDay,
  maxPxPerDay: () => props.maxPxPerDay,
  weekStartsOn: () => props.weekStartsOn,
  lang,
  quarterLabel: () => locale.ganttQuarter,
  today: () => props.today,
  calendar: () => props.calendar,
  onScale: (s) => emit('update:scale', s),
  onPinch: () => { if (gesture) onCancel({ pointerId: gesture.id } as PointerEvent) },
})
const { ppd, view, timelineView, origin, timelineWidth, todayMs, xOf, timeAt, zoomIn, zoomOut, setScale, scrollToDate, topCells, bottomCells, offTimes } = axis
const scaleNow = axis.scaleNow

function scrollToTask(id: string) {
  let t = byId.value.get(id)
  // Unfold what hides it
  const hidden: string[] = []
  for (let p = t?.parentId; p && byId.value.has(p); p = byId.value.get(p)!.parentId) if (foldedSet.value.has(p)) hidden.push(p)
  if (hidden.length) setFolded(folded.value.filter((f) => !hidden.includes(f)))
  nextTick(() => {
    t = byId.value.get(id)
    const i = rowIndex.value.get(id)
    if (!t || i === undefined || !scroller.value) return
    const s = taskSpan(t)
    const top = i * props.rowHeight
    const el = scroller.value
    let y = el.scrollTop
    const body = el.clientHeight - headerHeight
    if (top < y) y = top
    else if (top + props.rowHeight > y + body) y = top + props.rowHeight - body
    let x = el.scrollLeft
    const bx = xOf(s.start)
    if (bx < x || bx > x + timelineView.value - 40) x = Math.max(0, bx - 48)
    el.scrollTo({ left: x, top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  })
}

// ── Rows in view ──────────────────────────────────────────────────────────────────────────────────────────
const OVERSCAN = 6
const firstRow = computed(() => Math.max(0, Math.floor(view.value.top / props.rowHeight) - OVERSCAN))
const lastRow = computed(() => Math.min(rows.value.length, Math.ceil((view.value.top + view.value.height) / props.rowHeight) + OVERSCAN))
const visibleRows = computed(() => rows.value.slice(firstRow.value, lastRow.value).map((r, i) => ({ ...r, index: firstRow.value + i })))
const bodyHeight = computed(() => Math.max(rows.value.length * props.rowHeight, view.value.height - headerHeight))

// ── Bars: geometry, springs ───────────────────────────────────────────────────────────────────────────────
const barH = computed(() => Math.round(props.rowHeight * 0.6))
const critical = computed(() => (props.criticalPath ? computeCritical(shown.value, { calendar: props.calendar }) : null))
const criticalPathInfo = computed(() => critical.value ?? computeCritical(shown.value, { calendar: props.calendar }))
const criticalSet = computed(() => new Set(critical.value?.tasks ?? []))
const criticalLinks = computed(() => new Set(critical.value?.dependencies ?? []))

type Geo = { x: number; w: number }
const geometry = computed(() => {
  const m = new Map<string, Geo>()
  for (const t of shown.value) {
    const s = taskSpan(t)
    if (!Number.isFinite(s.start)) continue
    m.set(t.id, { x: xOf(s.start), w: isMilestone(t) ? 0 : Math.max(2, xOf(s.end) - xOf(s.start)) })
  }
  return m
})
const springs = new Map<string, { x: number; w: number; vx: number; vw: number; tx: number; tw: number }>()
const barEls = new Map<string, HTMLElement>()
const linkEls = new Map<string, SVGGElement>()
let springRaf = 0
let lastZoom = { ppd: ppd.value, origin: origin.value }
watch(geometry, (g) => {
  // A zoom or a moved origin redraws everything where it is; anything else springs there
  const instant = lastZoom.ppd !== ppd.value || lastZoom.origin !== origin.value || prefersReducedMotion()
  lastZoom = { ppd: ppd.value, origin: origin.value }
  let animate = false
  for (const [id, t] of g) {
    const s = springs.get(id)
    if (!s || instant) {
      springs.set(id, { x: t.x, w: t.w, vx: 0, vw: 0, tx: t.x, tw: t.w })
      continue
    }
    if (s.tx !== t.x || s.tw !== t.w) { s.tx = t.x; s.tw = t.w; animate = true }
  }
  for (const id of springs.keys()) if (!g.has(id)) springs.delete(id)
  if (animate) startSprings()
  else writeAll()
}, { immediate: true, flush: 'post' })
function startSprings() {
  if (springRaf) return
  let last = performance.now()
  const step = (now: number) => {
    let dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    let moving = false
    while (dt > 0) {
      const h = Math.min(dt, 0.004)
      for (const s of springs.values()) {
        if (s.x === s.tx && s.w === s.tw && !s.vx && !s.vw) continue
        s.vx += (-700 * (s.x - s.tx) - 2 * 0.9 * Math.sqrt(700) * s.vx) * h
        s.x += s.vx * h
        s.vw += (-700 * (s.w - s.tw) - 2 * 0.9 * Math.sqrt(700) * s.vw) * h
        s.w += s.vw * h
      }
      dt -= h
    }
    for (const s of springs.values()) {
      if (Math.abs(s.x - s.tx) < 0.3 && Math.abs(s.vx) < 2 && Math.abs(s.w - s.tw) < 0.3 && Math.abs(s.vw) < 2) {
        s.x = s.tx; s.w = s.tw; s.vx = 0; s.vw = 0
      } else moving = true
    }
    writeAll()
    springRaf = moving ? requestAnimationFrame(step) : 0
  }
  springRaf = requestAnimationFrame(step)
}
function writeBar(id: string, el: HTMLElement) {
  const s = springs.get(id)
  if (!s) return
  el.style.transform = `translateX(${s.x}px)`
  el.style.width = `${s.w}px`
}
function writeAll() {
  for (const [id, el] of barEls) writeBar(id, el)
  for (const [key, el] of linkEls) writeLink(key, el)
}
function bindBar(id: string, el: unknown) {
  if (el instanceof HTMLElement) {
    barEls.set(id, el)
    writeBar(id, el)
  } else barEls.delete(id)
}
// The bar's span right now (sprung), for links and hit tests
const liveGeo = (id: string): Geo | undefined => springs.get(id) ?? geometry.value.get(id)

// ── Dependencies ──────────────────────────────────────────────────────────────────────────────────────────
interface LinkInfo { key: string; from: string; to: string; type: NonNullable<GanttDependency['type']>; lag: number }
const links = computed(() => {
  const out: LinkInfo[] = []
  for (const t of shown.value) {
    for (const raw of t.dependencies ?? []) {
      const d = normalizeDependency(raw)
      if (byId.value.has(d.id)) out.push({ key: `${d.id}>${t.id}`, from: d.id, to: t.id, type: d.type, lag: d.lag })
    }
  }
  return out
})
// A link to or from a folded task is drawn from its nearest visible summary
function visibleRowOf(id: string): number | undefined {
  let t = byId.value.get(id)
  for (let i = 0; t && i < 100; i++) {
    const r = rowIndex.value.get(t.id)
    if (r !== undefined) return r
    t = t.parentId ? byId.value.get(t.parentId) : undefined
  }
  return undefined
}
const visibleLinks = computed(() => {
  const top = firstRow.value
  const bottom = lastRow.value
  return links.value.filter((l) => {
    const a = visibleRowOf(l.from)
    const b = visibleRowOf(l.to)
    if (a === undefined || b === undefined || a === b) return false
    return Math.min(a, b) <= bottom && Math.max(a, b) >= top
  })
})
const GAP = 10
function linkPoints(l: LinkInfo): [number, number][] | null {
  const ra = visibleRowOf(l.from)
  const rb = visibleRowOf(l.to)
  if (ra === undefined || rb === undefined) return null
  // A folded task's links start and end at the row that shows it
  const p = liveGeo(rows.value[ra]!.task.id)
  const s = liveGeo(rows.value[rb]!.task.id)
  if (!p || !s) return null
  const rh = props.rowHeight
  const y1 = ra * rh + rh / 2
  const y2 = rb * rh + rh / 2
  const fromEnd = l.type === 'FS' || l.type === 'FF'
  const toStart = l.type === 'FS' || l.type === 'SS'
  // Milestones are diamonds: links touch their points
  const half = (g: Geo) => (g.w ? 0 : barH.value * 0.4)
  const x1 = fromEnd ? p.x + p.w + half(p) : p.x - half(p)
  const x2 = toStart ? s.x - half(s) : s.x + s.w + half(s)
  const a = x1 + (fromEnd ? GAP : -GAP)
  const b = x2 + (toStart ? -GAP : GAP)
  const direct = toStart ? a <= b : a >= b
  if (direct) return [[x1, y1], [a, y1], [a, y2], [x2, y2]]
  const ym = y2 > y1 ? rb * rh : (rb + 1) * rh
  return [[x1, y1], [a, y1], [a, ym], [b, ym], [b, y2], [x2, y2]]
}
function roundedPath(pts: [number, number][], r = 6): string {
  let d = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]!
    const [x, y] = pts[i]!
    const [nx, ny] = pts[i + 1]!
    const l1 = Math.hypot(x - px, y - py)
    const l2 = Math.hypot(nx - x, ny - y)
    const k = Math.min(r, l1 / 2, l2 / 2)
    if (k < 0.5) { d += ` L${x},${y}`; continue }
    const ax = x - ((x - px) / l1) * k
    const ay = y - ((y - py) / l1) * k
    const bx = x + ((nx - x) / l2) * k
    const by = y + ((ny - y) / l2) * k
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`
  }
  const [lx, ly] = pts.at(-1)!
  return `${d} L${lx},${ly}`
}
function writeLink(key: string, g: SVGGElement) {
  const l = links.value.find((x) => x.key === key)
  const pts = l && linkPoints(l)
  if (!pts) return
  const d = roundedPath(pts)
  const [x2, y2] = pts.at(-1)!
  const toStart = l!.type === 'FS' || l!.type === 'SS'
  const paths = g.querySelectorAll('path')
  paths[0]?.setAttribute('d', d)
  paths[1]?.setAttribute('d', d)
  paths[2]?.setAttribute('d', arrowPath(x2, y2, toStart ? 0 : Math.PI, 7, true))
}
function bindLink(key: string, el: unknown) {
  if (el instanceof SVGGElement) {
    linkEls.set(key, el)
    writeLink(key, el)
  } else linkEls.delete(key)
}
const selectedLink = ref<string | null>(null)
const selectedLinkMid = computed(() => {
  const l = links.value.find((x) => x.key === selectedLink.value)
  const pts = l && linkPoints(l)
  if (!pts) return null
  const i = Math.floor((pts.length - 1) / 2)
  return { x: (pts[i]![0] + pts[i + 1]![0]) / 2, y: (pts[i]![1] + pts[i + 1]![1]) / 2 }
})
function unlink(from: string, to: string) {
  const t = current.value.find((x) => x.id === to)
  if (!t?.dependencies?.some((d) => normalizeDependency(d).id === from)) return
  commit(current.value.map((x) => (x.id === to ? { ...x, dependencies: x.dependencies!.filter((d) => normalizeDependency(d).id !== from) } : x)))
  if (selectedLink.value === `${from}>${to}`) selectedLink.value = null
  emit('unlink', { from, to })
  announce(locale.ganttUnlink)
}
// Whether `a` already waits on `b`, through any chain
function dependsOn(a: string, b: string): boolean {
  const seen = new Set<string>()
  const stack = [a]
  while (stack.length) {
    const id = stack.pop()!
    if (id === b) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const d of byId.value.get(id)?.dependencies ?? []) stack.push(normalizeDependency(d).id)
  }
  return false
}
function canLink(from: string, to: string) {
  if (from === to || props.readonly) return false
  const a = byId.value.get(from)
  const b = byId.value.get(to)
  if (!a || !b || a.linkable === false || b.linkable === false) return false
  // Not within its own family, not twice, not in a circle
  if (descendants(from).includes(to) || descendants(to).includes(from)) return false
  if (b.dependencies?.some((d) => normalizeDependency(d).id === from)) return false
  return !dependsOn(from, to)
}
function link(from: string, to: string, type: NonNullable<GanttDependency['type']> = 'FS', lag = 0) {
  if (!canLink(from, to)) return
  const dep: string | GanttDependency = type === 'FS' && !lag ? from : { id: from, type, ...(lag ? { lag } : {}) }
  let next = current.value.map((x) => (x.id === to ? { ...x, dependencies: [...(x.dependencies ?? []), dep] } : x))
  if (props.schedule === 'auto') next = scheduleTasks(next, scheduleOptions())
  commit(next)
  emit('link', { from, to, type })
  announce(locale.ganttLinked.replace('{from}', byId.value.get(from)?.name ?? from).replace('{to}', byId.value.get(to)?.name ?? to))
}
const scheduleOptions = (): GanttScheduleOptions => ({ calendar: props.calendar ? props.calendar : undefined })

// ── Editing API ───────────────────────────────────────────────────────────────────────────────────────────
function addTasks(tasks: GanttTask | GanttTask[], opts: { after?: string } = {}) {
  const list = Array.isArray(tasks) ? tasks : [tasks]
  const next = [...current.value]
  let at = opts.after ? next.findIndex((t) => t.id === opts.after) : -1
  if (at >= 0) {
    // After its subtree
    const sub = new Set(descendants(opts.after!))
    while (at + 1 < next.length && sub.has(next[at + 1]!.id)) at++
    next.splice(at + 1, 0, ...list)
  } else next.push(...list)
  commit(next)
}
function updateTask(id: string, patch: Partial<GanttTask> | ((t: GanttTask) => GanttTask)) {
  let next = current.value.map((t) => (t.id === id ? (typeof patch === 'function' ? patch(t) : { ...t, ...patch }) : t))
  if (props.schedule === 'auto') next = scheduleTasks(next, scheduleOptions())
  commit(next)
}
async function removeTasks(ids: string[]) {
  const gone = new Set<string>()
  for (const id of ids) {
    const t = byId.value.get(id)
    if (!t || t.deletable === false) continue
    gone.add(id)
    for (const d of descendants(id)) gone.add(d)
  }
  if (!gone.size) return
  const removed = current.value.filter((t) => gone.has(t.id))
  if (props.beforeDelete && !(await props.beforeDelete(removed))) return
  commit(current.value
    .filter((t) => !gone.has(t.id))
    .map((t) => (t.dependencies?.some((d) => gone.has(normalizeDependency(d).id)) ? { ...t, dependencies: t.dependencies.filter((d) => !gone.has(normalizeDependency(d).id)) } : t)))
  setSelection(selected.value.filter((id) => !gone.has(id)))
  emit('delete', { tasks: removed })
  announce(locale.ganttDeleted.replace('{count}', String(removed.length)))
}
function runSchedule(options?: GanttScheduleOptions) {
  commit(scheduleTasks(current.value, { ...scheduleOptions(), ...options }))
}
function dateAt(clientX: number) {
  const r = scroller.value?.getBoundingClientRect()
  const x = clientX - (r?.left ?? 0) - listWidth.value + view.value.left
  return formatDate(snapTime(timeAt(x), 1440), true)
}

// ── Pointer gestures on the timeline ──────────────────────────────────────────────────────────────────────
type Part = 'body' | 'start' | 'end' | 'progress' | 'link-start' | 'link-end'
type Gesture =
  | { kind: 'bar'; part: Part; id: number; taskId: string; sx: number; sy: number; sl: number; touch: boolean; active: boolean; spans: Map<string, { start: number; end: number }>; moving: string[] }
  | { kind: 'pan'; id: number; sx: number; sy: number; sl: number; st: number; moved: boolean }
  | { kind: 'row'; id: number; taskId: string; sx: number; sy: number; st: number; touch: boolean; active: boolean }
  | { kind: 'split'; id: number; sx: number; w: number }
let gesture: Gesture | null = null
let pressTimer: ReturnType<typeof setTimeout> | undefined
const dragging = ref<{ taskId: string; part: Part } | null>(null)
const linkDraft = ref<{ from: string; fromEnd: boolean; x: number; y: number; target: string | null; targetEnd: boolean; valid: boolean } | null>(null)
const rowDrop = ref<{ taskId: string; target: string; where: 'before' | 'after' | 'inside' } | null>(null)
const pointer = { x: 0, y: 0 }

function contentPoint(clientX: number, clientY: number) {
  const r = scroller.value!.getBoundingClientRect()
  return { x: clientX - r.left - listWidth.value + scroller.value!.scrollLeft, y: clientY - r.top - headerHeight + scroller.value!.scrollTop }
}
const isControl = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, select, button, a, [contenteditable], [data-gantt-action]')

function onBarDown(e: PointerEvent, task: GanttTask, part: Part) {
  if (e.button !== 0 || isControl(e.target)) return
  if (props.readonly && part !== 'body') return
  e.stopPropagation()
  const touch = e.pointerType === 'touch'
  gesture = { kind: 'bar', part, id: e.pointerId, taskId: task.id, sx: e.clientX, sy: e.clientY, sl: scroller.value!.scrollLeft, touch, active: false, spans: new Map(), moving: [] }
  addWindow()
  // A finger scrolls unless it holds still a moment first; handles take it at once
  if (touch && part === 'body') pressTimer = setTimeout(() => activate(e), 250)
  else if (touch) activate(e)
}
function onPaneDown(e: PointerEvent) {
  if (e.button !== 0 || e.pointerType === 'touch' || isControl(e.target)) return
  gesture = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, sl: scroller.value!.scrollLeft, st: scroller.value!.scrollTop, moved: false }
  addWindow()
}
function onRowDown(e: PointerEvent, task: GanttTask) {
  if (e.button !== 0 || isControl(e.target) || props.readonly || editing.value) return
  const touch = e.pointerType === 'touch'
  gesture = { kind: 'row', id: e.pointerId, taskId: task.id, sx: e.clientX, sy: e.clientY, st: scroller.value!.scrollTop, touch, active: false }
  addWindow()
  if (touch) pressTimer = setTimeout(() => activate(e), 350)
}
function onSplitDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  gesture = { kind: 'split', id: e.pointerId, sx: e.clientX, w: gridW.value }
  addWindow()
}
function addWindow() {
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
}
function removeWindow() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  clearTimeout(pressTimer)
  document.body.style.userSelect = ''
}

function activate(e: PointerEvent) {
  const g = gesture
  if (!g || (g.kind !== 'bar' && g.kind !== 'row') || g.active) return
  const t = byId.value.get(g.taskId)
  if (!t) return
  if (g.kind === 'bar') {
    if (g.part === 'body' && (props.readonly || t.draggable === false)) return
    if ((g.part === 'start' || g.part === 'end') && t.resizable === false) return
    if ((g.part === 'link-start' || g.part === 'link-end') && t.linkable === false) return
    g.active = true
    // What moves: the task (or the selection, if it's in it), summaries with all their tasks
    const roots = g.part === 'body' && selectedSet.value.has(t.id) ? selected.value : [t.id]
    const moving = new Set<string>()
    for (const id of roots) {
      const r = byId.value.get(id)
      if (!r || r.draggable === false) continue
      moving.add(id)
      for (const d of descendants(id)) moving.add(d)
    }
    g.moving = g.part === 'body' ? [...moving] : [t.id]
    for (const id of g.moving) {
      const s = taskSpan(byId.value.get(id)!)
      g.spans.set(id, { start: s.start, end: s.end })
    }
    if (!selectedSet.value.has(t.id)) setSelection([t.id])
    dragging.value = { taskId: t.id, part: g.part }
    if (g.part === 'link-start' || g.part === 'link-end') {
      const p = contentPoint(e.clientX, e.clientY)
      linkDraft.value = { from: t.id, fromEnd: g.part === 'link-end', x: p.x, y: p.y, target: null, targetEnd: false, valid: false }
    }
  } else {
    g.active = true
    dragging.value = { taskId: t.id, part: 'body' }
  }
  if (g.touch) navigator.vibrate?.(10)
  document.body.style.userSelect = 'none'
  startAutoScroll()
}

function onMove(e: PointerEvent) {
  const g = gesture
  if (!g || g.id !== e.pointerId) return
  pointer.x = e.clientX
  pointer.y = e.clientY
  if (g.kind === 'split') {
    const w = Math.round(Math.min(Math.max(120, g.w + e.clientX - g.sx), Math.max(160, view.value.width - 80)))
    gridW.value = w
    emit('update:gridWidth', w)
    return
  }
  if (g.kind === 'pan') {
    const dx = e.clientX - g.sx
    const dy = e.clientY - g.sy
    if (!g.moved && Math.hypot(dx, dy) < 4) return
    g.moved = true
    scroller.value!.scrollLeft = g.sl - dx
    scroller.value!.scrollTop = g.st - dy
    return
  }
  if (!g.active) {
    const d = Math.hypot(e.clientX - g.sx, e.clientY - g.sy)
    if (g.touch) {
      // Moving before the press is long enough: it's a scroll
      if (d > 8) { gesture = null; removeWindow() }
      return
    }
    if (d < 4) return
    activate(e)
    if (!g.active) return
  }
  dragTo(e.clientX, e.clientY)
}

function snapStep(t: GanttTask) {
  return taskSpan(t).dateOnly ? 1440 : (props.snap ?? defaultSnap(ppd.value))
}
function dragTo(clientX: number, clientY: number) {
  const g = gesture
  if (!g || (g.kind !== 'bar' && g.kind !== 'row') || !g.active) return
  if (g.kind === 'row') return dragRow(clientY)
  const p = contentPoint(clientX, clientY)
  const dx = clientX - g.sx + (scroller.value!.scrollLeft - g.sl)
  const dt = (dx / ppd.value) * DAY
  const lead = byId.value.get(g.taskId)!
  const base = rolled.value
  if (g.part === 'link-start' || g.part === 'link-end') {
    const hit = barAt(clientX, clientY)
    const target = hit && hit !== g.taskId ? hit : null
    const geo = target ? liveGeo(target) : undefined
    const targetEnd = !!geo && p.x > geo.x + geo.w / 2
    linkDraft.value = { from: g.taskId, fromEnd: g.part === 'link-end', x: p.x, y: p.y, target, targetEnd, valid: !!target && canLink(g.taskId, target) }
    return
  }
  const patched = new Map<string, GanttTask>()
  if (g.part === 'progress') {
    const s = g.spans.get(g.taskId)!
    const x0 = xOf(s.start)
    const w = Math.max(1, xOf(s.end) - x0)
    const progress = Math.round(Math.min(100, Math.max(0, ((p.x - x0) / w) * 100)))
    patched.set(g.taskId, { ...lead, progress })
  } else if (g.part === 'body') {
    // The lead task snaps; the rest move by the same amount
    const s0 = g.spans.get(g.taskId)!
    const step = snapStep(lead)
    const snapped = snapTime(s0.start + dt, step)
    const days = taskSpan(lead).dateOnly ? daysBetween(s0.start, snapped) : 0
    const shift = snapped - s0.start
    for (const id of g.moving) {
      const t = base.find((x) => x.id === id)
      const s = g.spans.get(id)
      if (!t || !s || (sums.value.has(id) && childrenOf.value.has(id))) continue
      const dateOnly = taskSpan(t).dateOnly
      const ns = dateOnly ? addDays(s.start, days || Math.round(shift / DAY)) : s.start + shift
      const ne = dateOnly ? addDays(s.end, days || Math.round(shift / DAY)) : s.end + shift
      patched.set(id, { ...t, ...spanDates(t, ns, ne) })
    }
  } else {
    const s0 = g.spans.get(g.taskId)!
    const step = snapStep(lead)
    const min = taskSpan(lead).dateOnly ? DAY : step * 60_000
    if (g.part === 'start') {
      const ns = Math.min(snapTime(s0.start + dt, step), s0.end - min)
      patched.set(g.taskId, { ...lead, ...spanDates(lead, ns, s0.end) })
    } else {
      const ne = Math.max(snapTime(s0.end + dt, step), s0.start + min)
      patched.set(g.taskId, { ...lead, ...spanDates(lead, s0.start, ne) })
    }
  }
  let next = base.map((t) => patched.get(t.id) ?? t)
  if (props.schedule === 'auto' && g.part !== 'progress') next = scheduleTasks(next, scheduleOptions())
  preview.value = rollupSummaries(next)
}
function barAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint?.(clientX, clientY)
  const bar = el?.closest('[data-gantt-task]')
  if (bar) return bar.getAttribute('data-gantt-task')
  // Anywhere on a row also counts
  const p = contentPoint(clientX, clientY)
  const r = rows.value[Math.floor(p.y / props.rowHeight)]
  return r?.task.id ?? null
}

function dragRow(clientY: number) {
  const g = gesture as Extract<Gesture, { kind: 'row' }>
  const r = scroller.value!.getBoundingClientRect()
  const y = clientY - r.top - headerHeight + scroller.value!.scrollTop
  const i = Math.max(0, Math.min(rows.value.length - 1, Math.floor(y / props.rowHeight)))
  const target = rows.value[i]!.task
  const f = y / props.rowHeight - i
  const blocked = target.id === g.taskId || descendants(g.taskId).includes(target.id)
  const where: 'before' | 'after' | 'inside' = f < 0.3 ? 'before' : f > 0.7 ? 'after' : 'inside'
  rowDrop.value = blocked ? null : { taskId: g.taskId, target: target.id, where }
}
function moveRow(id: string, target: string, where: 'before' | 'after' | 'inside') {
  const list = current.value
  const moving = new Set([id, ...descendants(id)])
  const block = list.filter((t) => moving.has(t.id))
  const rest = list.filter((t) => !moving.has(t.id))
  const tIndex = rest.findIndex((t) => t.id === target)
  if (tIndex < 0) return
  const targetTask = rest[tIndex]!
  let at = tIndex
  if (where !== 'before') {
    // After the target's own subtree
    const sub = new Set(descendants(target))
    at = tIndex + 1
    while (at < rest.length && sub.has(rest[at]!.id)) at++
  }
  const parentId = where === 'inside' ? target : targetTask.parentId
  const head = block[0]!
  const moved = { ...head, parentId } as GanttTask
  if (!parentId) delete moved.parentId
  block[0] = moved
  const next = [...rest.slice(0, at), ...block, ...rest.slice(at)]
  if (where === 'inside' && foldedSet.value.has(target)) toggle(target, true)
  commit(next)
  const pos = rows.value.findIndex((r) => r.task.id === id) + 1
  emit('change', { tasks: [moved], kind: 'reorder' })
  nextTick(() => announce(locale.ganttReordered.replace('{name}', moved.name).replace('{pos}', String(rows.value.findIndex((r) => r.task.id === id) + 1 || pos))))
}

function onUp(e: PointerEvent) {
  const g = gesture
  if (!g || g.id !== e.pointerId) return
  gesture = null
  removeWindow()
  stopAutoScroll()
  if (g.kind === 'pan' || g.kind === 'split') return
  if (g.kind === 'row') {
    dragging.value = null
    const drop = rowDrop.value
    rowDrop.value = null
    if (g.active && drop) moveRow(drop.taskId, drop.target, drop.where)
    return
  }
  dragging.value = null
  if (!g.active) {
    const t = byId.value.get(g.taskId)
    if (!t) return
    selectFromClick(t, e)
    emit('task-click', t, e)
    return
  }
  if (g.part === 'link-start' || g.part === 'link-end') {
    const d = linkDraft.value
    linkDraft.value = null
    if (d?.target && d.valid) link(d.from, d.target, d.fromEnd ? (d.targetEnd ? 'FF' : 'FS') : d.targetEnd ? 'SF' : 'SS')
    return
  }
  const next = preview.value
  preview.value = null
  if (!next) return
  const before = new Map(rolled.value.map((t) => [t.id, t]))
  const changed = next.filter((t) => before.get(t.id) && before.get(t.id) !== t && !(sums.value.has(t.id) && childrenOf.value.has(t.id)))
  if (!changed.length) return
  // Keep the order and the objects of what didn't change
  const byNext = new Map(next.map((t) => [t.id, t]))
  commit(current.value.map((t) => (changed.some((c) => c.id === t.id) ? byNext.get(t.id)! : t)))
  const kind = g.part === 'progress' ? 'progress' : g.part === 'body' ? 'move' : 'resize'
  emit('change', { tasks: changed, kind })
  const lead = byNext.get(g.taskId)!
  if (kind === 'progress') announce(locale.ganttProgressSet.replace('{name}', lead.name).replace('{progress}', String(lead.progress ?? 0)))
  else announce(locale.ganttMoved.replace('{name}', lead.name).replace('{start}', formatShort(lead.start)).replace('{end}', formatShort(lead.end ?? lead.start)))
}
function onCancel(e: PointerEvent) {
  if (!gesture || gesture.id !== e.pointerId) return
  gesture = null
  removeWindow()
  stopAutoScroll()
  preview.value = null
  dragging.value = null
  linkDraft.value = null
  rowDrop.value = null
}

function selectFromClick(t: GanttTask, e: MouseEvent) {
  selectedLink.value = null
  if (t.selectable === false) return
  if (e.shiftKey || e.metaKey || e.ctrlKey) setSelection(selectedSet.value.has(t.id) ? selected.value.filter((x) => x !== t.id) : [...selected.value, t.id])
  else setSelection([t.id])
  focusedId.value = t.id
}

// Scroll while a drag is held near an edge
let autoRaf = 0
function startAutoScroll() {
  if (autoRaf) return
  const step = () => {
    autoRaf = requestAnimationFrame(step)
    const el = scroller.value
    if (!el || !gesture || !('active' in gesture) || !gesture.active) return
    const r = el.getBoundingClientRect()
    const edge = 40
    const left = r.left + listWidth.value
    let dx = 0
    let dy = 0
    if (gesture.kind === 'bar') {
      if (pointer.x < left + edge) dx = -Math.ceil((left + edge - pointer.x) / 4)
      else if (pointer.x > r.right - edge) dx = Math.ceil((pointer.x - r.right + edge) / 4)
    }
    if (pointer.y < r.top + headerHeight + edge) dy = -Math.ceil((r.top + headerHeight + edge - pointer.y) / 4)
    else if (pointer.y > r.bottom - edge) dy = Math.ceil((pointer.y - r.bottom + edge) / 4)
    if (!dx && !dy) return
    el.scrollLeft += dx
    el.scrollTop += dy
    dragTo(pointer.x, pointer.y)
  }
  autoRaf = requestAnimationFrame(step)
}
function stopAutoScroll() {
  cancelAnimationFrame(autoRaf)
  autoRaf = 0
}

// A finger's drag mustn't scroll the chart (its touchmoves are cancelled once the drag is on)
function onTouchMove(e: TouchEvent) {
  if (axis.pinchMove(e)) return
  if (gesture && 'active' in gesture && gesture.active && e.cancelable) e.preventDefault()
}
function onScroll() {
  axis.readView()
  hovered.value = null
}

// ── Tooltip ───────────────────────────────────────────────────────────────────────────────────────────────
const hovered = ref<{ id: string; x: number; y: number } | null>(null)
let hoverTimer: ReturnType<typeof setTimeout> | undefined
function onBarEnter(e: PointerEvent, t: GanttTask) {
  if (e.pointerType === 'touch') return
  clearTimeout(hoverTimer)
  const el = e.currentTarget as HTMLElement
  hoverTimer = setTimeout(() => {
    const r = el.getBoundingClientRect()
    hovered.value = { id: t.id, x: r.left + r.width / 2, y: r.top }
  }, 450)
}
function onBarLeave() {
  clearTimeout(hoverTimer)
  hovered.value = null
}
const tooltipTask = computed(() => {
  const id = dragging.value?.taskId ?? hovered.value?.id
  return id ? byId.value.get(id) : undefined
})
const tooltipPos = ref({ x: 0, y: 0 })
watch(tooltipTask, () => {
  if (dragging.value) {
    const el = barEls.get(dragging.value.taskId)
    const r = el?.getBoundingClientRect()
    if (r) tooltipPos.value = { x: r.left + r.width / 2, y: r.top }
  } else if (hovered.value) tooltipPos.value = { x: hovered.value.x, y: hovered.value.y }
}, { flush: 'post' })
watch(preview, () => {
  if (!dragging.value) return
  nextTick(() => {
    const r = barEls.get(dragging.value?.taskId ?? '')?.getBoundingClientRect()
    if (r) tooltipPos.value = { x: Math.min(Math.max(r.left + r.width / 2, 120), window.innerWidth - 120), y: r.top }
  })
})

// ── Text ──────────────────────────────────────────────────────────────────────────────────────────────────
function formatShort(s: string) {
  const ms = parseDate(s)
  if (Number.isNaN(ms)) return ''
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (new Date(ms).getFullYear() !== new Date().getFullYear()) o.year = '2-digit'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) { o.hour = 'numeric'; o.minute = '2-digit' }
  return new Intl.DateTimeFormat(lang.value, o).format(ms)
}
function durationText(t: GanttTask) {
  if (isMilestone(t)) return locale.ganttMilestone
  const days = taskDays(t)
  if (taskSpan(t).dateOnly || days >= 1) return locale.ganttDays.replace('{n}', String(Math.round(days * 10) / 10))
  return locale.ganttHours.replace('{n}', String(Math.round(days * 24 * 10) / 10))
}
const columnWidths = computed(() => {
  const fixed = columnList.value.reduce((s, c) => s + (c.key === 'name' && !c.width ? 0 : (c.width ?? 100)), 0)
  return columnList.value.map((c) => (c.key === 'name' && !c.width ? Math.max(120, gridW.value - fixed) : (c.width ?? 100)))
})
function cellText(t: GanttTask, c: GanttColumn): string {
  if (c.format) return c.format(t)
  switch (c.key) {
    case 'name': return t.name
    case 'start': return formatShort(t.start)
    case 'end': return isMilestone(t) ? '' : formatShort(t.end ?? t.start)
    case 'duration': return durationText(t)
    case 'progress': return isMilestone(t) ? '' : `${Math.round(t.progress ?? 0)}%`
  }
  const v = (t.data as Record<string, unknown> | undefined)?.[c.key] ?? (t as unknown as Record<string, unknown>)[c.key]
  return v === undefined || v === null ? '' : String(v)
}
function baselineGeo(t: GanttTask): Geo | null {
  if (!props.baselines || !t.baselineStart) return null
  const s = taskSpan({ start: t.baselineStart, end: t.baselineEnd ?? (t.end ? t.baselineStart : undefined), type: t.type })
  if (!Number.isFinite(s.start)) return null
  return { x: xOf(s.start), w: Math.max(4, xOf(s.end) - xOf(s.start)) }
}
const showLabelInside = (t: GanttTask) => {
  const g = geometry.value.get(t.id)
  return !!g && g.w > t.name.length * 7 + 24
}

const TONES = {
  primary: { bar: 'bg-primary-container text-on-primary-container', fill: 'bg-primary/30', solid: 'bg-primary text-primary' },
  secondary: { bar: 'bg-secondary-container text-on-secondary-container', fill: 'bg-secondary/30', solid: 'bg-secondary text-secondary' },
  tertiary: { bar: 'bg-tertiary-container text-on-tertiary-container', fill: 'bg-tertiary/30', solid: 'bg-tertiary text-tertiary' },
  error: { bar: 'bg-error-container text-on-error-container', fill: 'bg-error/30', solid: 'bg-error text-error' },
  success: { bar: 'bg-success-container text-on-success-container', fill: 'bg-success/30', solid: 'bg-success text-success' },
  neutral: { bar: 'bg-surface-container-highest text-on-surface', fill: 'bg-on-surface/16', solid: 'bg-on-surface-variant text-on-surface-variant' },
}
function toneOf(t: GanttTask) {
  if (criticalSet.value.has(t.id) && !(sums.value.has(t.id) && childrenOf.value.has(t.id))) return TONES.error
  return TONES[t.color ?? (sums.value.has(t.id) ? 'neutral' : 'primary')] ?? TONES.primary
}

// ── Keyboard and announcements ────────────────────────────────────────────────────────────────────────────
const focusedId = ref<string | null>(null)
const tabStop = computed(() => (focusedId.value && rowIndex.value.has(focusedId.value) ? focusedId.value : rows.value[0]?.task.id))
const message = ref('')
function announce(text: string) {
  message.value = ''
  nextTick(() => { message.value = text })
}
const editing = ref<string | null>(null)
const editValue = ref('')
function startRename(id: string) {
  const t = byId.value.get(id)
  if (!t || props.readonly) return
  editing.value = id
  editValue.value = t.name
  nextTick(() => {
    const input = scroller.value?.querySelector<HTMLInputElement>('[data-gantt-rename]')
    input?.focus()
    input?.select()
  })
}
function finishRename(save: boolean) {
  const id = editing.value
  if (!id) return
  editing.value = null
  const t = current.value.find((x) => x.id === id)
  if (save && t && editValue.value.trim() && editValue.value !== t.name) {
    const renamed = { ...t, name: editValue.value.trim() }
    commit(current.value.map((x) => (x.id === id ? renamed : x)))
    emit('change', { tasks: [renamed], kind: 'rename' })
  }
  focusRow(id)
}
function focusRow(id: string) {
  focusedId.value = id
  nextTick(() => scroller.value?.querySelector<HTMLElement>(`[data-gantt-row="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }))
}
function shiftTask(t: GanttTask, steps: number, endOnly: boolean) {
  const s = taskSpan(t)
  const step = snapStep(t)
  const by = (ms: number) => (s.dateOnly ? addDays(ms, steps) : ms + steps * step * 60_000)
  const ns = endOnly ? s.start : by(s.start)
  let ne = by(s.end)
  if (endOnly && ne <= s.start) ne = s.dateOnly ? addDays(s.start, 1) : s.start + step * 60_000
  const moving = endOnly ? [t.id] : [t.id, ...descendants(t.id)]
  const patched = current.value.map((x) => {
    if (!moving.includes(x.id) || (sums.value.has(x.id) && childrenOf.value.has(x.id))) return x
    if (x.id === t.id) return { ...x, ...spanDates(x, ns, ne) }
    const xs = taskSpan(x)
    return { ...x, ...spanDates(x, xs.dateOnly ? addDays(xs.start, steps) : xs.start + steps * step * 60_000, xs.dateOnly ? addDays(xs.end, steps) : xs.end + steps * step * 60_000) }
  })
  const next = props.schedule === 'auto' ? scheduleTasks(patched, scheduleOptions()) : patched
  commit(next)
  const moved = rollupSummaries(next).find((x) => x.id === t.id)!
  emit('change', { tasks: [moved], kind: endOnly ? 'resize' : 'move' })
  announce(locale.ganttMoved.replace('{name}', moved.name).replace('{start}', formatShort(moved.start)).replace('{end}', formatShort(moved.end ?? moved.start)))
}
function onRowKey(e: KeyboardEvent, t: GanttTask) {
  if (editing.value) return
  const i = rowIndex.value.get(t.id) ?? 0
  const mod = e.ctrlKey || e.metaKey
  const go = (j: number) => {
    const r = rows.value[Math.max(0, Math.min(rows.value.length - 1, j))]
    if (!r) return
    focusRow(r.task.id)
    if (!e.shiftKey) setSelection([r.task.id])
    else setSelection([...new Set([...selected.value, r.task.id])])
    scrollToTask(r.task.id)
  }
  const editable = !props.readonly
  if (e.altKey && editable && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    if (t.draggable !== false) shiftTask(t, e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey)
    return
  }
  if (e.altKey && editable && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const sibs = childrenOf.value.get(t.parentId && byId.value.has(t.parentId) ? t.parentId : undefined) ?? []
    const k = sibs.findIndex((s) => s.id === t.id)
    const other = sibs[k + (e.key === 'ArrowUp' ? -1 : 1)]
    if (other) moveRow(t.id, other.id, e.key === 'ArrowUp' ? 'before' : 'after')
    focusRow(t.id)
    return
  }
  if (mod && editable && (e.key === ']' || e.key === '[')) {
    e.preventDefault()
    if (e.key === ']') {
      // Into the sibling above, at its end
      const sibs = childrenOf.value.get(t.parentId && byId.value.has(t.parentId) ? t.parentId : undefined) ?? []
      const above = sibs[sibs.findIndex((s) => s.id === t.id) - 1]
      if (above) {
        const last = (childrenOf.value.get(above.id) ?? []).at(-1)
        if (last) moveRow(t.id, last.id, 'after')
        else moveRow(t.id, above.id, 'inside')
      }
    } else if (t.parentId && byId.value.has(t.parentId)) moveRow(t.id, t.parentId, 'after')
    focusRow(t.id)
    return
  }
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelection(rows.value.map((r) => r.task.id)); return }
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); go(i + 1); break
    case 'ArrowUp': e.preventDefault(); go(i - 1); break
    case 'Home': e.preventDefault(); go(0); break
    case 'End': e.preventDefault(); go(rows.value.length - 1); break
    case 'ArrowRight':
      e.preventDefault()
      if (childrenOf.value.has(t.id) && foldedSet.value.has(t.id)) toggle(t.id, true)
      else if (childrenOf.value.has(t.id)) go(i + 1)
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (childrenOf.value.has(t.id) && !foldedSet.value.has(t.id)) toggle(t.id, false)
      else if (t.parentId && rowIndex.value.has(t.parentId)) go(rowIndex.value.get(t.parentId)!)
      break
    case ' ':
      e.preventDefault()
      setSelection(selectedSet.value.has(t.id) ? selected.value.filter((x) => x !== t.id) : [...selected.value, t.id])
      break
    case 'Enter': e.preventDefault(); emit('task-dblclick', t, e); break
    case 'F2': e.preventDefault(); startRename(t.id); break
    case 'Delete':
    case 'Backspace':
      if (!editable) break
      e.preventDefault()
      removeTasks(selectedSet.value.has(t.id) ? selected.value : [t.id])
      break
  }
}
function onRootKey(e: KeyboardEvent) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  if (selectedLink.value && !props.readonly) {
    e.preventDefault()
    const [from, to] = selectedLink.value.split('>')
    unlink(from!, to!)
  }
}

// ── Rows reorder: FLIP ────────────────────────────────────────────────────────────────────────────────────
let rowTops = new Map<string, number>()
onBeforeUpdate(() => {
  if (gesture && 'active' in gesture && gesture.active) return
  rowTops = new Map(rows.value.map((r, i) => [r.task.id, i * props.rowHeight]))
})
onUpdated(() => {
  if (!rowTops.size || prefersReducedMotion()) return
  const now = rowIndex.value
  for (const el of scroller.value?.querySelectorAll<HTMLElement>('[data-gantt-flip]') ?? []) {
    const id = el.dataset.ganttFlip!
    const before = rowTops.get(id)
    const i = now.get(id)
    if (before === undefined || i === undefined) continue
    const dy = before - i * props.rowHeight
    if (Math.abs(dy) < 1 || Math.abs(dy) > props.rowHeight * 40) continue
    const samples = sampleSpring(dy, 0, 0, { dampingRatio: 0.9, stiffness: 700 }, 0.5)
    playSamples(el, samples, (v) => ({ translate: `0 ${v}px` }))
  }
  rowTops.clear()
})

// ── Context ───────────────────────────────────────────────────────────────────────────────────────────────
const context: GanttContext = {
  tasks: computed(() => shown.value),
  selection: computed(() => selected.value),
  scale: scaleNow,
  pxPerDay: ppd,
  readonly: computed(() => props.readonly),
  canUndo,
  canRedo,
  collapsed: computed(() => folded.value),
  undo,
  redo,
  zoomIn,
  zoomOut,
  setScale,
  scrollToDate,
  scrollToTask,
  toggle,
  expandAll: () => setFolded([]),
  collapseAll: () => setFolded([...childrenOf.value.keys()].filter((k): k is string => !!k)),
  setSelection,
  addTasks,
  updateTask,
  removeTasks,
  link,
  unlink,
  schedule: runSchedule,
  criticalPath: criticalPathInfo,
  dateAt,
}
provide(GANTT_KEY, context)
provide(TIMELINE_CONTROLS_KEY, {
  ...context,
  foldable: computed(() => childrenOf.value.size > 1),
  folded: computed(() => folded.value.length > 0),
})

onMounted(() => {
  const el = scroller.value!
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  // Start at today when it's on the chart, else at the first task
  nextTick(() => {
    const now = todayMs.value
    const at = now !== null && now >= extent.value.min && now <= extent.value.max ? now : extent.value.min
    el.scrollLeft = Math.max(0, xOf(at) - Math.min(80, timelineView.value / 4))
    view.value.left = el.scrollLeft
  })
})
onBeforeUnmount(() => {
  scroller.value?.removeEventListener('touchmove', onTouchMove)
  removeWindow()
  stopAutoScroll()
  cancelAnimationFrame(springRaf)
  clearTimeout(hoverTimer)
})

defineExpose(context)
</script>

<template>
  <div class="m3-gantt flex flex-col overflow-hidden rounded-md bg-surface text-on-surface" @keydown="onRootKey">
    <slot :gantt="context" />
    <div
      ref="scroller"
      class="relative min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain"
      @scroll.passive="onScroll"
      @touchstart.passive="axis.onTouchStart"
      @touchend.passive="axis.onTouchEnd"
      @contextmenu="gesture && $event.preventDefault()"
    >
      <div class="relative" :style="{ width: `${listWidth + timelineWidth}px`, height: `${headerHeight + bodyHeight}px` }">
        <!-- Header -->
        <div class="sticky top-0 z-20 flex" :style="{ height: `${headerHeight}px`, width: `${listWidth + timelineWidth}px` }">
          <div
            v-if="showGrid"
            class="sticky left-0 z-10 flex shrink-0 items-end border-r border-b border-outline-variant bg-surface-container-low text-label-medium text-on-surface-variant"
            :style="{ width: `${listWidth}px` }"
            role="row"
          >
            <div
              v-for="(c, ci) in columnList"
              :key="c.key"
              role="columnheader"
              class="truncate px-3 pb-2"
              :class="c.align === 'end' ? 'text-right' : c.align === 'center' ? 'text-center' : ''"
              :style="{ width: `${columnWidths[ci]}px` }"
            >
              {{ c.label ?? c.key }}
            </div>
          </div>
          <MTimeHeader :width="timelineWidth" :top-cells="topCells" :bottom-cells="bottomCells" :today-x="todayMs === null ? null : xOf(todayMs)" />
        </div>

        <!-- Body -->
        <div class="flex" :style="{ height: `${bodyHeight}px` }">
          <!-- Task list -->
          <div
            v-if="showGrid"
            class="sticky left-0 z-10 shrink-0 border-r border-outline-variant bg-surface"
            :style="{ width: `${listWidth}px` }"
            role="treegrid"
            :aria-label="label ?? locale.ganttChart"
            :aria-rowcount="rows.length"
            aria-multiselectable="true"
          >
            <div
              v-for="r in visibleRows"
              :key="r.task.id"
              :data-gantt-row="r.task.id"
              :data-gantt-flip="r.task.id"
              role="row"
              :aria-level="r.depth + 1"
              :aria-rowindex="r.index + 1"
              :aria-expanded="r.parent ? !foldedSet.has(r.task.id) : undefined"
              :aria-selected="selectedSet.has(r.task.id)"
              :tabindex="tabStop === r.task.id ? 0 : -1"
              class="m3-gantt-row absolute inset-x-0 flex items-center text-body-medium outline-none select-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-inset"
              :class="[
                selectedSet.has(r.task.id) ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-on-surface/8',
                dragging?.taskId === r.task.id && !dragging?.part.startsWith('link') && rowDrop ? 'opacity-50' : '',
              ]"
              :style="{ top: `${r.index * rowHeight}px`, height: `${rowHeight}px` }"
              @pointerdown="onRowDown($event, r.task)"
              @click="selectFromClick(r.task, $event)"
              @dblclick="emit('task-dblclick', r.task, $event)"
              @contextmenu="emit('task-contextmenu', r.task, $event)"
              @keydown="onRowKey($event, r.task)"
              @focus="focusedId = r.task.id"
            >
              <div
                v-for="(c, ci) in columnList"
                :key="c.key"
                role="gridcell"
                class="flex h-full min-w-0 items-center px-3"
                :class="[c.align === 'end' ? 'justify-end' : c.align === 'center' ? 'justify-center' : '', c.key === 'name' ? 'gap-1' : 'text-on-surface-variant']"
                :style="{ width: `${columnWidths[ci]}px`, paddingLeft: c.key === 'name' ? `${8 + r.depth * 20}px` : undefined }"
              >
                <template v-if="c.key === 'name'">
                  <button
                    v-if="r.parent"
                    type="button"
                    tabindex="-1"
                    data-gantt-action
                    class="flex size-6 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
                    :aria-label="foldedSet.has(r.task.id) ? locale.ganttExpand : locale.ganttCollapse"
                    @click.stop="toggle(r.task.id)"
                  >
                    <span class="material-symbols-outlined text-[20px] transition-transform duration-200" :class="foldedSet.has(r.task.id) ? '-rotate-90' : ''">expand_more</span>
                  </button>
                  <span v-else class="w-6 shrink-0" />
                  <span v-if="isMilestone(r.task)" class="mr-1 size-2 shrink-0 rotate-45 rounded-[1px] bg-tertiary" />
                  <input
                    v-if="editing === r.task.id"
                    v-model="editValue"
                    data-gantt-rename
                    class="h-8 min-w-0 flex-1 rounded-xs border border-primary bg-surface px-2 text-body-medium text-on-surface outline-none"
                    @keydown.stop.enter.prevent="finishRename(true)"
                    @keydown.stop.esc.prevent="finishRename(false)"
                    @blur="finishRename(true)"
                    @click.stop
                    @dblclick.stop
                  >
                  <slot v-else :name="`cell-${c.key}`" :task="r.task" :value="cellText(r.task, c)">
                    <span class="truncate" :class="r.parent ? 'font-medium' : ''" @dblclick.stop="readonly ? emit('task-dblclick', r.task, $event) : startRename(r.task.id)">{{ cellText(r.task, c) }}</span>
                  </slot>
                </template>
                <slot v-else :name="`cell-${c.key}`" :task="r.task" :value="cellText(r.task, c)">
                  <span class="truncate">{{ cellText(r.task, c) }}</span>
                </slot>
              </div>
            </div>
            <!-- Where a dragged row would land -->
            <div
              v-if="rowDrop"
              class="pointer-events-none absolute right-2 z-20"
              :class="rowDrop.where === 'inside' ? 'rounded-sm border-2 border-primary' : 'h-0.5 rounded-full bg-primary'"
              :style="rowDrop.where === 'inside'
                ? { top: `${(rowIndex.get(rowDrop.target) ?? 0) * rowHeight + 2}px`, height: `${rowHeight - 4}px`, left: '8px' }
                : { top: `${((rowIndex.get(rowDrop.target) ?? 0) + (rowDrop.where === 'after' ? 1 : 0)) * rowHeight - 1}px`, left: `${8 + ((rows[rowIndex.get(rowDrop.target) ?? 0]?.depth ?? 0)) * 20}px` }"
            />
            <div
              role="separator"
              aria-orientation="vertical"
              :aria-label="locale.ganttResize"
              :aria-valuenow="listWidth"
              tabindex="0"
              class="absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none outline-none hover:bg-primary/20 focus-visible:bg-primary/30"
              @pointerdown="onSplitDown"
              @keydown.left.prevent="gridW = Math.max(120, gridW - 16); emit('update:gridWidth', gridW)"
              @keydown.right.prevent="gridW = gridW + 16; emit('update:gridWidth', gridW)"
            />
          </div>

          <!-- Timeline -->
          <div class="relative shrink-0" :style="{ width: `${timelineWidth}px` }" aria-hidden="true" @pointerdown="onPaneDown">
            <MTimeBackground :off-times="offTimes" :cells="bottomCells" :today-x="todayMs === null ? null : xOf(todayMs)" />
            <div
              v-for="r in visibleRows"
              :key="`r${r.task.id}`"
              class="absolute inset-x-0"
              :class="selectedSet.has(r.task.id) ? 'bg-secondary-container/40' : ''"
              :style="{ top: `${r.index * rowHeight}px`, height: `${rowHeight}px` }"
            />

            <!-- Dependencies -->
            <svg class="pointer-events-none absolute inset-0 overflow-visible" :width="timelineWidth" :height="bodyHeight">
              <g
                v-for="l in visibleLinks"
                :key="l.key"
                :ref="(el) => bindLink(l.key, el)"
                class="m3-gantt-link"
                :class="criticalLinks.has(l.key) ? 'text-error' : selectedLink === l.key ? 'text-primary' : 'text-outline'"
              >
                <!-- What a click or a tap selects it by: wider than the line, much wider for a finger -->
                <path
                  fill="none"
                  stroke="transparent"
                  class="pointer-events-auto cursor-pointer [stroke-width:12px] pointer-coarse:[stroke-width:28px]"
                  @pointerdown.stop
                  @click.stop="selectedLink = l.key; setSelection([])"
                />
                <path fill="none" stroke="currentColor" :stroke-width="selectedLink === l.key || criticalLinks.has(l.key) ? 2.5 : 1.5" stroke-linejoin="round" />
                <path fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" />
              </g>
              <path
                v-if="linkDraft"
                fill="none"
                stroke-width="2"
                stroke-dasharray="6 4"
                :class="linkDraft.valid ? 'stroke-primary' : 'stroke-outline'"
                :d="`M${linkDraft.fromEnd ? (liveGeo(linkDraft.from)!.x + liveGeo(linkDraft.from)!.w) : liveGeo(linkDraft.from)!.x},${(rowIndex.get(linkDraft.from) ?? 0) * rowHeight + rowHeight / 2} L${linkDraft.x},${linkDraft.y}`"
              />
            </svg>
            <button
              v-if="selectedLink && selectedLinkMid && !readonly"
              type="button"
              data-gantt-action
              class="absolute z-10 flex size-6 -translate-1/2 items-center justify-center rounded-full bg-error text-on-error shadow-elevation-2 pointer-coarse:size-10"
              :style="{ left: `${selectedLinkMid.x}px`, top: `${selectedLinkMid.y}px` }"
              :aria-label="locale.ganttUnlink"
              @pointerdown.stop
              @click.stop="unlink(selectedLink.split('>')[0]!, selectedLink.split('>')[1]!)"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>

            <!-- Bars -->
            <template v-for="r in visibleRows" :key="`g${r.task.id}`">
              <div
                v-if="baselineGeo(r.task)"
                class="pointer-events-none absolute h-1 rounded-full bg-outline"
                :style="{ top: `${r.index * rowHeight + rowHeight / 2 + barH / 2 + 2}px`, left: `${baselineGeo(r.task)!.x}px`, width: `${baselineGeo(r.task)!.w}px` }"
              />
            </template>
            <div
              v-for="r in visibleRows"
              :key="`b${r.task.id}`"
              :ref="(el) => bindBar(r.task.id, el)"
              :data-gantt-flip="r.task.id"
              class="m3-gantt-bar group absolute left-0"
              :class="[r.task.class, dragging?.taskId === r.task.id ? 'z-10' : '']"
              :style="{ top: `${r.index * rowHeight + (rowHeight - barH) / 2}px`, height: `${barH}px` }"
            >
              <!-- Milestone: a finger gets a wider target than the diamond -->
              <div
                v-if="isMilestone(r.task)"
                class="absolute top-1/2 left-0 hidden size-11 -translate-1/2 pointer-coarse:block"
                @pointerdown="onBarDown($event, r.task, 'body')"
              />
              <div
                v-if="isMilestone(r.task)"
                :data-gantt-task="r.task.id"
                class="absolute top-1/2 left-0 -translate-1/2 rotate-45 rounded-[3px] shadow-elevation-1"
                :class="[criticalSet.has(r.task.id) ? 'bg-error' : TONES[r.task.color ?? 'tertiary'].solid, selectedSet.has(r.task.id) ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface' : '', readonly ? '' : 'cursor-grab']"
                :style="{ width: `${barH * 0.8}px`, height: `${barH * 0.8}px` }"
                @pointerdown="onBarDown($event, r.task, 'body')"
                @pointerenter="onBarEnter($event, r.task)"
                @pointerleave="onBarLeave"
                @dblclick="emit('task-dblclick', r.task, $event)"
                @contextmenu="emit('task-contextmenu', r.task, $event)"
              />
              <!-- Summary: a bracket over its tasks -->
              <div
                v-else-if="sums.has(r.task.id) && childrenOf.has(r.task.id)"
                :data-gantt-task="r.task.id"
                class="m3-gantt-summary absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-t-xs"
                :class="[toneOf(r.task).solid, selectedSet.has(r.task.id) ? 'ring-2 ring-on-surface ring-offset-1 ring-offset-surface' : '', readonly ? '' : 'cursor-grab']"
                @pointerdown="onBarDown($event, r.task, 'body')"
                @pointerenter="onBarEnter($event, r.task)"
                @pointerleave="onBarLeave"
                @dblclick="emit('task-dblclick', r.task, $event)"
                @contextmenu="emit('task-contextmenu', r.task, $event)"
              />
              <!-- Task -->
              <div
                v-else
                :data-gantt-task="r.task.id"
                class="absolute inset-0 overflow-hidden rounded-sm transition-shadow duration-200"
                :class="[
                  toneOf(r.task).bar,
                  selectedSet.has(r.task.id) ? 'ring-2 ring-on-surface ring-offset-1 ring-offset-surface' : '',
                  dragging?.taskId === r.task.id ? 'shadow-elevation-3' : 'hover:shadow-elevation-1',
                  readonly || r.task.draggable === false ? '' : 'cursor-grab active:cursor-grabbing',
                ]"
                @pointerdown="onBarDown($event, r.task, 'body')"
                @pointerenter="onBarEnter($event, r.task)"
                @pointerleave="onBarLeave"
                @dblclick="emit('task-dblclick', r.task, $event)"
                @contextmenu="emit('task-contextmenu', r.task, $event)"
              >
                <div class="pointer-events-none absolute inset-y-0 left-0" :class="toneOf(r.task).fill" :style="{ width: `${r.task.progress ?? 0}%` }" />
                <div class="pointer-events-none relative flex h-full items-center px-2 text-label-medium whitespace-nowrap">
                  <slot name="bar" :task="r.task" :selected="selectedSet.has(r.task.id)" :critical="criticalSet.has(r.task.id)">
                    <span v-if="showLabelInside(r.task)" class="truncate">{{ r.task.name }}</span>
                  </slot>
                </div>
              </div>
              <!-- Resize handles, outside the bar's clipping: wider for a finger, with a grip while selected -->
              <template v-if="!readonly && r.task.resizable !== false && !isMilestone(r.task) && !(sums.has(r.task.id) && childrenOf.has(r.task.id))">
                <div
                  v-for="side in (['start', 'end'] as const)"
                  :key="`rs${side}`"
                  :data-gantt-resize="side"
                  class="absolute inset-y-0 z-[1] flex w-3 cursor-ew-resize items-center justify-center pointer-coarse:w-7"
                  :class="side === 'start' ? '-left-1 pointer-coarse:-left-3.5' : '-right-1 pointer-coarse:-right-3.5'"
                  @pointerdown="onBarDown($event, r.task, side)"
                >
                  <span class="hidden h-3/5 w-1 rounded-full bg-on-surface pointer-coarse:block" :class="selectedSet.has(r.task.id) ? 'opacity-100' : 'opacity-0'" />
                </div>
              </template>
              <!-- Outside the bar: its label when it doesn't fit, the progress handle, the link dots -->
              <span
                v-if="!isMilestone(r.task) && !slots.bar && !(sums.has(r.task.id) && childrenOf.has(r.task.id)) && !showLabelInside(r.task)"
                class="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 text-label-medium whitespace-nowrap text-on-surface-variant"
              >{{ r.task.name }}</span>
              <span
                v-else-if="isMilestone(r.task) || (sums.has(r.task.id) && childrenOf.has(r.task.id))"
                class="pointer-events-none absolute top-1/2 left-full -translate-y-1/2 text-label-medium whitespace-nowrap"
                :class="[isMilestone(r.task) ? 'ml-4' : 'ml-2', sums.has(r.task.id) ? 'font-medium text-on-surface' : 'text-on-surface-variant']"
              >{{ r.task.name }}</span>
              <template v-if="!readonly && !(sums.has(r.task.id) && childrenOf.has(r.task.id))">
                <div
                  v-if="!isMilestone(r.task)"
                  class="absolute -bottom-2 size-0 -translate-x-1/2 cursor-ew-resize border-x-[6px] border-b-[7px] border-x-transparent border-b-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
                  :class="selectedSet.has(r.task.id) || dragging?.taskId === r.task.id ? 'opacity-100' : ''"
                  :style="{ left: `${r.task.progress ?? 0}%` }"
                  @pointerdown="onBarDown($event, r.task, 'progress')"
                />
                <template v-if="r.task.linkable !== false">
                  <div
                    v-for="side in (['start', 'end'] as const)"
                    :key="side"
                    class="absolute top-1/2 flex size-5 -translate-y-1/2 cursor-crosshair items-center justify-center transition-opacity pointer-coarse:size-8"
                    :class="[
                      // Clear of the diamond (and of its wider touch area) for a milestone
                      side === 'start'
                        ? (isMilestone(r.task) ? '-left-9 pointer-coarse:-left-14' : '-left-5 pointer-coarse:-left-9')
                        : (isMilestone(r.task) ? 'left-4 pointer-coarse:left-6' : '-right-5 pointer-coarse:-right-9'),
                      // Only there to grab while shown, or they'd take clicks meant for the arrows that end there
                      selectedSet.has(r.task.id) || linkDraft ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
                    ]"
                    @pointerdown="onBarDown($event, r.task, side === 'start' ? 'link-start' : 'link-end')"
                  >
                    <span class="size-2.5 rounded-full border-2 border-primary bg-surface" />
                  </div>
                </template>
              </template>
              <!-- Where a dependency drawn now would arrive -->
              <div
                v-if="linkDraft?.target === r.task.id"
                class="pointer-events-none absolute -inset-1 rounded-md border-2"
                :class="linkDraft.valid ? 'border-primary' : 'border-error'"
              />
            </div>

            <div v-if="!rows.length" class="absolute inset-0 flex items-center justify-center p-6" :style="{ left: `${view.left}px`, width: `${timelineView}px` }">
              <slot name="empty">
                <span class="text-body-medium text-on-surface-variant">{{ locale.ganttEmpty }}</span>
              </slot>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="tooltipTask && !linkDraft && !rowDrop"
        class="pointer-events-none fixed z-[300] -translate-x-1/2 -translate-y-full rounded-md bg-surface-container px-3 py-2 text-on-surface shadow-elevation-2"
        :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 8}px` }"
        role="tooltip"
      >
        <slot name="tooltip" :task="tooltipTask" :slack="criticalPathInfo.slack[tooltipTask.id]">
          <div class="text-title-small">{{ tooltipTask.name }}</div>
          <div class="text-body-small text-on-surface-variant">
            {{ formatShort(tooltipTask.start) }}<template v-if="!isMilestone(tooltipTask)"> – {{ formatShort(tooltipTask.end ?? tooltipTask.start) }} · {{ durationText(tooltipTask) }}</template>
            <template v-if="!isMilestone(tooltipTask) && tooltipTask.progress !== undefined"> · {{ Math.round(tooltipTask.progress) }}%</template>
          </div>
          <div v-if="criticalPath && criticalPathInfo.slack[tooltipTask.id] !== undefined" class="text-body-small" :class="criticalSet.has(tooltipTask.id) ? 'text-error' : 'text-on-surface-variant'">
            {{ criticalSet.has(tooltipTask.id) ? locale.ganttCritical : locale.ganttSlack.replace('{n}', String(Math.round(criticalPathInfo.slack[tooltipTask.id]! * 10) / 10)) }}
          </div>
        </slot>
      </div>
    </Teleport>
    <div class="sr-only" aria-live="polite">{{ message }}</div>
  </div>
</template>

<style>
/* The summary bracket's ends point down at its first and last tasks */
.m3-gantt-summary::before,
.m3-gantt-summary::after {
  content: '';
  position: absolute;
  top: 100%;
  border-top: 6px solid currentColor;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  color: inherit;
}
.m3-gantt-summary::before {
  left: 0;
  border-left: 0;
}
.m3-gantt-summary::after {
  right: 0;
  border-right: 0;
}
</style>
