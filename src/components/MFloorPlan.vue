<script lang="ts">
/** A table on the plan, in plan units (not pixels) */
export interface FloorTable {
  id: string | number
  label: string
  x: number
  y: number
  shape?: 'round' | 'square' | 'rect'
  seats?: number
  /** Size in plan units (default: from the shape and the seats) */
  width?: number
  height?: number
  /** Degrees */
  rotation?: number
  /** A key of `statuses` */
  status?: string
  /** A small badge: minutes seated, the total, a count… */
  badge?: string | number
  data?: Record<string, unknown>
}
/** Tables joined together (drawn as one group) */
export interface FloorMerge {
  id: string | number
  tables: (string | number)[]
  label?: string
}
/** A zone of the room (terrace, main hall, VIP): a rectangle behind the tables */
export interface FloorArea {
  id: string | number
  label?: string
  x: number
  y: number
  width: number
  height: number
  /** An M3 color role or any CSS color */
  color?: string
}
/** A wall: a line through its points */
export interface FloorWall {
  id: string | number
  points: [number, number][]
  thickness?: number
}
/** Something on the plan that isn't a table: a door, a window, a plant, a column, the register, a text label… */
export interface FloorDecor {
  id: string | number
  /** A built-in kind, or one of yours from `decorKinds` */
  kind: FloorDecorBuiltin | (string & {})
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  /** The text of a label (or a caption under the others) */
  label?: string
}
export type FloorDecorBuiltin = 'door' | 'window' | 'plant' | 'column' | 'restroom' | 'kitchen' | 'register' | 'stairs' | 'label'
/** How a decor kind looks: its default size, an icon, a shape and fill; yours or a built-in one restyled */
export interface FloorDecorKind {
  /** Name, for the accessible label */
  label?: string
  icon?: string
  width: number
  height: number
  /** `box` a rounded rectangle, `round` a circle, `bar` a thin slab (doors, windows), `text` the item's label only */
  shape?: 'box' | 'round' | 'bar' | 'text'
  /** Fill: an M3 color role (`surface`, `primary`…) or any CSS color */
  color?: string
}
/** What's picked on the plan besides tables: a zone, a wall (and one of its corners) or a decor item */
export type FloorPick = { kind: 'area' | 'wall' | 'decor'; id: string | number; vertex?: number } | null
/** How a status looks: an M3 color role ('primary', 'tertiary', 'error'…) or any CSS color, an icon, a name */
export interface FloorStatus {
  label: string
  color: string
  icon?: string
}
</script>

<script setup lang="ts">
/**
 * A floor plan of tables: to arrange them (`editable`: drag one or several, snapped to a grid, arrows nudge) and to
 * run service (each table colored by its status, with a badge, a click to open it). Merged tables are drawn as one
 * group. Positions are plan units scaled to the component's width, so the same plan fits a phone and a wall screen.
 * Not an M3 spec component.
 *
 * Editing: drag tables (Shift-click picks several), zones (resize by any corner), walls (drag a corner once picked;
 * double-click a wall for a new corner) and decor (resize by its corner); rotate the picked table or decor by the handle
 * above it (15° steps, Shift for free). Arrows nudge, Delete removes what's picked (a wall's picked corner, or the
 * selected tables), Ctrl+D duplicates, Ctrl+Z / Ctrl+Shift+Z undo and redo. `v-model:picked` says which zone, wall or
 * decor is picked, for an inspector of your own.
 *
 * @slot table The inside of a table: `{ table, status, selected }`
 * @event table-click A table was clicked or opened with Enter (not after a drag)
 * @event move Tables moved by a drag or the arrows, with their new positions (`{ id, x, y }[]`), to save them
 */
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import { useLocale } from '../composables/useLocale'
import { FLOOR_PLAN_KEY, type FloorItemKind, type FloorPlanContext } from '../composables/useFloorPlan'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  /** The plan's size in plan units */
  width?: number
  height?: number
  /** Status keys to their look */
  statuses?: Record<string, FloorStatus>
  /** Drag tables around; otherwise a click opens one */
  editable?: boolean
  /** Grid step in plan units (0: no snapping) */
  grid?: number
  /** Draw the grid while editing */
  showGrid?: boolean
  /** Draw chairs from `seats` */
  chairs?: boolean
  /** Decor kinds of yours, or the built-in ones restyled (merged over them by name) */
  decorKinds?: Record<string, FloorDecorKind>
  /** Outside editing, what a click on a table selects: nothing, one, or several (toggling; to merge them) */
  selectable?: 'none' | 'single' | 'multiple'
  /** Whether these tables may be merged: `true`, or `false` / a reason to refuse (shown by `merge-refused`) */
  canMerge?: (ids: (string | number)[]) => boolean | string
  /** Accessible name */
  label?: string
}>(), {
  width: 1000,
  height: 600,
  statuses: () => ({
    free: { label: 'Free', color: 'surface' },
    occupied: { label: 'Occupied', color: 'primary', icon: 'restaurant' },
    bill: { label: 'Bill requested', color: 'tertiary', icon: 'receipt_long' },
    reserved: { label: 'Reserved', color: 'secondary', icon: 'event' },
  }),
  editable: false,
  grid: 10,
  showGrid: true,
  chairs: true,
  selectable: 'none',
})
const tables = defineModel<FloorTable[]>('tables', { default: () => [] })
const merges = defineModel<FloorMerge[]>('merges', { default: () => [] })
const selection = defineModel<(string | number)[]>('selection', { default: () => [] })
const areas = defineModel<FloorArea[]>('areas', { default: () => [] })
const walls = defineModel<FloorWall[]>('walls', { default: () => [] })
const decor = defineModel<FloorDecor[]>('decor', { default: () => [] })
/** While editing: `select` moves things, `wall` draws a wall (click each corner, double-click or Enter to end), `area` drags out a zone */
const tool = defineModel<'select' | 'wall' | 'area'>('tool', { default: 'select' })
/** While editing: the zone, wall (and corner) or decor item picked, for an inspector of your own */
const picked = defineModel<FloorPick>('picked', { default: null })
// ── History: every edit the plan makes is a step Ctrl+Z takes back ──
type Snap = { tables: FloorTable[]; areas: FloorArea[]; walls: FloorWall[]; decor: FloorDecor[]; merges: FloorMerge[] }
const past = shallowRef<Snap[]>([])
const future = shallowRef<Snap[]>([])
const snap0 = (): Snap => ({ tables: tables.value, areas: areas.value, walls: walls.value, decor: decor.value, merges: merges.value })
/** Called before an edit: what it changes can be undone */
function record() {
  past.value = [...past.value, snap0()].slice(-100)
  future.value = []
}
function restore(sn: Snap) {
  const now = snap0()
  if (sn.tables !== now.tables) tables.value = sn.tables
  if (sn.areas !== now.areas) areas.value = sn.areas
  if (sn.walls !== now.walls) walls.value = sn.walls
  if (sn.decor !== now.decor) decor.value = sn.decor
  if (sn.merges !== now.merges) merges.value = sn.merges
}
function undo() {
  const sn = past.value[past.value.length - 1]
  if (!sn) return
  future.value = [snap0(), ...future.value]
  past.value = past.value.slice(0, -1)
  restore(sn)
}
function redo() {
  const sn = future.value[0]
  if (!sn) return
  past.value = [...past.value, snap0()]
  future.value = future.value.slice(1)
  restore(sn)
}
const emit = defineEmits<{
  merge: [merge: FloorMerge]
  split: [merge: FloorMerge]
  'merge-refused': [ids: (string | number)[], reason: string]
  'table-click': [table: FloorTable, event: MouseEvent | KeyboardEvent]
  move: [moved: { id: string | number; x: number; y: number }[]]
}>()
const locale = useLocale()

const root = ref<HTMLElement>()
/** A finger: bigger handles */
const coarse = ref(typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches)
const scale = ref(1)
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => (scale.value = (root.value?.clientWidth || props.width) / props.width))
  ro.observe(root.value!)
  scale.value = (root.value!.clientWidth || props.width) / props.width
})
onBeforeUnmount(() => ro?.disconnect())

// ── Geometry ────────────────────────────────────────────────────────────────────────────────────────────
const CHAIR = 16
type FloorBox = { w: number; h: number }
function sizeOf(t: FloorTable): FloorBox {
  const n = t.seats ?? 4
  const shape = t.shape ?? 'square'
  if (t.width && (t.height || shape !== 'rect')) return { w: t.width, h: t.height ?? t.width }
  if (shape === 'round') {
    const d = Math.max(60, 40 + n * 8)
    return { w: d, h: d }
  }
  if (shape === 'square') return { w: 72, h: 72 }
  return { w: Math.max(100, Math.ceil(n / 2) * 40 + 20), h: 72 }
}
/** Chairs around a table, as centers relative to its center */
function chairsOf(t: FloorTable, s: FloorBox): { x: number; y: number; r: number }[] {
  const n = t.seats ?? 0
  if (!props.chairs || !n) return []
  const gap = CHAIR / 2 + 4
  if ((t.shape ?? 'square') === 'round') {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(a) * (s.w / 2 + gap), y: Math.sin(a) * (s.h / 2 + gap), r: (a * 180) / Math.PI + 90 }
    })
  }
  // Long sides first (top and bottom), then the ends
  const sides: { len: number; at: (f: number) => { x: number; y: number; r: number } }[] = [
    { len: s.w, at: (f) => ({ x: -s.w / 2 + f * s.w, y: -s.h / 2 - gap, r: 0 }) },
    { len: s.w, at: (f) => ({ x: -s.w / 2 + f * s.w, y: s.h / 2 + gap, r: 180 }) },
    { len: s.h, at: (f) => ({ x: -s.w / 2 - gap, y: -s.h / 2 + f * s.h, r: 270 }) },
    { len: s.h, at: (f) => ({ x: s.w / 2 + gap, y: -s.h / 2 + f * s.h, r: 90 }) },
  ]
  const square = (t.shape ?? 'square') === 'square'
  const per = [0, 0, 0, 0]
  for (let i = 0; i < n; i++) {
    if (square) per[i % 4]!++
    else if (n > 2 && i >= n - 2 && n % 2 === 0 && n >= 6) per[i === n - 2 ? 2 : 3]!++
    else per[i % 2]!++
  }
  return sides.flatMap((side, k) => Array.from({ length: per[k]! }, (_, i) => side.at((i + 1) / (per[k]! + 1))))
}

// While a drag moves tables, their positions live here until the drop
const draft = shallowRef<Map<string | number, { x: number; y: number }> | null>(null)
const placed = computed(() =>
  tables.value.map((t) => {
    const at = draft.value?.get(t.id) ?? { x: t.x, y: t.y }
    const size = sizeOf(t)
    return { t, x: at.x, y: at.y, size, chairs: chairsOf(t, size), status: t.status ? props.statuses[t.status] : undefined }
  }),
)
const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'success', 'surface'])
function look(st?: FloorStatus) {
  if (!st || st.color === 'surface') return { background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface)' }
  if (ROLES.has(st.color)) return { background: `var(--color-${st.color}-container)`, color: `var(--color-on-${st.color}-container)` }
  return { background: st.color, color: '#fff' }
}
const mergeBoxes = computed(() =>
  merges.value.map((m) => {
    const ms = placed.value.filter((p) => m.tables.includes(p.t.id))
    if (!ms.length) return null
    const pad = CHAIR + 10
    const x1 = Math.min(...ms.map((p) => p.x - p.size.w / 2)) - pad
    const y1 = Math.min(...ms.map((p) => p.y - p.size.h / 2)) - pad
    const x2 = Math.max(...ms.map((p) => p.x + p.size.w / 2)) + pad
    const y2 = Math.max(...ms.map((p) => p.y + p.size.h / 2)) + pad
    return { m, x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  }).filter((b) => !!b),
)

// ── Dragging ────────────────────────────────────────────────────────────────────────────────────────────
let drag: { id: number; sx: number; sy: number; start: Map<string | number, { x: number; y: number }>; moved: boolean; pick?: string | number } | null = null
let suppressClick = false
const snap = (v: number) => (props.grid ? Math.round(v / props.grid) * props.grid : v)
function clamp(t: FloorTable, x: number, y: number) {
  const s = sizeOf(t)
  return { x: Math.min(props.width - s.w / 2, Math.max(s.w / 2, x)), y: Math.min(props.height - s.h / 2, Math.max(s.h / 2, y)) }
}
// A finger has no Shift: holding a table down adds it to the selection (or takes it out)
const LONG_PRESS = 450
let longPress = 0
let longPressed = false
function onDown(e: PointerEvent, t: FloorTable) {
  if (!props.editable || e.button !== 0 || tool.value !== 'select') return
  e.stopPropagation()
  picked.value = null
  const touch = e.pointerType === 'touch'
  longPressed = false
  clearTimeout(longPress)
  if (touch) {
    longPress = window.setTimeout(() => {
      if (!drag || drag.moved) return
      longPressed = true
      selection.value = selection.value.includes(t.id) ? selection.value.filter((x) => x !== t.id) : [...selection.value, t.id]
      navigator.vibrate?.(10)
    }, LONG_PRESS)
  } else if (!selection.value.includes(t.id)) selection.value = e.shiftKey || e.ctrlKey || e.metaKey ? [...selection.value, t.id] : [t.id]
  // A touch picks the table once it moves (or on release), so a long press can add to what's picked
  const ids = selection.value.includes(t.id) ? selection.value : [t.id]
  drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start: new Map(tables.value.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }])), moved: false, pick: touch && !selection.value.includes(t.id) ? t.id : undefined }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = (e.clientX - drag.sx) / scale.value
  const dy = (e.clientY - drag.sy) / scale.value
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < (e.pointerType === 'touch' ? 8 : 4)) return
  if (!drag.moved) {
    clearTimeout(longPress)
    if (drag.pick !== undefined) selection.value = [drag.pick]
  }
  drag.moved = true
  const next = new Map<string | number, { x: number; y: number }>()
  for (const [id, p] of drag.start) next.set(id, clamp(tables.value.find((x) => x.id === id)!, p.x + dx, p.y + dy))
  draft.value = next
}
function onUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  clearTimeout(longPress)
  if (longPressed) {
    suppressClick = true
    setTimeout(() => (suppressClick = false))
  }
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  const d = draft.value
  const moved = drag.moved && d && e.type !== 'pointercancel'
  drag = null
  draft.value = null
  if (!moved) return
  suppressClick = true
  setTimeout(() => (suppressClick = false))
  commitMoves(new Map([...d!].map(([id, p]) => [id, clamp(tables.value.find((x) => x.id === id)!, snap(p.x), snap(p.y))])))
}
function commitMoves(next: Map<string | number, { x: number; y: number }>) {
  record()
  tables.value = tables.value.map((t) => (next.has(t.id) ? { ...t, ...next.get(t.id)! } : t))
  emit('move', [...next].map(([id, p]) => ({ id, ...p })))
}
function onClick(e: MouseEvent, t: FloorTable) {
  if (suppressClick) return
  if (props.editable && !(e.shiftKey || e.ctrlKey || e.metaKey)) selection.value = [t.id]
  else if (!props.editable && props.selectable === 'single') selection.value = selection.value.length === 1 && selection.value[0] === t.id ? [] : [t.id]
  else if (!props.editable && props.selectable === 'multiple')
    selection.value = selection.value.includes(t.id) ? selection.value.filter((x) => x !== t.id) : [...selection.value, t.id]
  emit('table-click', t, e)
}
function onKey(e: KeyboardEvent, t: FloorTable) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('table-click', t, e)
    return
  }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
  if (!dir || !props.editable) return
  e.preventDefault()
  const step = (props.grid || 1) * (e.shiftKey ? 5 : 1)
  const ids = selection.value.includes(t.id) ? selection.value : [t.id]
  commitMoves(new Map(tables.value.filter((x) => ids.includes(x.id)).map((x) => [x.id, clamp(x, x.x + dir[0]! * step, x.y + dir[1]! * step)])))
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
// ── Zones, walls and decor ───────────────────────────────────────────────────────────────────────────────
const BUILTIN_DECOR: Record<FloorDecorBuiltin, FloorDecorKind> = {
  door: { label: 'Door', icon: 'door_front', width: 60, height: 14, shape: 'bar' },
  window: { label: 'Window', icon: 'window', width: 80, height: 10, shape: 'bar' },
  plant: { label: 'Plant', icon: 'potted_plant', width: 40, height: 40 },
  column: { label: 'Column', width: 30, height: 30, shape: 'round', color: 'var(--color-outline)' },
  restroom: { label: 'Restroom', icon: 'wc', width: 48, height: 48 },
  kitchen: { label: 'Kitchen', icon: 'skillet', width: 48, height: 48 },
  register: { label: 'Register', icon: 'point_of_sale', width: 48, height: 48 },
  stairs: { label: 'Stairs', icon: 'stairs', width: 60, height: 60 },
  label: { label: 'Label', width: 120, height: 30, shape: 'text' },
}
const kinds = computed<Record<string, FloorDecorKind>>(() => {
  const out: Record<string, FloorDecorKind> = { ...BUILTIN_DECOR }
  for (const [k, v] of Object.entries(props.decorKinds ?? {})) out[k] = { ...out[k], ...v }
  return out
})
const kindOf = (d: FloorDecor): FloorDecorKind => kinds.value[d.kind] ?? { width: 40, height: 40 }
const decorSize = (d: FloorDecor) => ({ w: d.width ?? kindOf(d).width, h: d.height ?? kindOf(d).height })
function decorLook(k: FloorDecorKind) {
  const shape = k.shape ?? 'box'
  if (shape === 'text') return {}
  const c = k.color ?? (shape === 'bar' ? 'surface-container-highest' : 'surface-container-high')
  const bg = c.startsWith('surface') || c.startsWith('var(') || c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl')
    ? (c.startsWith('surface') ? `var(--color-${c})` : c)
    : `var(--color-${c}-container)`
  return { background: bg, borderRadius: shape === 'round' ? '9999px' : shape === 'bar' ? '2px' : '8px' }
}
function areaLook(color?: string) {
  const c = color ?? 'secondary'
  return ROLES.has(c) ? { background: `color-mix(in srgb, var(--color-${c}-container) 45%, transparent)`, borderColor: `var(--color-${c})` } : { background: `color-mix(in srgb, ${c} 18%, transparent)`, borderColor: c }
}
// `picked` (a v-model) is declared with the other models
const isPicked = (kind: 'area' | 'wall' | 'decor', id: string | number) => picked.value?.kind === kind && picked.value.id === id
const toPlan = (e: { clientX: number; clientY: number }) => {
  const r = root.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left) / scale.value, y: (e.clientY - r.top) / scale.value }
}
/** A generic drag in plan units: `move` gets the offset from where it started, `end` runs once if it moved */
function follow(e: PointerEvent, move: (dx: number, dy: number) => void, end: () => void) {
  // Keys (Delete, Enter) reach the plan while something on it is being edited
  root.value?.focus({ preventScroll: true })
  const sx = e.clientX
  const sy = e.clientY
  let moved = false
  const mv = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return
    moved = true
    move((ev.clientX - sx) / scale.value, (ev.clientY - sy) / scale.value)
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    window.removeEventListener('pointermove', mv)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    if (moved) end()
  }
  window.addEventListener('pointermove', mv)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
const areaDraft = shallowRef<FloorArea | null>(null)
const shownAreas = computed(() => areas.value.map((a) => (areaDraft.value?.id === a.id ? areaDraft.value : a)).concat(areaDraft.value && !areas.value.some((a) => a.id === areaDraft.value!.id) ? [areaDraft.value] : []))
type Corner = 'nw' | 'ne' | 'sw' | 'se'
function onAreaDown(e: PointerEvent, a: FloorArea, corner: Corner | null) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'area', id: a.id }
  selection.value = []
  follow(e, (dx, dy) => {
    if (!corner) {
      areaDraft.value = { ...a, x: a.x + dx, y: a.y + dy }
      return
    }
    // The opposite corner stays put
    const min = props.grid || 20
    const left = corner.includes('w')
    const top = corner[0] === 'n'
    const w = Math.max(min, a.width + (left ? -dx : dx))
    const h = Math.max(min, a.height + (top ? -dy : dy))
    areaDraft.value = { ...a, x: left ? a.x + a.width - w : a.x, y: top ? a.y + a.height - h : a.y, width: w, height: h }
  }, () => {
    const d = areaDraft.value!
    areaDraft.value = null
    record()
    areas.value = areas.value.map((x) => (x.id === a.id ? { ...d, x: snap(d.x), y: snap(d.y), width: snap(d.width) || d.width, height: snap(d.height) || d.height } : x))
  })
}
const decorDraft = shallowRef<FloorDecor | null>(null)
const shownDecor = computed(() => decor.value.map((d) => (decorDraft.value?.id === d.id ? decorDraft.value : d)))
function onDecorDown(e: PointerEvent, d: FloorDecor, resize = false) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'decor', id: d.id }
  selection.value = []
  const s0 = decorSize(d)
  // Resizing from the bottom-right corner keeps it centered where it is, growing both ways
  follow(e, (dx, dy) => (decorDraft.value = resize ? { ...d, width: Math.max(10, s0.w + dx * 2), height: Math.max(6, s0.h + dy * 2) } : { ...d, x: d.x + dx, y: d.y + dy }), () => {
    const n = decorDraft.value!
    decorDraft.value = null
    record()
    decor.value = decor.value.map((x) => (x.id === d.id ? (resize ? { ...n, width: Math.round(n.width!), height: Math.round(n.height!) } : { ...n, x: snap(n.x), y: snap(n.y) }) : x))
  })
}
const wallDraft = shallowRef<FloorWall | null>(null)
const shownWalls = computed(() => walls.value.map((w) => (wallDraft.value?.id === w.id ? wallDraft.value : w)))
const wallPath = (w: FloorWall) => w.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x * scale.value} ${y * scale.value}`).join('')
function onWallDown(e: PointerEvent, w: FloorWall, vertex = -1) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'wall', id: w.id, ...(vertex >= 0 && { vertex }) }
  selection.value = []
  follow(e, (dx, dy) => {
    wallDraft.value = { ...w, points: w.points.map(([x, y], i) => (vertex < 0 || i === vertex ? [x + dx, y + dy] : [x, y])) }
  }, () => {
    const n = wallDraft.value!
    wallDraft.value = null
    record()
    walls.value = walls.value.map((x) => (x.id === w.id ? { ...n, points: n.points.map(([x, y]) => [snap(x), snap(y)] as [number, number]) } : x))
  })
}
// Drawing new walls and zones
const drawing = ref<[number, number][] | null>(null)
const hover = ref<[number, number] | null>(null)
let made = 0
const newId = (p: string) => `${p}${Date.now().toString(36)}${made++}`
function onPlanPointer(e: PointerEvent) {
  if (!props.editable) return
  if (tool.value === 'select') {
    if (e.target === e.currentTarget || (e.target as Element).closest('svg') === svgEl.value) {
      selection.value = []
      picked.value = null
    }
    return
  }
  const p = toPlan(e)
  const at: [number, number] = [snap(p.x), snap(p.y)]
  if (tool.value === 'wall') {
    drawing.value = [...(drawing.value ?? [at]), at]
    return
  }
  const id = newId('area')
  areaDraft.value = { id, x: at[0], y: at[1], width: 0, height: 0 }
  follow(e, (dx, dy) => (areaDraft.value = { id, x: Math.min(at[0], at[0] + dx), y: Math.min(at[1], at[1] + dy), width: Math.abs(dx), height: Math.abs(dy) }), () => {
    const d = areaDraft.value!
    areaDraft.value = null
    if (d.width > 10 && d.height > 10) {
      record()
      areas.value = [...areas.value, { ...d, x: snap(d.x), y: snap(d.y), width: snap(d.width) || d.width, height: snap(d.height) || d.height }]
      picked.value = { kind: 'area', id }
    }
  })
}
function onPlanMove(e: PointerEvent) {
  if (drawing.value) {
    const p = toPlan(e)
    hover.value = [snap(p.x), snap(p.y)]
  }
}
function finishWall() {
  const pts = drawing.value?.filter((p, i, a) => !i || p[0] !== a[i - 1]![0] || p[1] !== a[i - 1]![1])
  drawing.value = null
  hover.value = null
  if (pts && pts.length > 1) record()
  if (pts && pts.length > 1) walls.value = [...walls.value, { id: newId('wall'), points: pts }]
}
function onPlanKey(e: KeyboardEvent) {
  if (drawing.value && (e.key === 'Enter' || e.key === 'Escape')) {
    e.preventDefault()
    if (e.key === 'Enter') finishWall()
    else drawing.value = null
    return
  }
  if (!props.editable) return
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (mod && key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
    return
  }
  if (mod && key === 'y') {
    e.preventDefault()
    redo()
    return
  }
  if (mod && key === 'd') {
    e.preventDefault()
    duplicate()
    return
  }
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  if (!picked.value && !selection.value.length) return
  e.preventDefault()
  removeSelected()
}
function removeSelected() {
  if (!picked.value) {
    if (selection.value.length) removeTables(selection.value)
    return
  }
  const { kind, id, vertex } = picked.value
  record()
  if (kind === 'area') areas.value = areas.value.filter((a) => a.id !== id)
  if (kind === 'wall') {
    const w = walls.value.find((x) => x.id === id)
    // A picked corner goes (a wall keeps at least two); otherwise the whole wall
    if (w && vertex !== undefined && w.points.length > 2) {
      walls.value = walls.value.map((x) => (x.id === id ? { ...x, points: x.points.filter((_, i) => i !== vertex) } : x))
      picked.value = { kind: 'wall', id }
      return
    }
    walls.value = walls.value.filter((x) => x.id !== id)
  }
  if (kind === 'decor') decor.value = decor.value.filter((d) => d.id !== id)
  picked.value = null
}
const svgEl = ref<SVGSVGElement>()
/** Removes tables (and takes them out of their merges; a merge left with one table goes) */
function removeTables(ids: (string | number)[]) {
  record()
  tables.value = tables.value.filter((t) => !ids.includes(t.id))
  merges.value = merges.value.map((m) => ({ ...m, tables: m.tables.filter((x) => !ids.includes(x)) })).filter((m) => m.tables.length > 1)
  selection.value = []
}
/** A copy of the selected tables, or of the picked zone or decor, a grid step or two away */
function duplicate() {
  const off = Math.max(20, (props.grid || 10) * 2)
  if (selection.value.length) {
    const copies = tables.value.filter((t) => selection.value.includes(t.id)).map((t) => ({ ...t, id: newId('table'), x: t.x + off, y: t.y + off, status: undefined, badge: undefined }))
    record()
    tables.value = [...tables.value, ...copies]
    selection.value = copies.map((t) => t.id)
    return
  }
  const pk = picked.value
  if (pk?.kind === 'area') {
    const a = areas.value.find((x) => x.id === pk.id)
    if (!a) return
    const c = { ...a, id: newId('area'), x: a.x + off, y: a.y + off }
    record()
    areas.value = [...areas.value, c]
    picked.value = { kind: 'area', id: c.id }
  } else if (pk?.kind === 'decor') {
    const d = decor.value.find((x) => x.id === pk.id)
    if (!d) return
    const c = { ...d, id: newId('decor'), x: d.x + off, y: d.y + off }
    record()
    decor.value = [...decor.value, c]
    picked.value = { kind: 'decor', id: c.id }
  }
}
// ── Rotating a table or a decor item by its handle (15° steps; Shift: free) ──
const rotateDraft = shallowRef<{ id: string | number; kind: 'table' | 'decor'; deg: number } | null>(null)
function onRotateDown(e: PointerEvent, kind: 'table' | 'decor', id: string | number, cx: number, cy: number) {
  if (!props.editable || e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const r = root.value!.getBoundingClientRect()
  const angle = (ev: PointerEvent) => (Math.atan2(ev.clientY - (r.top + cy * scale.value), ev.clientX - (r.left + cx * scale.value)) * 180) / Math.PI + 90
  const mv = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    let deg = ((angle(ev) % 360) + 360) % 360
    if (!ev.shiftKey) deg = Math.round(deg / 15) * 15 % 360
    rotateDraft.value = { id, kind, deg }
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    window.removeEventListener('pointermove', mv)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    const d = rotateDraft.value
    rotateDraft.value = null
    if (!d) return
    record()
    if (kind === 'table') tables.value = tables.value.map((t) => (t.id === id ? { ...t, rotation: d.deg } : t))
    else decor.value = decor.value.map((x) => (x.id === id ? { ...x, rotation: d.deg } : x))
  }
  window.addEventListener('pointermove', mv)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
const rotationOf = (kind: 'table' | 'decor', id: string | number, base?: number) => (rotateDraft.value?.kind === kind && rotateDraft.value.id === id ? rotateDraft.value.deg : base ?? 0)

/**
 * Merges tables (the selection by default, with what they're already merged with) into one group. `canMerge` can
 * refuse (the `merge-refused` event says why). Returns the merge, or null.
 */
function merge(ids: (string | number)[] = selection.value, label?: string): FloorMerge | null {
  const all = [...new Set(ids.flatMap((id) => merges.value.find((m) => m.tables.includes(id))?.tables ?? [id]))]
  if (all.length < 2) return null
  const ok = props.canMerge?.(all) ?? true
  if (ok !== true) {
    emit('merge-refused', all, typeof ok === 'string' ? ok : '')
    return null
  }
  const name = label ?? all.map((id) => tables.value.find((t) => t.id === id)?.label ?? id).join(' + ')
  const m: FloorMerge = { id: newId('merge'), tables: all, label: name }
  record()
  merges.value = [...merges.value.filter((x) => !x.tables.some((id) => all.includes(id))), m]
  selection.value = []
  emit('merge', m)
  return m
}
/** Splits a merge (by its id, or the one a table is in) back into its tables */
function split(idOrTable: string | number) {
  const m = merges.value.find((x) => x.id === idOrTable) ?? merges.value.find((x) => x.tables.includes(idOrTable))
  if (!m) return
  record()
  merges.value = merges.value.filter((x) => x !== m)
  emit('split', m)
}
// ── The context the toolbar, the inspector and your own controls work through ──
let lastEdit = { key: '', at: 0 }
function update(kind: FloorItemKind, id: string | number, patch: Record<string, unknown>) {
  // Typing a label or dragging a slider is one undo step, not one per keystroke
  const key = `${kind}:${id}:${Object.keys(patch).sort().join()}`
  const now = performance.now()
  if (key !== lastEdit.key || now - lastEdit.at > 1000) record()
  lastEdit = { key, at: now }
  const apply = <T extends { id: string | number }>(list: T[]) => list.map((x) => (x.id === id ? { ...x, ...patch } : x))
  if (kind === 'table') tables.value = apply(tables.value)
  else if (kind === 'area') areas.value = apply(areas.value)
  else if (kind === 'wall') walls.value = apply(walls.value)
  else decor.value = apply(decor.value)
}
function addTable(t: Partial<FloorTable> = {}): FloorTable {
  const n = Math.max(0, ...tables.value.map((x) => Number(x.label)).filter((x) => Number.isFinite(x))) + 1
  const table: FloorTable = { id: newId('table'), label: String(n), x: snap(props.width / 2), y: snap(props.height / 2), shape: 'square', seats: 4, ...t }
  record()
  tables.value = [...tables.value, table]
  selection.value = [table.id]
  picked.value = null
  return table
}
function addDecor(kind: string, d: Partial<FloorDecor> = {}): FloorDecor {
  const item: FloorDecor = { id: newId('decor'), kind, x: snap(props.width / 2), y: snap(props.height / 2), ...(kinds.value[kind]?.shape === 'text' && { label: kinds.value[kind]?.label ?? kind }), ...d }
  record()
  decor.value = [...decor.value, item]
  picked.value = { kind: 'decor', id: item.id }
  selection.value = []
  return item
}
const context: FloorPlanContext = {
  tables,
  areas,
  walls,
  decor,
  merges,
  selection,
  picked,
  tool,
  editable: computed(() => props.editable),
  drawingWall: computed(() => !!drawing.value),
  finishWall,
  cancelWall: () => {
    drawing.value = null
    hover.value = null
  },
  kinds,
  statuses: computed(() => props.statuses),
  size: computed(() => ({ width: props.width, height: props.height })),
  canUndo: computed(() => past.value.length > 0),
  canRedo: computed(() => future.value.length > 0),
  undo,
  redo,
  addTable,
  addDecor,
  update: update as FloorPlanContext['update'],
  removeSelected,
  removeTables,
  duplicate,
  merge,
  split,
}
provide(FLOOR_PLAN_KEY, context)

defineExpose({
  /** Everything above and more, for MFloorPlanToolbar / MFloorPlanInspector outside the plan (`:plan="plan"`) */
  context,
  addTable,
  addDecor,
  update,
  removeSelected,
  /** Merge tables (default: the selection) / split a merge (by its id or a table's) */
  merge,
  split,
  /** Undo / redo the plan's own edits (also Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y) */
  undo,
  redo,
  canUndo: computed(() => past.value.length > 0),
  canRedo: computed(() => future.value.length > 0),
  /** Copy the selected tables, or the picked zone or decor (also Ctrl+D) */
  duplicate,
  /** Remove tables, taking them out of their merges (Delete does it for the selection) */
  removeTables,
})
/** Double-click on a wall: a new corner there, on the nearest segment */
function onWallDblclick(e: MouseEvent, w: FloorWall) {
  if (!props.editable || tool.value !== 'select') return
  e.stopPropagation()
  const p = toPlan(e)
  let best = 0
  let bestD = Infinity
  for (let i = 1; i < w.points.length; i++) {
    const [ax, ay] = w.points[i - 1]!
    const [bx, by] = w.points[i]!
    const len = (bx - ax) ** 2 + (by - ay) ** 2
    const t = len ? Math.max(0, Math.min(1, ((p.x - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / len)) : 0
    const d = Math.hypot(ax + t * (bx - ax) - p.x, ay + t * (by - ay) - p.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const pt: [number, number] = [snap(p.x), snap(p.y)]
  record()
  walls.value = walls.value.map((x) => (x.id === w.id ? { ...x, points: [...x.points.slice(0, best), pt, ...x.points.slice(best)] } : x))
  picked.value = { kind: 'wall', id: w.id, vertex: best }
}

const ariaOf = (p: (typeof placed.value)[number]) =>
  [p.t.label, p.status?.label, p.t.seats ? locale.floorSeats.replace('{n}', String(p.t.seats)) : '', p.t.badge !== undefined ? String(p.t.badge) : ''].filter(Boolean).join(', ')
const gridStyle = computed(() => {
  const g = (props.grid >= 10 ? props.grid : props.grid * Math.ceil(10 / Math.max(1, props.grid))) * scale.value
  return props.editable && props.showGrid && props.grid
    ? { backgroundImage: 'radial-gradient(circle, var(--color-outline-variant) 1px, transparent 1.2px)', backgroundSize: `${g}px ${g}px` }
    : {}
})
</script>

<template>
  <div
    ref="root"
    class="m3-floor-plan select-none"
    :style="{ aspectRatio: `${width} / ${height}`, ...gridStyle }"
    role="group"
    tabindex="-1"
    :aria-label="label ?? locale.floorPlan"
    :class="editable && tool !== 'select' && 'cursor-crosshair'"
    @pointerdown="onPlanPointer"
    @pointermove="onPlanMove"
    @dblclick="drawing && finishWall()"
    @keydown="onPlanKey"
  >
    <!-- Zones -->
    <div
      v-for="a in shownAreas"
      :key="`a${a.id}`"
      class="absolute rounded-lg border"
      :class="[editable && tool === 'select' ? 'cursor-move touch-none' : 'pointer-events-none', isPicked('area', a.id) && 'ring-2 ring-primary']"
      :style="{ left: `${a.x * scale}px`, top: `${a.y * scale}px`, width: `${a.width * scale}px`, height: `${a.height * scale}px`, ...areaLook(a.color) }"
      @pointerdown="onAreaDown($event, a, null)"
    >
      <slot name="area" :area="a" :picked="isPicked('area', a.id)" :scale="scale">
        <span v-if="a.label" class="absolute top-1 left-2 text-label-medium text-on-surface-variant">{{ a.label }}</span>
      </slot>
      <template v-if="editable && isPicked('area', a.id)">
        <span
          v-for="c in (['nw', 'ne', 'sw', 'se'] as const)"
          :key="c"
          class="m3-floor-handle absolute size-3 rounded-xs border-2 border-primary bg-surface"
          :class="[c[0] === 'n' ? '-top-1.5' : '-bottom-1.5', c[1] === 'w' ? '-left-1.5' : '-right-1.5', c === 'nw' || c === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize']"
          :data-corner="c"
          @pointerdown="onAreaDown($event, a, c)"
        />
      </template>
    </div>

    <!-- Walls -->
    <svg ref="svgEl" class="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g v-for="w in shownWalls" :key="`w${w.id}`">
        <path
          :d="wallPath(w)"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="m3-floor-wall"
          :class="[editable && tool === 'select' && 'pointer-events-auto cursor-move touch-none', isPicked('wall', w.id) && 'm3-floor-wall-picked']"
          :stroke-width="(w.thickness ?? 8) * scale"
          @pointerdown="onWallDown($event, w)"
          @dblclick="onWallDblclick($event, w)"
        />
        <template v-if="editable && isPicked('wall', w.id)">
          <circle
            v-for="(pt, i) in w.points"
            :key="i"
            :cx="pt[0] * scale"
            :cy="pt[1] * scale"
            :r="(picked?.vertex === i ? 8 : 6) * (coarse ? 1.6 : 1)"
            class="pointer-events-auto cursor-move touch-none stroke-primary"
            :class="picked?.vertex === i ? 'fill-primary' : 'fill-surface'"
            stroke-width="2"
            @pointerdown="onWallDown($event, w, i)"
          />
        </template>
      </g>
      <path
        v-if="drawing"
        :d="wallPath({ id: 'new', points: hover ? [...drawing, hover] : drawing })"
        fill="none"
        class="stroke-primary"
        stroke-dasharray="6 4"
        stroke-linecap="round"
        :stroke-width="8 * scale"
      />
    </svg>

    <!-- Decor -->
    <div
      v-for="d in shownDecor"
      :key="`d${d.id}`"
      class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-on-surface-variant"
      :class="[
        editable && tool === 'select' ? 'cursor-move touch-none' : 'pointer-events-none',
        isPicked('decor', d.id) && 'ring-2 ring-primary',
      ]"
      :style="{ left: `${d.x * scale}px`, top: `${d.y * scale}px`, width: `${decorSize(d).w * scale}px`, height: `${decorSize(d).h * scale}px`, rotate: `${rotationOf('decor', d.id, d.rotation)}deg`, ...decorLook(kindOf(d)) }"
      :aria-label="d.label ?? kindOf(d).label ?? d.kind"
      role="img"
      @pointerdown="onDecorDown($event, d)"
    >
      <slot name="decor" :item="d" :kind="kindOf(d)" :picked="isPicked('decor', d.id)" :scale="scale">
        <MIcon v-if="kindOf(d).icon && kindOf(d).shape !== 'bar'" :name="kindOf(d).icon!" :size="Math.max(12, Math.min(decorSize(d).w, decorSize(d).h) * 0.6 * scale)" />
        <span v-if="kindOf(d).shape === 'text'" class="truncate text-title-small text-on-surface-variant" :style="{ fontSize: `${Math.max(10, 16 * scale)}px` }">{{ d.label }}</span>
      </slot>
      <span
        v-if="editable && isPicked('decor', d.id)"
        class="m3-floor-handle absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-xs border-2 border-primary bg-surface"
        data-resize
        @pointerdown="onDecorDown($event, d, true)"
      />
      <span
        v-if="editable && isPicked('decor', d.id)"
        class="m3-floor-handle absolute -top-6 left-1/2 size-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-surface"
        :aria-label="locale.floorRotate"
        data-rotate
        @pointerdown="onRotateDown($event, 'decor', d.id, d.x, d.y)"
      />
    </div>

    <!-- Merged tables: one outline around the group -->
    <div
      v-for="b in mergeBoxes"
      :key="`m${b!.m.id}`"
      class="m3-floor-merge pointer-events-none absolute rounded-2xl border-2 border-dashed"
      :style="{ left: `${b!.x * scale}px`, top: `${b!.y * scale}px`, width: `${b!.w * scale}px`, height: `${b!.h * scale}px` }"
    >
      <slot name="merge" :merge="b!.m" :tables="b!.m.tables">
        <span v-if="b!.m.label" class="m3-floor-merge-label absolute -top-2.5 left-3 rounded-full px-2 text-label-small">{{ b!.m.label }}</span>
      </slot>
    </div>

    <div
      v-for="p in placed"
      :key="p.t.id"
      class="absolute"
      :class="!draft?.has(p.t.id) && 'transition-[left,top] duration-200 ease-out'"
      :style="{ left: `${p.x * scale}px`, top: `${p.y * scale}px`, transform: `rotate(${rotationOf('table', p.t.id, p.t.rotation)}deg)` }"
    >
      <!-- Rotation handle of the one table picked while editing -->
      <span
        v-if="editable && selection.length === 1 && selection[0] === p.t.id && tool === 'select'"
        class="m3-floor-handle absolute z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-primary bg-surface"
        :style="{ left: '0px', top: `${-(p.size.h / 2 + CHAIR + 18) * scale}px` }"
        :aria-label="locale.floorRotate"
        data-rotate
        @pointerdown="onRotateDown($event, 'table', p.t.id, p.x, p.y)"
      />
      <span
        v-for="(ch, i) in p.chairs"
        :key="i"
        class="m3-floor-chair pointer-events-none absolute rounded-md"
        :style="{ width: `${CHAIR * scale}px`, height: `${CHAIR * 0.75 * scale}px`, left: `${ch.x * scale}px`, top: `${ch.y * scale}px`, transform: `translate(-50%, -50%) rotate(${ch.r}deg)` }"
      />
      <div
        role="button"
        tabindex="0"
        class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 text-center shadow-elevation-1 outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-secondary"
        :class="[
          (p.t.shape ?? 'square') === 'round' ? 'rounded-full' : 'rounded-lg',
          editable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer hover:shadow-elevation-2',
          selection.includes(p.t.id) && 'ring-2 ring-primary',
          draft?.has(p.t.id) && 'shadow-elevation-3',
        ]"
        :style="{ width: `${p.size.w * scale}px`, height: `${p.size.h * scale}px`, ...look(p.status), fontSize: `${Math.max(9, 14 * scale)}px` }"
        :aria-label="ariaOf(p)"
        :aria-pressed="editable ? selection.includes(p.t.id) : undefined"
        @pointerdown="onDown($event, p.t)"
        @click="onClick($event, p.t)"
        @keydown="onKey($event, p.t)"
      >
        <!-- The inside stays upright however the table turns -->
        <span class="flex flex-col items-center justify-center gap-0.5" :style="{ transform: `rotate(${-rotationOf('table', p.t.id, p.t.rotation)}deg)` }">
          <slot name="table" :table="p.t" :status="p.status" :selected="selection.includes(p.t.id)">
            <MIcon v-if="p.status?.icon && scale > 0.5" :name="p.status.icon" :size="Math.max(12, 18 * scale)" class="opacity-80" />
            <span class="max-w-full truncate px-1 leading-tight font-medium">{{ p.t.label }}</span>
          </slot>
        </span>
        <span
          v-if="p.t.badge !== undefined"
          class="absolute -top-2 -right-2 min-w-5 rounded-full bg-error px-1.5 text-center text-label-small leading-5 text-on-error"
          :style="{ transform: `rotate(${-rotationOf('table', p.t.id, p.t.rotation)}deg)` }"
        >{{ p.t.badge }}</span>
      </div>
    </div>
    <!-- Anything of yours over the plan, placed in plan units with toPx -->
    <slot name="overlay" :scale="scale" :to-px="(v: number) => v * scale" />
  </div>
</template>

<style>
/* Defaults a consumer's own utilities override: none on the root itself. The colors are custom properties to restyle:
   --m3-floor-wall, --m3-floor-wall-picked, --m3-floor-chair, --m3-floor-merge, --m3-floor-merge-label */
@layer base {
  .m3-floor-plan {
    --m3-floor-wall: var(--color-on-surface-variant);
    --m3-floor-wall-picked: var(--color-primary);
    --m3-floor-chair: var(--color-outline-variant);
    --m3-floor-merge: var(--color-primary);
    --m3-floor-merge-label: var(--color-on-primary);
    position: relative;
    overflow: hidden;
    width: 100%;
    border-radius: var(--radius-xl, 12px);
    background-color: var(--color-surface-container-low);
  }
}
@layer base {
  /* Handles: never a scroll, and a finger-sized target around the small mark */
  .m3-floor-handle {
    touch-action: none;
  }
  .m3-floor-handle::after {
    content: '';
    position: absolute;
    inset: -6px;
  }
  @media (pointer: coarse) {
    .m3-floor-handle::after {
      inset: -16px;
    }
  }
  .m3-floor-wall {
    stroke: var(--m3-floor-wall);
  }
  .m3-floor-wall-picked {
    stroke: var(--m3-floor-wall-picked);
  }
  .m3-floor-chair {
    background: var(--m3-floor-chair);
  }
  .m3-floor-merge {
    border-color: color-mix(in srgb, var(--m3-floor-merge) 60%, transparent);
    background: color-mix(in srgb, var(--m3-floor-merge) 5%, transparent);
  }
  .m3-floor-merge-label {
    background: var(--m3-floor-merge);
    color: var(--m3-floor-merge-label);
  }
}
</style>
