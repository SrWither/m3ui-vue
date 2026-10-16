<script setup lang="ts">
/**
 * Content that can be swiped left or right to dismiss it, uncovering a background behind it (a port of
 * Compose's `SwipeToDismissBox`), typically a list item with "archive" and "delete" behind. Once swiped away it
 * stays there until you reset it (`v-model` back to `'settled'`, or `reset()`), so you decide what happens:
 * remove the item, or undo.
 *
 * @slot default The content that moves
 * @slot background What the swipe uncovers. Receives `{ direction, target, progress }`: the side being
 *   swiped (`'start-to-end'`, `'end-to-start'` or `'settled'`), the state it would settle in if released now,
 *   and how far it has moved (0 to 1)
 * @event update:modelValue Emitted when it settles in a new state — powers v-model
 * @event dismiss Emitted with the direction when the content is swiped away
 */
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { fastOutSlowIn } from '../composables/_useSpring'

export type SwipeToDismissValue = 'settled' | 'start-to-end' | 'end-to-start'

const props = withDefaults(defineProps<{
  /** State (v-model): `'settled'`, or dismissed towards `'start-to-end'` / `'end-to-start'`. Set it to animate there. */
  modelValue?: SwipeToDismissValue
  /** Allow dismissing by swiping in the reading direction (right in LTR) */
  startToEnd?: boolean
  /** Allow dismissing by swiping against the reading direction (left in LTR) */
  endToStart?: boolean
  /** Turns the swipe gesture off (setting v-model still works) */
  disabled?: boolean
  /** How far, in px, the content has to move before releasing dismisses it (SwipeToDismissBoxDefaults: 56dp) */
  threshold?: number
}>(), {
  modelValue: 'settled',
  startToEnd: true,
  endToStart: true,
  disabled: false,
  threshold: 56,
})

const emit = defineEmits<{
  'update:modelValue': [SwipeToDismissValue]
  dismiss: [Exclude<SwipeToDismissValue, 'settled'>]
}>()

const vnodeProps = getCurrentInstance()?.vnode.props ?? {}
const controlled = 'onUpdate:modelValue' in vnodeProps
const rootEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()
// Offset in px along the reading direction (positive = towards the end)
const offset = ref(0)
const width = ref(0)
const settled = ref<SwipeToDismissValue>(props.modelValue)
let rtl = false

const anchorOf = (v: SwipeToDismissValue) => (v === 'start-to-end' ? width.value : v === 'end-to-start' ? -width.value : 0)

const direction = computed<SwipeToDismissValue>(() =>
  offset.value > 0 ? 'start-to-end' : offset.value < 0 ? 'end-to-start' : 'settled')
// targetValue without a fling: the closest anchor once past the threshold from where the drag started
const target = computed<SwipeToDismissValue>(() => {
  if (settled.value !== 'settled') return settled.value
  if (offset.value >= props.threshold && props.startToEnd) return 'start-to-end'
  if (offset.value <= -props.threshold && props.endToStart) return 'end-to-start'
  return 'settled'
})
const progress = computed(() => (width.value ? Math.min(1, Math.abs(offset.value) / width.value) : 0))

function write() {
  if (contentEl.value) contentEl.value.style.transform = offset.value ? `translateX(${rtl ? -offset.value : offset.value}px)` : ''
}
watch(offset, write)

// ── Settling: AnchoredDraggableDefaults.SnapAnimationSpec is tween() (300ms, FastOutSlowIn) ─────
let raf = 0
function animateTo(value: SwipeToDismissValue) {
  cancelAnimationFrame(raf)
  width.value = rootEl.value?.offsetWidth ?? width.value
  const from = offset.value
  const to = anchorOf(value)
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 300)
    offset.value = from + (to - from) * fastOutSlowIn(t)
    if (t < 1) raf = requestAnimationFrame(step)
    else settle(value)
  }
  if (from === to) settle(value)
  else raf = requestAnimationFrame(step)
}

function settle(value: SwipeToDismissValue) {
  raf = 0
  offset.value = anchorOf(value)
  if (settled.value === value) return
  settled.value = value
  emit('update:modelValue', value)
  if (value !== 'settled') emit('dismiss', value)
  // With v-model, a parent that sets it straight back (inside @dismiss, say) leaves the prop unchanged, so
  // the watcher below never fires: compare once the parent has updated
  if (controlled) nextTick(() => { if (props.modelValue !== settled.value) animateTo(props.modelValue) })
}

watch(() => props.modelValue, (v) => { if (v !== settled.value) animateTo(v) })

// ── Gesture ─────────────────────────────────────────────────────────────────────────────────────
// Touch keeps vertical scrolling (touch-action: pan-y); a drag only starts once the pointer has moved
// sideways more than it has vertically.
const SLOP = 8
// AnchoredDraggableMinFlingVelocity
const FLING_VELOCITY = 125
let pointerId: number | null = null
let startX = 0
let startY = 0
let startOffset = 0
let dragging = false
let samples: { t: number; x: number }[] = []
let suppressClick = false

function onPointerDown(e: PointerEvent) {
  // Gestures are off while dismissed, as in SwipeToDismissBox
  if (props.disabled || settled.value !== 'settled' || e.button !== 0) return
  pointerId = e.pointerId
  startX = e.clientX
  startY = e.clientY
  startOffset = offset.value
  dragging = false
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function along(e: PointerEvent) {
  return rtl ? startX - e.clientX : e.clientX - startX
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (!dragging) {
    if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return release()
    if (Math.abs(dx) <= SLOP) return
    dragging = true
    cancelAnimationFrame(raf)
    raf = 0
    width.value = rootEl.value?.offsetWidth ?? 0
    document.body.style.userSelect = 'none'
  }
  const min = props.endToStart ? -width.value : 0
  const max = props.startToEnd ? width.value : 0
  offset.value = Math.min(max, Math.max(min, startOffset + along(e)))
  samples.push({ t: e.timeStamp, x: rtl ? -e.clientX : e.clientX })
  samples = samples.filter((s) => e.timeStamp - s.t < 100)
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  if (!dragging) return release()
  const velocity = releaseVelocity(e.timeStamp)
  suppressClick = true
  release()
  animateTo(computeTarget(velocity))
}

// Like Compose's VelocityTracker: the last 100ms of movement, and no velocity at all if the pointer had
// stopped (AssumePointerMoveStoppedMilliseconds = 40) before it was released
function releaseVelocity(upTime: number) {
  const recent = samples.filter((s) => upTime - s.t < 100)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (!first || !last || upTime - last.t > 40) return 0
  const dt = (last.t - first.t) / 1000
  return dt > 0 ? (last.x - first.x) / dt : 0
}

// AnchoredDraggable's computeTarget(): at rest the closest anchor; a fast fling goes to the next anchor in
// its direction; otherwise the next anchor once past the positional threshold from the previous one.
function computeTarget(velocity: number): SwipeToDismissValue {
  const anchors: [SwipeToDismissValue, number][] = [['settled', 0]]
  if (props.startToEnd) anchors.push(['start-to-end', width.value])
  if (props.endToStart) anchors.push(['end-to-start', -width.value])
  anchors.sort((a, b) => a[1] - b[1])
  const x = offset.value
  if (velocity === 0) {
    return anchors.reduce((best, a) => (Math.abs(a[1] - x) < Math.abs(best[1] - x) ? a : best))[0]
  }
  const forward = velocity > 0
  const below = [...anchors].reverse().find((a) => a[1] <= x) ?? anchors[0]!
  const above = anchors.find((a) => a[1] >= x) ?? anchors[anchors.length - 1]!
  if (Math.abs(velocity) >= FLING_VELOCITY) return (forward ? above : below)[0]
  const from = forward ? below : above
  return Math.abs(x - from[1]) >= props.threshold ? (forward ? above : below)[0] : from[0]
}

function release() {
  pointerId = null
  dragging = false
  samples = []
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

// A drag that ends over a button inside the content shouldn't also click it
function onClickCapture(e: MouseEvent) {
  if (!suppressClick) return
  suppressClick = false
  e.stopPropagation()
  e.preventDefault()
}

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  rtl = rootEl.value ? getComputedStyle(rootEl.value).direction === 'rtl' : false
  width.value = rootEl.value?.offsetWidth ?? 0
  offset.value = anchorOf(settled.value)
  write()
  resizeObserver = new ResizeObserver(() => {
    width.value = rootEl.value?.offsetWidth ?? 0
    if (!dragging && !raf) offset.value = anchorOf(settled.value)
  })
  if (rootEl.value) resizeObserver.observe(rootEl.value)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  release()
  resizeObserver?.disconnect()
})

defineExpose({
  /** Animates back to `'settled'` */
  reset: () => animateTo('settled'),
  /** Animates away in the given direction */
  dismiss: (dir: Exclude<SwipeToDismissValue, 'settled'>) => animateTo(dir),
})
</script>

<template>
  <div ref="rootEl" class="relative touch-pan-y overflow-hidden" @pointerdown="onPointerDown" @click.capture="onClickCapture">
    <div class="absolute inset-0 flex">
      <slot name="background" :direction="direction" :target="target" :progress="progress" />
    </div>
    <div ref="contentEl" class="relative">
      <slot />
    </div>
  </div>
</template>
