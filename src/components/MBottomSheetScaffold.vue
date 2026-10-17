<script setup lang="ts">
/**
 * A screen with M3's standard (non-modal) bottom sheet, a port of Compose's `BottomSheetScaffold`: the sheet
 * sits over the bottom of the content without a scrim, peeking out when partially expanded, and the content
 * stays usable. Drag it (or its content, which scrolls once the sheet is fully expanded) between its states,
 * or tap the handle. For a sheet that blocks the screen behind a scrim, use MBottomSheet.
 *
 * @slot default The screen's content; it gets bottom padding equal to `peekHeight` so nothing hides under the
 *   peeking sheet
 * @slot sheet The sheet's content, below the drag handle
 * @slot top-bar An app bar above the content (the sheet can rise over it)
 * @event update:modelValue Emitted when the sheet settles in another state after a drag or a handle tap —
 *   powers v-model
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'
import { DEFAULT_SPATIAL, FAST_EFFECTS, type SpringSpec } from '../composables/_useSpring'

export type BottomSheetValue = 'hidden' | 'partial' | 'expanded'

const props = withDefaults(defineProps<{
  /** The sheet's state (v-model): `partial` shows `peekHeight` of it, `expanded` all of it, `hidden` none */
  modelValue?: BottomSheetValue
  /** Height in px the partially expanded sheet shows (BottomSheetDefaults.SheetPeekHeight) */
  peekHeight?: number
  /** Leaves out the hidden state, so the sheet can't be swiped away (Compose's default for this sheet) */
  skipHiddenState?: boolean
  /** Lets the sheet be dragged; with false it only moves through v-model and the handle */
  swipeEnabled?: boolean
  /** Maximum width in px; the sheet is centered when the screen is wider */
  maxWidth?: number
}>(), {
  modelValue: 'partial',
  peekHeight: 56,
  skipHiddenState: true,
  swipeEnabled: true,
  maxWidth: 640,
})

const emit = defineEmits<{ 'update:modelValue': [BottomSheetValue] }>()
const locale = useLocale()

const rootEl = ref<HTMLElement>()
const sheetEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()

// ── Anchors ──────────────────────────────────────────────────────────────────────────────────────
// The sheet's translateY: 0 when expanded, its height minus the peek when partially expanded, its height
// when hidden. As in StandardBottomSheet's draggableAnchors, the partial anchor exists only with a peek
// shorter than the sheet, and the hidden one only without skipHiddenState (or with no peek).
let sheetHeight = 0
function anchors(): Partial<Record<BottomSheetValue, number>> {
  const a: Partial<Record<BottomSheetValue, number>> = { expanded: 0 }
  if (props.peekHeight > 0 && props.peekHeight < sheetHeight) a.partial = sheetHeight - props.peekHeight
  if (!props.skipHiddenState || props.peekHeight <= 0) a.hidden = sheetHeight
  return a
}
// A state with no anchor falls back the way Compose's reconciliation does
function resolve(value: BottomSheetValue): BottomSheetValue {
  const a = anchors()
  if (a[value] !== undefined) return value
  if (value === 'hidden') return a.partial !== undefined ? 'partial' : 'expanded'
  if (value === 'partial') return a.expanded !== undefined ? 'expanded' : 'hidden'
  return a.hidden !== undefined ? 'hidden' : 'partial'
}

// `wanted` is the state asked for; `settled` is where it actually lands with the current anchors (they can
// lack it for a moment, e.g. while the sheet hasn't been measured yet)
let wanted: BottomSheetValue = props.modelValue
const settled = ref<BottomSheetValue>(props.modelValue)

// ── Motion ───────────────────────────────────────────────────────────────────────────────────────
// Drags, flings and handle taps settle on DefaultSpatial (anchoredDraggableMotionSpec); hiding through
// v-model uses FastEffects (hideMotionSpec), as Compose's SheetState does.
let y = 0
let vel = 0
let target: number | null = null
let spec: SpringSpec = DEFAULT_SPATIAL
let raf = 0
let last = 0

function write() {
  if (sheetEl.value) sheetEl.value.style.transform = `translateY(${y}px)`
  // The content scrolls only once the sheet is fully up; until then a drag on it moves the sheet
  if (contentEl.value) contentEl.value.style.overflowY = settled.value === 'expanded' && target === null ? 'auto' : 'hidden'
}

function frame(now: number) {
  if (target === null) return
  let dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const c = 2 * spec.dampingRatio * Math.sqrt(spec.stiffness)
  while (dt > 0) {
    const h = Math.min(dt, 0.004)
    dt -= h
    vel += (-spec.stiffness * (y - target) - c * vel) * h
    y += vel * h
  }
  if (Math.abs(y - target) < 0.5 && Math.abs(vel) < 1) {
    y = target
    vel = 0
    target = null
    raf = 0
    write()
    return
  }
  write()
  raf = requestAnimationFrame(frame)
}

function animateTo(value: BottomSheetValue, s: SpringSpec = DEFAULT_SPATIAL, velocity = vel) {
  wanted = value
  value = resolve(value)
  settled.value = value
  target = anchors()[value]!
  spec = s
  vel = velocity
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  write()
}

function settleTo(value: BottomSheetValue, velocity = vel) {
  animateTo(value, DEFAULT_SPATIAL, velocity)
  if (settled.value !== props.modelValue) emit('update:modelValue', settled.value)
}

watch(() => props.modelValue, (v) => {
  if (resolve(v) !== settled.value || target !== null) animateTo(v, v === 'hidden' ? FAST_EFFECTS : DEFAULT_SPATIAL)
})
watch(() => [props.peekHeight, props.skipHiddenState], () => measure())

// Layout changes (content added, window resized) keep the sheet on its state, without animating
function measure() {
  if (!sheetEl.value) return
  sheetHeight = sheetEl.value.offsetHeight
  const value = resolve(wanted)
  settled.value = value
  if (target !== null) target = anchors()[value]!
  else y = anchors()[value]!
  write()
}

// ── Dragging ─────────────────────────────────────────────────────────────────────────────────────
// AnchoredDraggable with BottomSheetDefaults' thresholds: released faster than 125px/s it goes to the next
// state that way, otherwise to the next one only when dragged 56px past the last state it crossed.
const POSITIONAL_THRESHOLD = 56
const VELOCITY_THRESHOLD = 125
let drag: { id: number; x: number; y: number; from: number; active: boolean; inContent: boolean; samples: { t: number; y: number }[] } | null = null
let suppressClick = false

function onPointerDown(e: PointerEvent) {
  if (!props.swipeEnabled || e.button !== 0) return
  const inContent = !!contentEl.value?.contains(e.target as Node)
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: y, active: false, inContent, samples: [{ t: e.timeStamp, y: e.clientY }] }
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dy = e.clientY - drag.y
  if (!drag.active) {
    if (Math.abs(dy) < 4 || Math.abs(dy) < Math.abs(e.clientX - drag.x)) {
      if (Math.abs(e.clientX - drag.x) > 8) drag = null
      return
    }
    // ConsumeSwipeWithinBottomSheetBoundsNestedScrollConnection: an expanded sheet's content scrolls first,
    // and the sheet only follows a downward drag once the content is back at its top
    const content = contentEl.value
    if (drag.inContent && settled.value === 'expanded' && content && content.scrollHeight > content.clientHeight
      && (dy < 0 || content.scrollTop > 0)) {
      drag = null
      return
    }
    drag.active = true
    drag.y = e.clientY
    drag.from = y
    cancelAnimationFrame(raf)
    raf = 0
    target = null
    vel = 0
    sheetEl.value?.setPointerCapture?.(e.pointerId)
  }
  const a = Object.values(anchors())
  y = Math.min(Math.max(...a), Math.max(Math.min(...a), drag.from + e.clientY - drag.y))
  write()
  drag.samples.push({ t: e.timeStamp, y: e.clientY })
  drag.samples = drag.samples.filter((p) => e.timeStamp - p.t < 100)
}

function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const d = drag
  drag = null
  if (!d.active) return
  suppressClick = true
  setTimeout(() => { suppressClick = false })
  const first = d.samples[0]!
  const lastSample = d.samples[d.samples.length - 1]!
  const dt = (lastSample.t - first.t) / 1000
  const velocity = dt > 0 && e.timeStamp - lastSample.t <= 40 ? (lastSample.y - first.y) / dt : 0
  settleTo(pickTarget(d.from, velocity), velocity)
}

function pickTarget(from: number, velocity: number): BottomSheetValue {
  const list = (Object.entries(anchors()) as [BottomSheetValue, number][]).sort((a, b) => a[1] - b[1])
  const down = Math.abs(velocity) > VELOCITY_THRESHOLD ? velocity > 0 : y >= from
  const ahead = down ? list.find(([, p]) => p > y) : [...list].reverse().find(([, p]) => p < y)
  const behind = down ? [...list].reverse().find(([, p]) => p <= y) : list.find(([, p]) => p >= y)
  if (!ahead) return behind![0]
  if (!behind) return ahead[0]
  if (Math.abs(velocity) > VELOCITY_THRESHOLD) return ahead[0]
  return Math.abs(y - behind[1]) >= POSITIONAL_THRESHOLD ? ahead[0] : behind[0]
}

// Once the sheet is following the finger the browser must not scroll the page or the content with it
function onTouchMove(e: TouchEvent) {
  if (drag?.active && e.cancelable) e.preventDefault()
}

function onClickCapture(e: MouseEvent) {
  if (!suppressClick) return
  e.preventDefault()
  e.stopPropagation()
}

// The handle: Expanded → partial (or hidden without a partial state), Partial → expanded, Hidden → shown
function onHandleClick() {
  const a = anchors()
  if (settled.value === 'expanded') settleTo(!props.skipHiddenState || a.partial === undefined ? 'hidden' : 'partial', 0)
  else settleTo('expanded', 0)
}
const handleLabel = computed(() => {
  if (settled.value !== 'expanded') return locale.sheetExpand
  return !props.skipHiddenState || props.peekHeight <= 0 ? locale.sheetDismiss : locale.sheetCollapse
})

let observer: ResizeObserver | null = null
onMounted(() => {
  measure()
  sheetEl.value?.addEventListener('touchmove', onTouchMove, { passive: false })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    if (sheetEl.value) observer.observe(sheetEl.value)
    if (rootEl.value) observer.observe(rootEl.value)
  }
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  sheetEl.value?.removeEventListener('touchmove', onTouchMove)
})
</script>

<template>
  <div ref="rootEl" class="relative flex h-full flex-col overflow-hidden bg-surface text-on-surface">
    <div v-if="$slots['top-bar']" class="shrink-0">
      <slot name="top-bar" />
    </div>
    <div class="min-h-0 flex-1 overflow-auto" :style="{ paddingBottom: `${peekHeight}px` }">
      <slot />
    </div>

    <!-- SheetBottomTokens: surface-container-low, 28dp top corners, elevation 1. The strip hanging below
         (after:) fills the gap a spring overshoot past the expanded state would open at the bottom. -->
    <div
      ref="sheetEl"
      role="region"
      class="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-h-full w-full touch-pan-y select-none flex-col rounded-t-[28px] bg-surface-container-low text-on-surface shadow-elevation-1 after:absolute after:inset-x-0 after:top-full after:h-24 after:bg-surface-container-low"
      :style="{ maxWidth: `${maxWidth}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
    >
      <!-- BottomSheetDefaults.DragHandle: 32×4dp in on-surface-variant, 22dp above and below -->
      <div class="flex h-12 shrink-0 justify-center">
        <button
          type="button"
          class="flex h-12 w-16 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          :aria-label="handleLabel"
          :aria-expanded="settled === 'expanded'"
          @click="onHandleClick"
        >
          <span class="h-1 w-8 rounded-full bg-on-surface-variant" />
        </button>
      </div>
      <!-- touch-action stops at a scroll container, so the content needs its own pan-y -->
      <div ref="contentEl" class="min-h-0 flex-1 touch-pan-y select-text overflow-y-hidden">
        <slot name="sheet" />
      </div>
    </div>
  </div>
</template>
