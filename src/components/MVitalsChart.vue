<script lang="ts">
/** One reading of a vital sign. A pair is a range reading such as blood pressure: `[systolic, diastolic]`. */
export interface VitalReading {
  time: Date | string | number
  value: number | [number, number]
}

/** A vital sign: its readings, unit and normal range. */
export interface VitalSeries {
  key: string
  label: string
  unit?: string
  /** Line / point color (any CSS color). Defaults to the primary color */
  color?: string
  decimals?: number
  /**
   * Normal range, drawn as a band. For pair readings give one range per value:
   * `[[90, 120], [60, 80]]` for systolic and diastolic
   */
  normal?: [number, number] | [[number, number], [number, number]]
  /** Fixed axis range; by default it fits the readings and the normal band */
  domain?: [number, number]
  data: VitalReading[]
}
</script>

<script setup lang="ts">
/**
 * A vitals flowsheet: one row per vital sign (heart rate, blood pressure, SpO₂, temperature, respiratory rate…)
 * over a shared time axis, each with its normal range as a band, readings outside it in the error color, and the
 * latest value (with a High / Low tag) beside the row. Blood pressure and other pair readings are drawn as bars from
 * the lower to the upper value. Hovering (or the arrow keys) moves a crosshair across every row at once.
 *
 * @slot label Replaces a row's label column. Slot props: `{ series, reading, status }`
 * @event hover The time under the crosshair (epoch ms), or null when it leaves
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    series: VitalSeries[]
    /** Height of each row's plot, in px */
    rowHeight?: number
    /** Start of the time axis (defaults to the first reading) */
    from?: Date | string | number
    /** End of the time axis (defaults to the last reading) */
    to?: Date | string | number
  }>(),
  { rowHeight: 64 },
)

const emit = defineEmits<{ hover: [number | null] }>()

const toMs = (t: Date | string | number) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t))

const rootEl = ref<HTMLElement | null>(null)
const width = ref(640)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!rootEl.value) return
  width.value = rootEl.value.clientWidth || 640
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(([e]) => (width.value = e!.contentRect.width || width.value))
    ro.observe(rootEl.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

const narrow = computed(() => width.value < 480)
const LABEL_W = computed(() => (narrow.value ? 0 : Math.min(150, Math.round(width.value * 0.3))))
const PAD = 8
const plotW = computed(() => Math.max(60, width.value - LABEL_W.value - PAD * 2))

const sorted = computed(() =>
  props.series.map((s) => ({ ...s, data: [...s.data].sort((a, b) => toMs(a.time) - toMs(b.time)) })),
)

const times = computed(() => {
  const set = new Set<number>()
  for (const s of sorted.value) for (const r of s.data) set.add(toMs(r.time))
  return [...set].sort((a, b) => a - b)
})
const t0 = computed(() => (props.from !== undefined ? toMs(props.from) : times.value[0] ?? 0))
const t1 = computed(() => {
  const end = props.to !== undefined ? toMs(props.to) : times.value.at(-1) ?? 1
  return end === t0.value ? end + 1 : end
})
const x = (t: number) => PAD + ((t - t0.value) / (t1.value - t0.value)) * plotW.value

const ranges = (s: VitalSeries): [number, number][] => {
  if (!s.normal) return []
  return Array.isArray(s.normal[0]) ? (s.normal as [[number, number], [number, number]]) : [s.normal as [number, number]]
}

function domainOf(s: VitalSeries): [number, number] {
  if (s.domain) return s.domain
  let lo = Infinity
  let hi = -Infinity
  for (const r of s.data) for (const v of Array.isArray(r.value) ? r.value : [r.value]) {
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  for (const [a, b] of ranges(s)) {
    lo = Math.min(lo, a)
    hi = Math.max(hi, b)
  }
  if (!isFinite(lo)) return [0, 1]
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12
  return [lo - pad, hi + pad]
}

function yFor(s: VitalSeries) {
  const [lo, hi] = domainOf(s)
  const h = props.rowHeight
  return (v: number) => 4 + (1 - (v - lo) / (hi - lo)) * (h - 8)
}

/** 'high' | 'low' | 'normal' for a reading against the series' normal range(s) */
function statusOf(s: VitalSeries, r: VitalReading | undefined): 'high' | 'low' | 'normal' {
  if (!r) return 'normal'
  const rs = ranges(s)
  const vals = Array.isArray(r.value) ? r.value : [r.value]
  let st: 'high' | 'low' | 'normal' = 'normal'
  vals.forEach((v, i) => {
    const range = rs[Math.min(i, rs.length - 1)]
    if (!range) return
    if (v > range[1]) st = 'high'
    else if (v < range[0] && st !== 'high') st = 'low'
  })
  return st
}

function fmt(s: VitalSeries, v: number | [number, number]) {
  const f = new Intl.NumberFormat(locale.lang, { maximumFractionDigits: s.decimals ?? 0, minimumFractionDigits: s.decimals ?? 0 })
  return Array.isArray(v) ? `${f.format(v[0])}/${f.format(v[1])}` : f.format(v)
}

const rows = computed(() =>
  sorted.value.map((s) => {
    const y = yFor(s)
    const color = s.color ?? 'var(--color-primary)'
    const pair = s.data.some((r) => Array.isArray(r.value))
    const bands = ranges(s).map(([a, b]) => ({ y: y(b), h: Math.max(1, y(a) - y(b)) }))
    const lines: string[] = []
    if (pair) {
      for (const k of [0, 1]) lines.push(s.data.map((r, i) => `${i ? 'L' : 'M'}${x(toMs(r.time)).toFixed(1)} ${y((r.value as [number, number])[k]!).toFixed(1)}`).join(''))
    } else {
      lines.push(s.data.map((r, i) => `${i ? 'L' : 'M'}${x(toMs(r.time)).toFixed(1)} ${y(r.value as number).toFixed(1)}`).join(''))
    }
    const points = s.data.map((r) => {
      const t = toMs(r.time)
      const out = statusOf(s, r) !== 'normal'
      return Array.isArray(r.value)
        ? { t, x: x(t), y1: y(r.value[0]), y2: y(r.value[1]), out }
        : { t, x: x(t), y: y(r.value), out }
    })
    return { s, color, bands, lines, points, pair }
  }),
)

// ── crosshair ──
const hoverT = ref<number | null>(null)
function readingAt(s: VitalSeries, t: number | null): VitalReading | undefined {
  if (t === null) return s.data.at(-1)
  // the latest reading at or before the hovered time
  let best: VitalReading | undefined
  for (const r of s.data) if (toMs(r.time) <= t) best = r
  return best
}
function nearestTime(px: number) {
  const t = t0.value + ((px - PAD) / plotW.value) * (t1.value - t0.value)
  let best = times.value[0] ?? null
  for (const tt of times.value) if (Math.abs(tt - t) < Math.abs((best ?? 0) - t)) best = tt
  return best
}
function setHover(t: number | null) {
  if (t !== hoverT.value) emit('hover', t)
  hoverT.value = t
}
function onPointerMove(e: PointerEvent) {
  const svg = (e.currentTarget as Element).getBoundingClientRect()
  setHover(nearestTime(e.clientX - svg.left))
}
function onKeydown(e: KeyboardEvent) {
  if (!times.value.length) return
  const i = hoverT.value === null ? times.value.length : times.value.indexOf(hoverT.value)
  if (e.key === 'ArrowLeft') setHover(times.value[Math.max(0, i - 1)]!)
  else if (e.key === 'ArrowRight') setHover(times.value[Math.min(times.value.length - 1, i + 1)]!)
  else if (e.key === 'Escape') setHover(null)
  else return
  e.preventDefault()
}

// ── time axis ──
const spanMs = computed(() => t1.value - t0.value)
const tickFmt = computed(() =>
  new Intl.DateTimeFormat(locale.lang, spanMs.value <= 2 * 86_400_000 ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }),
)
const fullFmt = computed(() => new Intl.DateTimeFormat(locale.lang, { dateStyle: 'medium', timeStyle: 'short' }))
const ticks = computed(() => {
  const n = Math.max(2, Math.floor(plotW.value / 90))
  return Array.from({ length: n + 1 }, (_, i) => t0.value + (spanMs.value * i) / n)
})
</script>

<template>
  <div
    ref="rootEl"
    class="m3-vitals text-on-surface outline-none"
    tabindex="0"
    @keydown="onKeydown"
  >
    <p v-if="!times.length" class="py-6 text-center text-body-medium text-on-surface-variant">{{ locale.vitalsNoData }}</p>
    <template v-else>
      <div
        v-for="row in rows"
        :key="row.s.key"
        class="flex border-b border-outline-variant"
        :class="narrow ? 'flex-col pt-2' : 'items-center'"
        :data-vital="row.s.key"
      >
        <div class="shrink-0 pe-2" :style="narrow ? undefined : { width: `${LABEL_W}px` }">
          <slot name="label" :series="row.s" :reading="readingAt(row.s, hoverT)" :status="statusOf(row.s, readingAt(row.s, hoverT))">
            <div class="flex items-baseline gap-2" :class="narrow ? '' : 'flex-col gap-0'">
              <span class="text-label-large text-on-surface-variant">{{ row.s.label }}</span>
              <span v-if="readingAt(row.s, hoverT)" class="flex items-baseline gap-1">
                <span
                  class="text-title-large font-medium tabular-nums"
                  :class="statusOf(row.s, readingAt(row.s, hoverT)) !== 'normal' ? 'text-error' : ''"
                  data-value
                >{{ fmt(row.s, readingAt(row.s, hoverT)!.value) }}</span>
                <span v-if="row.s.unit" class="text-body-small text-on-surface-variant">{{ row.s.unit }}</span>
                <span
                  v-if="statusOf(row.s, readingAt(row.s, hoverT)) !== 'normal'"
                  class="rounded-xs bg-error-container px-1 text-label-small font-medium text-on-error-container"
                  data-status
                >{{ statusOf(row.s, readingAt(row.s, hoverT)) === 'high' ? locale.vitalsHigh : locale.vitalsLow }}</span>
              </span>
            </div>
          </slot>
        </div>
        <svg
          :width="plotW + PAD * 2"
          :height="rowHeight"
          class="block shrink-0 touch-pan-y"
          aria-hidden="true"
          @pointermove="onPointerMove"
          @pointerdown="onPointerMove"
          @pointerleave="(e) => e.pointerType === 'mouse' && setHover(null)"
        >
          <rect v-for="(b, i) in row.bands" :key="i" :x="PAD" :y="b.y" :width="plotW" :height="b.h" class="fill-success" fill-opacity="0.12" data-band />
          <path v-for="(d, i) in row.lines" :key="i" :d="d" fill="none" :stroke="row.color" stroke-width="1.5" :stroke-opacity="row.pair ? 0.5 : 1" />
          <template v-for="p in row.points" :key="p.t">
            <g v-if="'y1' in p">
              <line :x1="p.x" :x2="p.x" :y1="p.y1" :y2="p.y2" :stroke="p.out ? 'var(--color-error)' : row.color" stroke-width="3" stroke-linecap="round" />
              <line :x1="p.x - 4" :x2="p.x + 4" :y1="p.y1" :y2="p.y1" :stroke="p.out ? 'var(--color-error)' : row.color" stroke-width="2" />
              <line :x1="p.x - 4" :x2="p.x + 4" :y1="p.y2" :y2="p.y2" :stroke="p.out ? 'var(--color-error)' : row.color" stroke-width="2" />
            </g>
            <circle
              v-else
              :cx="p.x"
              :cy="p.y"
              :r="p.t === hoverT ? 5 : 3.5"
              :fill="p.out ? 'var(--color-error)' : row.color"
              class="stroke-surface"
              stroke-width="1.5"
              :data-out="p.out || undefined"
            />
          </template>
          <line v-if="hoverT !== null" :x1="x(hoverT)" :x2="x(hoverT)" y1="0" :y2="rowHeight" class="stroke-on-surface-variant" stroke-dasharray="3 3" />
        </svg>
      </div>

      <div class="flex" :style="narrow ? undefined : { paddingInlineStart: `${LABEL_W}px` }">
        <svg :width="plotW + PAD * 2" height="22" class="block" aria-hidden="true">
          <text
            v-for="(t, i) in ticks"
            :key="t"
            :x="x(t)"
            y="15"
            :text-anchor="i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'"
            class="fill-on-surface-variant text-[11px]"
          >{{ tickFmt.format(t) }}</text>
        </svg>
      </div>
      <p class="mt-1 flex min-h-5 items-center gap-3 text-body-small text-on-surface-variant">
        <span class="flex items-center gap-1"><span class="h-2.5 w-4 rounded-[2px] bg-success/20" />{{ locale.vitalsNormal }}</span>
        <span v-if="hoverT !== null" class="ms-auto tabular-nums" data-hover-time>{{ fullFmt.format(hoverT) }}</span>
      </p>
    </template>
  </div>
</template>

<style>
.m3-vitals:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
