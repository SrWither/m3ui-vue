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
  kind: 'door' | 'window' | 'plant' | 'column' | 'restroom' | 'kitchen' | 'register' | 'stairs' | 'label'
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  /** The text of a label (or a caption under the others) */
  label?: string
}
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
 * @slot table The inside of a table: `{ table, status, selected }`
 * @event table-click A table was clicked or opened with Enter (not after a drag)
 * @event move Tables moved by a drag or the arrows, with their new positions (`{ id, x, y }[]`), to save them
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useLocale } from '../composables/useLocale'
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
})
const tables = defineModel<FloorTable[]>('tables', { default: () => [] })
const merges = defineModel<FloorMerge[]>('merges', { default: () => [] })
const selection = defineModel<(string | number)[]>('selection', { default: () => [] })
const areas = defineModel<FloorArea[]>('areas', { default: () => [] })
const walls = defineModel<FloorWall[]>('walls', { default: () => [] })
const decor = defineModel<FloorDecor[]>('decor', { default: () => [] })
/** While editing: `select` moves things, `wall` draws a wall (click each corner, double-click or Enter to end), `area` drags out a zone */
const tool = defineModel<'select' | 'wall' | 'area'>('tool', { default: 'select' })
const emit = defineEmits<{ 'table-click': [table: FloorTable, event: MouseEvent | KeyboardEvent]; move: [moved: { id: string | number; x: number; y: number }[]] }>()
const locale = useLocale()

const root = ref<HTMLElement>()
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
let drag: { id: number; sx: number; sy: number; start: Map<string | number, { x: number; y: number }>; moved: boolean } | null = null
let suppressClick = false
const snap = (v: number) => (props.grid ? Math.round(v / props.grid) * props.grid : v)
function clamp(t: FloorTable, x: number, y: number) {
  const s = sizeOf(t)
  return { x: Math.min(props.width - s.w / 2, Math.max(s.w / 2, x)), y: Math.min(props.height - s.h / 2, Math.max(s.h / 2, y)) }
}
function onDown(e: PointerEvent, t: FloorTable) {
  if (!props.editable || e.button !== 0 || tool.value !== 'select') return
  e.stopPropagation()
  picked.value = null
  if (!selection.value.includes(t.id)) selection.value = e.shiftKey || e.ctrlKey || e.metaKey ? [...selection.value, t.id] : [t.id]
  const ids = selection.value.includes(t.id) ? selection.value : [t.id]
  drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start: new Map(tables.value.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }])), moved: false }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = (e.clientX - drag.sx) / scale.value
  const dy = (e.clientY - drag.sy) / scale.value
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return
  drag.moved = true
  const next = new Map<string | number, { x: number; y: number }>()
  for (const [id, p] of drag.start) next.set(id, clamp(tables.value.find((x) => x.id === id)!, p.x + dx, p.y + dy))
  draft.value = next
}
function onUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
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
  tables.value = tables.value.map((t) => (next.has(t.id) ? { ...t, ...next.get(t.id)! } : t))
  emit('move', [...next].map(([id, p]) => ({ id, ...p })))
}
function onClick(e: MouseEvent, t: FloorTable) {
  if (suppressClick) return
  if (props.editable && !(e.shiftKey || e.ctrlKey || e.metaKey)) selection.value = [t.id]
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
const DECOR: Record<FloorDecor['kind'], { icon?: string; w: number; h: number }> = {
  door: { icon: 'door_front', w: 60, h: 14 },
  window: { icon: 'window', w: 80, h: 10 },
  plant: { icon: 'potted_plant', w: 40, h: 40 },
  column: { w: 30, h: 30 },
  restroom: { icon: 'wc', w: 48, h: 48 },
  kitchen: { icon: 'skillet', w: 48, h: 48 },
  register: { icon: 'point_of_sale', w: 48, h: 48 },
  stairs: { icon: 'stairs', w: 60, h: 60 },
  label: { w: 120, h: 30 },
}
const decorSize = (d: FloorDecor) => ({ w: d.width ?? DECOR[d.kind].w, h: d.height ?? DECOR[d.kind].h })
function areaLook(color?: string) {
  const c = color ?? 'secondary'
  return ROLES.has(c) ? { background: `color-mix(in srgb, var(--color-${c}-container) 45%, transparent)`, borderColor: `var(--color-${c})` } : { background: `color-mix(in srgb, ${c} 18%, transparent)`, borderColor: c }
}
/** What's picked while editing, besides tables: an area, a wall or a decor item */
const picked = ref<{ kind: 'area' | 'wall' | 'decor'; id: string | number } | null>(null)
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
function onAreaDown(e: PointerEvent, a: FloorArea, resize: boolean) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'area', id: a.id }
  selection.value = []
  follow(e, (dx, dy) => {
    areaDraft.value = resize
      ? { ...a, width: Math.max(props.grid || 20, a.width + dx), height: Math.max(props.grid || 20, a.height + dy) }
      : { ...a, x: a.x + dx, y: a.y + dy }
  }, () => {
    const d = areaDraft.value!
    areaDraft.value = null
    areas.value = areas.value.map((x) => (x.id === a.id ? { ...d, x: snap(d.x), y: snap(d.y), width: snap(d.width) || d.width, height: snap(d.height) || d.height } : x))
  })
}
const decorDraft = shallowRef<FloorDecor | null>(null)
const shownDecor = computed(() => decor.value.map((d) => (decorDraft.value?.id === d.id ? decorDraft.value : d)))
function onDecorDown(e: PointerEvent, d: FloorDecor) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'decor', id: d.id }
  selection.value = []
  follow(e, (dx, dy) => (decorDraft.value = { ...d, x: d.x + dx, y: d.y + dy }), () => {
    const n = decorDraft.value!
    decorDraft.value = null
    decor.value = decor.value.map((x) => (x.id === d.id ? { ...n, x: snap(n.x), y: snap(n.y) } : x))
  })
}
const wallDraft = shallowRef<FloorWall | null>(null)
const shownWalls = computed(() => walls.value.map((w) => (wallDraft.value?.id === w.id ? wallDraft.value : w)))
const wallPath = (w: FloorWall) => w.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x * scale.value} ${y * scale.value}`).join('')
function onWallDown(e: PointerEvent, w: FloorWall, vertex = -1) {
  if (!props.editable || tool.value !== 'select' || e.button !== 0) return
  e.stopPropagation()
  picked.value = { kind: 'wall', id: w.id }
  selection.value = []
  follow(e, (dx, dy) => {
    wallDraft.value = { ...w, points: w.points.map(([x, y], i) => (vertex < 0 || i === vertex ? [x + dx, y + dy] : [x, y])) }
  }, () => {
    const n = wallDraft.value!
    wallDraft.value = null
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
  if (pts && pts.length > 1) walls.value = [...walls.value, { id: newId('wall'), points: pts }]
}
function onPlanKey(e: KeyboardEvent) {
  if (drawing.value && (e.key === 'Enter' || e.key === 'Escape')) {
    e.preventDefault()
    if (e.key === 'Enter') finishWall()
    else drawing.value = null
    return
  }
  if (!props.editable || (e.key !== 'Delete' && e.key !== 'Backspace') || !picked.value) return
  const { kind, id } = picked.value
  e.preventDefault()
  if (kind === 'area') areas.value = areas.value.filter((a) => a.id !== id)
  if (kind === 'wall') walls.value = walls.value.filter((w) => w.id !== id)
  if (kind === 'decor') decor.value = decor.value.filter((d) => d.id !== id)
  picked.value = null
}
const svgEl = ref<SVGSVGElement>()

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
      :class="[editable && tool === 'select' ? 'cursor-move' : 'pointer-events-none', isPicked('area', a.id) && 'ring-2 ring-primary']"
      :style="{ left: `${a.x * scale}px`, top: `${a.y * scale}px`, width: `${a.width * scale}px`, height: `${a.height * scale}px`, ...areaLook(a.color) }"
      @pointerdown="onAreaDown($event, a, false)"
    >
      <span v-if="a.label" class="absolute top-1 left-2 text-label-medium text-on-surface-variant">{{ a.label }}</span>
      <span
        v-if="editable && isPicked('area', a.id)"
        class="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-xs border-2 border-primary bg-surface"
        @pointerdown="onAreaDown($event, a, true)"
      />
    </div>

    <!-- Walls -->
    <svg ref="svgEl" class="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g v-for="w in shownWalls" :key="`w${w.id}`">
        <path
          :d="wallPath(w)"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="stroke-on-surface-variant"
          :class="[editable && tool === 'select' && 'pointer-events-auto cursor-move', isPicked('wall', w.id) && 'stroke-primary']"
          :stroke-width="(w.thickness ?? 8) * scale"
          @pointerdown="onWallDown($event, w)"
        />
        <template v-if="editable && isPicked('wall', w.id)">
          <circle
            v-for="(pt, i) in w.points"
            :key="i"
            :cx="pt[0] * scale"
            :cy="pt[1] * scale"
            r="6"
            class="pointer-events-auto cursor-move fill-surface stroke-primary"
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
        d.kind === 'column' ? 'rounded-full bg-outline' : d.kind === 'door' || d.kind === 'window' ? 'rounded-xs bg-surface-container-highest' : d.kind === 'label' ? '' : 'rounded-lg bg-surface-container-high',
        editable && tool === 'select' ? 'cursor-move' : 'pointer-events-none',
        isPicked('decor', d.id) && 'ring-2 ring-primary',
      ]"
      :style="{ left: `${d.x * scale}px`, top: `${d.y * scale}px`, width: `${decorSize(d).w * scale}px`, height: `${decorSize(d).h * scale}px`, rotate: `${d.rotation ?? 0}deg` }"
      :aria-label="d.label ?? d.kind"
      role="img"
      @pointerdown="onDecorDown($event, d)"
    >
      <MIcon v-if="DECOR[d.kind].icon && d.kind !== 'door' && d.kind !== 'window'" :name="DECOR[d.kind].icon!" :size="Math.max(12, Math.min(decorSize(d).w, decorSize(d).h) * 0.6 * scale)" />
      <span v-if="d.kind === 'label'" class="truncate text-title-small text-on-surface-variant" :style="{ fontSize: `${Math.max(10, 16 * scale)}px` }">{{ d.label }}</span>
    </div>

    <!-- Merged tables: one outline around the group -->
    <div
      v-for="b in mergeBoxes"
      :key="`m${b!.m.id}`"
      class="pointer-events-none absolute rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5"
      :style="{ left: `${b!.x * scale}px`, top: `${b!.y * scale}px`, width: `${b!.w * scale}px`, height: `${b!.h * scale}px` }"
    >
      <span v-if="b!.m.label" class="absolute -top-2.5 left-3 rounded-full bg-primary px-2 text-label-small text-on-primary">{{ b!.m.label }}</span>
    </div>

    <div
      v-for="p in placed"
      :key="p.t.id"
      class="absolute"
      :class="!draft?.has(p.t.id) && 'transition-[left,top] duration-200 ease-out'"
      :style="{ left: `${p.x * scale}px`, top: `${p.y * scale}px`, transform: `rotate(${p.t.rotation ?? 0}deg)` }"
    >
      <span
        v-for="(ch, i) in p.chairs"
        :key="i"
        class="pointer-events-none absolute rounded-md bg-outline-variant"
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
        <slot name="table" :table="p.t" :status="p.status" :selected="selection.includes(p.t.id)">
          <MIcon v-if="p.status?.icon && scale > 0.5" :name="p.status.icon" :size="Math.max(12, 18 * scale)" class="opacity-80" />
          <span class="max-w-full truncate px-1 leading-tight font-medium">{{ p.t.label }}</span>
        </slot>
        <span
          v-if="p.t.badge !== undefined"
          class="absolute -top-2 -right-2 min-w-5 rounded-full bg-error px-1.5 text-center text-label-small leading-5 text-on-error"
          :style="{ transform: `rotate(${-(p.t.rotation ?? 0)}deg)` }"
        >{{ p.t.badge }}</span>
      </div>
    </div>
  </div>
</template>

<style>
/* Defaults a consumer's own utilities override: none on the root itself */
@layer base {
  .m3-floor-plan {
    position: relative;
    overflow: hidden;
    width: 100%;
    border-radius: var(--radius-xl, 12px);
    background-color: var(--color-surface-container-low);
  }
}
</style>
