<script lang="ts">
/** A price level of an `MOrderBook`: `[price, size]`. */
export type OrderBookLevel = [price: number, size: number]
</script>

<script setup lang="ts">
/**
 * A live order book (market depth) for an exchange or trading screen: asks above, bids below (or side by side),
 * each level with its size, the running total and a depth bar, and the last price and spread in the middle. Levels
 * whose size changes flash; `step` groups levels into coarser price buckets. Clicking a level emits it, e.g. to
 * fill an order form's price.
 *
 * @slot middle Replaces the last price / spread row. Slot props: `{ lastPrice, direction, spread, spreadPercent }`
 * @event select A level was clicked: `{ price, size, side }`
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Buy orders, `[price, size]`, any order */
    bids: OrderBookLevel[]
    /** Sell orders, `[price, size]`, any order */
    asks: OrderBookLevel[]
    /** Levels shown per side */
    levels?: number
    /** Groups prices into buckets of this size (bids round down, asks round up) */
    step?: number
    /** Decimals of prices. Defaults to the decimals of `step`, or 2 */
    decimals?: number
    /** Decimals of sizes */
    sizeDecimals?: number
    /** Last traded price, shown between the sides; its arrow follows the previous value */
    lastPrice?: number
    /** Asks above bids, or bids and asks side by side */
    layout?: 'stacked' | 'split'
    /** Flashes levels whose size changed */
    flash?: boolean
    /** Color of bids (any CSS color) */
    bidColor?: string
    /** Color of asks (any CSS color) */
    askColor?: string
  }>(),
  {
    levels: 10,
    sizeDecimals: 4,
    layout: 'stacked',
    flash: true,
    bidColor: 'var(--color-success)',
    askColor: 'var(--color-error)',
  },
)

const emit = defineEmits<{ select: [{ price: number; size: number; side: 'bid' | 'ask' }] }>()

const priceDecimals = computed(() => {
  if (props.decimals !== undefined) return props.decimals
  if (props.step !== undefined) {
    const s = String(props.step)
    return s.includes('.') ? s.split('.')[1]!.length : 0
  }
  return 2
})

function bucket(p: number, side: 'bid' | 'ask') {
  if (!props.step) return p
  const k = p / props.step
  // Nudge away float noise (0.3 / 0.1 = 2.9999999999999996) before rounding
  const r = side === 'bid' ? Math.floor(k + 1e-9) : Math.ceil(k - 1e-9)
  return Number((r * props.step).toFixed(priceDecimals.value))
}

interface Row { price: number; size: number; total: number }

function build(levels: OrderBookLevel[], side: 'bid' | 'ask'): Row[] {
  const map = new Map<number, number>()
  for (const [p, s] of levels) {
    if (!(s > 0)) continue
    const b = bucket(p, side)
    map.set(b, (map.get(b) ?? 0) + s)
  }
  const sorted = [...map.entries()].sort((a, b) => (side === 'bid' ? b[0] - a[0] : a[0] - b[0])).slice(0, props.levels)
  let total = 0
  return sorted.map(([price, size]) => ({ price, size, total: (total += size) }))
}

const bidRows = computed(() => build(props.bids, 'bid'))
/** Best ask first (nearest the middle) */
const askRows = computed(() => build(props.asks, 'ask'))
const maxTotal = computed(() => Math.max(bidRows.value.at(-1)?.total ?? 0, askRows.value.at(-1)?.total ?? 0, 1e-12))

const spread = computed(() => {
  const b = bidRows.value[0]?.price
  const a = askRows.value[0]?.price
  if (b === undefined || a === undefined) return null
  const s = a - b
  return { value: s, percent: (s / ((a + b) / 2)) * 100 }
})

const direction = ref<'up' | 'down' | null>(null)
watch(
  () => props.lastPrice,
  (now, before) => {
    if (now === undefined || before === undefined || now === before) return
    direction.value = now > before ? 'up' : 'down'
  },
)

const priceFmt = computed(() => new Intl.NumberFormat(locale.lang, { minimumFractionDigits: priceDecimals.value, maximumFractionDigits: priceDecimals.value }))
// Fixed decimals keep the size column aligned
const sizeFmt = computed(() => new Intl.NumberFormat(locale.lang, { minimumFractionDigits: props.sizeDecimals, maximumFractionDigits: props.sizeDecimals }))

// ── flashes: a generation number per level restarts its animation by re-keying the overlay ──
const flashes = ref(new Map<string, number>())
let gen = 0
const timers = new Set<ReturnType<typeof setTimeout>>()
function diff(rows: Row[], prev: Row[] | undefined, side: string) {
  if (!props.flash || !prev) return
  const old = new Map(prev.map((r) => [r.price, r.size]))
  for (const r of rows) {
    if (old.get(r.price) === r.size) continue
    const k = `${side}:${r.price}`
    const g = ++gen
    flashes.value.set(k, g)
    const t = setTimeout(() => {
      timers.delete(t)
      if (flashes.value.get(k) === g) flashes.value.delete(k)
    }, 700)
    timers.add(t)
  }
}
watch(bidRows, (rows, prev) => diff(rows, prev, 'bid'))
watch(askRows, (rows, prev) => diff(rows, prev, 'ask'))
onBeforeUnmount(() => timers.forEach(clearTimeout))

/** Asks listed top to bottom: worst first in stacked layout so the best sits by the middle */
const askList = computed(() => (props.layout === 'stacked' ? [...askRows.value].reverse() : askRows.value))

function pick(r: Row, side: 'bid' | 'ask') {
  emit('select', { price: r.price, size: r.size, side })
}
</script>

<template>
  <div class="m3-order-book text-body-medium tabular-nums text-on-surface" :data-layout="layout">
    <div v-if="layout === 'stacked'" class="flex flex-col">
      <div class="grid grid-cols-3 px-3 pb-1 text-label-medium text-on-surface-variant">
        <span>{{ locale.bookPrice }}</span>
        <span class="text-end">{{ locale.bookSize }}</span>
        <span class="text-end">{{ locale.bookTotal }}</span>
      </div>

      <button
        v-for="r in askList"
        :key="`a${r.price}`"
        type="button"
        class="m3-ob-row relative grid w-full grid-cols-3 px-3 py-0.5 text-start"
        data-side="ask"
        @click="pick(r, 'ask')"
      >
        <span class="m3-ob-depth absolute inset-y-0 right-0" :style="{ width: `${(r.total / maxTotal) * 100}%`, background: askColor }" />
        <span v-if="flashes.get(`ask:${r.price}`)" :key="flashes.get(`ask:${r.price}`)" class="m3-ob-flash absolute inset-0" :style="{ background: askColor }" />
        <span class="relative" :style="{ color: askColor }">{{ priceFmt.format(r.price) }}</span>
        <span class="relative text-end">{{ sizeFmt.format(r.size) }}</span>
        <span class="relative text-end text-on-surface-variant">{{ sizeFmt.format(r.total) }}</span>
      </button>

      <div class="my-1 flex items-center gap-3 border-y border-outline-variant px-3 py-2" data-middle>
        <slot name="middle" :last-price="lastPrice" :direction="direction" :spread="spread?.value" :spread-percent="spread?.percent">
          <span
            v-if="lastPrice !== undefined"
            class="flex items-center gap-0.5 text-title-large font-medium"
            :style="{ color: direction === 'down' ? askColor : direction === 'up' ? bidColor : undefined }"
          >
            {{ priceFmt.format(lastPrice) }}
            <MIcon v-if="direction" :name="direction === 'up' ? 'arrow_upward' : 'arrow_downward'" :size="18" />
          </span>
          <span v-if="spread" class="ms-auto text-label-medium text-on-surface-variant" data-spread>
            {{ locale.bookSpread }} {{ priceFmt.format(spread.value) }} ({{ spread.percent.toFixed(3) }}%)
          </span>
        </slot>
      </div>

      <button
        v-for="r in bidRows"
        :key="`b${r.price}`"
        type="button"
        class="m3-ob-row relative grid w-full grid-cols-3 px-3 py-0.5 text-start"
        data-side="bid"
        @click="pick(r, 'bid')"
      >
        <span class="m3-ob-depth absolute inset-y-0 right-0" :style="{ width: `${(r.total / maxTotal) * 100}%`, background: bidColor }" />
        <span v-if="flashes.get(`bid:${r.price}`)" :key="flashes.get(`bid:${r.price}`)" class="m3-ob-flash absolute inset-0" :style="{ background: bidColor }" />
        <span class="relative" :style="{ color: bidColor }">{{ priceFmt.format(r.price) }}</span>
        <span class="relative text-end">{{ sizeFmt.format(r.size) }}</span>
        <span class="relative text-end text-on-surface-variant">{{ sizeFmt.format(r.total) }}</span>
      </button>
    </div>

    <div v-else class="flex flex-col">
      <div class="flex items-center gap-3 border-b border-outline-variant px-3 pb-2" data-middle>
        <slot name="middle" :last-price="lastPrice" :direction="direction" :spread="spread?.value" :spread-percent="spread?.percent">
          <span
            v-if="lastPrice !== undefined"
            class="flex items-center gap-0.5 text-title-large font-medium"
            :style="{ color: direction === 'down' ? askColor : direction === 'up' ? bidColor : undefined }"
          >
            {{ priceFmt.format(lastPrice) }}
            <MIcon v-if="direction" :name="direction === 'up' ? 'arrow_upward' : 'arrow_downward'" :size="18" />
          </span>
          <span v-if="spread" class="ms-auto text-label-medium text-on-surface-variant" data-spread>
            {{ locale.bookSpread }} {{ priceFmt.format(spread.value) }} ({{ spread.percent.toFixed(3) }}%)
          </span>
        </slot>
      </div>
      <div class="grid grid-cols-2 gap-px pt-1">
        <div>
          <div class="grid grid-cols-2 px-3 pb-1 text-label-medium text-on-surface-variant">
            <span>{{ locale.bookSize }}</span>
            <span class="text-end">{{ locale.bookPrice }}</span>
          </div>
          <button
            v-for="r in bidRows"
            :key="`b${r.price}`"
            type="button"
            class="m3-ob-row relative grid w-full grid-cols-2 px-3 py-0.5 text-start"
            data-side="bid"
            @click="pick(r, 'bid')"
          >
            <span class="m3-ob-depth absolute inset-y-0 right-0" :style="{ width: `${(r.total / maxTotal) * 100}%`, background: bidColor }" />
            <span v-if="flashes.get(`bid:${r.price}`)" :key="flashes.get(`bid:${r.price}`)" class="m3-ob-flash absolute inset-0" :style="{ background: bidColor }" />
            <span class="relative">{{ sizeFmt.format(r.size) }}</span>
            <span class="relative text-end" :style="{ color: bidColor }">{{ priceFmt.format(r.price) }}</span>
          </button>
        </div>
        <div>
          <div class="grid grid-cols-2 px-3 pb-1 text-label-medium text-on-surface-variant">
            <span>{{ locale.bookPrice }}</span>
            <span class="text-end">{{ locale.bookSize }}</span>
          </div>
          <button
            v-for="r in askList"
            :key="`a${r.price}`"
            type="button"
            class="m3-ob-row relative grid w-full grid-cols-2 px-3 py-0.5 text-start"
            data-side="ask"
            @click="pick(r, 'ask')"
          >
            <span class="m3-ob-depth absolute inset-y-0 left-0" :style="{ width: `${(r.total / maxTotal) * 100}%`, background: askColor }" />
            <span v-if="flashes.get(`ask:${r.price}`)" :key="flashes.get(`ask:${r.price}`)" class="m3-ob-flash absolute inset-0" :style="{ background: askColor }" />
            <span class="relative" :style="{ color: askColor }">{{ priceFmt.format(r.price) }}</span>
            <span class="relative text-end">{{ sizeFmt.format(r.size) }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.m3-ob-depth {
  opacity: 0.14;
  transition: width 200ms ease;
}
.m3-ob-flash {
  opacity: 0;
  animation: m3-ob-flash 700ms ease-out;
}
@keyframes m3-ob-flash {
  from { opacity: 0.35; }
  to { opacity: 0; }
}
.m3-ob-row:hover {
  background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}
.m3-ob-row:focus-visible {
  outline: 2px solid var(--color-secondary);
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .m3-ob-flash { animation: none; }
  .m3-ob-depth { transition: none; }
}
</style>
