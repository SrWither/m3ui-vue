<script lang="ts">
export interface SeekBarChapter {
  /** Where the chapter starts, in seconds */
  start: number
  /** Shown in the preview while the pointer is over it */
  title?: string
}
</script>

<script setup lang="ts">
/**
 * A media seek bar (not an M3 spec component; Media3's ProgressSlider is a plain M3 Slider, which this follows in
 * its default look): the playback position on a track with the buffered part, optional chapters, elapsed and
 * total (or remaining) time, and a preview of the time under the pointer. Dragging scrubs locally and seeks once
 * on release (or live, with `live`); a tap or click seeks to that point. While `playing`, it advances on its own
 * between `modelValue` updates, so a 4Hz `timeupdate` still moves it smoothly.
 *
 * @slot preview Replaces the bubble shown above the pointer while hovering or dragging (a frame preview, say).
 *   Props: `{ time, formatted, chapter }`
 * @event update:modelValue Emitted on a seek (and continuously while dragging with `live`) — powers v-model
 * @event seek Emitted once per seek with its time: on release of a drag, a tap or click, or a key press
 * @event scrub-start Emitted when a drag starts, with its time
 * @event scrub Emitted while dragging, with the time under the pointer
 * @event update:remaining Emitted when the end label is clicked to switch between total and remaining time
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  /** Playback position in seconds (v-model) */
  modelValue: number
  /** Media length in seconds; 0, NaN or Infinity (not loaded yet, a live stream) disables seeking */
  duration: number
  /** How much is loaded: up to a time, or time ranges (`[[start, end], …]`, like a media element's `buffered`) */
  buffered?: number | [number, number][]
  /** Chapter starts, drawn as gaps in the track; their titles show in the preview */
  chapters?: SeekBarChapter[]
  /** The media is playing: the bar moves on its own between updates, and the wavy line waves */
  playing?: boolean
  /** Playback speed, for that motion between updates */
  playbackRate?: number
  /** Updates the v-model continuously while dragging (the media follows the thumb), not only on release */
  live?: boolean
  /** `slider`: the M3 slider (bar thumb with a gap around it). `line`: a plain line with a round thumb. `wavy`: the played part waves while playing */
  variant?: 'slider' | 'line' | 'wavy'
  /** Track thickness: `md` (16px, the smallest M3 slider), `sm` (8px) or `xs` (4px, over a video) */
  size?: 'xs' | 'sm' | 'md'
  /** Where the elapsed and total time go */
  time?: 'below' | 'sides' | 'none'
  /** The end label shows the remaining time (`-1:23`) instead of the total; clicking it switches (v-model:remaining) */
  remaining?: boolean
  /** Formats a time in seconds. Default `m:ss`, or `h:mm:ss` for media an hour or longer */
  format?: (seconds: number) => string
  /** Seconds the arrow keys move; Page Up/Down move 10% */
  keyStep?: number
  /** Shows the time (and chapter) above the pointer while hovering or dragging */
  preview?: boolean
  /** Played part and thumb: an M3 role (`primary`, `secondary`, `tertiary`, `error`) or any CSS color */
  color?: string
  /** Unplayed track: an M3 role or any CSS color. Default secondary-container */
  trackColor?: string
  /** The time labels' color, as a CSS color (white over a video, say). Default on-surface-variant */
  timeColor?: string
  /** Disables seeking */
  disabled?: boolean
  /** Accessible name. Default the locale's `seekBar` */
  label?: string
}>(), {
  playing: false,
  playbackRate: 1,
  live: false,
  variant: 'slider',
  size: 'md',
  time: 'below',
  remaining: false,
  keyStep: 5,
  preview: true,
  color: 'primary',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [number]
  seek: [number]
  'scrub-start': [number]
  scrub: [number]
  'update:remaining': [boolean]
}>()

const locale = useLocale()

// track: thickness; thumbH: the bar thumb's height (md = MSlider xs, SliderTokens.HandleHeight); dot: the line
// variant's round thumb under the pointer, dotIdle at rest (the thinner the line, the more it grows, as a
// video player's does); gap: around the bar thumb; hit: the pointer target's height; wave/amp/length: the wavy line
const SIZES = {
  xs: { track: 4, thumbH: 16, dot: 21, dotIdle: 10, gap: 4, hit: 32, wave: 4, amp: 2.5, length: 18 },
  sm: { track: 8, thumbH: 28, dot: 20, dotIdle: 14, gap: 5, hit: 40, wave: 6, amp: 3, length: 22 },
  md: { track: 16, thumbH: 44, dot: 28, dotIdle: 21, gap: 6, hit: 46, wave: 8, amp: 4, length: 26 },
}
const s = computed(() => SIZES[props.size] ?? SIZES.md)

const dur = computed(() => (Number.isFinite(props.duration) && props.duration > 0 ? props.duration : 0))
const inactive = computed(() => props.disabled || !dur.value)

// ── Colors (as in MSlider: a role name or any CSS color; disabled per SliderTokens) ─────────────────────
const ROLES: Record<string, string> = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  tertiary: 'var(--color-tertiary)',
  error: 'var(--color-error)',
  'secondary-container': 'var(--color-secondary-container)',
}
const colors = computed(() => {
  if (props.disabled) {
    return {
      active: 'color-mix(in srgb, var(--color-on-surface) 38%, transparent)',
      inactive: 'color-mix(in srgb, var(--color-on-surface) 12%, transparent)',
      buffered: 'color-mix(in srgb, var(--color-on-surface) 20%, transparent)',
    }
  }
  const active = ROLES[props.color] ?? props.color
  const inactive = props.trackColor ? ROLES[props.trackColor] ?? props.trackColor : 'var(--color-secondary-container)'
  return { active, inactive, buffered: `color-mix(in srgb, ${active} 35%, ${inactive})` }
})

// ── Time ────────────────────────────────────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')
function fmt(t: number) {
  if (props.format) return props.format(t)
  const sec = Math.max(0, Math.floor(t))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return (dur.value >= 3600 ? `${h}:${pad(m)}` : String(h * 60 + m)) + ':' + pad(sec % 60)
}

// The shown position: the drag's while scrubbing, else `pos`, which follows modelValue and, while playing,
// advances on its own (only written when it moves half a pixel or crosses a second, so it re-renders rarely)
const scrubTime = ref<number | null>(null)
const pos = ref(props.modelValue)
const current = computed(() => Math.min(dur.value || Infinity, Math.max(0, scrubTime.value ?? pos.value)))

const showRemaining = ref(props.remaining)
watch(() => props.remaining, (v) => { showRemaining.value = v })
function toggleRemaining() {
  showRemaining.value = !showRemaining.value
  emit('update:remaining', showRemaining.value)
}
const timeStyle = computed(() => (props.timeColor ? { color: props.timeColor } : undefined))
const startText = computed(() => fmt(current.value))
const endText = computed(() => {
  if (!dur.value) return '--:--'
  return showRemaining.value ? `-${fmt(dur.value - current.value)}` : fmt(dur.value)
})
const valueText = computed(() =>
  locale.seekBarValue.replace('{position}', fmt(current.value)).replace('{duration}', dur.value ? fmt(dur.value) : '--:--'),
)

const chapterAt = (t: number) => {
  let found: SeekBarChapter | null = null
  for (const c of props.chapters ?? []) if (c.start <= t && (!found || c.start >= found.start)) found = c
  return found
}

// ── Geometry (px, from the measured track width) ────────────────────────────────────────────────────────
const trackEl = ref<HTMLElement>()
const width = ref(0)
const toPx = (t: number) => (dur.value ? (width.value * Math.min(1, Math.max(0, t / dur.value))) : 0)

// The bar thumb keeps clear of the track's ends, as MSlider's thumbInset; the round one may overhang them
const thumbX = computed(() => {
  const x = toPx(current.value)
  if (props.variant === 'line') return x
  const inset = Math.max(2, s.value.track * 0.3)
  return Math.min(width.value - inset, Math.max(inset, x))
})

const bufferedRanges = computed<[number, number][]>(() => {
  const b = props.buffered
  if (b === undefined) return []
  return typeof b === 'number' ? [[0, b]] : b
})

interface Piece { a: number; b: number; rl: number; rr: number; fills: { left: number; width: number; color: string }[] }

// The track is drawn as pieces between cuts: chapter boundaries, the gap around the bar thumb and, for the wavy
// line, everything before the thumb (drawn by the SVG). Outer ends get a full radius, cut ends a small one, as
// the M3 slider's segments.
const pieces = computed<Piece[]>(() => {
  const W = width.value
  if (!W) return []
  const { gap } = s.value
  const track = trackH.value
  const x = thumbX.value
  const chapterGap = props.size === 'md' ? 4 : 2
  const cuts: [number, number][] = []
  for (const c of props.chapters ?? []) {
    if (c.start <= 0 || c.start >= dur.value) continue
    const cx = toPx(c.start)
    cuts.push([cx - chapterGap / 2, cx + chapterGap / 2])
  }
  if (props.variant === 'slider') cuts.push([x - gap, x + gap])
  if (props.variant === 'wavy') cuts.push([-Infinity, x + gap])
  cuts.sort((p, q) => p[0] - q[0])
  const spans: [number, number][] = []
  let at = 0
  for (const [c0, c1] of cuts) {
    if (c0 > at) spans.push([at, Math.min(c0, W)])
    at = Math.max(at, c1)
  }
  if (at < W) spans.push([at, W])

  const full = track / 2
  const small = Math.min(full, Math.max(1, track / 8))
  const playedTo = props.variant === 'line' ? toPx(current.value) : x
  return spans.filter(([a, b]) => b - a >= 0.5).map(([a, b]) => {
    const fills: Piece['fills'] = []
    for (const [t0, t1] of bufferedRanges.value) {
      const l = Math.max(a, toPx(t0))
      const r = Math.min(b, toPx(t1))
      if (r > l) fills.push({ left: l - a, width: r - l, color: colors.value.buffered })
    }
    if (playedTo > a) fills.push({ left: 0, width: Math.min(b, playedTo) - a, color: colors.value.active })
    return { a, b, rl: a <= 0.01 ? full : small, rr: b >= W - 0.01 ? full : small, fills }
  })
})

// M3's stop indicator at the far end of a (md) slider track, while the thumb hasn't reached it
const stopDot = computed(() => props.variant === 'slider' && props.size === 'md' && thumbX.value < width.value - 12 - s.value.gap)

// ── Thumb ───────────────────────────────────────────────────────────────────────────────────────────────
const pressed = ref(false)
const focused = ref(false)
const hovered = ref(false)

// The line thickens under the pointer, as a video player's does
const trackH = computed(() => {
  const t = s.value.track
  return props.variant === 'line' && !inactive.value && (hovered.value || pressed.value) ? t + Math.max(2, t / 4) : t
})
const thumbStyle = computed(() => {
  const base = { left: `${thumbX.value}px`, backgroundColor: colors.value.active }
  if (props.variant === 'line') {
    const { dot: d, dotIdle } = s.value
    const scale = pressed.value || hovered.value || focused.value ? 1 : dotIdle / d
    return { ...base, width: `${d}px`, height: `${d}px`, borderRadius: '50%', transform: `translate(-50%, -50%) scale(${scale})` }
  }
  // Pinches to half its width while pressed or focused, as MSlider (SliderTokens.PressedHandleWidth)
  const narrow = pressed.value || focused.value ? 0.5 : 1
  return { ...base, width: '4px', height: `${s.value.thumbH}px`, borderRadius: '2px', transform: `translate(-50%, -50%) scaleX(${narrow})` }
})

// ── Preview bubble ──────────────────────────────────────────────────────────────────────────────────────
const hoverTime = ref<number | null>(null)
const previewTime = computed(() => (props.preview && !inactive.value ? scrubTime.value ?? hoverTime.value : null))
const previewChapter = computed(() => (previewTime.value === null ? null : chapterAt(previewTime.value)))
const bubbleEl = ref<HTMLElement>()
const bubbleW = ref(0)
let bubbleObserver: ResizeObserver | null = null
watch(bubbleEl, (el) => {
  bubbleObserver?.disconnect()
  if (!el || typeof ResizeObserver === 'undefined') return
  bubbleW.value = el.offsetWidth
  bubbleObserver = new ResizeObserver(() => { bubbleW.value = el.offsetWidth })
  bubbleObserver.observe(el)
})
// Centered over the time, but kept within the track
const previewX = computed(() => {
  const x = previewTime.value === null ? 0 : toPx(previewTime.value)
  const half = bubbleW.value / 2
  return half * 2 >= width.value ? width.value / 2 : Math.min(width.value - half, Math.max(half, x))
})

// ── Pointer: mouse/pen scrub from the press; a touch waits to see a horizontal move (touch-action pan-y leaves a
// vertical one to the page), and a touch that doesn't move is a tap that seeks there ────────────────────────
let press: { id: number; x: number; y: number; touch: boolean; started: boolean } | null = null

function timeAt(clientX: number) {
  const el = trackEl.value
  if (!el || !dur.value) return 0
  const r = el.getBoundingClientRect()
  return (Math.min(1, Math.max(0, (clientX - r.left) / (r.width || 1)))) * dur.value
}

function scrubTo(t: number) {
  scrubTime.value = t
  emit('scrub', t)
  if (props.live) emit('update:modelValue', t)
}

function begin(e: PointerEvent) {
  if (!press) return
  press.started = true
  pressed.value = true
  const t = timeAt(e.clientX)
  emit('scrub-start', t)
  scrubTo(t)
}

function commit(t: number) {
  emit('update:modelValue', t)
  emit('seek', t)
  // Show it at once; a later modelValue resyncs
  pos.value = t
  base = t
  baseAt = now()
}

function onPointerDown(e: PointerEvent) {
  if (inactive.value || e.button !== 0) return
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', started: false }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  if (!press.touch) {
    e.preventDefault()
    trackEl.value?.focus({ preventScroll: true })
    begin(e)
  }
}

function onPointerMove(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  if (!press.started) {
    const dx = Math.abs(e.clientX - press.x)
    const dy = Math.abs(e.clientY - press.y)
    if (dy > 8 && dy > dx) return end()
    if (dx < 4) return
    begin(e)
  }
  scrubTo(timeAt(e.clientX))
}

function onPointerUp(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  const t = press.started ? scrubTime.value ?? timeAt(e.clientX) : timeAt(e.clientX)
  end()
  commit(t)
}

// The browser took the touch (a scroll): a drag in progress still lands where it was
function onPointerCancel(e: PointerEvent) {
  if (!press || e.pointerId !== press.id) return
  const t = press.started ? scrubTime.value : null
  end()
  if (t !== null) commit(t)
}

function end() {
  press = null
  pressed.value = false
  scrubTime.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function onHover(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  hovered.value = true
  hoverTime.value = timeAt(e.clientX)
}
function onLeave() {
  hovered.value = false
  hoverTime.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (inactive.value) return
  const d = dur.value
  const steps: Record<string, number> = {
    ArrowRight: props.keyStep, ArrowUp: props.keyStep, ArrowLeft: -props.keyStep, ArrowDown: -props.keyStep,
    PageUp: d / 10, PageDown: -d / 10,
  }
  let t: number | null = null
  if (e.key in steps) t = current.value + steps[e.key]!
  else if (e.key === 'Home') t = 0
  else if (e.key === 'End') t = d
  if (t === null) return
  e.preventDefault()
  commit(Math.min(d, Math.max(0, t)))
}

// ── Motion between updates, and the wave (a rAF loop, only while either needs frames) ───────────────────
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)
let base = props.modelValue
let baseAt = now()
let raf = 0
let last = 0
let amp = 0
let phase = 0
const wavePathEl = ref<SVGPathElement>()
const svgH = computed(() => s.value.wave + 2 * s.value.amp + 2)
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ampTarget = () => (props.variant === 'wavy' && props.playing && scrubTime.value === null ? s.value.amp : 0)
amp = ampTarget()

function advancing() {
  return props.playing && scrubTime.value === null && !!dur.value
}

function syncPos(t: number) {
  const W = width.value
  const d = dur.value
  if (Math.floor(t) !== Math.floor(pos.value) || (d && (Math.abs(t - pos.value) * W) / d >= 0.5)) pos.value = t
}

function drawWave() {
  const path = wavePathEl.value
  if (!path) return
  const { wave, length, gap } = s.value
  const half = wave / 2
  const end = thumbX.value - gap - half
  if (end <= half) return path.setAttribute('d', '')
  const mid = svgH.value / 2
  const k = (2 * Math.PI) / length
  let d = ''
  for (let x = half; ; x += 2) {
    const px = Math.min(x, end)
    d += `${d ? 'L' : 'M'}${px.toFixed(1)},${(mid + amp * Math.sin(k * px + phase)).toFixed(2)}`
    if (px >= end) break
  }
  path.setAttribute('d', d)
}

function frame(t: number) {
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 0
  last = t
  if (advancing()) syncPos(Math.min(dur.value, base + ((t - baseAt) / 1000) * props.playbackRate))
  if (props.variant === 'wavy') {
    amp += (ampTarget() - amp) * (1 - Math.exp(-dt / 0.12))
    if (Math.abs(ampTarget() - amp) < 0.01) amp = ampTarget()
    // The wave travels with the playback, one length every 1.25s
    if (props.playing && !reducedMotion) phase -= (dt * 2 * Math.PI) / 1.25
    drawWave()
  }
  if (advancing() || (props.variant === 'wavy' && (amp !== ampTarget() || (props.playing && !reducedMotion)))) {
    raf = requestAnimationFrame(frame)
  } else {
    raf = 0
    last = 0
  }
}

function kick() {
  if (raf || typeof requestAnimationFrame === 'undefined') return
  raf = requestAnimationFrame(frame)
}

watch(() => props.modelValue, (v) => {
  base = v
  baseAt = now()
  pos.value = v
  kick()
})
watch(() => props.playing, () => {
  base = pos.value
  baseAt = now()
  kick()
})
watch(scrubTime, (v) => {
  if (v === null) {
    base = pos.value
    baseAt = now()
  }
  kick()
})
// Paused, the (flat) wave still follows the thumb
watch([thumbX, () => props.variant, () => props.size], () => {
  if (props.variant === 'wavy') drawWave()
}, { flush: 'post' })

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  const el = trackEl.value!
  width.value = el.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => { width.value = el.clientWidth })
    resizeObserver.observe(el)
  }
  drawWave()
  kick()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  bubbleObserver?.disconnect()
  end()
})
</script>

<template>
  <div class="flex min-w-0 select-none" :class="time === 'sides' ? 'items-center gap-3' : 'flex-col'">
    <span v-if="time === 'sides'" class="min-w-[4ch] shrink-0 text-right text-label-medium tabular-nums" :class="!timeColor && 'text-on-surface-variant'" :style="timeStyle">{{ startText }}</span>

    <div
      ref="trackEl"
      role="slider"
      :tabindex="inactive ? -1 : 0"
      :aria-label="label ?? locale.seekBar"
      aria-valuemin="0"
      :aria-valuemax="Math.round(dur)"
      :aria-valuenow="Math.round(current)"
      :aria-valuetext="valueText"
      :aria-disabled="inactive || undefined"
      class="group relative min-w-0 shrink-0 touch-pan-y outline-none"
      :class="[inactive ? 'cursor-default' : 'cursor-pointer', time === 'sides' && 'flex-1']"
      :style="{ height: `${s.hit}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onHover"
      @pointerleave="onLeave"
      @keydown="onKeyDown"
      @focus="focused = true"
      @blur="focused = false"
    >
      <!-- A grace zone past the hit area (mostly above, where the preview opens), so the pointer doesn't have to
           land exactly on a thin line: its events reach the track like the track's own -->
      <div v-if="!inactive" class="absolute inset-x-0 -top-3 -bottom-1" />
      <div
        v-for="(p, i) in pieces"
        :key="i"
        class="absolute top-1/2 -translate-y-1/2 overflow-hidden transition-[height] duration-100"
        :style="{
          left: `${p.a}px`, width: `${p.b - p.a}px`, height: `${trackH}px`,
          borderRadius: `${p.rl}px ${p.rr}px ${p.rr}px ${p.rl}px`, backgroundColor: colors.inactive,
        }"
      >
        <div
          v-for="(f, j) in p.fills"
          :key="j"
          class="absolute inset-y-0"
          :style="{ left: `${f.left}px`, width: `${f.width}px`, backgroundColor: f.color }"
        />
      </div>

      <svg
        v-if="variant === 'wavy'"
        class="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 overflow-visible"
        :width="width"
        :height="svgH"
        aria-hidden="true"
      >
        <path ref="wavePathEl" fill="none" :stroke="colors.active" :stroke-width="s.wave" stroke-linecap="round" />
      </svg>

      <div
        v-if="stopDot"
        class="pointer-events-none absolute top-1/2 right-3 size-1 -translate-y-1/2 rounded-full"
        :style="{ backgroundColor: colors.active }"
      />

      <div
        class="pointer-events-none absolute top-1/2 transition-transform duration-75 group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface"
        :style="thumbStyle"
      />

      <div
        v-if="previewTime !== null"
        ref="bubbleEl"
        class="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2"
        :style="{ left: `${previewX}px` }"
      >
        <slot name="preview" :time="previewTime" :formatted="fmt(previewTime)" :chapter="previewChapter">
          <div class="flex h-7 max-w-60 items-center gap-1 rounded-full bg-inverse-surface px-2.5 text-label-medium whitespace-nowrap text-inverse-on-surface tabular-nums">
            <span v-if="previewChapter?.title" class="truncate">{{ previewChapter.title }} ·</span>
            <span>{{ fmt(previewTime) }}</span>
          </div>
        </slot>
      </div>
    </div>

    <div v-if="time === 'below'" class="flex items-center justify-between text-label-medium tabular-nums" :class="!timeColor && 'text-on-surface-variant'" :style="timeStyle">
      <span>{{ startText }}</span>
      <button
        type="button"
        class="cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        :aria-label="showRemaining ? locale.seekBarShowDuration : locale.seekBarShowRemaining"
        @click="toggleRemaining"
      >{{ endText }}</button>
    </div>
    <button
      v-else-if="time === 'sides'"
      type="button"
      class="min-w-[4ch] shrink-0 cursor-pointer rounded-sm text-left text-label-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      :class="!timeColor && 'text-on-surface-variant'"
      :style="timeStyle"
      :aria-label="showRemaining ? locale.seekBarShowDuration : locale.seekBarShowRemaining"
      @click="toggleRemaining"
    >{{ endText }}</button>
  </div>
</template>
