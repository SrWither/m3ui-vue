<script setup lang="ts">
/**
 * A dashboard of widgets on a grid that people rearrange: drag a widget to move it (others make room and everything
 * floats up to fill gaps), drag its corner to resize it, all on springs. Touch picks a widget up on a long press,
 * so the page still scrolls; the keyboard does it all too (Space to pick up, arrows to move, Shift and arrows to
 * resize, Space to drop, Escape to cancel), announced to screen readers. The layout (cells: `x`, `y`, `w`, `h`) is
 * the v-model; your content goes in `#item`. Below `breakpoint` (its own width) the widgets stack in one column.
 *
 * @slot item One widget's content: `{ item, dragging, resizing }`
 * @event update:modelValue The layout changed (moved, resized)
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { moveItem, normalizeLayout, layoutRows, type DashboardItem } from '../composables/dashboardLayout'

const props = withDefaults(
  defineProps<{
    /** The layout (v-model): `{ id, x, y, w, h, minW?, minH?, maxW?, maxH?, static?, label? }[]`, in cells */
    modelValue: (DashboardItem & { label?: string })[]
    /** Columns */
    columns?: number
    /** A row's height, in px */
    rowHeight?: number
    /** The gap between cells, in px */
    gap?: number
    /** Let people move and resize widgets */
    editable?: boolean
    /** Show a resize handle on each widget's corner */
    resizable?: boolean
    /** Below this width (px, the grid's own) the widgets stack in one column, in reading order */
    breakpoint?: number
    /** Only start a drag from inside an element matching this (a widget's title bar), instead of anywhere on it */
    handle?: string
  }>(),
  { columns: 12, rowHeight: 96, gap: 16, editable: true, resizable: true, breakpoint: 600 },
)

const emit = defineEmits<{ 'update:modelValue': [layout: (DashboardItem & { label?: string })[]] }>()

const t = useLocale()
const root = ref<HTMLElement>()
const width = ref(0)
const stacked = computed(() => width.value > 0 && width.value < props.breakpoint)
const canEdit = computed(() => props.editable && !stacked.value)

// The layout shown: the v-model, or a preview while dragging / resizing / moving with keys
const items = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const layout = computed(() => normalizeLayout(items.value, props.columns))
const preview = ref<DashboardItem[] | null>(null)
const shown = computed(() => preview.value ?? layout.value)

const colWidth = computed(() => Math.max(0, (width.value - props.gap * (props.columns - 1)) / props.columns))
const cellX = (x: number) => x * (colWidth.value + props.gap)
const cellY = (y: number) => y * (props.rowHeight + props.gap)
const spanW = (w: number) => w * colWidth.value + (w - 1) * props.gap
const spanH = (h: number) => h * props.rowHeight + (h - 1) * props.gap
const height = computed(() => {
  const rows = layoutRows(shown.value)
  return rows ? cellY(rows) - props.gap : 0
})

// ── Springs (Standard DefaultSpatial: dampingRatio 0.9, stiffness 700), one rAF loop ────────────

interface Spring { x: number; y: number; w: number; h: number; vx: number; vy: number; vw: number; vh: number }
const springs = new Map<DashboardItem['id'], Spring>()
const els = new Map<DashboardItem['id'], HTMLElement>()
const STIFF = 700
const DAMP = 2 * 0.9 * Math.sqrt(STIFF)
let raf = 0
let last = 0

const dragging = ref<DashboardItem['id'] | null>(null)
const resizing = ref<DashboardItem['id'] | null>(null)
/** The held widget's box, in px, following the pointer */
const held = reactive({ x: 0, y: 0, w: 0, h: 0 })

function target(item: DashboardItem) {
  return { x: cellX(item.x), y: cellY(item.y), w: spanW(item.w), h: spanH(item.h) }
}

function write(id: DashboardItem['id'], s: { x: number; y: number; w: number; h: number }) {
  const el = els.get(id)
  if (!el) return
  el.style.transform = `translate(${s.x}px, ${s.y}px)`
  el.style.width = `${s.w}px`
  el.style.height = `${s.h}px`
}

function step(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  let moving = false
  for (const item of shown.value) {
    const s = springs.get(item.id)
    if (!s) continue
    if (item.id === dragging.value || item.id === resizing.value) {
      // The held one follows the pointer; its spring waits where it is, to take over on drop
      Object.assign(s, held, { vx: 0, vy: 0, vw: 0, vh: 0 })
      write(item.id, s)
      continue
    }
    const goal = target(item)
    // Fixed 4ms substeps: stable at any frame rate
    for (let left = dt; left > 0; left -= 0.004) {
      const h = Math.min(0.004, left)
      for (const k of ['x', 'y', 'w', 'h'] as const) {
        const v = `v${k}` as 'vx' | 'vy' | 'vw' | 'vh'
        s[v] += (-STIFF * (s[k] - goal[k]) - DAMP * s[v]) * h
        s[k] += s[v] * h
      }
    }
    const settled = (['x', 'y', 'w', 'h'] as const).every((k) => Math.abs(s[k] - goal[k]) < 0.3 && Math.abs(s[`v${k}` as 'vx']) < 0.3)
    if (settled) Object.assign(s, goal, { vx: 0, vy: 0, vw: 0, vh: 0 })
    else moving = true
    write(item.id, s)
  }
  raf = moving || dragging.value !== null || resizing.value !== null ? requestAnimationFrame(step) : 0
}

function animate() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(step)
}

/** Puts every widget where it belongs at once (first layout, width changes, reduced motion) */
function snap() {
  for (const item of shown.value) {
    const goal = target(item)
    springs.set(item.id, { ...goal, vx: 0, vy: 0, vw: 0, vh: 0 })
    write(item.id, goal)
  }
}

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

watch(shown, (items) => {
  for (const item of items) if (!springs.has(item.id)) springs.set(item.id, { ...target(item), vx: 0, vy: 0, vw: 0, vh: 0 })
  for (const id of springs.keys()) if (!items.some((i) => i.id === id)) springs.delete(id)
  nextTick(() => (reduced() ? snap() : animate()))
}, { deep: true })

// ── Pointer: move and resize ───────────────────────────────────────────────────────────────────

let press: { id: DashboardItem['id']; mode: 'move' | 'resize'; x: number; y: number; pointer: string; timer?: ReturnType<typeof setTimeout>; active: boolean } | null = null
let start = { x: 0, y: 0, w: 0, h: 0 }
let snapshot: DashboardItem[] = []

const CONTROLS = 'input, textarea, select, button, a, label, [contenteditable], [data-dashboard-action]'

function onPointerDown(e: PointerEvent, item: DashboardItem, mode: 'move' | 'resize') {
  if (!canEdit.value || item.static || e.button > 0) return
  const el = e.target as HTMLElement
  if (mode === 'move') {
    if (el.closest(CONTROLS) && !el.closest('[data-dashboard-resize]')) return
    if (props.handle && !el.closest(props.handle)) return
  }
  press = { id: item.id, mode, x: e.clientX, y: e.clientY, pointer: e.pointerType, active: false }
  // A finger picks up on a long press (moving first is a scroll); the resize corner and a mouse right away-ish
  if (e.pointerType === 'touch' && mode === 'move') press.timer = setTimeout(() => activate(), 350)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  if (mode === 'resize') {
    e.preventDefault()
    activate()
  }
}

function activate() {
  if (!press) return
  press.active = true
  const item = shown.value.find((i) => i.id === press!.id)!
  snapshot = layout.value
  start = target(item)
  Object.assign(held, start)
  if (press.mode === 'move') dragging.value = item.id
  else resizing.value = item.id
  preview.value = layout.value
  document.body.style.userSelect = 'none'
  animate()
}

function onPointerMove(e: PointerEvent) {
  if (!press) return
  const dx = e.clientX - press.x
  const dy = e.clientY - press.y
  if (!press.active) {
    if (press.pointer === 'touch') {
      if (Math.hypot(dx, dy) > 8) cleanup()
      return
    }
    if (Math.hypot(dx, dy) < 4) return
    activate()
  }
  const unitX = colWidth.value + props.gap
  const unitY = props.rowHeight + props.gap
  if (press.mode === 'move') {
    held.x = Math.max(0, Math.min(width.value - start.w, start.x + dx))
    held.y = Math.max(0, start.y + dy)
    const x = Math.round(held.x / unitX)
    const y = Math.round(held.y / unitY)
    preview.value = moveItem(snapshot, press.id, { x, y }, props.columns)
  } else {
    held.w = Math.max(colWidth.value, Math.min(width.value - start.x, start.w + dx))
    held.h = Math.max(props.rowHeight, start.h + dy)
    const w = Math.round((held.w + props.gap) / unitX)
    const h = Math.round((held.h + props.gap) / unitY)
    preview.value = moveItem(snapshot, press.id, { w, h }, props.columns)
  }
}

function onPointerUp() {
  if (press?.active && preview.value) commit(preview.value)
  cleanup()
}
function onPointerCancel() {
  preview.value = null
  cleanup()
}

function commit(next: DashboardItem[]) {
  const byId = new Map(items.value.map((i) => [i.id, i]))
  emit('update:modelValue', next.map((i) => ({ ...byId.get(i.id)!, x: i.x, y: i.y, w: i.w, h: i.h })))
}

function cleanup() {
  clearTimeout(press?.timer)
  press = null
  dragging.value = null
  resizing.value = null
  // The preview stays until the v-model comes back with it, so nothing jumps
  nextTick(() => { preview.value = null })
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  animate()
}

// A finger dragging a widget mustn't scroll the page (decided on its first touchmove, non-passive)
function onTouchMove(e: TouchEvent) {
  if (dragging.value !== null || resizing.value !== null) e.preventDefault()
}
const noMenu = (e: Event) => { if (press) e.preventDefault() }

// ── Keyboard ───────────────────────────────────────────────────────────────────────────────────

const grabbed = ref<DashboardItem['id'] | null>(null)
const announcement = ref('')
const labelOf = (item: DashboardItem & { label?: string }) => item.label ?? String(item.id)

function say(text: string) {
  announcement.value = ''
  nextTick(() => (announcement.value = text))
}
function describe(item: DashboardItem & { label?: string }) {
  return t.dashPlaced.replace('{name}', labelOf(item)).replace('{x}', String(item.x + 1)).replace('{y}', String(item.y + 1))
    .replace('{w}', String(item.w)).replace('{h}', String(item.h))
}

function onKeydown(e: KeyboardEvent, item: DashboardItem & { label?: string }) {
  if (!canEdit.value || item.static || e.target !== e.currentTarget) return
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (grabbed.value === item.id) {
      grabbed.value = null
      say(t.dashDropped.replace('{name}', labelOf(item)))
    } else {
      grabbed.value = item.id
      snapshot = layout.value
      say(t.dashGrabbed.replace('{name}', labelOf(item)))
    }
    return
  }
  if (grabbed.value !== item.id) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    grabbed.value = null
    commit(snapshot)
    say(t.dashCancelled)
    return
  }
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
  if (!d) return
  e.preventDefault()
  const cur = layout.value.find((i) => i.id === item.id)!
  const change = e.shiftKey ? { w: cur.w + d[0]!, h: cur.h + d[1]! } : { x: cur.x + d[0]!, y: cur.y + d[1]! }
  const next = moveItem(layout.value, item.id, change, props.columns)
  commit(next)
  say(describe({ ...next.find((i) => i.id === item.id)!, label: item.label }))
}

// ── Size ───────────────────────────────────────────────────────────────────────────────────────

let observer: ResizeObserver | undefined
onMounted(() => {
  const measure = () => {
    const before = width.value
    width.value = root.value?.clientWidth ?? 0
    // A new width moves everything at once, not on springs
    if (before !== width.value) nextTick(snap)
  }
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(measure)
    observer.observe(root.value)
  }
  root.value?.addEventListener('touchmove', onTouchMove, { passive: false })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  root.value?.removeEventListener('touchmove', onTouchMove)
  cleanup()
})

const setEl = (id: DashboardItem['id']) => (el: unknown) => {
  if (el instanceof HTMLElement) {
    els.set(id, el)
    const s = springs.get(id)
    if (s) write(id, s)
  } else els.delete(id)
}
const heldItem = computed(() => (dragging.value ?? resizing.value) !== null ? shown.value.find((i) => i.id === (dragging.value ?? resizing.value)) : undefined)
const stackOrder = computed(() => [...items.value].sort((a, b) => a.y - b.y || a.x - b.x))
</script>

<template>
  <div ref="root" class="m3-dashboard-grid relative" :style="stacked ? undefined : { height: `${height}px` }" @contextmenu="noMenu">
    <!-- Narrow: one column, in reading order, no editing -->
    <div v-if="stacked" class="flex flex-col" :style="{ gap: `${gap}px` }">
      <div v-for="item in stackOrder" :key="item.id" class="m3-dashboard-grid__item min-w-0" :style="{ height: `${spanH(item.h)}px` }">
        <slot name="item" :item="item" :dragging="false" :resizing="false" />
      </div>
    </div>

    <template v-else-if="width">
      <!-- Where the held widget will land -->
      <div
        v-if="heldItem"
        class="pointer-events-none absolute left-0 top-0 rounded-lg border-2 border-dashed border-primary/60 bg-primary/8 transition-transform duration-100"
        :style="{ transform: `translate(${cellX(heldItem.x)}px, ${cellY(heldItem.y)}px)`, width: `${spanW(heldItem.w)}px`, height: `${spanH(heldItem.h)}px` }"
      />
      <div
        v-for="item in items"
        :key="item.id"
        :ref="setEl(item.id)"
        class="m3-dashboard-grid__item absolute left-0 top-0 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        :class="[
          dragging === item.id || resizing === item.id ? 'z-10 shadow-elevation-4' : '',
          grabbed === item.id ? 'ring-2 ring-primary' : '',
          canEdit && !item.static && !handle ? (dragging === item.id ? 'cursor-grabbing' : 'cursor-grab') : '',
        ]"
        :style="{ touchAction: canEdit && !item.static ? 'pan-y' : undefined }"
        :tabindex="canEdit && !item.static ? 0 : undefined"
        :aria-roledescription="canEdit && !item.static ? 'draggable' : undefined"
        :aria-label="item.label"
        @pointerdown="onPointerDown($event, item, 'move')"
        @keydown="onKeydown($event, item)"
        @blur="grabbed === item.id && (grabbed = null)"
      >
        <slot name="item" :item="item" :dragging="dragging === item.id" :resizing="resizing === item.id" />
        <!-- Resize corner -->
        <span
          v-if="canEdit && resizable && !item.static"
          data-dashboard-resize
          class="absolute bottom-0 right-0 z-[1] grid size-6 cursor-nwse-resize touch-none place-items-center rounded-br-lg text-on-surface-variant opacity-60 hover:opacity-100"
          :aria-label="t.dashResize"
          role="presentation"
          @pointerdown.stop="onPointerDown($event, item, 'resize')"
        >
          <MIcon name="south_east" :size="16" />
        </span>
      </div>
    </template>

    <span class="sr-only" aria-live="assertive">{{ announcement }}</span>
  </div>
</template>
