<script setup lang="ts">
/**
 * A small trend chart, drawn as SVG with no chart library: a line, an area or bars, for next to a number (a stat
 * card, a table cell, a list item). It fills its box (size it with classes; 96×28px by default), drawn at its real
 * size so dots and bars don't stretch. When the data changes the shape springs to the new values. Screen readers
 * get a summary (first, last, low, high) instead of the drawing. Not an M3 spec component.
 *
 * @event hover With `interactive`: the index of the point under the pointer, or null when it leaves
 */
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { useLocale } from '../composables/useLocale'
import { useSpring, DEFAULT_SPATIAL } from '../composables/_useSpring'

const props = withDefaults(
  defineProps<{
    /** The values, oldest first */
    data: number[]
    /** Line, line with a soft fill under it, or bars */
    type?: 'line' | 'area' | 'bar'
    /** An M3 color role (`primary`, `tertiary`, `error`...) or any CSS color */
    color?: string
    /** Smooth curve through the points (monotone: it never overshoots them) instead of straight segments */
    smooth?: boolean
    /** A dot on the last point (line and area) */
    showLast?: boolean
    /** Line width in px */
    strokeWidth?: number
    /** Fix the bottom of the scale (otherwise the lowest value, or 0 for bars) */
    min?: number
    /** Fix the top of the scale (otherwise the highest value) */
    max?: number
    /** A dashed reference line at this value (a target, yesterday's close) */
    baseline?: number
    /** Follow the pointer with a dot and emit `hover` with the index under it */
    interactive?: boolean
    /** Accessible name; defaults to a summary of the data in the app's language */
    label?: string
    /** Spring to new data; false (or reduced motion) jumps */
    animate?: boolean
  }>(),
  { type: 'line', color: 'primary', smooth: true, showLast: true, strokeWidth: 2, interactive: false, animate: true },
)

const emit = defineEmits<{ hover: [index: number | null] }>()

const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'success', 'on-surface', 'on-surface-variant', 'outline', 'inverse-primary'])
const stroke = computed(() => (ROLES.has(props.color) ? `var(--color-${props.color})` : props.color))

// Drawn at the box's real size (measured), so circles and bar corners stay round
const root = ref<HTMLElement>()
const width = ref(96)
const height = ref(28)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!root.value) return
  const measure = () => {
    width.value = Math.max(1, root.value!.clientWidth)
    height.value = Math.max(1, root.value!.clientHeight)
  }
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(root.value)
})
onUnmounted(() => observer?.disconnect())

const domain = computed(() => {
  const values = props.baseline === undefined ? props.data : [...props.data, props.baseline]
  let lo = props.min ?? (props.type === 'bar' ? Math.min(0, ...values) : Math.min(...values))
  let hi = props.max ?? Math.max(...values)
  if (!props.data.length) return { lo: 0, hi: 1 }
  if (hi === lo) {
    hi += 1
    lo -= props.type === 'bar' ? 0 : 1
  }
  return { lo, hi }
})
// Values as 0..1 of the scale; these are what spring when the data changes
const targets = computed(() => props.data.map((v) => (v - domain.value.lo) / (domain.value.hi - domain.value.lo)))
const shown = ref<number[]>([...targets.value])
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
// In thousandths: useSpring settles within 0.05 of the target, which on a 0..1 scale would cut the last 5% short
const { snap } = useSpring(() => targets.value.map((v) => v * 1000), (v) => (shown.value = v.map((n) => n / 1000)), DEFAULT_SPATIAL)
watch(targets, () => {
  if (!props.animate || reduceMotion()) snap()
})

const pad = computed(() => (props.type === 'bar' ? 0 : Math.max(props.strokeWidth, props.showLast || props.interactive ? props.strokeWidth * 2 + 1 : 0)))
const x = (i: number, n = shown.value.length) =>
  props.type === 'bar' ? ((i + 0.5) / n) * width.value : n < 2 ? width.value / 2 : pad.value + (i / (n - 1)) * (width.value - pad.value * 2)
const y = (t: number) => pad.value + (1 - t) * (height.value - pad.value * 2)
const points = computed(() => shown.value.map((t, i) => [x(i), y(t)] as const))

// Monotone cubic (Fritsch–Carlson): a smooth curve that never bulges past its points
function curve(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 2) return pts.length ? `M${pts[0]![0]},${pts[0]![1]}` : ''
  if (!props.smooth) return pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`).join('')
  const n = pts.length
  const dx = [], dy = [], m = [], tan: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]![0] - pts[i]![0])
    dy.push(pts[i + 1]![1] - pts[i]![1])
    m.push(dy[i]! / dx[i]!)
  }
  tan.push(m[0]!)
  for (let i = 1; i < n - 1; i++) tan.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2)
  tan.push(m[n - 2]!)
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tan[i] = 0
      tan[i + 1] = 0
      continue
    }
    const a = tan[i]! / m[i]!
    const b = tan[i + 1]! / m[i]!
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      tan[i] = k * a * m[i]!
      tan[i + 1] = k * b * m[i]!
    }
  }
  let d = `M${pts[0]![0].toFixed(2)},${pts[0]![1].toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!
    const [x1, y1] = pts[i + 1]!
    const c = dx[i]! / 3
    d += `C${(x0 + c).toFixed(2)},${(y0 + tan[i]! * c).toFixed(2)} ${(x1 - c).toFixed(2)},${(y1 - tan[i + 1]! * c).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`
  }
  return d
}

const linePath = computed(() => curve(points.value))
const areaPath = computed(() => {
  const pts = points.value
  if (pts.length < 2) return ''
  const bottom = height.value
  return `${linePath.value}L${pts[pts.length - 1]![0].toFixed(2)},${bottom}L${pts[0]![0].toFixed(2)},${bottom}Z`
})
const bars = computed(() => {
  const n = shown.value.length
  const slot = width.value / Math.max(1, n)
  const w = Math.max(1, slot * 0.68)
  const zero = y(Math.max(0, Math.min(1, -domain.value.lo / (domain.value.hi - domain.value.lo))))
  return shown.value.map((t, i) => {
    const top = y(t)
    return { x: i * slot + (slot - w) / 2, y: Math.min(top, zero), w, h: Math.max(1, Math.abs(zero - top)) }
  })
})
const baselineY = computed(() =>
  props.baseline === undefined ? undefined : y((props.baseline - domain.value.lo) / (domain.value.hi - domain.value.lo)),
)

// Hover
const hoverIndex = ref<number | null>(null)
function onMove(e: PointerEvent) {
  if (!props.interactive || !root.value || !props.data.length) return
  const r = root.value.getBoundingClientRect()
  const px = e.clientX - r.left
  let best = 0
  for (let i = 1; i < props.data.length; i++) if (Math.abs(x(i, props.data.length) - px) < Math.abs(x(best, props.data.length) - px)) best = i
  if (best !== hoverIndex.value) {
    hoverIndex.value = best
    emit('hover', best)
  }
}
function onLeave() {
  if (hoverIndex.value === null) return
  hoverIndex.value = null
  emit('hover', null)
}
const dotIndex = computed(() => hoverIndex.value ?? (props.showLast && props.type !== 'bar' ? shown.value.length - 1 : null))

const t = useLocale()
const summary = computed(() => {
  if (props.label) return props.label
  if (!props.data.length) return ''
  const fmt = new Intl.NumberFormat(t.lang, { maximumFractionDigits: 2 })
  return t.sparklineSummary
    .replace('{first}', fmt.format(props.data[0]!))
    .replace('{last}', fmt.format(props.data[props.data.length - 1]!))
    .replace('{min}', fmt.format(Math.min(...props.data)))
    .replace('{max}', fmt.format(Math.max(...props.data)))
})
const gradientId = `m3-spark-${useId()}`
</script>

<template>
  <span ref="root" class="m3-sparkline" role="img" :aria-label="summary" @pointermove="onMove" @pointerleave="onLeave">
    <svg :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" aria-hidden="true">
      <defs v-if="type === 'area'">
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="stroke" stop-opacity="0.32" />
          <stop offset="1" :stop-color="stroke" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line
        v-if="baselineY !== undefined"
        x1="0"
        :x2="width"
        :y1="baselineY"
        :y2="baselineY"
        stroke="var(--color-outline)"
        stroke-width="1"
        stroke-dasharray="3 3"
      />
      <template v-if="type === 'bar'">
        <rect
          v-for="(b, i) in bars"
          :key="i"
          :x="b.x"
          :y="b.y"
          :width="b.w"
          :height="b.h"
          :rx="Math.min(b.w / 2, 2)"
          :fill="stroke"
          :opacity="hoverIndex === null || hoverIndex === i ? 1 : 0.45"
        />
      </template>
      <template v-else>
        <path v-if="type === 'area'" :d="areaPath" :fill="`url(#${gradientId})`" />
        <path :d="linePath" fill="none" :stroke="stroke" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" />
        <circle
          v-if="dotIndex !== null && points[dotIndex]"
          :cx="points[dotIndex]![0]"
          :cy="points[dotIndex]![1]"
          :r="strokeWidth + 1"
          :fill="stroke"
          stroke="var(--color-surface)"
          :stroke-width="Math.max(1, strokeWidth / 2)"
        />
      </template>
    </svg>
  </span>
</template>

<style>
/* Defaults in the base layer so a size class on the component wins (see MShape). */
@layer base {
  .m3-sparkline {
    display: inline-block;
    width: 6rem;
    height: 1.75rem;
    vertical-align: middle;
  }
}
.m3-sparkline > svg {
  display: block;
  overflow: visible;
}
</style>
