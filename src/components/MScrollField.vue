<script setup lang="ts">
/**
 * An endless wheel to pick a number or option by scrolling (M3 Expressive's ScrollField, a port of Compose's
 * `ScrollField`): the centered item is the selected one. Drag, flick, use the mouse wheel, the arrow keys, or
 * click an item. Put two side by side for a time (hours and minutes).
 *
 * @slot item Custom content for each item, instead of the formatted number. Receives `{ index, selected }`.
 * @event update:modelValue Emitted with the index of the centered item, as it changes while scrolling
 */
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** Index of the selected item, 0 to count - 1 (v-model) */
  modelValue: number
  /** Number of items; the wheel wraps around after the last one */
  count: number
  /**
   * Accessible name of the field. Include the range when it isn't obvious ("Select year between 2000 and
   * 2025"): the wheel wraps, so screen readers can't tell where it ends.
   */
  label?: string
  /** Text for each item (also what screen readers announce). Defaults to the index with at least 2 digits. */
  format?: (index: number) => string
  /** Height in px; three items fit in the default 200 (ScrollFieldDefaults.ScrollFieldHeight) */
  height?: number
  /** Disables the field */
  disabled?: boolean
}>(), {
  format: (index: number) => String(index).padStart(2, '0'),
  height: 200,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [number] }>()
const slots = defineSlots<{ item?: (props: { index: number; selected: boolean }) => unknown }>()
const custom = computed(() => !!slots.item)

// Pager pages are a fixed ScrollFieldHeight / 3, whatever the field's own height
const ITEM = 200 / 3
// PagerDefaults: the snap after a fling is spring(StiffnessMediumLow); animateScrollToPage uses spring()
const SNAP = { stiffness: 400, dampingRatio: 1 }
const SCROLL_TO = { stiffness: 1500, dampingRatio: 1 }
// Item text emphasis: MotionScheme.fastSpatialSpec() (Standard)
const EMPHASIS = { stiffness: 1400, dampingRatio: 0.9 }
// PagerDefaults' snapVelocityThreshold (400dp/s)
const FLING_VELOCITY = 400

const mod = (n: number) => ((n % props.count) + props.count) % props.count

// ── Position (in items, not wrapped) ──────────────────────────────────────────────────────────
let pos = props.count > 0 ? mod(props.modelValue) : 0
let vel = 0
let target: number | null = null
let spec = SNAP
const selectedPage = ref(Math.round(pos))
const range = computed(() => Math.ceil(props.height / 2 / ITEM) + 1)
const pages = shallowRef<number[]>([])

function updatePages() {
  const base = Math.round(pos)
  if (pages.value[range.value] === base) return
  pages.value = Array.from({ length: range.value * 2 + 1 }, (_, i) => base - range.value + i)
}
updatePages()

// ── Per-item emphasis (0 → 1 as an item becomes the selected one) ───────────────────────────────
const emphasis = new Map<number, { f: number; v: number }>()
const itemEls = new Map<number, HTMLElement>()

function setItemEl(page: number, el: unknown) {
  if (el instanceof HTMLElement) itemEls.set(page, el)
  else itemEls.delete(page)
}

function write() {
  const center = props.height / 2 - ITEM / 2
  for (const [page, el] of itemEls) {
    el.style.transform = `translateY(${center + (page - pos) * ITEM}px)`
    if (custom.value) continue
    const f = emphasis.get(page)?.f ?? (page === selectedPage.value ? 1 : 0)
    const text = el.firstElementChild as HTMLElement | null
    if (!text) continue
    // displayMedium (45/52, regular) → displayLargeEmphasized (57/64, medium)
    text.style.fontSize = `${45 + 12 * f}px`
    text.style.lineHeight = `${52 + 12 * f}px`
    text.style.fontWeight = String(Math.round(400 + 100 * f))
    text.style.letterSpacing = '0'
    text.style.color = props.disabled
      ? ''
      : `color-mix(in srgb, var(--color-on-surface) ${Math.round(f * 100)}%, var(--color-outline))`
  }
}

// ── Animation loop ──────────────────────────────────────────────────────────────────────────────
let raf = 0
let last = 0
let dragging = false

function setSelected() {
  const page = Math.round(pos)
  if (page === selectedPage.value) return
  selectedPage.value = page
  updatePages()
  if (props.count > 0) emit('update:modelValue', mod(page))
}

function frame(now: number) {
  let dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  let busy = false
  while (dt > 0) {
    const h = Math.min(dt, 0.004)
    dt -= h
    if (target !== null && !dragging) {
      const c = 2 * spec.dampingRatio * Math.sqrt(spec.stiffness)
      vel += (-spec.stiffness * (pos - target) - c * vel) * h
      pos += vel * h
    }
    for (const [page, e] of emphasis) {
      const goal = page === selectedPage.value ? 1 : 0
      const c = 2 * EMPHASIS.dampingRatio * Math.sqrt(EMPHASIS.stiffness)
      e.v += (-EMPHASIS.stiffness * (e.f - goal) - c * e.v) * h
      e.f += e.v * h
    }
  }
  if (target !== null && !dragging) {
    if (Math.abs(pos - target) < 0.001 && Math.abs(vel) < 0.01) {
      pos = target
      vel = 0
      target = null
    } else busy = true
  }
  for (const [page, e] of emphasis) {
    const goal = page === selectedPage.value ? 1 : 0
    if (Math.abs(e.f - goal) < 0.002 && Math.abs(e.v) < 0.01) {
      e.f = goal
      e.v = 0
      if (goal === 0) emphasis.delete(page)
    } else busy = true
  }
  setSelected()
  write()
  raf = busy || dragging ? requestAnimationFrame(frame) : 0
}

function kick() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(frame)
}

function animateTo(page: number, s = SCROLL_TO) {
  target = page
  spec = s
  kick()
}

watch(selectedPage, (page, prev) => {
  // Both the item leaving and the one arriving animate their emphasis
  if (!emphasis.has(prev)) emphasis.set(prev, { f: 1, v: 0 })
  if (!emphasis.has(page)) emphasis.set(page, { f: 0, v: 0 })
  kick()
})

// Outside changes take the short way around the wheel
watch(() => props.modelValue, (v) => {
  if (props.count <= 0) return
  const current = target ?? Math.round(pos)
  let d = mod(v) - mod(current)
  if (d > props.count / 2) d -= props.count
  if (d < -props.count / 2) d += props.count
  if (d !== 0) animateTo(current + d)
})

watch(pages, () => nextTick(write))
watch(() => [props.height, props.disabled], () => { updatePages(); nextTick(write) })

// ── Pointer ─────────────────────────────────────────────────────────────────────────────────────
const rootEl = ref<HTMLElement>()
let startY = 0
let startPos = 0
let moved = false
let samples: { t: number; y: number }[] = []

function onPointerDown(e: PointerEvent) {
  if (props.disabled || e.button !== 0) return
  rootEl.value?.setPointerCapture?.(e.pointerId)
  dragging = true
  moved = false
  startY = e.clientY
  startPos = pos
  target = null
  vel = 0
  samples = [{ t: e.timeStamp, y: e.clientY }]
  kick()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  if (Math.abs(e.clientY - startY) > 4) moved = true
  pos = startPos - (e.clientY - startY) / ITEM
  samples.push({ t: e.timeStamp, y: e.clientY })
  samples = samples.filter((s) => e.timeStamp - s.t < 100)
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  if (!moved) {
    // A click scrolls the clicked item to the center
    const rect = rootEl.value!.getBoundingClientRect()
    animateTo(Math.round(pos + (e.clientY - rect.top - props.height / 2) / ITEM))
    return
  }
  // VelocityTracker: the last 100ms of movement, none if the pointer had stopped for 40ms before release
  const recent = samples.filter((s) => e.timeStamp - s.t < 100)
  const first = recent[0]
  const lastSample = recent[recent.length - 1]
  const dt = first && lastSample && e.timeStamp - lastSample.t <= 40 ? (lastSample.t - first.t) / 1000 : 0
  const vy = dt > 0 ? (lastSample!.y - first!.y) / dt : 0
  vel = -vy / ITEM
  // PagerSnapDistance.atMost(1): a fling moves on to the next item in its direction, no further
  let page: number
  if (Math.abs(vy) > FLING_VELOCITY) page = vy < 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1
  else page = Math.round(pos)
  animateTo(page, SNAP)
}

// ── Wheel and keys ──────────────────────────────────────────────────────────────────────────────
let wheelAcc = 0
function onWheel(e: WheelEvent) {
  if (props.disabled) return
  e.preventDefault()
  wheelAcc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
  const steps = Math.trunc(wheelAcc / 40)
  if (!steps) return
  wheelAcc -= steps * 40
  animateTo((target ?? Math.round(pos)) + steps)
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  e.preventDefault()
  animateTo((target ?? Math.round(pos)) + step)
}

onMounted(() => {
  rootEl.value?.addEventListener('wheel', onWheel, { passive: false })
  write()
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  rootEl.value?.removeEventListener('wheel', onWheel)
})

const selectedIndex = computed(() => (props.count > 0 ? mod(selectedPage.value) : 0))
// The widest label sets the width (the first and last are the longest for numbers)
const sizer = computed(() => {
  if (props.count <= 0) return ''
  const a = props.format(0)
  const b = props.format(props.count - 1)
  return a.length >= b.length ? a : b
})
</script>

<template>
  <div
    ref="rootEl"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-label="label"
    :aria-valuenow="selectedIndex"
    aria-valuemin="0"
    :aria-valuemax="Math.max(count - 1, 0)"
    :aria-valuetext="count > 0 ? format(selectedIndex) : undefined"
    :aria-disabled="disabled || undefined"
    class="relative inline-block touch-none overflow-hidden rounded-lg outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="disabled ? 'cursor-default bg-surface-container-lowest/38 text-on-surface/38' : 'cursor-grab bg-surface-container-lowest'"
    :style="{ height: `${height}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
  >
    <!-- Sets the width: the widest label in the selected style -->
    <span v-if="!custom" aria-hidden="true" class="invisible block px-4 font-medium" style="font-size: 57px; line-height: 0; height: 0">{{ sizer }}</span>
    <div
      v-for="page in pages"
      :key="page"
      :ref="(el) => setItemEl(page, el)"
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center"
      :style="{ height: `${ITEM}px` }"
    >
      <slot v-if="custom" name="item" :index="mod(page)" :selected="page === selectedPage" />
      <span v-else class="font-sans tabular-nums">{{ count > 0 ? format(mod(page)) : '' }}</span>
    </div>
  </div>
</template>
