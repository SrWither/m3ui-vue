<script lang="ts">
/** One period of an `MCandlestickChart`. */
export interface Candle {
  /** Start of the period (Date, ISO string or epoch ms) */
  time: Date | string | number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}
</script>

<script setup lang="ts">
/**
 * A candlestick (OHLC) chart for prices: stocks, crypto, commodities, an exchange rate. Drawn in plain SVG with no
 * chart library: candles, volume bars, moving averages, the last-price line and a crosshair with the candle's
 * open / high / low / close. Drag (or swipe) to pan through history, Ctrl + wheel (or a trackpad / two-finger
 * pinch) to zoom; the arrow keys move the crosshair. Appending candles keeps the chart pinned to the latest one
 * while it's in view, so it can be fed live.
 *
 * @slot legend Replaces the O/H/L/C legend. Slot props: `{ candle, change, changePercent }`
 * @event hover The candle under the crosshair, or null when it leaves
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Candles, oldest first */
    data: Candle[]
    /** Height in px */
    height?: number
    /** Volume bars under the candles (when the data has volume) */
    volume?: boolean
    /** Periods of simple moving averages to draw over the candles, e.g. [20, 50] */
    movingAverages?: number[]
    /** Candles visible at first (the latest ones) */
    visible?: number
    /** Color of rising candles (any CSS color) */
    upColor?: string
    /** Color of falling candles (any CSS color) */
    downColor?: string
    /** Decimals of prices */
    decimals?: number
    /** ISO 4217 code to format prices as money */
    currency?: string
    /** Draws the dashed line at the last close */
    lastPrice?: boolean
  }>(),
  {
    height: 320,
    volume: true,
    movingAverages: () => [],
    visible: 60,
    upColor: 'var(--color-success)',
    downColor: 'var(--color-error)',
    decimals: 2,
    lastPrice: true,
  },
)

const emit = defineEmits<{ hover: [Candle | null] }>()

const AXIS_W = 64
const AXIS_H = 24
const RIGHT_PAD = 3 // empty candle slots after the last one
const MA_COLORS = ['var(--color-tertiary)', 'var(--color-primary)', 'var(--color-secondary)']

const rootEl = ref<HTMLElement | null>(null)
const width = ref(600)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!rootEl.value) return
  width.value = rootEl.value.clientWidth || 600
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(([e]) => (width.value = e!.contentRect.width || width.value))
    ro.observe(rootEl.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

const plotW = computed(() => Math.max(50, width.value - AXIS_W))
const plotH = computed(() => props.height - AXIS_H)
const hasVolume = computed(() => props.volume && props.data.some((c) => c.volume !== undefined))
const priceH = computed(() => (hasVolume.value ? plotH.value * 0.78 : plotH.value))
const volTop = computed(() => plotH.value * 0.8)

// ── visible window: `count` slots ending at `right` (a fractional candle index) ──
const n = computed(() => props.data.length)
const count = ref(Math.max(5, props.visible))
const right = ref(n.value - 0.5 + RIGHT_PAD)

const minCount = 5
const maxCount = computed(() => Math.max(minCount, n.value + RIGHT_PAD * 2))

function clampView() {
  count.value = Math.min(maxCount.value, Math.max(minCount, count.value))
  const hi = n.value - 0.5 + RIGHT_PAD
  const lo = Math.min(hi, count.value - 0.5 - RIGHT_PAD)
  right.value = Math.min(hi, Math.max(lo, right.value))
}

// Live data: stay pinned to the latest candle when it was in view
watch(n, (now, before) => {
  if (right.value >= before - 0.5) right.value += now - before
  clampView()
})

const left = computed(() => right.value - count.value)
const cw = computed(() => plotW.value / count.value)
const x = (i: number) => (i + 0.5 - left.value) * cw.value

const range = computed(() => {
  const a = Math.max(0, Math.floor(left.value))
  const b = Math.min(n.value - 1, Math.ceil(right.value))
  return [a, b] as const
})
const visibleCandles = computed(() => {
  const [a, b] = range.value
  return props.data.slice(a, b + 1).map((c, k) => ({ c, i: a + k }))
})

const yDomain = computed(() => {
  let lo = Infinity
  let hi = -Infinity
  for (const { c } of visibleCandles.value) {
    lo = Math.min(lo, c.low)
    hi = Math.max(hi, c.high)
  }
  if (!isFinite(lo)) return [0, 1] as const
  if (lo === hi) return [lo - 1, hi + 1] as const
  const pad = (hi - lo) * 0.08
  return [lo - pad, hi + pad] as const
})
// A band at the top is kept free for the legend
const TOP = 24
const y = (p: number) => {
  const [lo, hi] = yDomain.value
  return priceH.value - ((p - lo) / (hi - lo)) * (priceH.value - TOP)
}
const maxVol = computed(() => Math.max(1, ...visibleCandles.value.map(({ c }) => c.volume ?? 0)))
const yVol = (v: number) => plotH.value - (v / maxVol.value) * (plotH.value - volTop.value)

// ── shapes, batched into one path per color ──
const shapes = computed(() => {
  const bodyW = Math.max(1, cw.value * 0.7)
  let up = ''
  let down = ''
  let volUp = ''
  let volDown = ''
  for (const { c, i } of visibleCandles.value) {
    const cx = Math.round(x(i)) + 0.5
    const yo = y(c.open)
    const yc = y(c.close)
    const top = Math.min(yo, yc)
    const h = Math.max(1, Math.abs(yo - yc))
    const wick = `M${cx} ${y(c.high)}V${y(c.low)}`
    const body = `M${cx - bodyW / 2} ${top}h${bodyW}v${h}h${-bodyW}Z`
    if (c.close >= c.open) up += wick + body
    else down += wick + body
    if (hasVolume.value && c.volume !== undefined) {
      const vb = `M${cx - bodyW / 2} ${yVol(c.volume)}H${cx + bodyW / 2}V${plotH.value}H${cx - bodyW / 2}Z`
      if (c.close >= c.open) volUp += vb
      else volDown += vb
    }
  }
  return { up, down, volUp, volDown }
})

/** Simple moving averages over the whole series, drawn for the visible part */
const maLines = computed(() =>
  props.movingAverages.map((period, k) => {
    const [a, b] = range.value
    let d = ''
    let sum = 0
    for (let i = 0; i < n.value && i <= b; i++) {
      sum += props.data[i]!.close
      if (i >= period) sum -= props.data[i - period]!.close
      if (i >= period - 1 && i >= a) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(sum / period).toFixed(1)}`
    }
    return { period, d, color: MA_COLORS[k % MA_COLORS.length]! }
  }),
)

// ── axes ──
function niceStep(span: number, target: number) {
  const raw = span / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
}
const priceTicks = computed(() => {
  const [lo, hi] = yDomain.value
  const step = niceStep(hi - lo, Math.max(2, Math.floor(priceH.value / 50)))
  const out: number[] = []
  // Labels too close to the edges would be cut
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) if (y(p) > 8 && y(p) < priceH.value - 4) out.push(p)
  return out
})

const priceFmt = computed(
  () =>
    new Intl.NumberFormat(locale.lang, {
      ...(props.currency ? { style: 'currency', currency: props.currency } : {}),
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
    }),
)
const price = (p: number) => priceFmt.value.format(p)
const compact = (v: number) => new Intl.NumberFormat(locale.lang, { notation: 'compact', maximumFractionDigits: 2 }).format(v)

const toMs = (t: Date | string | number) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t))

/** Median period length, to pick the time format */
const period = computed(() => {
  if (n.value < 2) return 86_400_000
  return Math.abs(toMs(props.data[Math.min(n.value - 1, 1)]!.time) - toMs(props.data[0]!.time))
})
const timeFmt = computed(() =>
  new Intl.DateTimeFormat(
    locale.lang,
    period.value < 86_400_000 ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' },
  ),
)
const fullTimeFmt = computed(() =>
  new Intl.DateTimeFormat(locale.lang, period.value < 86_400_000 ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }),
)

const timeTicks = computed(() => {
  const every = niceStep(90 / cw.value, 1)
  const step = Math.max(1, Math.round(every))
  const [a, b] = range.value
  const out: { i: number; label: string }[] = []
  for (let i = Math.ceil(a / step) * step; i <= b; i += step) out.push({ i, label: timeFmt.value.format(toMs(props.data[i]!.time)) })
  return out
})

const last = computed(() => props.data[n.value - 1])
const lastUp = computed(() => {
  const l = last.value
  const prev = props.data[n.value - 2]
  return l ? l.close >= (prev ? prev.close : l.open) : true
})

// ── crosshair ──
const hoverIdx = ref<number | null>(null)
const hoverY = ref<number | null>(null)
const shown = computed(() => (hoverIdx.value !== null ? props.data[hoverIdx.value] : last.value))
const shownIdx = computed(() => hoverIdx.value ?? n.value - 1)
const change = computed(() => {
  const c = shown.value
  if (!c) return 0
  const prev = props.data[shownIdx.value - 1]
  return c.close - (prev ? prev.close : c.open)
})
const changePercent = computed(() => {
  const c = shown.value
  if (!c) return 0
  const base = c.close - change.value
  return base ? (change.value / base) * 100 : 0
})

function priceAt(py: number) {
  const [lo, hi] = yDomain.value
  return lo + ((priceH.value - py) / (priceH.value - TOP)) * (hi - lo)
}

function setHover(i: number | null, py: number | null = null) {
  const clamped = i === null ? null : Math.max(0, Math.min(n.value - 1, i))
  if (clamped !== hoverIdx.value) emit('hover', clamped === null ? null : props.data[clamped]!)
  hoverIdx.value = clamped
  hoverY.value = py
}

function local(e: { clientX: number; clientY: number }) {
  const r = rootEl.value!.getBoundingClientRect()
  return { px: e.clientX - r.left, py: e.clientY - r.top }
}

// ── gestures ──
const pointers = new Map<number, { x: number; y: number }>()
let drag: { x: number; right: number } | null = null
let pinch: { dist: number; count: number; center: number } | null = null

function onPointerDown(e: PointerEvent) {
  if (e.button > 0) return
  const { px, py } = local(e)
  pointers.set(e.pointerId, { x: px, y: py })
  try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* synthetic */ }
  if (pointers.size === 1) {
    drag = { x: px, right: right.value }
    if (e.pointerType !== 'mouse') setHover(Math.round(px / cw.value + left.value - 0.5), py < priceH.value ? py : null)
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinch = { dist: Math.abs(a!.x - b!.x) || 1, count: count.value, center: (a!.x + b!.x) / 2 }
    drag = null
  }
}

function onPointerMove(e: PointerEvent) {
  const { px, py } = local(e)
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: px, y: py })
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    zoomAround(pinch.center, pinch.count * (pinch.dist / (Math.abs(a!.x - b!.x) || 1)))
    return
  }
  if (drag && pointers.has(e.pointerId)) {
    const moved = px - drag.x
    if (Math.abs(moved) > 3 || e.pointerType === 'mouse') {
      right.value = drag.right - moved / cw.value
      clampView()
    }
    if (e.pointerType !== 'mouse') return
  }
  if (px > plotW.value || py > plotH.value) return setHover(null)
  setHover(Math.round(px / cw.value + left.value - 0.5), py < priceH.value ? py : null)
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinch = null
  if (pointers.size === 0) drag = null
}

function zoomAround(px: number, nextCount: number) {
  const anchor = left.value + px / cw.value // candle index under px stays put
  const before = count.value
  count.value = nextCount
  clampView()
  if (count.value === before) return
  right.value = anchor + (plotW.value - px) / (plotW.value / count.value)
  clampView()
}

function onWheel(e: WheelEvent) {
  // Plain vertical wheel scrolls the page; Ctrl/⌘ + wheel (and trackpad pinch) zooms, horizontal wheel pans
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    zoomAround(local(e).px, count.value * Math.exp(e.deltaY * 0.01))
  } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault()
    right.value += e.deltaX / cw.value
    clampView()
  }
}

function onKeydown(e: KeyboardEvent) {
  const cur = hoverIdx.value ?? n.value - 1
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const next = Math.max(0, Math.min(n.value - 1, cur + (e.key === 'ArrowLeft' ? -1 : 1)))
    setHover(next)
    // Scroll the window to keep the crosshair in view
    if (next < left.value + 0.5) right.value = next - 0.5 + count.value
    else if (next > right.value - 0.5) right.value = next + 0.5
    clampView()
  } else if (e.key === '+' || e.key === '=') zoomAround(x(cur), count.value / 1.25)
  else if (e.key === '-') zoomAround(x(cur), count.value * 1.25)
  else if (e.key === 'Home') setHover(0)
  else if (e.key === 'End') setHover(n.value - 1)
  else if (e.key === 'Escape') setHover(null)
  else return
  e.preventDefault()
}

onMounted(() => rootEl.value?.addEventListener('wheel', onWheel, { passive: false }))
onBeforeUnmount(() => rootEl.value?.removeEventListener('wheel', onWheel))

const ariaLabel = computed(() => {
  const c = shown.value
  if (!c) return ''
  return `${fullTimeFmt.value.format(toMs(c.time))}: ${locale.chartOpen} ${price(c.open)}, ${locale.chartHigh} ${price(c.high)}, ${locale.chartLow} ${price(c.low)}, ${locale.chartClose} ${price(c.close)}`
})

defineExpose({
  /** Shows the latest candles again */
  reset() {
    count.value = Math.max(minCount, props.visible)
    right.value = n.value - 0.5 + RIGHT_PAD
    clampView()
  },
})
</script>

<template>
  <div
    ref="rootEl"
    class="m3-candles relative touch-pan-y select-none text-on-surface outline-none"
    :style="{ height: `${height}px` }"
    tabindex="0"
    role="img"
    :aria-label="ariaLabel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="(e) => e.pointerType === 'mouse' && setHover(null)"
    @keydown="onKeydown"
  >
    <svg :width="width" :height="height" class="block overflow-hidden" aria-hidden="true">
      <!-- grid -->
      <g class="text-outline-variant" stroke="currentColor" stroke-opacity="0.5">
        <line v-for="p in priceTicks" :key="p" x1="0" :x2="plotW" :y1="Math.round(y(p)) + 0.5" :y2="Math.round(y(p)) + 0.5" />
      </g>
      <line :x1="plotW + 0.5" :x2="plotW + 0.5" y1="0" :y2="plotH" class="text-outline-variant" stroke="currentColor" />
      <line x1="0" :x2="width" :y1="plotH + 0.5" :y2="plotH + 0.5" class="text-outline-variant" stroke="currentColor" />

      <svg :width="plotW" :height="plotH" class="overflow-hidden">
        <path v-if="shapes.volUp" :d="shapes.volUp" :fill="upColor" fill-opacity="0.3" />
        <path v-if="shapes.volDown" :d="shapes.volDown" :fill="downColor" fill-opacity="0.3" />
        <path :d="shapes.up" :fill="upColor" :stroke="upColor" stroke-width="1" data-candles="up" />
        <path :d="shapes.down" :fill="downColor" :stroke="downColor" stroke-width="1" data-candles="down" />
        <path v-for="m in maLines" :key="m.period" :d="m.d" fill="none" :stroke="m.color" stroke-width="1.5" :data-ma="m.period" />
        <line
          v-if="lastPrice && last"
          x1="0"
          :x2="plotW"
          :y1="y(last.close)"
          :y2="y(last.close)"
          :stroke="lastUp ? upColor : downColor"
          stroke-dasharray="3 3"
        />
        <!-- crosshair -->
        <g v-if="hoverIdx !== null" class="text-on-surface-variant" stroke="currentColor" stroke-dasharray="4 4" stroke-opacity="0.7">
          <line :x1="x(hoverIdx)" :x2="x(hoverIdx)" y1="0" :y2="plotH" />
          <line v-if="hoverY !== null" x1="0" :x2="plotW" :y1="hoverY" :y2="hoverY" />
        </g>
      </svg>

      <!-- price axis -->
      <g class="fill-on-surface-variant text-[11px] tabular-nums">
        <text v-for="p in priceTicks" :key="p" :x="plotW + 6" :y="y(p)" dominant-baseline="middle">{{ price(p) }}</text>
      </g>
      <g v-if="lastPrice && last">
        <rect :x="plotW + 1" :y="y(last.close) - 9" :width="AXIS_W - 1" height="18" rx="3" :fill="lastUp ? upColor : downColor" />
        <text :x="plotW + 6" :y="y(last.close)" dominant-baseline="middle" class="fill-white text-[11px] font-medium tabular-nums" data-last-price>{{ price(last.close) }}</text>
      </g>
      <g v-if="hoverY !== null">
        <rect :x="plotW + 1" :y="hoverY - 9" :width="AXIS_W - 1" height="18" rx="3" class="fill-inverse-surface" />
        <text :x="plotW + 6" :y="hoverY" dominant-baseline="middle" class="fill-inverse-on-surface text-[11px] tabular-nums">{{ price(priceAt(hoverY)) }}</text>
      </g>

      <!-- time axis -->
      <g class="fill-on-surface-variant text-[11px]">
        <text v-for="t in timeTicks" :key="t.i" :x="x(t.i)" :y="plotH + 16" text-anchor="middle">{{ t.label }}</text>
      </g>
      <g v-if="hoverIdx !== null">
        <rect :x="Math.min(plotW - 110, Math.max(0, x(hoverIdx) - 55))" :y="plotH + 2" width="110" height="20" rx="3" class="fill-inverse-surface" />
        <text :x="Math.min(plotW - 55, Math.max(55, x(hoverIdx)))" :y="plotH + 16" text-anchor="middle" class="fill-inverse-on-surface text-[11px]">{{ fullTimeFmt.format(toMs(data[hoverIdx]!.time)) }}</text>
      </g>
    </svg>

    <!-- legend -->
    <div class="pointer-events-none absolute left-2 top-1 flex flex-wrap items-baseline gap-x-3 text-label-medium tabular-nums" data-legend>
      <slot name="legend" :candle="shown" :change="change" :change-percent="changePercent">
        <template v-if="shown">
          <span><span class="text-on-surface-variant">{{ locale.chartOpen }}</span> {{ price(shown.open) }}</span>
          <span><span class="text-on-surface-variant">{{ locale.chartHigh }}</span> {{ price(shown.high) }}</span>
          <span><span class="text-on-surface-variant">{{ locale.chartLow }}</span> {{ price(shown.low) }}</span>
          <span><span class="text-on-surface-variant">{{ locale.chartClose }}</span> {{ price(shown.close) }}</span>
          <span :style="{ color: change >= 0 ? upColor : downColor }">{{ change >= 0 ? '+' : '' }}{{ changePercent.toFixed(2) }}%</span>
          <span v-if="hasVolume && shown.volume !== undefined"><span class="text-on-surface-variant">{{ locale.chartVolume }}</span> {{ compact(shown.volume) }}</span>
        </template>
      </slot>
      <span v-for="m in maLines" :key="m.period" :style="{ color: m.color }">MA {{ m.period }}</span>
    </div>
  </div>
</template>

<style>
.m3-candles:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
