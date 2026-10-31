<script setup lang="ts">
/**
 * A resource timeline: one row per person, table, room or machine, with their bookings (shifts, reservations,
 * jobs) along a timeline you zoom from hours to months. Not an M3 spec component: MGantt's timeline, for planning
 * who or what is busy when rather than tasks and their order.
 *
 * Bookings are a `v-model` of plain objects (`TimelineEvent`: `resourceId`, `start`/`end` datetimes or whole days,
 * `title`, `color`). Drag one along its row to move it, to another row to give it to that resource, or by its ends
 * to resize it; snapped to `snap` minutes. Bookings that overlap share the row in lanes, and more than a resource's
 * `capacity` at once are marked as conflicts (`overlap="prevent"` refuses a drop that makes one). With `creatable`,
 * dragging across empty time (a short press first with a finger) asks for a new booking there (`create`).
 * Resources with a `group` sit under headers that fold. Rows and time render only near the view; every edit is
 * undoable.
 *
 * Keyboard (on a booking): ←/→ move it a step, Shift + ←/→ change its end, ↑/↓ move it to the resource above or
 * below, Enter opens it (`event-dblclick`), Delete deletes, Ctrl+Z / Ctrl+Shift+Z undo and redo.
 *
 * @slot default Above the timeline: MGanttControls, filters of yours. Props: `{ timeline }`
 * @slot resource A resource's cell. Props: `{ resource, events, hours }` (`hours`: booked in total)
 * @slot event A booking's content. Props: `{ event, resource, selected, conflict }`
 * @slot group A group's header. Props: `{ group, resources, collapsed }`
 * @slot empty Shown while there are no resources
 * @event event-click / event-dblclick / event-contextmenu `(event, mouseEvent)`
 * @event create Empty time was dragged across (or long pressed) on a resource: `{ resourceId, start, end }`; add the booking yourself
 * @event slot-click Empty time was clicked: `{ resourceId, start }`
 * @event change A drag or a key changed bookings: `{ events, kind: 'move' | 'resize' }`
 * @event conflict A drop was refused (`overlap="prevent"`): `{ event, with }`
 * @event delete Bookings were deleted: `{ events }`
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, toRaw, watch } from 'vue'
import { RESOURCE_TIMELINE_KEY, type ResourceTimelineContext, type TimelineEvent, type TimelineResource } from '../composables/useResourceTimeline'
import { TIMELINE_CONTROLS_KEY, type GanttScale } from '../composables/useGantt'
import { spanDates, taskSpan, type GanttCalendar } from '../composables/ganttSchedule'
import { DAY, HOUR, defaultSnap, formatDate, parseDate, snapTime } from '../composables/_ganttTime'
import { prefersReducedMotion } from '../composables/_springAnimation'
import { useTimeAxis } from '../composables/_useTimeAxis'
import { useLocale } from '../composables/useLocale'
import MTimeHeader from './_MTimeHeader.vue'
import MTimeBackground from './_MTimeBackground.vue'

const props = withDefaults(defineProps<{
  events?: TimelineEvent[]
  resources?: TimelineResource[]
  /** The zoom as a named level (`v-model:scale`) */
  scale?: GanttScale
  /** The starting zoom in px per day, between the named levels (default 240: 10 px an hour) */
  pxPerDay?: number
  /** Selected booking ids (`v-model:selection`) */
  selection?: string[]
  /** Folded group names (`v-model:collapsed`) */
  collapsed?: string[]
  /** The resource column's width, px (`v-model:list-width`; drag its edge); 0 hides it */
  listWidth?: number
  /** A row's least height; rows grow with their lanes */
  rowHeight?: number
  /** One lane's height (a booking and its gap) */
  laneHeight?: number
  /** `'stack'` (default): overlaps share the row in lanes and show as conflicts past `capacity`; `'prevent'` also refuses a drop that makes one */
  overlap?: 'stack' | 'prevent'
  /** Dragging across empty time asks for a booking there (`create`) */
  creatable?: boolean
  readonly?: boolean
  /** Minutes bookings snap to (default 15; by zoom when zoomed far out); whole-day bookings snap to days */
  snap?: number
  /** Days worked (shaded when they aren't) */
  calendar?: GanttCalendar
  /** Working hours, shaded outside them when zoomed in to hours, e.g. `[9, 18]` */
  workHours?: [number, number]
  /** Now, for the line across the timeline (default the current time; `null` hides it) */
  now?: string | null
  /** Where the view starts (default now, or the first booking) */
  start?: string
  weekStartsOn?: 0 | 1
  minPxPerDay?: number
  maxPxPerDay?: number
  locale?: string
  label?: string
  beforeDelete?: (events: TimelineEvent[]) => boolean | Promise<boolean>
}>(), {
  events: () => [],
  resources: () => [],
  scale: 'day',
  pxPerDay: 240,
  rowHeight: 56,
  laneHeight: 40,
  overlap: 'stack',
  creatable: false,
  readonly: false,
  weekStartsOn: 1,
  minPxPerDay: 2,
  maxPxPerDay: 4800,
})

const emit = defineEmits<{
  'update:events': [TimelineEvent[]]
  'update:scale': [GanttScale]
  'update:selection': [string[]]
  'update:collapsed': [string[]]
  'update:listWidth': [number]
  'event-click': [TimelineEvent, MouseEvent]
  'event-dblclick': [TimelineEvent, MouseEvent | KeyboardEvent]
  'event-contextmenu': [TimelineEvent, MouseEvent]
  create: [{ resourceId: string; start: string; end: string }]
  'slot-click': [{ resourceId: string; start: string }]
  change: [{ events: TimelineEvent[]; kind: 'move' | 'resize' }]
  conflict: [{ event: TimelineEvent; with: TimelineEvent[] }]
  delete: [{ events: TimelineEvent[] }]
}>()

const locale = useLocale()
const lang = computed(() => props.locale ?? (locale.lang === 'en' ? undefined : locale.lang))

// ── Events, history ───────────────────────────────────────────────────────────────────────────────────────
const current = shallowRef<TimelineEvent[]>(props.events)
watch(() => props.events, (e) => { current.value = e })
const preview = shallowRef<TimelineEvent[] | null>(null)
const shown = computed(() => preview.value ?? current.value)
const past: TimelineEvent[][] = []
const future: TimelineEvent[][] = []
const historyTick = ref(0)
function emitEvents(next: TimelineEvent[]) {
  current.value = next
  emit('update:events', next)
}
function commit(next: TimelineEvent[]) {
  past.push(toRaw(current.value))
  if (past.length > 100) past.shift()
  future.length = 0
  historyTick.value++
  emitEvents(next)
}
function undo() {
  const prev = past.pop()
  if (!prev) return
  future.push(toRaw(current.value))
  historyTick.value++
  emitEvents(prev)
}
function redo() {
  const next = future.pop()
  if (!next) return
  past.push(toRaw(current.value))
  historyTick.value++
  emitEvents(next)
}
const canUndo = computed(() => (historyTick.value, past.length > 0))
const canRedo = computed(() => (historyTick.value, future.length > 0))
const eventById = computed(() => new Map(shown.value.map((e) => [e.id, e])))
const resourceById = computed(() => new Map(props.resources.map((r) => [r.id, r])))

const selected = ref<string[]>(props.selection ?? [])
watch(() => props.selection, (s) => { if (s) selected.value = s })
const selectedSet = computed(() => new Set(selected.value))
function setSelection(ids: string[]) {
  const ok = ids.filter((id) => eventById.value.get(id)?.selectable !== false)
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
const toggleGroup = (g: string) => setFolded(foldedSet.value.has(g) ? folded.value.filter((x) => x !== g) : [...folded.value, g])

// ── Lanes, conflicts, rows ────────────────────────────────────────────────────────────────────────────────
type Span = { start: number; end: number; dateOnly: boolean }
const spans = computed(() => {
  const m = new Map<string, Span>()
  for (const e of shown.value) {
    const s = taskSpan({ start: e.start, end: e.end })
    if (Number.isFinite(s.start)) m.set(e.id, s)
  }
  return m
})
const byResource = computed(() => {
  const m = new Map<string, TimelineEvent[]>()
  for (const e of shown.value) if (spans.value.has(e.id)) (m.get(e.resourceId) ?? m.set(e.resourceId, []).get(e.resourceId)!).push(e)
  for (const list of m.values()) list.sort((a, b) => spans.value.get(a.id)!.start - spans.value.get(b.id)!.start)
  return m
})
// Each booking's lane in its row (first lane free when it starts), and the row's lane count
const lanes = computed(() => {
  const lane = new Map<string, number>()
  const count = new Map<string, number>()
  for (const [rid, list] of byResource.value) {
    const ends: number[] = []
    for (const e of list) {
      const s = spans.value.get(e.id)!
      let i = ends.findIndex((end) => end <= s.start)
      if (i < 0) { i = ends.length; ends.push(0) }
      ends[i] = s.end
      lane.set(e.id, i)
    }
    count.set(rid, Math.max(1, ends.length))
  }
  return { lane, count }
})
function overlapsOf(list: TimelineEvent[], capacity: number, sp: Map<string, Span>): Map<string, string[]> {
  // A sweep: at every start, what's still running
  const out = new Map<string, string[]>()
  const running: TimelineEvent[] = []
  for (const e of list) {
    const s = sp.get(e.id)!
    for (let i = running.length - 1; i >= 0; i--) if (sp.get(running[i]!.id)!.end <= s.start) running.splice(i, 1)
    running.push(e)
    if (running.length > capacity) for (const r of running) out.set(r.id, running.filter((x) => x !== r).map((x) => x.id))
  }
  return out
}
const conflictMap = computed(() => {
  const all = new Map<string, string[]>()
  for (const [rid, list] of byResource.value) {
    for (const [id, w] of overlapsOf(list, resourceById.value.get(rid)?.capacity ?? 1, spans.value)) all.set(id, w)
  }
  return all
})
const conflicts = computed(() => new Set(conflictMap.value.keys()))

type Row =
  | { kind: 'group'; key: string; group: string; top: number; height: number; resources: TimelineResource[] }
  | { kind: 'resource'; key: string; resource: TimelineResource; top: number; height: number }
const GROUP_H = 40
const rows = computed(() => {
  const out: Row[] = []
  const groups = new Map<string, TimelineResource[]>()
  const order: (TimelineResource | string)[] = []
  for (const r of props.resources) {
    if (!r.group) { order.push(r); continue }
    if (!groups.has(r.group)) { groups.set(r.group, []); order.push(r.group) }
    groups.get(r.group)!.push(r)
  }
  let top = 0
  const addResource = (r: TimelineResource) => {
    const height = Math.max(props.rowHeight, (lanes.value.count.get(r.id) ?? 1) * props.laneHeight + 8)
    out.push({ kind: 'resource', key: r.id, resource: r, top, height })
    top += height
  }
  for (const item of order) {
    if (typeof item !== 'string') { addResource(item); continue }
    const rs = groups.get(item)!
    out.push({ kind: 'group', key: `group:${item}`, group: item, top, height: GROUP_H, resources: rs })
    top += GROUP_H
    if (!foldedSet.value.has(item)) rs.forEach(addResource)
  }
  return out
})
const rowOf = computed(() => {
  const m = new Map<string, Extract<Row, { kind: 'resource' }>>()
  for (const r of rows.value) if (r.kind === 'resource') m.set(r.resource.id, r)
  return m
})
const contentHeight = computed(() => {
  const last = rows.value.at(-1)
  return last ? last.top + last.height : 0
})
const groupOf = (rid: string) => resourceById.value.get(rid)?.group

// ── Axis ──────────────────────────────────────────────────────────────────────────────────────────────────
const scroller = ref<HTMLElement>()
const headerHeight = 56
const listW = ref(props.listWidth ?? 220)
watch(() => props.listWidth, (w) => { if (w !== undefined) listW.value = w })
const listWidth = computed(() => listW.value)
const extent = computed(() => {
  let min = Infinity
  let max = -Infinity
  for (const s of spans.value.values()) { min = Math.min(min, s.start); max = Math.max(max, s.end) }
  const now = props.start ? parseDate(props.start) : props.now ? parseDate(props.now) : Date.now()
  if (!Number.isFinite(min)) { min = now; max = now + DAY }
  return { min: Math.min(min, now), max: Math.max(max, now + DAY) }
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
  today: () => props.now,
  calendar: () => props.calendar ?? { workingDays: [0, 1, 2, 3, 4, 5, 6] },
  workHours: () => props.workHours,
  onScale: (s) => emit('update:scale', s),
  onPinch: () => { if (gesture) onCancel({ pointerId: gesture.id } as PointerEvent) },
})
const { ppd, view, timelineView, timelineWidth, todayMs, xOf, timeAt, zoomIn, zoomOut, setScale, scrollToDate, topCells, bottomCells, offTimes } = axis

const OVERSCAN = 400
const visibleRows = computed(() => {
  const top = view.value.top - OVERSCAN
  const bottom = view.value.top + view.value.height + OVERSCAN
  return rows.value.filter((r) => r.top + r.height >= top && r.top <= bottom)
})
const visibleFrom = computed(() => timeAt(view.value.left - 400))
const visibleTo = computed(() => timeAt(view.value.left + timelineView.value + 400))
const visibleEvents = computed(() => {
  const out: { event: TimelineEvent; row: Extract<Row, { kind: 'resource' }> }[] = []
  for (const r of visibleRows.value) {
    if (r.kind !== 'resource') continue
    for (const e of byResource.value.get(r.resource.id) ?? []) {
      const s = spans.value.get(e.id)!
      if (s.end >= visibleFrom.value && s.start <= visibleTo.value) out.push({ event: e, row: r })
    }
  }
  return out
})

// ── Blocks: geometry and springs ──────────────────────────────────────────────────────────────────────────
type Geo = { x: number; y: number; w: number }
const blockH = computed(() => props.laneHeight - 8)
const geometry = computed(() => {
  const m = new Map<string, Geo>()
  for (const e of shown.value) {
    const s = spans.value.get(e.id)
    const row = rowOf.value.get(e.resourceId)
    if (!s || !row) continue
    // Lanes sit centered in a row taller than they need
    const lanesH = (lanes.value.count.get(e.resourceId) ?? 1) * props.laneHeight
    const y = row.top + (row.height - lanesH) / 2 + (lanes.value.lane.get(e.id) ?? 0) * props.laneHeight + 4
    m.set(e.id, { x: xOf(s.start), y, w: Math.max(4, xOf(s.end) - xOf(s.start)) })
  }
  return m
})
const springs = new Map<string, { x: number; y: number; w: number; vx: number; vy: number; vw: number; tx: number; ty: number; tw: number }>()
const blockEls = new Map<string, HTMLElement>()
let springRaf = 0
let lastZoom = { ppd: ppd.value, origin: axis.origin.value }
watch(geometry, (g) => {
  const instant = lastZoom.ppd !== ppd.value || lastZoom.origin !== axis.origin.value || prefersReducedMotion()
  lastZoom = { ppd: ppd.value, origin: axis.origin.value }
  let animate = false
  for (const [id, t] of g) {
    const s = springs.get(id)
    if (!s || instant) {
      springs.set(id, { ...t, vx: 0, vy: 0, vw: 0, tx: t.x, ty: t.y, tw: t.w })
      continue
    }
    // The dragged booking follows the pointer as it is; the rest spring
    if (dragging.value?.id === id && dragging.value.part === 'body') {
      Object.assign(s, { x: t.x, y: t.y, w: t.w, tx: t.x, ty: t.y, tw: t.w, vx: 0, vy: 0, vw: 0 })
      continue
    }
    if (s.tx !== t.x || s.ty !== t.y || s.tw !== t.w) { s.tx = t.x; s.ty = t.y; s.tw = t.w; animate = true }
  }
  for (const id of springs.keys()) if (!g.has(id)) springs.delete(id)
  if (animate) startSprings()
  else writeAll()
}, { immediate: true, flush: 'post' })
function startSprings() {
  if (springRaf) return
  let last = performance.now()
  const k = 700
  const c = 2 * 0.9 * Math.sqrt(k)
  const step = (now: number) => {
    let dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    while (dt > 0) {
      const h = Math.min(dt, 0.004)
      for (const s of springs.values()) {
        s.vx += (-k * (s.x - s.tx) - c * s.vx) * h
        s.x += s.vx * h
        s.vy += (-k * (s.y - s.ty) - c * s.vy) * h
        s.y += s.vy * h
        s.vw += (-k * (s.w - s.tw) - c * s.vw) * h
        s.w += s.vw * h
      }
      dt -= h
    }
    let moving = false
    for (const s of springs.values()) {
      if (Math.abs(s.x - s.tx) + Math.abs(s.y - s.ty) + Math.abs(s.w - s.tw) < 0.6 && Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.vw) < 4) {
        Object.assign(s, { x: s.tx, y: s.ty, w: s.tw, vx: 0, vy: 0, vw: 0 })
      } else moving = true
    }
    writeAll()
    springRaf = moving ? requestAnimationFrame(step) : 0
  }
  springRaf = requestAnimationFrame(step)
}
function writeBlock(id: string, el: HTMLElement) {
  const s = springs.get(id)
  if (!s) return
  el.style.transform = `translate(${s.x}px, ${s.y}px)`
  el.style.width = `${s.w}px`
}
function writeAll() {
  for (const [id, el] of blockEls) writeBlock(id, el)
}
function bindBlock(id: string, el: unknown) {
  if (el instanceof HTMLElement) {
    blockEls.set(id, el)
    writeBlock(id, el)
  } else blockEls.delete(id)
}

// ── Pointer gestures ──────────────────────────────────────────────────────────────────────────────────────
type Part = 'body' | 'start' | 'end'
type Gesture =
  | { kind: 'event'; part: Part; id: number; eventId: string; sx: number; sy: number; sl: number; st: number; touch: boolean; active: boolean; span: Span; resourceId: string }
  | { kind: 'empty'; id: number; resourceId: string; sx: number; sy: number; t0: number; touch: boolean; active: boolean }
  | { kind: 'pan'; id: number; sx: number; sy: number; sl: number; st: number; moved: boolean; resourceId?: string }
  | { kind: 'split'; id: number; sx: number; w: number }
let gesture: Gesture | null = null
let pressTimer: ReturnType<typeof setTimeout> | undefined
const dragging = ref<{ id: string; part: Part } | null>(null)
const draft = ref<{ resourceId: string; start: number; end: number } | null>(null)
const refused = ref(false)
const pointer = { x: 0, y: 0 }
const isControl = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, select, button, a, [contenteditable], [data-timeline-action]')

function contentPoint(clientX: number, clientY: number) {
  const r = scroller.value!.getBoundingClientRect()
  return { x: clientX - r.left - listWidth.value + scroller.value!.scrollLeft, y: clientY - r.top - headerHeight + scroller.value!.scrollTop }
}
function resourceAtY(y: number) {
  const r = rows.value.find((x) => y >= x.top && y < x.top + x.height)
  return r?.kind === 'resource' ? r.resource : undefined
}
function snapStep(dateOnly: boolean) {
  // 15 minutes while they're at least 2 px wide, coarser as it zooms out
  return dateOnly ? 1440 : (props.snap ?? (ppd.value >= 192 ? 15 : defaultSnap(ppd.value)))
}

function onEventDown(e: PointerEvent, ev: TimelineEvent, part: Part) {
  if (e.button !== 0 || isControl(e.target)) return
  e.stopPropagation()
  const s = spans.value.get(ev.id)
  if (!s) return
  const touch = e.pointerType === 'touch'
  gesture = { kind: 'event', part, id: e.pointerId, eventId: ev.id, sx: e.clientX, sy: e.clientY, sl: scroller.value!.scrollLeft, st: scroller.value!.scrollTop, touch, active: false, span: s, resourceId: ev.resourceId }
  addWindow()
  if (touch && part === 'body') pressTimer = setTimeout(() => activate(), 250)
  else if (touch) activate()
}
function onPaneDown(e: PointerEvent) {
  if (e.button !== 0 || isControl(e.target)) return
  const p = contentPoint(e.clientX, e.clientY)
  const res = resourceAtY(p.y)
  const touch = e.pointerType === 'touch'
  if (res && props.creatable && !props.readonly) {
    gesture = { kind: 'empty', id: e.pointerId, resourceId: res.id, sx: e.clientX, sy: e.clientY, t0: timeAt(p.x), touch, active: false }
    addWindow()
    if (touch) pressTimer = setTimeout(() => activate(), 350)
    return
  }
  if (touch) {
    if (res) {
      gesture = { kind: 'empty', id: e.pointerId, resourceId: res.id, sx: e.clientX, sy: e.clientY, t0: timeAt(p.x), touch, active: false }
      addWindow()
    }
    return
  }
  gesture = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, sl: scroller.value!.scrollLeft, st: scroller.value!.scrollTop, moved: false, resourceId: res?.id }
  addWindow()
}
function onSplitDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  gesture = { kind: 'split', id: e.pointerId, sx: e.clientX, w: listW.value }
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
function activate() {
  const g = gesture
  if (!g || (g.kind !== 'event' && g.kind !== 'empty') || g.active) return
  if (g.kind === 'event') {
    const ev = eventById.value.get(g.eventId)
    if (!ev || props.readonly) return
    if (g.part === 'body' && ev.draggable === false) return
    if (g.part !== 'body' && ev.resizable === false) return
    g.active = true
    if (!selectedSet.value.has(ev.id)) setSelection([ev.id])
    dragging.value = { id: ev.id, part: g.part }
  } else {
    if (!props.creatable || props.readonly) return
    g.active = true
    const step = snapStep(false) * 60_000
    const s = snapTime(g.t0, snapStep(false))
    draft.value = { resourceId: g.resourceId, start: s, end: s + Math.max(step, HOUR) }
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
    const w = Math.round(Math.min(Math.max(0, g.w + e.clientX - g.sx), Math.max(160, view.value.width - 80)))
    listW.value = w
    emit('update:listWidth', w)
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
      if (d > 8) { gesture = null; removeWindow() }
      return
    }
    if (d < 4) return
    activate()
    if (!g.active) return
  }
  dragTo(e.clientX, e.clientY)
}
function dragTo(clientX: number, clientY: number) {
  const g = gesture
  if (!g || (g.kind !== 'event' && g.kind !== 'empty') || !g.active) return
  const p = contentPoint(clientX, clientY)
  if (g.kind === 'empty') {
    const step = snapStep(false)
    const a = snapTime(g.t0, step)
    const b = snapTime(timeAt(p.x), step)
    const min = Math.max(step * 60_000, 15 * 60_000)
    draft.value = { resourceId: g.resourceId, start: Math.min(a, b), end: Math.max(Math.max(a, b), Math.min(a, b) + min) }
    return
  }
  const ev = current.value.find((x) => x.id === g.eventId)
  if (!ev) return
  const s0 = g.span
  const dt = ((clientX - g.sx + (scroller.value!.scrollLeft - g.sl)) / ppd.value) * DAY
  const step = snapStep(s0.dateOnly)
  const min = s0.dateOnly ? DAY : step * 60_000
  let next: TimelineEvent
  if (g.part === 'body') {
    const ns = snapTime(s0.start + dt, step)
    const res = resourceAtY(p.y)
    const resourceId = res && !props.readonly ? res.id : ev.resourceId
    next = { ...ev, ...spanDates({ start: ev.start, end: ev.end }, ns, ns + (s0.end - s0.start)) as { start: string; end: string }, resourceId }
  } else if (g.part === 'start') {
    const ns = Math.min(snapTime(s0.start + dt, step), s0.end - min)
    next = { ...ev, ...spanDates({ start: ev.start, end: ev.end }, ns, s0.end) as { start: string; end: string } }
  } else {
    const ne = Math.max(snapTime(s0.end + dt, step), s0.start + min)
    next = { ...ev, ...spanDates({ start: ev.start, end: ev.end }, s0.start, ne) as { start: string; end: string } }
  }
  const list = current.value.map((x) => (x.id === ev.id ? next : x))
  preview.value = list
  refused.value = props.overlap === 'prevent' && clashes(next, list).length > 0
}
// The bookings `ev` would overlap past its resource's capacity
function clashes(ev: TimelineEvent, list: TimelineEvent[]): TimelineEvent[] {
  const sp = new Map<string, Span>()
  const same = list.filter((x) => x.resourceId === ev.resourceId)
  for (const x of same) sp.set(x.id, taskSpan({ start: x.start, end: x.end }))
  same.sort((a, b) => sp.get(a.id)!.start - sp.get(b.id)!.start)
  const hit = overlapsOf(same, resourceById.value.get(ev.resourceId)?.capacity ?? 1, sp).get(ev.id)
  return hit ? same.filter((x) => hit.includes(x.id)) : []
}
function onUp(e: PointerEvent) {
  const g = gesture
  if (!g || g.id !== e.pointerId) return
  gesture = null
  removeWindow()
  stopAutoScroll()
  if (g.kind === 'split') return
  if (g.kind === 'pan') {
    if (!g.moved && g.resourceId) emit('slot-click', { resourceId: g.resourceId, start: formatDate(snapTime(timeAt(contentPoint(e.clientX, e.clientY).x), snapStep(false)), false) })
    if (!g.moved) setSelection([])
    return
  }
  if (g.kind === 'empty') {
    const d = draft.value
    draft.value = null
    if (g.active && d) emit('create', { resourceId: d.resourceId, start: formatDate(d.start, false), end: formatDate(d.end, false) })
    else if (!g.active) {
      emit('slot-click', { resourceId: g.resourceId, start: formatDate(snapTime(g.t0, snapStep(false)), false) })
      setSelection([])
    }
    return
  }
  dragging.value = null
  const ev = eventById.value.get(g.eventId)
  if (!g.active) {
    preview.value = null
    if (!ev) return
    if (ev.selectable !== false) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) setSelection(selectedSet.value.has(ev.id) ? selected.value.filter((x) => x !== ev.id) : [...selected.value, ev.id])
      else setSelection([ev.id])
    }
    emit('event-click', ev, e)
    return
  }
  const next = preview.value
  preview.value = null
  const moved = next?.find((x) => x.id === g.eventId)
  const before = current.value.find((x) => x.id === g.eventId)
  refused.value = false
  if (!next || !moved || !before || (moved.start === before.start && moved.end === before.end && moved.resourceId === before.resourceId)) return
  if (props.overlap === 'prevent') {
    const hit = clashes(moved, next)
    if (hit.length) {
      emit('conflict', { event: moved, with: hit })
      announce(locale.timelineConflict)
      return
    }
  }
  commit(next)
  emit('change', { events: [moved], kind: g.part === 'body' ? 'move' : 'resize' })
  announceMove(moved)
}
function onCancel(e: PointerEvent) {
  if (!gesture || gesture.id !== e.pointerId) return
  gesture = null
  removeWindow()
  stopAutoScroll()
  preview.value = null
  dragging.value = null
  draft.value = null
  refused.value = false
}

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
    if (pointer.x < left + edge) dx = -Math.ceil((left + edge - pointer.x) / 4)
    else if (pointer.x > r.right - edge) dx = Math.ceil((pointer.x - r.right + edge) / 4)
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
function onTouchMove(e: TouchEvent) {
  if (axis.pinchMove(e)) return
  if (gesture && 'active' in gesture && gesture.active && e.cancelable) e.preventDefault()
}

// ── Editing API, keyboard ─────────────────────────────────────────────────────────────────────────────────
const message = ref('')
function announce(text: string) {
  message.value = ''
  nextTick(() => { message.value = text })
}
function formatTime(s: string) {
  const ms = parseDate(s)
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s)
  return new Intl.DateTimeFormat(lang.value, dateOnly ? { day: 'numeric', month: 'short' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(ms)
}
function timeRange(ev: TimelineEvent) {
  const s = parseDate(ev.start)
  const e = parseDate(ev.end)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ev.start)) return `${formatTime(ev.start)} – ${formatTime(ev.end)}`
  // Minutes only when there are some: "9–17:30", "9 AM–5 PM"
  const f = (ms: number) => new Intl.DateTimeFormat(lang.value, new Date(ms).getMinutes() ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' }).format(ms)
  return `${f(s)}–${f(e)}`
}
function announceMove(ev: TimelineEvent) {
  announce(locale.timelineMoved.replace('{title}', ev.title).replace('{resource}', resourceById.value.get(ev.resourceId)?.name ?? '').replace('{start}', formatTime(ev.start)).replace('{end}', formatTime(ev.end)))
}
function addEvents(events: TimelineEvent | TimelineEvent[]) {
  commit([...current.value, ...(Array.isArray(events) ? events : [events])])
}
function updateEvent(id: string, patch: Partial<TimelineEvent> | ((e: TimelineEvent) => TimelineEvent)) {
  commit(current.value.map((e) => (e.id === id ? (typeof patch === 'function' ? patch(e) : { ...e, ...patch }) : e)))
}
async function removeEvents(ids: string[]) {
  const gone = current.value.filter((e) => ids.includes(e.id) && e.deletable !== false)
  if (!gone.length) return
  if (props.beforeDelete && !(await props.beforeDelete(gone))) return
  const set = new Set(gone.map((e) => e.id))
  commit(current.value.filter((e) => !set.has(e.id)))
  setSelection(selected.value.filter((id) => !set.has(id)))
  emit('delete', { events: gone })
  announce(locale.ganttDeleted.replace('{count}', String(gone.length)))
}
function resourceRows() {
  return rows.value.filter((r): r is Extract<Row, { kind: 'resource' }> => r.kind === 'resource')
}
function onEventKey(e: KeyboardEvent, ev: TimelineEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
  if (e.key === 'Enter') { e.preventDefault(); emit('event-dblclick', ev, e); return }
  if (props.readonly) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    removeEvents(selectedSet.value.has(ev.id) ? selected.value : [ev.id])
    return
  }
  const s = spans.value.get(ev.id)
  if (!s) return
  const step = s.dateOnly ? DAY : snapStep(false) * 60_000
  let next: TimelineEvent | null = null
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ev.draggable !== false) {
    const d = e.key === 'ArrowLeft' ? -step : step
    if (e.shiftKey) {
      if (ev.resizable === false) return
      next = { ...ev, ...spanDates({ start: ev.start, end: ev.end }, s.start, Math.max(s.start + step, s.end + d)) as { start: string; end: string } }
    } else next = { ...ev, ...spanDates({ start: ev.start, end: ev.end }, s.start + d, s.end + d) as { start: string; end: string } }
  } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && ev.draggable !== false) {
    const list = resourceRows()
    const i = list.findIndex((r) => r.resource.id === ev.resourceId)
    const other = list[i + (e.key === 'ArrowUp' ? -1 : 1)]
    if (other) next = { ...ev, resourceId: other.resource.id }
  }
  if (!next) return
  e.preventDefault()
  const list = current.value.map((x) => (x.id === ev.id ? next! : x))
  if (props.overlap === 'prevent' && clashes(next, list).length) {
    emit('conflict', { event: next, with: clashes(next, list) })
    announce(locale.timelineConflict)
    return
  }
  commit(list)
  emit('change', { events: [next], kind: e.shiftKey ? 'resize' : 'move' })
  announceMove(next)
  nextTick(() => blockEls.get(ev.id)?.querySelector<HTMLElement>('[data-timeline-event]')?.focus({ preventScroll: true }))
}
function scrollToEvent(id: string) {
  const ev = eventById.value.get(id)
  if (!ev) return
  const g = groupOf(ev.resourceId)
  if (g && foldedSet.value.has(g)) toggleGroup(g)
  nextTick(() => {
    const geo = geometry.value.get(id)
    const el = scroller.value
    if (!geo || !el) return
    el.scrollTo({ left: Math.max(0, geo.x - 48), top: Math.max(0, geo.y - 48), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  })
}
function onRootKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest?.('[data-timeline-event]')) { e.preventDefault(); e.shiftKey ? redo() : undo() }
}

const TONES = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  success: 'bg-success-container text-on-success-container',
  neutral: 'bg-surface-container-highest text-on-surface',
}
const ACCENT = { primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary', error: 'bg-error', success: 'bg-success', neutral: 'bg-outline' }
const toneOf = (ev: TimelineEvent) => ev.color ?? resourceById.value.get(ev.resourceId)?.color ?? 'primary'
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}
const bookedHours = computed(() => {
  const m = new Map<string, number>()
  for (const e of shown.value) {
    const s = spans.value.get(e.id)
    if (s) m.set(e.resourceId, (m.get(e.resourceId) ?? 0) + (s.end - s.start) / HOUR)
  }
  return m
})

// ── Context ───────────────────────────────────────────────────────────────────────────────────────────────
const context: ResourceTimelineContext = {
  events: computed(() => shown.value),
  selection: computed(() => selected.value),
  conflicts,
  scale: axis.scaleNow,
  pxPerDay: ppd,
  canUndo,
  canRedo,
  undo,
  redo,
  zoomIn,
  zoomOut,
  setScale,
  scrollToDate,
  scrollToEvent,
  setSelection,
  addEvents,
  updateEvent,
  removeEvents,
  dateAt: (clientX) => {
    const r = scroller.value?.getBoundingClientRect()
    return formatDate(snapTime(timeAt(clientX - (r?.left ?? 0) - listWidth.value + view.value.left), snapStep(false)), false)
  },
  resourceAt: (clientY) => {
    const r = scroller.value?.getBoundingClientRect()
    return resourceAtY(clientY - (r?.top ?? 0) - headerHeight + view.value.top)
  },
}
provide(RESOURCE_TIMELINE_KEY, context)
provide(TIMELINE_CONTROLS_KEY, {
  scale: axis.scaleNow,
  readonly: computed(() => props.readonly),
  canUndo,
  canRedo,
  foldable: computed(() => props.resources.some((r) => r.group)),
  folded: computed(() => folded.value.length > 0),
  undo,
  redo,
  zoomIn,
  zoomOut,
  setScale,
  scrollToDate,
  expandAll: () => setFolded([]),
  collapseAll: () => setFolded([...new Set(props.resources.map((r) => r.group).filter((g): g is string => !!g))]),
})

onMounted(() => {
  const el = scroller.value!
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  nextTick(() => {
    const at = props.start ? parseDate(props.start) : todayMs.value ?? extent.value.min
    el.scrollLeft = Math.max(0, xOf(at) - Math.min(48, timelineView.value / 4))
    view.value.left = el.scrollLeft
  })
})
onBeforeUnmount(() => {
  scroller.value?.removeEventListener('touchmove', onTouchMove)
  removeWindow()
  stopAutoScroll()
  cancelAnimationFrame(springRaf)
})

defineExpose(context)
</script>

<template>
  <div class="m3-resource-timeline flex flex-col overflow-hidden rounded-md bg-surface text-on-surface" @keydown="onRootKey">
    <slot :timeline="context" />
    <div
      ref="scroller"
      class="relative min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain"
      @scroll.passive="axis.readView"
      @touchstart.passive="axis.onTouchStart"
      @touchend.passive="axis.onTouchEnd"
      @contextmenu="gesture && $event.preventDefault()"
    >
      <div class="relative" :style="{ width: `${listWidth + timelineWidth}px`, height: `${headerHeight + Math.max(contentHeight, view.height - headerHeight)}px` }">
        <div class="sticky top-0 z-20 flex" :style="{ height: `${headerHeight}px`, width: `${listWidth + timelineWidth}px` }">
          <div
            v-if="listWidth"
            class="sticky left-0 z-10 flex shrink-0 items-end border-r border-b border-outline-variant bg-surface-container-low px-4 pb-2 text-label-medium text-on-surface-variant"
            :style="{ width: `${listWidth}px` }"
          >
            {{ locale.timelineResource }}
          </div>
          <MTimeHeader :width="timelineWidth" :top-cells="topCells" :bottom-cells="bottomCells" :today-x="todayMs === null ? null : xOf(todayMs)" />
        </div>

        <div class="flex" :style="{ height: `${Math.max(contentHeight, view.height - headerHeight)}px` }">
          <!-- Resources -->
          <div v-if="listWidth" class="sticky left-0 z-10 shrink-0 border-r border-outline-variant bg-surface" :style="{ width: `${listWidth}px` }" role="list" :aria-label="label">
            <template v-for="r in visibleRows" :key="r.key">
              <button
                v-if="r.kind === 'group'"
                type="button"
                class="absolute inset-x-0 flex items-center gap-1 border-b border-outline-variant/60 bg-surface-container-low px-2 text-left text-title-small text-on-surface outline-none hover:bg-on-surface/8 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-inset"
                :style="{ top: `${r.top}px`, height: `${r.height}px` }"
                :aria-expanded="!foldedSet.has(r.group)"
                @click="toggleGroup(r.group)"
              >
                <span class="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200" :class="foldedSet.has(r.group) ? '-rotate-90' : ''">expand_more</span>
                <slot name="group" :group="r.group" :resources="r.resources" :collapsed="foldedSet.has(r.group)">
                  <span class="truncate">{{ r.group }}</span>
                  <span class="ml-auto pr-2 text-label-medium text-on-surface-variant">{{ r.resources.length }}</span>
                </slot>
              </button>
              <div
                v-else
                role="listitem"
                class="absolute inset-x-0 flex items-center gap-3 border-b border-outline-variant/60 px-4"
                :style="{ top: `${r.top}px`, height: `${r.height}px` }"
              >
                <slot name="resource" :resource="r.resource" :events="byResource.get(r.resource.id) ?? []" :hours="Math.round((bookedHours.get(r.resource.id) ?? 0) * 10) / 10">
                  <img v-if="r.resource.avatar" :src="r.resource.avatar" alt="" class="size-9 shrink-0 rounded-full object-cover">
                  <span
                    v-else
                    class="flex size-9 shrink-0 items-center justify-center rounded-full text-label-large"
                    :class="TONES[r.resource.color ?? 'neutral']"
                  >
                    <span v-if="r.resource.icon" class="material-symbols-outlined text-[20px]">{{ r.resource.icon }}</span>
                    <template v-else>{{ initials(r.resource.name) }}</template>
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-body-large text-on-surface">{{ r.resource.name }}</span>
                    <span v-if="r.resource.subtitle" class="block truncate text-body-small text-on-surface-variant">{{ r.resource.subtitle }}</span>
                  </span>
                </slot>
              </div>
            </template>
            <div
              role="separator"
              aria-orientation="vertical"
              :aria-label="locale.ganttResize"
              tabindex="0"
              class="absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none outline-none hover:bg-primary/20 focus-visible:bg-primary/30"
              @pointerdown="onSplitDown"
              @keydown.left.prevent="listW = Math.max(120, listW - 16); emit('update:listWidth', listW)"
              @keydown.right.prevent="listW = listW + 16; emit('update:listWidth', listW)"
            />
          </div>

          <!-- Timeline -->
          <div class="relative shrink-0" :style="{ width: `${timelineWidth}px` }" @pointerdown="onPaneDown">
            <MTimeBackground :off-times="offTimes" :cells="bottomCells" :today-x="todayMs === null ? null : xOf(todayMs)" />
            <div
              v-for="r in visibleRows"
              :key="`r${r.key}`"
              class="pointer-events-none absolute inset-x-0 border-b border-outline-variant/60"
              :class="r.kind === 'group' ? 'bg-surface-container-low/60' : ''"
              :style="{ top: `${r.top}px`, height: `${r.height}px` }"
            />
            <!-- A booking being drawn on empty time -->
            <div
              v-if="draft && rowOf.get(draft.resourceId)"
              class="pointer-events-none absolute rounded-sm border-2 border-dashed border-primary bg-primary/12"
              :style="{
                left: `${xOf(draft.start)}px`,
                width: `${xOf(draft.end) - xOf(draft.start)}px`,
                top: `${rowOf.get(draft.resourceId)!.top + 4}px`,
                height: `${rowOf.get(draft.resourceId)!.height - 8}px`,
              }"
            />
            <div
              v-for="{ event: ev } in visibleEvents"
              :key="ev.id"
              :ref="(el) => bindBlock(ev.id, el)"
              class="absolute top-0 left-0"
              :class="[ev.class, dragging?.id === ev.id ? 'z-10' : '']"
              :style="{ height: `${blockH}px` }"
            >
              <div
                data-timeline-event
                role="button"
                tabindex="0"
                :aria-label="`${ev.title}, ${resourceById.get(ev.resourceId)?.name ?? ''}, ${timeRange(ev)}`"
                :aria-pressed="selectedSet.has(ev.id)"
                class="group absolute inset-0 flex items-stretch overflow-hidden rounded-sm text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1"
                :class="[
                  TONES[toneOf(ev)],
                  selectedSet.has(ev.id) ? 'ring-2 ring-on-surface ring-offset-1 ring-offset-surface' : '',
                  conflicts.has(ev.id) || (dragging?.id === ev.id && refused) ? 'outline-2 outline-offset-1 outline-error' : '',
                  dragging?.id === ev.id ? 'shadow-elevation-3' : 'hover:shadow-elevation-1',
                  readonly || ev.draggable === false ? '' : 'cursor-grab active:cursor-grabbing',
                ]"
                @pointerdown="onEventDown($event, ev, 'body')"
                @dblclick="emit('event-dblclick', ev, $event)"
                @contextmenu="emit('event-contextmenu', ev, $event)"
                @keydown="onEventKey($event, ev)"
              >
                <span class="w-1 shrink-0" :class="ACCENT[toneOf(ev)]" />
                <span class="flex min-w-0 flex-1 items-center gap-1 px-2">
                  <slot name="event" :event="ev" :resource="resourceById.get(ev.resourceId)" :selected="selectedSet.has(ev.id)" :conflict="conflicts.has(ev.id)">
                    <span class="min-w-0 flex-1 leading-tight">
                      <span class="block truncate text-label-large">{{ ev.title }}</span>
                      <span v-if="blockH >= 30" class="block truncate text-label-small opacity-80">{{ ev.subtitle ?? timeRange(ev) }}</span>
                    </span>
                    <span v-if="conflicts.has(ev.id) && (geometry.get(ev.id)?.w ?? 0) > 72" class="material-symbols-outlined shrink-0 text-[18px] text-error" :title="locale.timelineConflict">warning</span>
                  </slot>
                </span>
              </div>
              <!-- Resize handles, outside the block's clipping: wider for a finger, with a grip while selected -->
              <template v-if="!readonly && ev.resizable !== false">
                <span
                  v-for="side in (['start', 'end'] as const)"
                  :key="side"
                  :data-timeline-resize="side"
                  class="absolute inset-y-0 z-[1] flex w-3 cursor-ew-resize items-center justify-center pointer-coarse:w-7"
                  :class="side === 'start' ? '-left-1 pointer-coarse:-left-3.5' : '-right-1 pointer-coarse:-right-3.5'"
                  @pointerdown="onEventDown($event, ev, side)"
                >
                  <span class="hidden h-3/5 w-1 rounded-full bg-on-surface pointer-coarse:block" :class="selectedSet.has(ev.id) ? 'opacity-100' : 'opacity-0'" />
                </span>
              </template>
            </div>
            <div v-if="!resources.length" class="absolute flex items-center justify-center p-6" :style="{ left: `${view.left}px`, width: `${timelineView}px`, top: 0, height: `${Math.max(120, view.height - headerHeight)}px` }">
              <slot name="empty">
                <span class="text-body-medium text-on-surface-variant">{{ locale.timelineEmpty }}</span>
              </slot>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="sr-only" aria-live="polite">{{ message }}</div>
  </div>
</template>
