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
  /** Seats taken (numbered from 1, clockwise from the top-left), drawn in the status color */
  activeSeats?: number[]
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
  /**
   * A zone of any shape (an L-shaped room): its corners. x / y / width / height are then the box around them, kept up
   * to date. Double-click a rectangular zone's edge to give it corners
   */
  points?: [number, number][]
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
  /** Mirrored across its length: a door hinged on the other side */
  flip?: boolean
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
  /**
   * `box` a rounded rectangle, `round` a circle, `bar` a thin slab, `door` an opening with its leaf and swing (as on an
   * architect's plan), `window` a framed pane, `text` the item's label only. A door or window cuts the wall it sits on
   */
  shape?: 'box' | 'round' | 'bar' | 'door' | 'window' | 'text'
  /** Fill: an M3 color role (`surface`, `primary`…) or any CSS color */
  color?: string
}
/** Real lengths for the plan: `per` plan units make one `unit` (100 and 'm': a plan unit is a centimeter) */
export interface FloorMeasure {
  unit: string
  per: number
  /** Decimals shown (default 2) */
  decimals?: number
}
/** What's picked on the plan besides tables: a zone, a wall (and one of its corners, as a zone of any shape) or a decor item */
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
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
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
  /**
   * Where a table's middle snaps: `point` a grid point (default), `cell` the middle of a grid square, so tables sit in
   * the squares between the points while walls, zones and decor snap to the points (a plan of cells)
   */
  tableSnap?: 'point' | 'cell'
  /**
   * Snapping steps per grid square for walls, zones and decor: 2 puts them on the points and halfway between them
   * (tables keep to the grid). Drawn as smaller dots
   */
  subgrid?: number
  /** Draw chairs from `seats` */
  chairs?: boolean
  /**
   * Real lengths: while editing, the picked wall's or zone's sides, the wall being drawn, and the picked table's or
   * decor's size are labeled in your unit (the inspector's sizes too)
   */
  measure?: FloorMeasure
  /** Number the chairs (1 from the top-left, clockwise); in service a click on one emits `seat-click` */
  seatNumbers?: boolean
  /** Decor kinds of yours, or the built-in ones restyled (merged over them by name) */
  decorKinds?: Record<string, FloorDecorKind>
  /** What the turning handle turns: everything (`true`), nothing, or only these kinds (`['decor']` when your app keeps no tables' angles) */
  rotatable?: boolean | ('table' | 'decor')[]
  /**
   * Tables placed by cell: their `x` / `y` are a column and a row (whole numbers from 0), each cell this many plan
   * units wide. A table's middle sits in the middle of its cell and steps a cell at a time, and every table you get
   * back (`update:tables`, `move`, events, slots) is in columns and rows. Zones, walls and decor stay in plan units
   */
  cellSize?: number
  /**
   * Zoom and pan: Ctrl + wheel or a pinch zooms (from the plan's own size up to `maxZoom`), the wheel, two fingers,
   * a middle-button drag or (outside editing, or with a finger) a drag on empty floor pans, with + / − / fit buttons
   */
  zoomable?: boolean
  maxZoom?: number
  /** The zoom buttons, when zoomable */
  zoomControls?: boolean
  /** An image under everything (a scanned floor plan to trace over), placed in plan units (default: the whole plan) */
  backgroundImage?: string
  backgroundBox?: { x: number; y: number; width: number; height: number }
  /** Its opacity */
  backgroundOpacity?: number
  /** Which point of a table `x` / `y` name: its middle (default) or its top-left corner (unturned), as your data keeps it */
  tableOrigin?: 'center' | 'corner'
  /**
   * Tables that overlap while editing: `warn` outlines them (default), `prevent` also undoes a move or a resize that
   * would make one overlap another, `allow` says nothing
   */
  overlap?: 'allow' | 'warn' | 'prevent'
  /**
   * How a resize handle steps (tables and decor): `grid` whole grid squares, `subgrid` the snapping step of walls
   * and zones (`subgrid`), `free` not at all. The change steps, not the size: a table drawn a little smaller than its
   * square keeps that margin and grows by whole squares
   */
  resizeSnap?: 'grid' | 'subgrid' | 'free'
  /** The handle that resizes the selected table (off when your tables keep one size) */
  resizable?: boolean
  /** Dragging (or nudging) a merged table moves its whole merge with it */
  dragMerged?: boolean
  /**
   * What a click on a table selects outside editing: nothing, one, or several (toggling; to merge them). While
   * editing, `multiple` keeps clicks toggling tables in and out of the selection, and a drag moves the table pressed
   * on its own (to bring the ones being merged together)
   */
  selectable?: 'none' | 'single' | 'multiple'
  /**
   * In service, a table carried onto another one emits `transfer` (to move its party, its bill): a mouse drags it, a
   * finger holds it down first. The table itself doesn't move
   */
  transferable?: boolean
  /** Whether a table's party may go to another table: `true`, or `false` / a reason (`transfer-refused` carries it) */
  canTransfer?: (from: FloorTable, to: FloorTable) => boolean | string
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
  tableSnap: 'point',
  subgrid: 1,
  chairs: true,
  selectable: 'none',
  dragMerged: false,
  rotatable: true,
  resizable: true,
  resizeSnap: 'free',
  overlap: 'warn',
  tableOrigin: 'center',
  zoomable: false,
  maxZoom: 4,
  zoomControls: true,
  backgroundOpacity: 0.5,
})
/** The tables as you keep them: plan units, or cells (`cellSize`), by their middle or corner (`tableOrigin`) */
const outerTables = defineModel<FloorTable[]>('tables', { default: () => [] })
// Inside, a table's x / y are always its middle in plan units; these convert at the edge
/**
 * With `cellSize`, how far a table's middle sits from its cell's top-left corner along one axis: the middle of the
 * cell for a table no bigger than it, else half its own size (a 2-cell table covers its cell and the next one)
 */
const cellReach = (size: number) => Math.max(size, props.cellSize!) / 2
function toInner(t: FloorTable): FloorTable {
  const c = props.cellSize
  if (c) {
    const s = sizeOf(t)
    return { ...t, x: t.x * c + cellReach(s.w), y: t.y * c + cellReach(s.h) }
  }
  if (props.tableOrigin !== 'corner') return t
  const s = sizeOf(t)
  return { ...t, x: t.x + s.w / 2, y: t.y + s.h / 2 }
}
function toOuterXY(t: FloorTable, x: number, y: number) {
  const c = props.cellSize
  if (c) {
    const s = sizeOf(t)
    const cell = (v: number, span: number, size: number) => Math.min(Math.max(Math.round((v - cellReach(span)) / c), 0), Math.max(0, Math.floor(size / c) - 1))
    return { x: cell(x, s.w, props.width), y: cell(y, s.h, props.height) }
  }
  if (props.tableOrigin !== 'corner') return { x, y }
  const s = sizeOf(t)
  return { x: x - s.w / 2, y: y - s.h / 2 }
}
const toOuter = (t: FloorTable): FloorTable => ({ ...t, ...toOuterXY(t, t.x, t.y) })
const passThrough = () => !props.cellSize && props.tableOrigin !== 'corner'
const tables = computed<FloorTable[]>({
  get: () => (passThrough() ? outerTables.value : outerTables.value.map(toInner)),
  set: (list) => (outerTables.value = passThrough() ? list : list.map(toOuter)),
})
/** A table as you keep it, by id (what events and slots hand back) */
const outerById = computed(() => new Map(outerTables.value.map((t) => [t.id, t])))
const outerOf = (t: FloorTable) => outerById.value.get(t.id) ?? toOuter(t)
const merges = defineModel<FloorMerge[]>('merges', { default: () => [] })
const selection = defineModel<(string | number)[]>('selection', { default: () => [] })
const areas = defineModel<FloorArea[]>('areas', { default: () => [] })
const walls = defineModel<FloorWall[]>('walls', { default: () => [] })
const decor = defineModel<FloorDecor[]>('decor', { default: () => [] })
/**
 * While editing: `select` moves things, `wall` draws a wall (click each corner, double-click or Enter to end), `area`
 * drags out a rectangular zone, `polygon` draws a zone of any shape corner by corner (click the first corner, double-click
 * or Enter to close it)
 */
const tool = defineModel<'select' | 'wall' | 'area' | 'polygon'>('tool', { default: 'select' })
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
  transfer: [from: FloorTable, to: FloorTable]
  'seat-click': [table: FloorTable, seat: number, event: MouseEvent]
  'transfer-refused': [from: FloorTable, to: FloorTable, reason: string]
  'table-click': [table: FloorTable, event: MouseEvent | KeyboardEvent]
  move: [moved: { id: string | number; x: number; y: number }[]]
}>()
const locale = useLocale()

const root = ref<HTMLElement>()
/** A finger: bigger handles */
const coarse = ref(typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches)
/** Px per plan unit at zoom 1: the plan fits the component's width */
const base = ref(1)
/** Zoom (1: the whole plan; up to `maxZoom`), with `zoomable` */
const zoom = defineModel<number>('zoom', { default: 1 })
/** Where the zoomed plan sits in the component, px (0 or less: the plan covers the view) */
const pan = ref({ x: 0, y: 0 })
const zoomed = computed(() => (props.zoomable ? Math.min(Math.max(zoom.value, 1), props.maxZoom) : 1))
/** Px per plan unit, zoom included: everything is drawn and measured with it */
const scale = computed(() => base.value * zoomed.value)
/**
 * True while the scale changes (zoom, the component resized) and a moment after: tables slide when they move, not
 * when the whole plan grows or shrinks around them (the transition is off in the same render as the new positions)
 */
const rescaling = ref(false)
let rescaleTimer = 0
watch(scale, () => {
  rescaling.value = true
  clearTimeout(rescaleTimer)
  rescaleTimer = window.setTimeout(() => (rescaling.value = false), 150)
}, { flush: 'sync' })
onBeforeUnmount(() => clearTimeout(rescaleTimer))
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => {
    base.value = (root.value?.clientWidth || props.width) / props.width
    pan.value = clampPan(pan.value)
  })
  ro.observe(root.value!)
  base.value = (root.value!.clientWidth || props.width) / props.width
  root.value!.addEventListener('wheel', onWheel, { passive: false })
  // Added by hand rather than in the template: a Vue listener on the way down would stamp the event, and Vue skips
  // handlers attached the same instant (the tables' own pointerdown, under a frozen test clock)
  root.value!.addEventListener('pointerdown', onFingerDown, { capture: true })
  root.value!.addEventListener('touchmove', onTouchMove, { passive: false })
})
onBeforeUnmount(() => {
  ro?.disconnect()
  root.value?.removeEventListener('wheel', onWheel)
  root.value?.removeEventListener('pointerdown', onFingerDown, { capture: true })
  root.value?.removeEventListener('touchmove', onTouchMove)
})

// ── Zoom and pan ────────────────────────────────────────────────────────────────────────────────────────
const viewSize = () => ({ w: props.width * base.value, h: props.height * base.value })
/** The pan kept so the zoomed plan always covers the view */
function clampPan(p: { x: number; y: number }, z = zoomed.value) {
  const { w, h } = viewSize()
  return { x: Math.min(0, Math.max(w - w * z, p.x)), y: Math.min(0, Math.max(h - h * z, p.y)) }
}
// The zoom the pan was last worked out for (a v-model change from outside zooms about the middle)
let panZoom = 1
/** Zooms to `z`, keeping the plan point under (px, py) (px in the component; default its middle) where it is */
function zoomTo(z: number, px?: number, py?: number) {
  if (!props.zoomable) return
  const next = Math.min(Math.max(z, 1), props.maxZoom)
  const { w, h } = viewSize()
  const ax = px ?? w / 2
  const ay = py ?? h / 2
  const ux = (ax - pan.value.x) / (base.value * panZoom)
  const uy = (ay - pan.value.y) / (base.value * panZoom)
  pan.value = clampPan({ x: ax - ux * base.value * next, y: ay - uy * base.value * next }, next)
  panZoom = next
  zoom.value = next
}
watch(zoomed, (z) => {
  if (z !== panZoom) zoomTo(z)
})
/** Centers the view on a plan point (in plan units), zooming to `z` if given */
function centerOn(x: number, y: number, z = zoomed.value) {
  zoomTo(z)
  const { w, h } = viewSize()
  pan.value = clampPan({ x: w / 2 - x * scale.value, y: h / 2 - y * scale.value })
}
function onWheel(e: WheelEvent) {
  if (!props.zoomable) return
  const r = root.value!.getBoundingClientRect()
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1
  if (e.ctrlKey || e.metaKey) {
    // Ctrl + wheel, and a trackpad's pinch (which comes as one)
    e.preventDefault()
    zoomTo(zoomed.value * Math.exp(-e.deltaY * unit * 0.002), e.clientX - r.left, e.clientY - r.top)
  } else if (zoomed.value > 1) {
    e.preventDefault()
    pan.value = clampPan({ x: pan.value.x - (e.shiftKey ? e.deltaY : e.deltaX) * unit, y: pan.value.y - (e.shiftKey ? 0 : e.deltaY) * unit })
  }
}
/** A drag that pans the view */
function startPan(e: PointerEvent) {
  e.preventDefault()
  const p0 = { ...pan.value }
  const mv = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId || gesture) return
    pan.value = clampPan({ x: p0.x + ev.clientX - e.clientX, y: p0.y + ev.clientY - e.clientY })
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    window.removeEventListener('pointermove', mv)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', mv)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
// Two fingers pinch and pan, whatever they land on; a drag they interrupt is dropped
const fingers = new Map<number, { x: number; y: number }>()
let gesture: { d: number; z: number; mid: { x: number; y: number }; u: { x: number; y: number } } | null = null
/** Bumped when two fingers take over, so a drag that started with one of them lets go without committing */
let gestureRun = 0
function onFingerDown(e: PointerEvent) {
  if (!props.zoomable || e.pointerType !== 'touch') return
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (fingers.size === 1) {
    window.addEventListener('pointermove', onFingerMove)
    window.addEventListener('pointerup', onFingerUp)
    window.addEventListener('pointercancel', onFingerUp)
  }
  if (fingers.size === 2) startGesture()
}
function startGesture() {
  const [a, b] = [...fingers.values()]
  const r = root.value!.getBoundingClientRect()
  const mid = { x: (a!.x + b!.x) / 2 - r.left, y: (a!.y + b!.y) / 2 - r.top }
  gesture = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, z: zoomed.value, mid, u: { x: (mid.x - pan.value.x) / scale.value, y: (mid.y - pan.value.y) / scale.value } }
  gestureRun++
  // Whatever one finger was dragging goes back
  draft.value = null
  areaDraft.value = null
  decorDraft.value = null
  wallDraft.value = null
  sizeDraft.value = null
  marquee.value = null
  transferDrag.value = null
}
function onFingerMove(e: PointerEvent) {
  if (!fingers.has(e.pointerId)) return
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (!gesture || fingers.size < 2) return
  const [a, b] = [...fingers.values()]
  const r = root.value!.getBoundingClientRect()
  const mid = { x: (a!.x + b!.x) / 2 - r.left, y: (a!.y + b!.y) / 2 - r.top }
  const z = Math.min(Math.max(gesture.z * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / gesture.d), 1), props.maxZoom)
  // The plan point first under the fingers' middle stays under it
  pan.value = clampPan({ x: mid.x - gesture.u.x * base.value * z, y: mid.y - gesture.u.y * base.value * z }, z)
  panZoom = z
  zoom.value = z
}
function onFingerUp(e: PointerEvent) {
  fingers.delete(e.pointerId)
  if (fingers.size < 2) gesture = null
  if (!fingers.size) {
    window.removeEventListener('pointermove', onFingerMove)
    window.removeEventListener('pointerup', onFingerUp)
    window.removeEventListener('pointercancel', onFingerUp)
  }
}
/** While two fingers zoom, or a table is carried to another one, the page doesn't scroll */
function onTouchMove(e: TouchEvent) {
  if (gesture || transferDrag.value || (props.zoomable && zoomed.value > 1 && e.touches.length > 1)) e.preventDefault()
}
const touchAction = computed(() => (!props.zoomable ? undefined : zoomed.value > 1 ? 'none' : 'pan-x pan-y'))
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onFingerMove)
  window.removeEventListener('pointerup', onFingerUp)
  window.removeEventListener('pointercancel', onFingerUp)
})

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
  const list = sides.flatMap((side, k) => Array.from({ length: per[k]! }, (_, i) => side.at((i + 1) / (per[k]! + 1))))
  // Numbered clockwise from the top-left corner, as people count round a table
  const start = Math.atan2(-s.h / 2, -s.w / 2)
  const turn = (c: { x: number; y: number }) => (Math.atan2(c.y, c.x) - start + Math.PI * 4) % (Math.PI * 2)
  return list.sort((a, b) => turn(a) - turn(b))
}

// While a drag moves tables, their positions live here until the drop
const draft = shallowRef<Map<string | number, { x: number; y: number }> | null>(null)
/** A table being resized by its handle: its size until the drop */
const sizeDraft = shallowRef<{ id: string | number; w: number; h: number } | null>(null)
const placed = computed(() =>
  tables.value.map((t) => {
    const at = draft.value?.get(t.id) ?? { x: t.x, y: t.y }
    const size = sizeDraft.value?.id === t.id ? { w: sizeDraft.value.w, h: sizeDraft.value.h } : sizeOf(t)
    return { t, x: at.x, y: at.y, size, chairs: chairsOf(t, size), status: t.status ? props.statuses[t.status] : undefined }
  }),
)
const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'success', 'surface'])
/** A taken chair: the table's status color, full strength (primary when it has none) */
function seatTaken(st?: FloorStatus) {
  const c = !st || st.color === 'surface' ? 'primary' : st.color
  return ROLES.has(c) ? { background: `var(--color-${c})`, color: `var(--color-on-${c})` } : { background: c, color: '#fff' }
}
function look(st?: FloorStatus) {
  if (!st || st.color === 'surface') return { background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface)' }
  if (ROLES.has(st.color)) return { background: `var(--color-${st.color}-container)`, color: `var(--color-on-${st.color}-container)` }
  return { background: st.color, color: '#fff' }
}
/**
 * How a merge is drawn: tables that sit together share one outline (a cluster); clusters apart from each other get
 * an outline each, joined by a dashed line, so a merge across the room doesn't swallow the tables in between
 */
const mergeShapes = computed(() =>
  merges.value.map((m) => {
    const ms = placed.value.filter((p) => m.tables.includes(p.t.id))
    if (!ms.length) return null
    const pad = CHAIR + 10
    const boxes = ms.map((p) => ({ x1: p.x - p.size.w / 2 - pad, y1: p.y - p.size.h / 2 - pad, x2: p.x + p.size.w / 2 + pad, y2: p.y + p.size.h / 2 + pad }))
    // Union-find over touching boxes
    const parent = boxes.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const b = boxes[j]!
        if (a.x1 <= b.x2 && b.x1 <= a.x2 && a.y1 <= b.y2 && b.y1 <= a.y2) parent[find(i)] = find(j)
      }
    const groups = new Map<number, typeof boxes>()
    boxes.forEach((b, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), b]))
    const clusters = [...groups.values()].map((bs) => {
      const x1 = Math.min(...bs.map((b) => b.x1))
      const y1 = Math.min(...bs.map((b) => b.y1))
      const x2 = Math.max(...bs.map((b) => b.x2))
      const y2 = Math.max(...bs.map((b) => b.y2))
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 }
    })
    // Each cluster linked to the nearest one already linked (a small spanning tree)
    const links: [number, number, number, number][] = []
    for (let i = 1; i < clusters.length; i++) {
      let best = 0
      for (let j = 1; j < i; j++) if (Math.hypot(clusters[j]!.cx - clusters[i]!.cx, clusters[j]!.cy - clusters[i]!.cy) < Math.hypot(clusters[best]!.cx - clusters[i]!.cx, clusters[best]!.cy - clusters[i]!.cy)) best = j
      links.push([clusters[best]!.cx, clusters[best]!.cy, clusters[i]!.cx, clusters[i]!.cy])
    }
    return { m, clusters, links }
  }).filter((b) => !!b),
)

// ── Dragging ────────────────────────────────────────────────────────────────────────────────────────────
let drag: { id: number; sx: number; sy: number; start: Map<string | number, { x: number; y: number }>; moved: boolean; pick?: string | number; run: number } | null = null
let suppressClick = false
/** The step walls, zones and decor snap to: the grid, or a part of it (`subgrid`) */
const step = computed(() => (props.grid ? props.grid / Math.max(1, Math.round(props.subgrid)) : 0))
const snap = (v: number) => (step.value ? Math.round(v / step.value) * step.value : v)
/** The step a table moves by: its cell, or the grid */
const tableStep = computed(() => props.cellSize || props.grid)
/** A table's middle: on a grid point, or with `tableSnap="cell"` (or `cellSize`) in the middle of a grid square */
const snapTable = (v: number) => {
  const g = tableStep.value
  if (!g) return v
  if (props.tableSnap !== 'cell' && !props.cellSize) return Math.round(v / g) * g
  return Math.round((v - g / 2) / g) * g + g / 2
}
/** The step a resize handle moves by (0: free) */
const resizeStep = computed(() => (props.resizeSnap === 'grid' ? props.grid || 0 : props.resizeSnap === 'subgrid' ? step.value : 0))
/** A size changed by `delta`, in whole steps of `unit` (0: as is), never below `min` */
function steppedSize(size: number, delta: number, unit: number, min: number) {
  if (!unit) return Math.max(min, size + delta)
  let n = Math.round(delta / unit)
  while (n < 0 && size + n * unit < min) n++
  return size + n * unit
}
/** Where a dropped table's middle lands: snapped as above, or with `cellSize` so it covers whole cells from its own */
function snapTableAt(t: FloorTable, x: number, y: number) {
  const c = props.cellSize
  if (!c) return { x: snapTable(x), y: snapTable(y) }
  const s = sizeOf(t)
  return { x: Math.round((x - cellReach(s.w)) / c) * c + cellReach(s.w), y: Math.round((y - cellReach(s.h)) / c) * c + cellReach(s.h) }
}
function clamp(t: FloorTable, x: number, y: number) {
  const s = sizeOf(t)
  return { x: Math.min(props.width - s.w / 2, Math.max(s.w / 2, x)), y: Math.min(props.height - s.h / 2, Math.max(s.h / 2, y)) }
}
// A finger has no Shift: holding a table down adds it to the selection (or takes it out)
const LONG_PRESS = 450
let longPress = 0
let longPressed = false
function onDown(e: PointerEvent, t: FloorTable) {
  if (!props.editable && props.transferable && e.button === 0) return startTransfer(e, t)
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
  } else if (!selection.value.includes(t.id) && !toggling.value) selection.value = e.shiftKey || e.ctrlKey || e.metaKey ? [...selection.value, t.id] : [t.id]
  // A touch picks the table once it moves (or on release), so a long press can add to what's picked. With
  // `selectable="multiple"` the selection is the click's to change, and a drag moves only the table pressed (not the
  // rest of the selection nor its merge): to bring the tables being merged together one by one
  const ids = toggling.value ? [t.id] : withMerged(selection.value.includes(t.id) ? selection.value : [t.id])
  drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start: new Map(tables.value.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }])), moved: false, pick: touch && !toggling.value && !selection.value.includes(t.id) ? t.id : undefined, run: gestureRun }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id || drag.run !== gestureRun) return
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
  const moved = drag.moved && d && e.type !== 'pointercancel' && drag.run === gestureRun
  drag = null
  draft.value = null
  if (!moved) return
  suppressClick = true
  setTimeout(() => (suppressClick = false))
  commitMoves(new Map([...d!].map(([id, p]) => {
    const t = tables.value.find((x) => x.id === id)!
    const at = snapTableAt(t, p.x, p.y)
    return [id, clamp(t, at.x, at.y)]
  })))
}
/** Two boxes overlap (touching edges don't) */
const crosses = (a: { x1: number; y1: number; x2: number; y2: number }, b: typeof a) => a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5 && a.y1 < b.y2 - 0.5 && b.y1 < a.y2 - 0.5
/** The tables that overlap another one (their turned boxes), while editing */
const overlapping = computed(() => {
  const out = new Set<string | number>()
  if (!props.editable || props.overlap === 'allow') return out
  const boxes = placed.value.map((p) => ({ id: p.t.id, b: boxOf(p) }))
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (crosses(boxes[i]!.b, boxes[j]!.b)) {
        out.add(boxes[i]!.id)
        out.add(boxes[j]!.id)
      }
  return out
})
/** With `overlap="prevent"`: whether tables moved or resized like this would overlap one another or the rest */
function wouldOverlap(changed: Map<string | number, { x?: number; y?: number; w?: number; h?: number }>) {
  if (props.overlap !== 'prevent') return false
  const boxes = tables.value.map((t) => {
    const c = changed.get(t.id)
    const s0 = sizeOf(t)
    const size = { w: c?.w ?? s0.w, h: c?.h ?? s0.h }
    return { id: t.id, b: boxOf({ t, x: c?.x ?? t.x, y: c?.y ?? t.y, size }) }
  })
  return boxes.some((a) => changed.has(a.id) && boxes.some((b) => b.id !== a.id && crosses(a.b, b.b)))
}
function commitMoves(next: Map<string | number, { x: number; y: number }>) {
  // Refused: the tables go back where they were
  if (wouldOverlap(next)) return navigator.vibrate?.(30)
  record()
  tables.value = tables.value.map((t) => (next.has(t.id) ? { ...t, ...next.get(t.id)! } : t))
  emit('move', [...next].map(([id, p]) => ({ id, ...toOuterXY(tables.value.find((t) => t.id === id)!, p.x, p.y) })))
}
/**
 * Resizing the selected table by its corner handle: the drag read along the table's own axes, growing it both ways so
 * its middle stays on its grid point or cell; a round table with Shift (or one that is a circle) stays a circle
 */
function onTableResize(e: PointerEvent, t: FloorTable) {
  if (!props.editable || e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const s0 = sizeOf(t)
  const rad = ((t.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const circle = (t.shape ?? 'square') === 'round' && s0.w === s0.h
  let shift = false
  const key = (ev: KeyboardEvent) => (shift = ev.shiftKey)
  window.addEventListener('keydown', key)
  window.addEventListener('keyup', key)
  // By cell, the table keeps its cell and grows right and down over the next ones; else about its middle
  const c = props.cellSize
  const corner = c ? { x: t.x - cellReach(s0.w), y: t.y - cellReach(s0.h) } : null
  const middleFor = (w: number, h: number) => (corner ? { x: corner.x + cellReach(w), y: corner.y + cellReach(h) } : { x: t.x, y: t.y })
  follow(e, (dx, dy) => {
    // Growing both ways (about its middle), each side moves a whole step: twice a step in all
    const k = corner ? 1 : 2
    const unit = resizeStep.value * k
    let w = steppedSize(s0.w, k * (dx * cos + dy * sin), unit, 20)
    let h = steppedSize(s0.h, k * (-dx * sin + dy * cos), unit, 20)
    if (circle !== shift) w = h = Math.max(w, h)
    sizeDraft.value = { id: t.id, w, h }
    if (corner) draft.value = new Map([[t.id, middleFor(w, h)]])
  }, () => {
    const d = sizeDraft.value!
    sizeDraft.value = null
    draft.value = null
    const at = middleFor(d.w, d.h)
    if (wouldOverlap(new Map([[t.id, { ...at, w: d.w, h: d.h }]]))) return
    record()
    tables.value = tables.value.map((x) => (x.id === t.id ? { ...x, ...at, width: Math.round(d.w), height: Math.round(d.h) } : x))
  })
  const off = () => {
    window.removeEventListener('keydown', key)
    window.removeEventListener('keyup', key)
    window.removeEventListener('pointerup', off)
  }
  window.addEventListener('pointerup', off)
}

// ── In service: carrying a table's party to another table ──
/** The table being carried: where the pointer is (plan units) and the table under it, if any */
const transferDrag = shallowRef<{ id: string | number; label: string; x: number; y: number; over: string | number | null; ok: boolean } | null>(null)
const tableAt = (x: number, y: number, skip: string | number) =>
  placed.value.find((p) => {
    if (p.t.id === skip) return false
    const b = boxOf(p)
    return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2
  })?.t
function transferCheck(from: FloorTable, to: FloorTable) {
  return props.canTransfer?.(outerOf(from), outerOf(to)) ?? true
}
function startTransfer(e: PointerEvent, t: FloorTable) {
  const touch = e.pointerType === 'touch'
  const sx = e.clientX
  const sy = e.clientY
  const run = gestureRun
  let active = false
  const at = (ev: PointerEvent) => {
    const p = toPlan(ev)
    const over = tableAt(p.x, p.y, t.id)
    transferDrag.value = { id: t.id, label: t.label, x: p.x, y: p.y, over: over?.id ?? null, ok: !over || transferCheck(t, over) === true }
  }
  const begin = (ev: PointerEvent) => {
    active = true
    document.body.style.userSelect = 'none'
    navigator.vibrate?.(10)
    at(ev)
  }
  // A finger holds the table down first, so a swipe still scrolls the page
  const timer = touch ? window.setTimeout(() => begin(e), LONG_PRESS) : 0
  const mv = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    if (run !== gestureRun) return end()
    if (!active) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < (touch ? 8 : 4)) return
      if (touch) return end()
      begin(ev)
    }
    at(ev)
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    const d = transferDrag.value
    const was = active
    end()
    if (!was || !d || ev.type === 'pointercancel') return
    suppressClick = true
    setTimeout(() => (suppressClick = false))
    const to = d.over !== null ? tables.value.find((x) => x.id === d.over) : undefined
    if (!to) return
    const ok = transferCheck(t, to)
    if (ok === true) emit('transfer', outerOf(t), outerOf(to))
    else emit('transfer-refused', outerOf(t), outerOf(to), typeof ok === 'string' ? ok : '')
  }
  function end() {
    clearTimeout(timer)
    if (active) document.body.style.userSelect = ''
    active = false
    transferDrag.value = null
    window.removeEventListener('pointermove', mv)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', mv)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
/** Editing with `selectable="multiple"`: a click toggles a table in the selection (to merge them), a drag moves that table alone */
const toggling = computed(() => props.editable && props.selectable === 'multiple')
function onClick(e: MouseEvent, t: FloorTable) {
  if (suppressClick) return
  if (toggling.value) selection.value = selection.value.includes(t.id) ? selection.value.filter((x) => x !== t.id) : [...selection.value, t.id]
  else if (props.editable && !(e.shiftKey || e.ctrlKey || e.metaKey)) selection.value = [t.id]
  else if (!props.editable && props.selectable === 'single') selection.value = selection.value.length === 1 && selection.value[0] === t.id ? [] : [t.id]
  else if (!props.editable && props.selectable === 'multiple')
    selection.value = selection.value.includes(t.id) ? selection.value.filter((x) => x !== t.id) : [...selection.value, t.id]
  emit('table-click', outerOf(t), e)
}
/** With `dragMerged`, the tables merged with these come along */
function withMerged(ids: (string | number)[]) {
  if (!props.dragMerged) return ids
  const all = new Set(ids)
  for (const id of ids) for (const m of merges.value) if (m.tables.includes(id)) m.tables.forEach((x) => all.add(x))
  return [...all]
}
function onKey(e: KeyboardEvent, t: FloorTable) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('table-click', outerOf(t), e)
    return
  }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
  if (!dir || !props.editable) return
  e.preventDefault()
  const step = (tableStep.value || 1) * (e.shiftKey ? 5 : 1)
  const ids = withMerged(selection.value.includes(t.id) ? selection.value : [t.id])
  commitMoves(new Map(tables.value.filter((x) => ids.includes(x.id)).map((x) => [x.id, clamp(x, x.x + dir[0]! * step, x.y + dir[1]! * step)])))
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
// ── Zones, walls and decor ───────────────────────────────────────────────────────────────────────────────
const BUILTIN_DECOR: Record<FloorDecorBuiltin, FloorDecorKind> = {
  door: { label: 'Door', icon: 'door_front', width: 60, height: 14, shape: 'door' },
  window: { label: 'Window', icon: 'window', width: 80, height: 10, shape: 'window' },
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
  // Doors and windows take the plan's own color, so the wall they sit on looks cut there
  if ((shape === 'door' || shape === 'window') && !k.color) return { backgroundColor: 'inherit' }
  const c = k.color ?? (shape === 'bar' ? 'surface-container-highest' : 'surface-container-high')
  const bg = c.startsWith('surface') || c.startsWith('var(') || c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl')
    ? (c.startsWith('surface') ? `var(--color-${c})` : c)
    : `var(--color-${c}-container)`
  return { background: bg, borderRadius: shape === 'round' ? '9999px' : shape === 'bar' || shape === 'door' || shape === 'window' ? '2px' : '8px' }
}
/** A door's swing: the quarter circle its leaf sweeps, from the open leaf down to the far jamb, in px */
const doorSwing = (w: number) => `M0 0 L0 ${-w} A${w} ${w} 0 0 1 ${w} 0 Z`
function areaLook(color?: string) {
  const c = color ?? 'secondary'
  return ROLES.has(c) ? { background: `color-mix(in srgb, var(--color-${c}-container) 45%, transparent)`, borderColor: `var(--color-${c})` } : { background: `color-mix(in srgb, ${c} 18%, transparent)`, borderColor: c }
}
// `picked` (a v-model) is declared with the other models
const isPicked = (kind: 'area' | 'wall' | 'decor', id: string | number) => picked.value?.kind === kind && picked.value.id === id
const toPlan = (e: { clientX: number; clientY: number }) => {
  const r = root.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left - pan.value.x) / scale.value, y: (e.clientY - r.top - pan.value.y) / scale.value }
}
/** A generic drag in plan units: `move` gets the offset from where it started, `end` runs once if it moved */
function follow(e: PointerEvent, move: (dx: number, dy: number) => void, end: () => void) {
  // Keys (Delete, Enter) reach the plan while something on it is being edited
  root.value?.focus({ preventScroll: true })
  const sx = e.clientX
  const sy = e.clientY
  let moved = false
  const run = gestureRun
  const mv = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId || run !== gestureRun) return
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return
    moved = true
    move((ev.clientX - sx) / scale.value, (ev.clientY - sy) / scale.value)
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    window.removeEventListener('pointermove', mv)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    if (moved && run === gestureRun && ev.type !== 'pointercancel') end()
  }
  window.addEventListener('pointermove', mv)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
const areaDraft = shallowRef<FloorArea | null>(null)
const shownAreas = computed(() => areas.value.map((a) => (areaDraft.value?.id === a.id ? areaDraft.value : a)).concat(areaDraft.value && !areas.value.some((a) => a.id === areaDraft.value!.id) ? [areaDraft.value] : []))
type Corner = 'nw' | 'ne' | 'sw' | 'se'
/** The box around a zone's corners */
function boxAround(pts: [number, number][]) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
/** A zone of any shape with its box brought up to date */
const shaped = (a: FloorArea, points: [number, number][]): FloorArea => ({ ...a, points, ...boxAround(points) })
const rectCorners = (a: FloorArea): [number, number][] => [[a.x, a.y], [a.x + a.width, a.y], [a.x + a.width, a.y + a.height], [a.x, a.y + a.height]]
const polyPath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x * scale.value} ${y * scale.value}`).join('') + 'Z'
function areaSvgLook(color?: string) {
  const c = color ?? 'secondary'
  return ROLES.has(c) ? { fill: `color-mix(in srgb, var(--color-${c}-container) 45%, transparent)`, stroke: `var(--color-${c})` } : { fill: `color-mix(in srgb, ${c} 18%, transparent)`, stroke: c }
}
/**
 * Where a corner being placed lands: on a wall's corner or a zone's (yours, not the one moving) within a few px, so
 * walls join end to end; else on the snapping step
 */
function snapPoint(x: number, y: number, skip?: { kind: 'wall' | 'area'; id: string | number; vertex?: number }): [number, number] {
  let best: [number, number] | null = null
  let bestD = 12 / scale.value
  const consider = (pts: [number, number][], kind: 'wall' | 'area', id: string | number | null) =>
    pts.forEach((p, i) => {
      if (skip && skip.kind === kind && skip.id === id && (skip.vertex === undefined || skip.vertex === i)) return
      const d = Math.hypot(p[0] - x, p[1] - y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    })
  for (const w of walls.value) consider(w.points, 'wall', w.id)
  for (const a of areas.value) consider(a.points ?? rectCorners(a), 'area', a.id)
  // The wall or zone being drawn closes on its own corners (but not the one just placed)
  if (drawing.value) consider(drawing.value.slice(0, -1), 'wall', null)
  return best ? [best[0], best[1]] : [snap(x), snap(y)]
}
/** The segment of a line (closed: a zone's outline) nearest a point: the index to insert a corner before */
function nearestSegment(pts: [number, number][], p: { x: number; y: number }, closed: boolean) {
  let best = 1
  let bestD = Infinity
  const n = closed ? pts.length + 1 : pts.length
  for (let i = 1; i < n; i++) {
    const [ax, ay] = pts[i - 1]!
    const [bx, by] = pts[i % pts.length]!
    const len = (bx - ax) ** 2 + (by - ay) ** 2
    const t = len ? Math.max(0, Math.min(1, ((p.x - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / len)) : 0
    const d = Math.hypot(ax + t * (bx - ax) - p.x, ay + t * (by - ay) - p.y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
/** Double-click on a zone: a new corner on its nearest edge (a rectangle becomes a zone of any shape) */
function onAreaDblclick(e: MouseEvent, a: FloorArea) {
  if (!props.editable || tool.value !== 'select') return
  e.stopPropagation()
  const p = toPlan(e)
  const pts = a.points ?? rectCorners(a)
  const at = nearestSegment(pts, p, true)
  record()
  areas.value = areas.value.map((x) => (x.id === a.id ? shaped(x, [...pts.slice(0, at), [snap(p.x), snap(p.y)], ...pts.slice(at)]) : x))
  picked.value = { kind: 'area', id: a.id, vertex: at }
}
/** Dragging a corner of a zone of any shape */
function onAreaVertexDown(e: PointerEvent, a: FloorArea, vertex: number) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0 || !a.points) return
  e.stopPropagation()
  picked.value = { kind: 'area', id: a.id, vertex }
  const p0 = a.points[vertex]!
  follow(e, (dx, dy) => {
    const at = snapPoint(p0[0] + dx, p0[1] + dy, { kind: 'area', id: a.id, vertex })
    areaDraft.value = shaped(a, a.points!.map((p, i) => (i === vertex ? at : p)))
  }, () => {
    const d = areaDraft.value!
    areaDraft.value = null
    record()
    areas.value = areas.value.map((x) => (x.id === a.id ? d : x))
  })
}
function onAreaDown(e: PointerEvent, a: FloorArea, corner: Corner | null) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'area', id: a.id }
  selection.value = []
  if (a.points) {
    follow(e, (dx, dy) => (areaDraft.value = shaped(a, a.points!.map(([x, y]) => [x + dx, y + dy]))), () => {
      const d = areaDraft.value!
      areaDraft.value = null
      // Moved by whole steps, so its corners stay where they snapped
      const ox = snap(d.points![0]![0]) - d.points![0]![0]
      const oy = snap(d.points![0]![1]) - d.points![0]![1]
      record()
      areas.value = areas.value.map((x) => (x.id === a.id ? shaped(d, d.points!.map(([px, py]) => [px + ox, py + oy])) : x))
    })
    return
  }
  follow(e, (dx, dy) => {
    if (!corner) {
      areaDraft.value = { ...a, x: a.x + dx, y: a.y + dy }
      return
    }
    // The opposite corner stays put
    const min = step.value || 20
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
  follow(e, (dx, dy) => (decorDraft.value = resize ? resizedDecor(d, s0, dx, dy) : { ...d, x: d.x + dx, y: d.y + dy }), () => {
    const n = decorDraft.value!
    decorDraft.value = null
    record()
    decor.value = decor.value.map((x) => (x.id === d.id ? (resize ? resizedDecor(d, s0, 0, 0, Math.round(n.width!), Math.round(n.height!)) : { ...n, x: snap(n.x), y: snap(n.y) }) : x))
  })
}
/**
 * Decor resized by its corner handle, dragged by (dx, dy) on the plan: the drag is read along the item's own axes
 * (it may be turned), its corner follows the pointer and the opposite corner stays where it was. Or straight to a
 * size `w` × `h`, from the same corner
 */
function resizedDecor(d: FloorDecor, s0: { w: number; h: number }, dx: number, dy: number, w?: number, h?: number): FloorDecor {
  const rad = ((d.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const width = w ?? steppedSize(s0.w, dx * cos + dy * sin, resizeStep.value, 10)
  const height = h ?? steppedSize(s0.h, -dx * sin + dy * cos, resizeStep.value, 6)
  // The middle moves half the growth, turned back onto the plan
  const gx = (width - s0.w) / 2
  const gy = (height - s0.h) / 2
  return { ...d, width, height, x: d.x + gx * cos - gy * sin, y: d.y + gx * sin + gy * cos }
}
/** The resize cursor that matches the corner handle's direction once the item is turned */
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']
const resizeCursor = (deg = 0) => RESIZE_CURSORS[Math.round((((45 + deg) % 180) + 180) % 180 / 45) % 4]
/** Arrows move the picked zone, decor or wall (or the wall's picked corner) by a snapping step; Shift by five */
function nudgePicked(dx: number, dy: number) {
  const pk = picked.value!
  if (pk.kind === 'area') {
    const a = areas.value.find((x) => x.id === pk.id)
    if (a?.points) update('area', a.id, { ...shaped(a, a.points.map(([x, y], i) => (pk.vertex === undefined || i === pk.vertex ? [x + dx, y + dy] : [x, y]))) })
    else if (a) update('area', a.id, { x: a.x + dx, y: a.y + dy })
  } else if (pk.kind === 'decor') {
    const d = decor.value.find((x) => x.id === pk.id)
    if (d) update('decor', d.id, { x: d.x + dx, y: d.y + dy })
  } else {
    const w = walls.value.find((x) => x.id === pk.id)
    if (w) update('wall', w.id, { points: w.points.map(([x, y], i) => (pk.vertex === undefined || i === pk.vertex ? [x + dx, y + dy] : [x, y])) })
  }
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
    // A corner lands on another wall's corner nearby (they join), or on the step
    wallDraft.value = vertex < 0
      ? { ...w, points: w.points.map(([x, y]) => [x + dx, y + dy]) }
      : { ...w, points: w.points.map((p, i) => (i === vertex ? snapPoint(p[0] + dx, p[1] + dy, { kind: 'wall', id: w.id, vertex }) : p)) }
  }, () => {
    const n = wallDraft.value!
    wallDraft.value = null
    record()
    // A moved corner already sits where it snapped (maybe on another wall's corner); a moved wall steps
    walls.value = walls.value.map((x) => (x.id === w.id ? (vertex >= 0 ? n : { ...n, points: n.points.map(([x, y]) => [snap(x), snap(y)] as [number, number]) }) : x))
  })
}
// Drawing new walls and zones
const drawing = ref<[number, number][] | null>(null)
const hover = ref<[number, number] | null>(null)
let made = 0
const newId = (p: string) => `${p}${Date.now().toString(36)}${made++}`
/** The rectangle being dragged out on empty floor to select the tables it touches, in plan units */
const marquee = shallowRef<{ x: number; y: number; w: number; h: number } | null>(null)
/** A table's box on the plan, turned (the box around it), in plan units */
function boxOf(p: { x: number; y: number; size: FloorBox; t: FloorTable }) {
  const rad = ((rotationOf('table', p.t.id, p.t.rotation) ?? 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const sn = Math.abs(Math.sin(rad))
  const hw = (p.size.w * c + p.size.h * sn) / 2
  const hh = (p.size.w * sn + p.size.h * c) / 2
  return { x1: p.x - hw, y1: p.y - hh, x2: p.x + hw, y2: p.y + hh }
}
/** Empty floor: the plan itself, its zones' and walls' layers, the background — not a table, zone, wall or decor */
const isFloor = (e: Event) => {
  const el = e.target as Element
  return el === e.currentTarget || el === viewEl.value || el === svgEl.value || el === zoneSvg.value || el.hasAttribute?.('data-floor-bg')
}
function onPlanPointer(e: PointerEvent) {
  const floor = isFloor(e)
  const onTable = !!(e.target as Element).closest?.('[data-floor-table]')
  // Panning: the middle button anywhere; on empty floor (or, outside editing, on a table) once zoomed in, outside
  // editing or with a finger
  if (props.zoomable && (e.button === 1 || (e.button === 0 && zoomed.value > 1 && (floor || (!props.editable && onTable && !props.transferable)) && (!props.editable || e.pointerType === 'touch')))) {
    startPan(e)
    return
  }
  if (!props.editable) return
  if (tool.value === 'select') {
    if (!floor) return
    const adding = e.shiftKey || e.ctrlKey || e.metaKey
    if (!adding) {
      selection.value = []
      picked.value = null
    }
    // A mouse or a pen drags out a rectangle (a finger scrolls, or holds a table down to add it)
    if (e.pointerType === 'touch' || e.button !== 0) return
    const p0 = toPlan(e)
    const before = adding ? selection.value : []
    follow(e, (dx, dy) => {
      const m = { x: Math.min(p0.x, p0.x + dx), y: Math.min(p0.y, p0.y + dy), w: Math.abs(dx), h: Math.abs(dy) }
      marquee.value = m
      const hit = placed.value.filter((p) => {
        const b = boxOf(p)
        return b.x1 < m.x + m.w && b.x2 > m.x && b.y1 < m.y + m.h && b.y2 > m.y
      }).map((p) => p.t.id)
      const next = [...new Set([...before, ...hit])]
      if (next.length !== selection.value.length || next.some((id, i) => id !== selection.value[i])) selection.value = next
    }, () => {
      marquee.value = null
      suppressClick = true
      setTimeout(() => (suppressClick = false))
    })
    return
  }
  const p = toPlan(e)
  if (tool.value === 'wall' || tool.value === 'polygon') {
    const at = snapPoint(p.x, p.y)
    const first = drawing.value?.[0]
    // A zone closes when its first corner is clicked again
    if (tool.value === 'polygon' && first && distinct(drawing.value!).length >= 3 && at[0] === first[0] && at[1] === first[1]) return finishWall()
    drawing.value = [...(drawing.value ?? [at]), at]
    return
  }
  const at: [number, number] = [snap(p.x), snap(p.y)]
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
    hover.value = snapPoint(p.x, p.y)
  }
}
/** Corners without one repeated right after itself (a double-click places the last one twice) */
const distinct = (pts: [number, number][]) => pts.filter((p, i, a) => !i || p[0] !== a[i - 1]![0] || p[1] !== a[i - 1]![1])
/** Ends what's being drawn: a wall (two corners or more) or, with the polygon tool, a zone (three or more) */
function finishWall() {
  let pts = drawing.value ? distinct(drawing.value) : null
  drawing.value = null
  hover.value = null
  if (!pts) return
  if (tool.value === 'polygon') {
    // Closing on the first corner doesn't repeat it
    const [f, l] = [pts[0]!, pts[pts.length - 1]!]
    if (pts.length > 1 && f[0] === l[0] && f[1] === l[1]) pts = pts.slice(0, -1)
    if (pts.length < 3) return
    const id = newId('area')
    record()
    areas.value = [...areas.value, shaped({ id, x: 0, y: 0, width: 0, height: 0 }, pts)]
    picked.value = { kind: 'area', id }
    return
  }
  if (pts.length > 1) {
    record()
    walls.value = [...walls.value, { id: newId('wall'), points: pts }]
  }
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
  const dir = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key]
  if (dir && picked.value && tool.value === 'select') {
    e.preventDefault()
    const by = (step.value || 1) * (e.shiftKey ? 5 : 1)
    nudgePicked(dir[0]! * by, dir[1]! * by)
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
  if (kind === 'area') {
    const a = areas.value.find((x) => x.id === id)
    // A picked corner of a zone of any shape goes (it keeps at least three)
    if (a?.points && vertex !== undefined && a.points.length > 3) {
      areas.value = areas.value.map((x) => (x.id === id ? shaped(x, x.points!.filter((_, i) => i !== vertex)) : x))
      picked.value = { kind: 'area', id }
      return
    }
    areas.value = areas.value.filter((x) => x.id !== id)
  }
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
const zoneSvg = ref<SVGSVGElement>()
const viewEl = ref<HTMLElement>()
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
    const toff = props.cellSize || off
    // Past it, or back the other way when it would leave the plan
    const by = (v: number, half: number, max: number) => (v + toff + half <= max ? v + toff : v - toff)
    const copies = tables.value.filter((t) => selection.value.includes(t.id)).map((t) => {
      const sz = sizeOf(t)
      return { ...t, id: newId('table'), ...clamp(t, by(t.x, sz.w / 2, props.width), by(t.y, sz.h / 2, props.height)), status: undefined, badge: undefined }
    })
    record()
    tables.value = [...tables.value, ...copies]
    selection.value = copies.map((t) => t.id)
    return
  }
  const pk = picked.value
  if (pk?.kind === 'area') {
    const a = areas.value.find((x) => x.id === pk.id)
    if (!a) return
    // Inside the plan: back up and to the left when there's no room past it
    const dx = a.x + a.width + off <= props.width ? off : Math.max(-a.x, -off)
    const dy = a.y + a.height + off <= props.height ? off : Math.max(-a.y, -off)
    const c: FloorArea = a.points ? shaped({ ...a, id: newId('area') }, a.points.map(([x, y]) => [x + dx, y + dy])) : { ...a, id: newId('area'), x: a.x + dx, y: a.y + dy }
    record()
    areas.value = [...areas.value, c]
    picked.value = { kind: 'area', id: c.id }
  } else if (pk?.kind === 'decor') {
    const d = decor.value.find((x) => x.id === pk.id)
    if (!d) return
    const s = decorSize(d)
    const inside = (v: number, half: number, max: number) => (v + off + half <= max ? v + off : Math.max(half, v - off))
    const c = { ...d, id: newId('decor'), x: inside(d.x, s.w / 2, props.width), y: inside(d.y, s.h / 2, props.height) }
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
  const angle = (ev: PointerEvent) => (Math.atan2(ev.clientY - (r.top + pan.value.y + cy * scale.value), ev.clientX - (r.left + pan.value.x + cx * scale.value)) * 180) / Math.PI + 90
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
const canRotate = (kind: 'table' | 'decor') => props.rotatable === true || (Array.isArray(props.rotatable) && props.rotatable.includes(kind))
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
  // A table's patch is in your units (cells, a corner): applied to your list as it is
  if (kind === 'table') outerTables.value = apply(outerTables.value)
  else if (kind === 'area') areas.value = apply(areas.value)
  else if (kind === 'wall') walls.value = apply(walls.value)
  else decor.value = apply(decor.value)
}
function addTable(t: Partial<FloorTable> = {}): FloorTable {
  const n = Math.max(0, ...tables.value.map((x) => Number(x.label)).filter((x) => Number.isFinite(x))) + 1
  const draft: FloorTable = { id: newId('table'), label: String(n), x: 0, y: 0, shape: 'square', seats: 4, ...t }
  // A position given is in your units; otherwise the plan's middle
  const at = toInner(draft)
  const table: FloorTable = { ...draft, x: t.x !== undefined ? at.x : snapTable(props.width / 2), y: t.y !== undefined ? at.y : snapTable(props.height / 2) }
  record()
  tables.value = [...tables.value, table]
  selection.value = [table.id]
  picked.value = null
  return outerOf(table)
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
  // In your units, as you keep them
  tables: outerTables,
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
  tableSize: (t: FloorTable) => sizeOf(t),
  measure: computed(() => props.measure),
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
  /** Zoom (with `zoomable`): to a level, keeping the plan point under (px, py) in place; and centering on a plan point */
  zoomTo,
  centerOn,
  /** The plan as a standalone SVG string, or a PNG Blob (`pixelRatio` px per plan unit) */
  toSVG,
  toPNG,
})
/** Double-click on a wall: a new corner there, on the nearest segment */
function onWallDblclick(e: MouseEvent, w: FloorWall) {
  if (!props.editable || tool.value !== 'select') return
  e.stopPropagation()
  const p = toPlan(e)
  const best = nearestSegment(w.points, p, false)
  const pt: [number, number] = [snap(p.x), snap(p.y)]
  record()
  walls.value = walls.value.map((x) => (x.id === w.id ? { ...x, points: [...x.points.slice(0, best), pt, ...x.points.slice(best)] } : x))
  picked.value = { kind: 'wall', id: w.id, vertex: best }
}

// ── Export: the plan as a picture ──
const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/**
 * The plan as a standalone SVG (plan units, its own colors resolved from the theme): zones, walls, decor, merges,
 * tables with their chairs and labels, and the background image if any. Icons are left out (they're a font)
 */
function toSVG(): string {
  const cs = getComputedStyle(root.value!)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  // Theme variables to the colors they hold, so the file looks the same anywhere
  const resolve = (c: string) => c.replace(/var\((--[\w-]+)\)/g, (_, n: string) => v(n) || 'currentColor')
  const role = (c: string, suffix = '') => (ROLES.has(c) ? v(`--color-${c}${suffix}`) : resolve(c))
  const font = cs.fontFamily.replace(/"/g, "'")
  const out: string[] = []
  const W = props.width
  const H = props.height
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${esc(font)}">`)
  out.push(`<rect width="${W}" height="${H}" fill="${esc(cs.backgroundColor)}"/>`)
  if (props.backgroundImage) {
    const b = props.backgroundBox ?? { x: 0, y: 0, width: W, height: H }
    out.push(`<image href="${esc(props.backgroundImage)}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" opacity="${props.backgroundOpacity}" preserveAspectRatio="none"/>`)
  }
  const labelColor = v('--color-on-surface-variant')
  for (const a of areas.value) {
    const c = a.color ?? 'secondary'
    const fill = ROLES.has(c) ? role(c, '-container') : resolve(c)
    const paint = `fill="${esc(fill)}" fill-opacity="${ROLES.has(c) ? 0.45 : 0.18}" stroke="${esc(role(c))}"`
    if (a.points) out.push(`<polygon points="${a.points.map((p) => p.join(',')).join(' ')}" ${paint}/>`)
    else out.push(`<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" rx="8" ${paint}/>`)
    const at = a.points?.[0] ?? [a.x, a.y]
    if (a.label) out.push(`<text x="${at[0] + 8}" y="${at[1] + 18}" font-size="12" fill="${esc(labelColor)}">${esc(a.label)}</text>`)
  }
  const wall = v('--m3-floor-wall')
  for (const w of walls.value) out.push(`<polyline points="${w.points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${esc(wall)}" stroke-width="${w.thickness ?? 8}" stroke-linecap="round" stroke-linejoin="round"/>`)
  const planBg = cs.backgroundColor
  for (const d of decor.value) {
    const k = kindOf(d)
    const { w, h } = decorSize(d)
    const shape = k.shape ?? 'box'
    out.push(`<g transform="translate(${d.x} ${d.y}) rotate(${d.rotation ?? 0})${d.flip ? ' scale(-1 1)' : ''}">`)
    if (shape === 'text') out.push(`<text text-anchor="middle" dominant-baseline="central" font-size="16" fill="${esc(labelColor)}">${esc(d.label)}</text>`)
    else if (shape === 'door') {
      out.push(`<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${esc(k.color ? resolve(k.color) : planBg)}"/>`)
      out.push(`<path d="M${-w / 2} ${-h / 2} L${-w / 2} ${-h / 2 - w} A${w} ${w} 0 0 1 ${w / 2} ${-h / 2} Z" fill="${esc(wall)}" fill-opacity="0.06" stroke="${esc(wall)}" stroke-opacity="0.55" stroke-dasharray="3 3"/>`)
      out.push(`<line x1="${-w / 2}" y1="${-h / 2}" x2="${-w / 2}" y2="${-h / 2 - w}" stroke="${esc(wall)}" stroke-width="2"/>`)
      out.push(`<rect x="${-w / 2}" y="${-h / 2}" width="3" height="${h}" fill="${esc(wall)}"/><rect x="${w / 2 - 3}" y="${-h / 2}" width="3" height="${h}" fill="${esc(wall)}"/>`)
    } else if (shape === 'window') {
      out.push(`<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${esc(k.color ? resolve(k.color) : planBg)}" stroke="${esc(wall)}" stroke-width="1.5"/>`)
      out.push(`<line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="${esc(v('--m3-floor-window') || v('--color-primary'))}" stroke-width="1.5"/>`)
    } else {
      const look = decorLook(k) as { background?: string }
      out.push(`<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${shape === 'round' ? Math.min(w, h) / 2 : shape === 'bar' ? 2 : 8}" fill="${esc(resolve(look.background ?? 'transparent'))}"/>`)
      if (d.label) out.push(`<text y="${h / 2 + 12}" text-anchor="middle" font-size="11" fill="${esc(labelColor)}">${esc(d.label)}</text>`)
    }
    out.push('</g>')
  }
  const merge = v('--m3-floor-merge')
  for (const ms of mergeShapes.value) {
    for (const b of ms!.clusters) out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="16" fill="none" stroke="${esc(merge)}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 5"/>`)
    for (const l of ms!.links) out.push(`<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="${esc(merge)}" stroke-opacity="0.6" stroke-width="2" stroke-dasharray="6 5"/>`)
  }
  const chair = v('--m3-floor-chair')
  for (const p of placed.value) {
    const r = p.t.rotation ?? 0
    const lk = look(p.status)
    out.push(`<g transform="translate(${p.x} ${p.y}) rotate(${r})">`)
    p.chairs.forEach((ch, i) => {
      const taken = p.t.activeSeats?.includes(i + 1) ? (seatTaken(p.status) as { background: string }).background : chair
      out.push(`<rect x="${-CHAIR / 2}" y="${(-CHAIR * 0.75) / 2}" width="${CHAIR}" height="${CHAIR * 0.75}" rx="4" fill="${esc(resolve(taken))}" transform="translate(${ch.x} ${ch.y}) rotate(${ch.r})"/>`)
    })
    const { w, h } = p.size
    if ((p.t.shape ?? 'square') === 'round') out.push(`<ellipse rx="${w / 2}" ry="${h / 2}" fill="${esc(resolve(lk.background))}"/>`)
    else out.push(`<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="8" fill="${esc(resolve(lk.background))}"/>`)
    out.push(`<text transform="rotate(${-r})" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="500" fill="${esc(resolve(lk.color))}">${esc(p.t.label)}</text>`)
    out.push('</g>')
  }
  out.push('</svg>')
  return out.join('')
}
/**
 * The plan as a PNG, `pixelRatio` px per plan unit. A background image from another origin without CORS taints the
 * canvas, and then this rejects
 */
async function toPNG(pixelRatio = 2): Promise<Blob> {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSVG())}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(props.width * pixelRatio)
  canvas.height = Math.round(props.height * pixelRatio)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toPNG: the canvas gave no image'))), 'image/png'))
}

// ── Measurements: lengths in your unit while editing ──
const measured = (v: number) => {
  const m = props.measure!
  return `${(v / m.per).toFixed(m.decimals ?? 2)} ${m.unit}`
}
const measureLabels = computed(() => {
  const out: { x: number; y: number; text: string }[] = []
  if (!props.measure || !props.editable) return out
  const sides = (pts: [number, number][], closed: boolean) => {
    const n = closed ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pts[i]!
      const [bx, by] = pts[(i + 1) % pts.length]!
      const len = Math.hypot(bx - ax, by - ay)
      if (len > 0) out.push({ x: (ax + bx) / 2, y: (ay + by) / 2, text: measured(len) })
    }
  }
  const pk = picked.value
  if (pk?.kind === 'wall') {
    const w = shownWalls.value.find((x) => x.id === pk.id)
    if (w) sides(w.points, false)
  } else if (pk?.kind === 'area') {
    const a = shownAreas.value.find((x) => x.id === pk.id)
    if (a) sides(a.points ?? rectCorners(a), true)
  } else if (pk?.kind === 'decor') {
    const d = shownDecor.value.find((x) => x.id === pk.id)
    if (d) {
      const sz = decorSize(d)
      out.push({ x: d.x, y: d.y + Math.max(sz.w, sz.h) / 2 + 14 / scale.value, text: `${measured(sz.w)} × ${measured(sz.h)}` })
    }
  } else if (selection.value.length === 1) {
    const p = placed.value.find((x) => x.t.id === selection.value[0])
    if (p) out.push({ x: p.x, y: boxOf(p).y2 + (props.chairs && p.t.seats ? CHAIR + 12 : 12) / scale.value, text: `${measured(p.size.w)} × ${measured(p.size.h)}` })
  }
  if (drawing.value && hover.value) {
    const last = drawing.value[drawing.value.length - 1]!
    sides([last, hover.value], false)
  }
  return out
})
const ariaOf = (p: (typeof placed.value)[number]) =>
  [p.t.label, p.status?.label, p.t.seats ? locale.floorSeats.replace('{n}', String(p.t.seats)) : '', p.t.badge !== undefined ? String(p.t.badge) : '', overlapping.value.has(p.t.id) ? locale.floorOverlaps : ''].filter(Boolean).join(', ')
// A radial gradient draws its dot in the middle of each tile: moved back half a tile so the dots sit on the points
const gridStyle = computed(() => {
  if (!props.editable || !props.showGrid || !props.grid) return {}
  const g = (props.grid >= 10 ? props.grid : props.grid * Math.ceil(10 / Math.max(1, props.grid))) * scale.value
  const dot = 'radial-gradient(circle, var(--color-outline-variant) 1px, transparent 1.2px)'
  const sub = Math.max(1, Math.round(props.subgrid))
  const fine = g / sub
  if (sub === 1 || props.grid < 10 || fine < 6) return { backgroundImage: dot, backgroundSize: `${g}px ${g}px`, backgroundPosition: `${-g / 2}px ${-g / 2}px` }
  return {
    backgroundImage: `${dot}, radial-gradient(circle, color-mix(in srgb, var(--color-outline-variant) 70%, transparent) 0.6px, transparent 0.9px)`,
    backgroundSize: `${g}px ${g}px, ${fine}px ${fine}px`,
    backgroundPosition: `${-g / 2}px ${-g / 2}px, ${-fine / 2}px ${-fine / 2}px`,
  }
})
</script>

<template>
  <div
    ref="root"
    class="m3-floor-plan select-none"
    :style="{ aspectRatio: `${width} / ${height}`, touchAction }"
    role="group"
    tabindex="-1"
    :aria-label="label ?? locale.floorPlan"
    :class="editable && tool !== 'select' && 'cursor-crosshair'"
    @pointerdown="onPlanPointer"
    @pointermove="onPlanMove"
    @dblclick="drawing && finishWall()"
    @keydown="onPlanKey"
  >
    <!-- Everything on the plan, as big as the zoom makes it, moved by the pan -->
    <div
      ref="viewEl"
      class="m3-floor-view absolute top-0 left-0"
      :style="{ width: `${width * scale}px`, height: `${height * scale}px`, transform: pan.x || pan.y ? `translate(${pan.x}px, ${pan.y}px)` : undefined, ...gridStyle }"
    >
    <img
      v-if="backgroundImage"
      :src="backgroundImage"
      alt=""
      draggable="false"
      data-floor-bg
      class="absolute max-w-none select-none"
      :style="{
        left: `${(backgroundBox?.x ?? 0) * scale}px`,
        top: `${(backgroundBox?.y ?? 0) * scale}px`,
        width: `${(backgroundBox?.width ?? width) * scale}px`,
        height: `${(backgroundBox?.height ?? height) * scale}px`,
        opacity: backgroundOpacity,
      }"
    />
    <!-- Zones -->
    <div
      v-for="a in shownAreas.filter((x) => !x.points)"
      :key="`a${a.id}`"
      class="absolute rounded-lg border"
      :class="[editable && tool === 'select' ? 'cursor-move touch-none' : 'pointer-events-none', isPicked('area', a.id) && 'ring-2 ring-primary']"
      :style="{ left: `${a.x * scale}px`, top: `${a.y * scale}px`, width: `${a.width * scale}px`, height: `${a.height * scale}px`, ...areaLook(a.color) }"
      @pointerdown="onAreaDown($event, a, null)"
      @dblclick="onAreaDblclick($event, a)"
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

    <!-- Zones of any shape: their outline, then their label (or your #area) in the box around them -->
    <svg ref="zoneSvg" class="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g v-for="a in shownAreas.filter((x) => x.points)" :key="`ap${a.id}`">
        <path
          :d="polyPath(a.points!)"
          stroke-width="1"
          stroke-linejoin="round"
          :style="areaSvgLook(a.color)"
          :class="[editable && tool === 'select' && 'pointer-events-auto cursor-move touch-none', isPicked('area', a.id) && 'm3-floor-zone-picked']"
          :data-zone="a.id"
          @pointerdown="onAreaDown($event, a, null)"
          @dblclick="onAreaDblclick($event, a)"
        />
        <template v-if="editable && isPicked('area', a.id)">
          <circle
            v-for="(pt, i) in a.points"
            :key="i"
            :cx="pt[0] * scale"
            :cy="pt[1] * scale"
            :r="(picked?.vertex === i ? 7 : 5) * (coarse ? 1.6 : 1)"
            class="pointer-events-auto cursor-move touch-none stroke-primary"
            :class="picked?.vertex === i ? 'fill-primary' : 'fill-surface'"
            stroke-width="2"
            :data-zone-corner="i"
            @pointerdown="onAreaVertexDown($event, a, i)"
          />
        </template>
      </g>
    </svg>
    <div
      v-for="a in shownAreas.filter((x) => x.points)"
      :key="`al${a.id}`"
      class="pointer-events-none absolute"
      :style="{ left: `${a.x * scale}px`, top: `${a.y * scale}px`, width: `${a.width * scale}px`, height: `${a.height * scale}px` }"
    >
      <slot name="area" :area="a" :picked="isPicked('area', a.id)" :scale="scale">
        <span
          v-if="a.label"
          class="absolute text-label-medium whitespace-nowrap text-on-surface-variant"
          :style="{ left: `${(a.points![0]![0] - a.x) * scale + 8}px`, top: `${(a.points![0]![1] - a.y) * scale + 4}px` }"
        >{{ a.label }}</span>
      </slot>
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
        v-if="drawing && tool === 'polygon'"
        :d="polyPath(hover ? [...drawing, hover] : drawing)"
        class="m3-floor-zone-draft stroke-primary"
        stroke-dasharray="6 4"
        stroke-width="2"
      />
      <path
        v-else-if="drawing"
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
        <!-- A door: the jambs, the leaf standing open and its swing, as an architect draws it -->
        <svg
          v-if="kindOf(d).shape === 'door'"
          class="pointer-events-none absolute inset-0 size-full overflow-visible"
          :style="d.flip ? { transform: 'scaleX(-1)' } : undefined"
          aria-hidden="true"
        >
          <path :d="doorSwing(decorSize(d).w * scale)" class="m3-floor-door-swing" stroke-width="1" stroke-dasharray="3 3" />
          <line x1="0" y1="0" x2="0" :y2="-decorSize(d).w * scale" class="m3-floor-door" stroke-width="2" stroke-linecap="round" />
          <rect x="0" y="0" :width="Math.max(2, 3 * scale)" height="100%" class="m3-floor-door-jamb" />
          <rect :x="decorSize(d).w * scale - Math.max(2, 3 * scale)" y="0" :width="Math.max(2, 3 * scale)" height="100%" class="m3-floor-door-jamb" />
        </svg>
        <!-- A window: its frame and the pane down the middle -->
        <svg v-else-if="kindOf(d).shape === 'window'" class="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <rect x="0.75" y="0.75" :width="Math.max(0, decorSize(d).w * scale - 1.5)" :height="Math.max(0, decorSize(d).h * scale - 1.5)" class="m3-floor-window" stroke-width="1.5" fill="none" />
          <line x1="0" :y1="(decorSize(d).h * scale) / 2" :x2="decorSize(d).w * scale" :y2="(decorSize(d).h * scale) / 2" class="m3-floor-window-pane" stroke-width="1.5" />
        </svg>
        <MIcon v-else-if="kindOf(d).icon && kindOf(d).shape !== 'bar'" :name="kindOf(d).icon!" :size="Math.max(12, Math.min(decorSize(d).w, decorSize(d).h) * 0.6 * scale)" />
        <span v-if="kindOf(d).shape === 'text'" class="truncate text-title-small text-on-surface-variant" :style="{ fontSize: `${Math.max(10, 16 * scale)}px` }">{{ d.label }}</span>
      </slot>
      <span
        v-if="editable && isPicked('decor', d.id)"
        class="m3-floor-handle absolute -right-1.5 -bottom-1.5 size-3 rounded-xs border-2 border-primary bg-surface"
        :style="{ cursor: resizeCursor(rotationOf('decor', d.id, d.rotation)) }"
        data-resize
        @pointerdown="onDecorDown($event, d, true)"
      />
      <span
        v-if="editable && canRotate('decor') && isPicked('decor', d.id)"
        class="m3-floor-handle absolute -top-6 left-1/2 size-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-surface"
        :aria-label="locale.floorRotate"
        data-rotate
        @pointerdown="onRotateDown($event, 'decor', d.id, d.x, d.y)"
      />
    </div>

    <!-- Merged tables: one outline around the group -->
    <svg v-if="mergeShapes.some((ms) => ms!.links.length)" class="pointer-events-none absolute inset-0 size-full overflow-visible">
      <template v-for="ms in mergeShapes" :key="`ml${ms!.m.id}`">
        <line
          v-for="(l, i) in ms!.links"
          :key="i"
          class="m3-floor-merge-link"
          :x1="l[0] * scale"
          :y1="l[1] * scale"
          :x2="l[2] * scale"
          :y2="l[3] * scale"
          stroke-width="2"
          stroke-dasharray="6 5"
          stroke-linecap="round"
        />
      </template>
    </svg>
    <template v-for="ms in mergeShapes" :key="`m${ms!.m.id}`">
      <div
        v-for="(b, i) in ms!.clusters"
        :key="i"
        class="m3-floor-merge pointer-events-none absolute rounded-2xl border-2 border-dashed"
        :style="{ left: `${b.x * scale}px`, top: `${b.y * scale}px`, width: `${b.w * scale}px`, height: `${b.h * scale}px` }"
      >
        <slot v-if="i === 0" name="merge" :merge="ms!.m" :tables="ms!.m.tables">
          <span v-if="ms!.m.label" class="m3-floor-merge-label absolute -top-2.5 left-3 rounded-full px-2 text-label-small whitespace-nowrap">{{ ms!.m.label }}</span>
        </slot>
      </div>
    </template>

    <div
      v-for="p in placed"
      :key="p.t.id"
      class="absolute"
      :class="!draft?.has(p.t.id) && !rescaling && 'transition-[left,top] duration-200 ease-out'"
      :style="{ left: `${p.x * scale}px`, top: `${p.y * scale}px`, transform: `rotate(${rotationOf('table', p.t.id, p.t.rotation)}deg)` }"
    >
      <!-- Rotation handle of the one table picked while editing -->
      <span
        v-if="editable && canRotate('table') && selection.length === 1 && selection[0] === p.t.id && tool === 'select'"
        class="m3-floor-handle absolute z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-primary bg-surface"
        :style="{ left: '0px', top: `${-(p.size.h / 2 + CHAIR + 18) * scale}px` }"
        :aria-label="locale.floorRotate"
        data-rotate
        @pointerdown="onRotateDown($event, 'table', p.t.id, p.x, p.y)"
      />
      <!-- Size handle of the one table picked while editing (at its corner, turning with it) -->
      <span
        v-if="editable && resizable && selection.length === 1 && selection[0] === p.t.id && tool === 'select'"
        class="m3-floor-handle absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-xs border-2 border-primary bg-surface"
        :style="{ left: `${(p.size.w / 2) * scale}px`, top: `${(p.size.h / 2) * scale}px`, cursor: resizeCursor(rotationOf('table', p.t.id, p.t.rotation)) }"
        data-table-resize
        @pointerdown="onTableResize($event, p.t)"
      />
      <span
        v-for="(ch, i) in p.chairs"
        :key="i"
        class="m3-floor-chair absolute flex items-center justify-center rounded-md"
        :class="[seatNumbers && !editable ? 'cursor-pointer' : 'pointer-events-none', p.t.activeSeats?.includes(i + 1) && 'm3-floor-chair-taken']"
        :style="{
          width: `${CHAIR * scale}px`,
          height: `${CHAIR * 0.75 * scale}px`,
          left: `${ch.x * scale}px`,
          top: `${ch.y * scale}px`,
          transform: `translate(-50%, -50%) rotate(${ch.r}deg)`,
          ...(p.t.activeSeats?.includes(i + 1) && seatTaken(p.status)),
        }"
        :data-seat="i + 1"
        :aria-label="seatNumbers ? locale.floorSeatN.replace('{n}', String(i + 1)) : undefined"
        @click="seatNumbers && !editable && emit('seat-click', outerOf(p.t), i + 1, $event)"
      >
        <span
          v-if="seatNumbers && scale * CHAIR >= 10"
          class="pointer-events-none leading-none font-medium"
          :style="{ fontSize: `${Math.max(7, 9 * scale)}px`, transform: `rotate(${-ch.r - rotationOf('table', p.t.id, p.t.rotation)}deg)` }"
        >{{ i + 1 }}</span>
      </span>
      <div
        role="button"
        tabindex="0"
        data-floor-table
        class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 text-center shadow-elevation-1 outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-secondary"
        :class="[
          (p.t.shape ?? 'square') === 'round' ? 'rounded-full' : 'rounded-lg',
          editable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer hover:shadow-elevation-2',
          selection.includes(p.t.id) && 'ring-2 ring-primary',
          draft?.has(p.t.id) && 'shadow-elevation-3',
          transferDrag?.id === p.t.id && 'opacity-50',
          overlapping.has(p.t.id) && 'm3-floor-overlap',
          transferDrag?.over === p.t.id && (transferDrag.ok ? 'ring-4 ring-primary' : 'ring-4 ring-error'),
        ]"
        :style="{ width: `${p.size.w * scale}px`, height: `${p.size.h * scale}px`, ...look(p.status), fontSize: `${Math.max(9, 14 * scale)}px` }"
        :aria-label="ariaOf(p)"
        :aria-pressed="editable ? selection.includes(p.t.id) : undefined"
        @pointerdown="onDown($event, p.t)"
        @contextmenu="transferable && !editable && $event.preventDefault()"
        @click="onClick($event, p.t)"
        @keydown="onKey($event, p.t)"
      >
        <!-- The inside stays upright however the table turns -->
        <span class="flex flex-col items-center justify-center gap-0.5" :style="{ transform: `rotate(${-rotationOf('table', p.t.id, p.t.rotation)}deg)` }">
          <slot name="table" :table="outerOf(p.t)" :status="p.status" :selected="selection.includes(p.t.id)">
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
    <!-- A table being carried to another one (its party moves there) -->
    <div
      v-if="transferDrag"
      class="m3-floor-carry pointer-events-none absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-3 py-1.5 text-label-large shadow-elevation-3"
      :style="{ left: `${transferDrag.x * scale}px`, top: `${transferDrag.y * scale}px` }"
    ><MIcon name="move_down" :size="18" />{{ transferDrag.label }}</div>
    <!-- Lengths in your unit (measure) -->
    <span
      v-for="(m, i) in measureLabels"
      :key="`ms${i}`"
      class="m3-floor-measure pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-px text-label-small whitespace-nowrap"
      :style="{ left: `${m.x * scale}px`, top: `${m.y * scale}px` }"
    >{{ m.text }}</span>
    <!-- The rectangle a mouse drags out to select tables -->
    <div
      v-if="marquee"
      class="m3-floor-marquee pointer-events-none absolute rounded-xs border border-dashed"
      :style="{ left: `${marquee.x * scale}px`, top: `${marquee.y * scale}px`, width: `${marquee.w * scale}px`, height: `${marquee.h * scale}px` }"
    />
    <!-- Anything of yours over the plan, placed in plan units with toPx -->
    <slot name="overlay" :scale="scale" :to-px="(v: number) => v * scale" />
    </div>
    <!-- Zoom: in, out, the whole plan (they don't move with the pan) -->
    <div v-if="zoomable && zoomControls" class="m3-floor-zoom absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-full shadow-elevation-1" @pointerdown.stop>
      <button type="button" class="m3-floor-zoom-btn" :aria-label="locale.floorZoomIn" :disabled="zoomed >= maxZoom" @click="zoomTo(zoomed * 1.5)"><MIcon name="add" :size="20" /></button>
      <button type="button" class="m3-floor-zoom-btn" :aria-label="locale.floorZoomOut" :disabled="zoomed <= 1" @click="zoomTo(zoomed / 1.5)"><MIcon name="remove" :size="20" /></button>
      <button type="button" class="m3-floor-zoom-btn" :aria-label="locale.floorZoomFit" :disabled="zoomed <= 1" @click="zoomTo(1)"><MIcon name="fit_screen" :size="20" /></button>
    </div>
  </div>
</template>

<style>
/* Defaults a consumer's own utilities override: none on the root itself. The colors are custom properties to restyle:
   --m3-floor-wall (walls, doors, window frames), --m3-floor-wall-picked, --m3-floor-window (a window's pane),
   --m3-floor-chair, --m3-floor-merge, --m3-floor-merge-label */
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
  .m3-floor-door {
    stroke: var(--m3-floor-wall);
  }
  .m3-floor-door-jamb {
    fill: var(--m3-floor-wall);
  }
  .m3-floor-door-swing {
    stroke: color-mix(in srgb, var(--m3-floor-wall) 55%, transparent);
    fill: color-mix(in srgb, var(--m3-floor-wall) 6%, transparent);
  }
  .m3-floor-window {
    stroke: var(--m3-floor-wall);
  }
  .m3-floor-window-pane {
    stroke: var(--m3-floor-window, var(--color-primary));
  }
  .m3-floor-view {
    /* Doors and windows take this color to cut the wall they sit on */
    background-color: inherit;
  }
  .m3-floor-carry {
    background: var(--color-inverse-surface);
    color: var(--color-inverse-on-surface);
  }
  .m3-floor-zone-picked {
    stroke: var(--color-primary);
    stroke-width: 2;
  }
  .m3-floor-zone-draft {
    fill: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
  /* On a pseudo-element: the table's own outline and shadow are utilities, which win over this layer */
  .m3-floor-overlap::after {
    content: '';
    position: absolute;
    inset: -5px;
    border: 2px dashed var(--color-error);
    border-radius: inherit;
    pointer-events: none;
  }
  .m3-floor-measure {
    background: var(--color-inverse-surface);
    color: var(--color-inverse-on-surface);
  }
  .m3-floor-marquee {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
  .m3-floor-zoom {
    background: var(--color-surface-container-high);
  }
  .m3-floor-zoom-btn {
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    color: var(--color-on-surface-variant);
    transition: background-color 150ms;
  }
  .m3-floor-zoom-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
  }
  .m3-floor-zoom-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: -2px;
  }
  .m3-floor-zoom-btn:disabled {
    color: color-mix(in srgb, var(--color-on-surface) 38%, transparent);
  }
  .m3-floor-chair {
    background: var(--m3-floor-chair);
    color: var(--color-on-surface-variant);
  }
  .m3-floor-merge {
    border-color: color-mix(in srgb, var(--m3-floor-merge) 60%, transparent);
    background: color-mix(in srgb, var(--m3-floor-merge) 5%, transparent);
  }
  .m3-floor-merge-link {
    stroke: color-mix(in srgb, var(--m3-floor-merge) 60%, transparent);
  }
  .m3-floor-merge-label {
    background: var(--m3-floor-merge);
    color: var(--m3-floor-merge-label);
  }
}
</style>
