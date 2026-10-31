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
  if (!props.editable || e.button !== 0) return
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
function onPlanDown(e: PointerEvent) {
  if (props.editable && e.target === e.currentTarget) selection.value = []
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
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
    class="m3-floor-plan relative overflow-hidden rounded-xl bg-surface-container-low select-none"
    :style="{ aspectRatio: `${width} / ${height}`, ...gridStyle }"
    role="group"
    :aria-label="label ?? locale.floorPlan"
    @pointerdown="onPlanDown"
  >
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
@layer base {
  .m3-floor-plan {
    width: 100%;
  }
}
</style>
