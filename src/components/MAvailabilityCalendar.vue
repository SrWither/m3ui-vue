<script setup lang="ts">
/**
 * A booking calendar for stays (hotel, cabin, apartment, equipment rental): picks a check-in and a check-out
 * night with the price of each night under its day, booked nights blocked, and a minimum / maximum stay. Once a
 * check-in is chosen, only the days that make a valid stay stay pickable: a stay can't run over a booked night, but
 * it can check out on the morning a booked night starts.
 *
 * Dates are `YYYY-MM-DD` strings in local time; each date's price and availability are those of the night that
 * starts on it.
 *
 * @slot day Replaces a day's content (the button stays). Slot props: `{ date, day, price, state }`
 * @slot footer Replaces the summary under the months. Slot props: `{ start, end, nights, total, clear }`
 * @event update:modelValue `[checkIn, checkOut]`, either one `null` — powers v-model
 * @event change Emitted when a stay is complete: `{ start, end, nights, total }`
 */
import { computed, nextTick, ref, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import MButton from './MButton.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

type Range = [string | null, string | null]

const props = withDefaults(
  defineProps<{
    /** `[checkIn, checkOut]` as `YYYY-MM-DD` (v-model) */
    modelValue?: Range
    /** Price of the night starting on each date: a map or a function */
    prices?: Record<string, number> | ((date: string) => number | undefined)
    /** Nights already booked or closed: a list of dates or a function */
    unavailable?: string[] | ((date: string) => boolean)
    /** Shortest stay, in nights */
    minNights?: number
    /** Longest stay, in nights */
    maxNights?: number
    /** First bookable date. Defaults to today */
    min?: string
    /** Last bookable night */
    max?: string
    /** Months shown side by side (they wrap on narrow screens) */
    months?: number
    /** 0 = Sunday … 6 = Saturday. Defaults to the locale's first day of the week */
    firstDayOfWeek?: number
    /** ISO 4217 code to format prices */
    currency?: string
    /** Colors the cheapest quarter of the nights shown as deals */
    highlightDeals?: boolean
    /** Hides the summary under the months */
    hideFooter?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: () => [null, null],
    minNights: 1,
    months: 2,
    highlightDeals: false,
    hideFooter: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [Range]
  change: [{ start: string; end: string; nights: number; total: number }]
}>()

// ── date helpers (local time, YYYY-MM-DD) ──
const pad = (n: number) => String(n).padStart(2, '0')
function key(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function parse(k: string) {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
function addDays(k: string, n: number) {
  const d = parse(k)
  d.setDate(d.getDate() + n)
  return key(d)
}
function diffDays(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}

const minDate = computed(() => props.min ?? key(new Date()))

const firstDay = computed(() => {
  if (props.firstDayOfWeek !== undefined) return props.firstDayOfWeek
  try {
    const loc = new Intl.Locale(locale.lang) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } }
    const info = loc.getWeekInfo?.() ?? loc.weekInfo
    if (info) return info.firstDay % 7
  } catch { /* old engines */ }
  return 0
})

const start = computed(() => props.modelValue[0])
const end = computed(() => props.modelValue[1])

// ── view ──
const initial = start.value ? parse(start.value) : parse(minDate.value)
const view = ref(new Date(initial.getFullYear(), initial.getMonth(), 1))

const unavailableSet = computed(() => (Array.isArray(props.unavailable) ? new Set(props.unavailable) : null))
function isBooked(k: string) {
  if (typeof props.unavailable === 'function') return props.unavailable(k)
  return unavailableSet.value?.has(k) ?? false
}
function priceOf(k: string) {
  return typeof props.prices === 'function' ? props.prices(k) : props.prices?.[k]
}
function inBounds(k: string) {
  return k >= minDate.value && (!props.max || k <= props.max)
}

/** First booked (or out of range) night on or after `from`, within `limit` nights */
function firstBlocked(from: string, limit: number) {
  for (let i = 0; i < limit; i++) {
    const k = addDays(from, i)
    if (isBooked(k) || !inBounds(k)) return i
  }
  return -1
}

function canCheckIn(k: string) {
  if (!inBounds(k) || isBooked(k)) return false
  // the minimum stay must fit before the next booked night
  return firstBlocked(k, props.minNights) === -1
}

function canCheckOut(k: string) {
  const s = start.value
  if (!s || end.value) return false
  const n = diffDays(s, k)
  if (n < props.minNights || (props.maxNights !== undefined && n > props.maxNights)) return false
  return firstBlocked(s, n) === -1
}

const hover = ref<string | null>(null)

type DayState = 'start' | 'end' | 'range' | 'preview' | 'booked' | 'disabled' | 'available' | 'checkout-only'

function stateOf(k: string): DayState {
  if (k === start.value) return 'start'
  if (k === end.value) return 'end'
  if (start.value && end.value && k > start.value && k < end.value) return 'range'
  if (start.value && !end.value) {
    if (canCheckOut(k)) {
      if (hover.value && canCheckOut(hover.value) && k > start.value && k < hover.value) return 'preview'
      return isBooked(k) ? 'checkout-only' : 'available'
    }
    if (k > start.value) return isBooked(k) ? 'booked' : 'disabled'
  }
  if (isBooked(k)) return 'booked'
  if (!canCheckIn(k)) return 'disabled'
  return 'available'
}

function pickable(k: string) {
  const s = stateOf(k)
  return s !== 'booked' && s !== 'disabled'
}

interface Cell { key: string; day: number; price?: number }
const monthsView = computed(() =>
  Array.from({ length: props.months }, (_, i) => {
    const first = new Date(view.value.getFullYear(), view.value.getMonth() + i, 1)
    const lead = (first.getDay() - firstDay.value + 7) % 7
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const cells: (Cell | null)[] = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= days; d++) {
      const k = key(new Date(first.getFullYear(), first.getMonth(), d))
      cells.push({ key: k, day: d, price: priceOf(k) })
    }
    return {
      id: key(first).slice(0, 7),
      label: new Intl.DateTimeFormat(locale.lang, { month: 'long', year: 'numeric' }).format(first),
      cells,
    }
  }),
)

const weekdays = computed(() => {
  const f = new Intl.DateTimeFormat(locale.lang, { weekday: 'narrow' })
  const long = new Intl.DateTimeFormat(locale.lang, { weekday: 'long' })
  // 2023-01-01 was a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2023, 0, 1 + ((i + firstDay.value) % 7))
    return { short: f.format(d), long: long.format(d) }
  })
})

/** Prices at or under this are deals */
const dealLimit = computed(() => {
  if (!props.highlightDeals) return -Infinity
  const ps = monthsView.value.flatMap((m) => m.cells).filter((c): c is Cell => !!c && c.price !== undefined && pickable(c.key)).map((c) => c.price!)
  if (ps.length < 4) return -Infinity
  ps.sort((a, b) => a - b)
  return ps[Math.floor(ps.length / 4) - 1]!
})

function money(n: number, compact = false) {
  return new Intl.NumberFormat(locale.lang, {
    ...(props.currency ? { style: 'currency', currency: props.currency } : {}),
    ...(compact ? { maximumFractionDigits: 0 } : {}),
  }).format(n)
}

const nights = computed(() => (start.value && end.value ? diffDays(start.value, end.value) : 0))
const total = computed(() => {
  let t = 0
  for (let i = 0; i < nights.value; i++) t += priceOf(addDays(start.value!, i)) ?? 0
  return Math.round(t * 100) / 100
})

function select(k: string) {
  if (props.disabled || !pickable(k)) return
  if (start.value && !end.value && canCheckOut(k)) {
    const range: Range = [start.value, k]
    emit('update:modelValue', range)
    const n = diffDays(start.value, k)
    let t = 0
    for (let i = 0; i < n; i++) t += priceOf(addDays(start.value, i)) ?? 0
    emit('change', { start: start.value, end: k, nights: n, total: Math.round(t * 100) / 100 })
  } else if (canCheckIn(k)) {
    emit('update:modelValue', [k, null])
  }
}

function clear() {
  emit('update:modelValue', [null, null])
}

const hint = computed(() => {
  if (!start.value) return locale.availSelectCheckIn
  if (!end.value) return props.minNights > 1 ? `${locale.availSelectCheckOut} · ${locale.availMinNights.replace('{n}', String(props.minNights))}` : locale.availSelectCheckOut
  return ''
})

function nightsText(n: number) {
  return n === 1 ? locale.availNight : locale.availNights.replace('{n}', String(n))
}

function dayLabel(c: Cell) {
  const s = stateOf(c.key)
  const parts = [new Intl.DateTimeFormat(locale.lang, { dateStyle: 'full' }).format(parse(c.key))]
  if (c.price !== undefined && s !== 'booked') parts.push(money(c.price))
  if (s === 'start') parts.push(locale.availCheckIn)
  if (s === 'end') parts.push(locale.availCheckOut)
  if (s === 'booked') parts.push(locale.availUnavailable)
  return parts.join(', ')
}

// ── navigation ──
const canPrev = computed(() => {
  const m = parse(minDate.value)
  return view.value > new Date(m.getFullYear(), m.getMonth(), 1)
})
const canNext = computed(() => {
  if (!props.max) return true
  const m = parse(props.max)
  return new Date(view.value.getFullYear(), view.value.getMonth() + props.months - 1, 1) < new Date(m.getFullYear(), m.getMonth(), 1)
})
function shift(n: number) {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + n, 1)
}

// Roving focus: one day is tabbable
const focusKey = ref(start.value ?? (inBounds(key(new Date())) ? key(new Date()) : minDate.value))
const rootEl = ref<HTMLElement | null>(null)
const tabKey = computed(() => {
  const keys = monthsView.value.flatMap((m) => m.cells).filter(Boolean).map((c) => c!.key)
  return keys.includes(focusKey.value) ? focusKey.value : keys[0]
})

function ensureVisible(k: string) {
  const d = parse(k)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(view.value.getFullYear(), view.value.getMonth() + props.months - 1, 1)
  if (first < view.value) view.value = first
  else if (first > last) view.value = new Date(d.getFullYear(), d.getMonth() - props.months + 1, 1)
}

async function onKeydown(e: KeyboardEvent, k: string) {
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  let next: string | null = null
  if (e.key in moves) next = addDays(k, moves[e.key]!)
  else if (e.key === 'PageUp' || e.key === 'PageDown') {
    const d = parse(k)
    d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1))
    next = key(d)
  } else if (e.key === 'Home') next = addDays(k, -((parse(k).getDay() - firstDay.value + 7) % 7))
  else if (e.key === 'End') next = addDays(k, 6 - ((parse(k).getDay() - firstDay.value + 7) % 7))
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    select(k)
    return
  } else if (e.key === 'Escape' && start.value && !end.value) {
    e.preventDefault()
    clear()
    return
  }
  if (!next) return
  e.preventDefault()
  focusKey.value = next
  ensureVisible(next)
  hover.value = next
  await nextTick()
  rootEl.value?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus()
}

watch(start, (s) => {
  if (s) focusKey.value = s
})

defineExpose({ nights, total, clear })
</script>

<template>
  <div ref="rootEl" class="m3-availability text-on-surface" @mouseleave="hover = null">
    <div class="flex flex-wrap gap-x-8 gap-y-4">
      <div v-for="(m, mi) in monthsView" :key="m.id" class="min-w-64 flex-1">
        <div class="mb-2 flex h-12 items-center">
          <MIconButton
            icon="chevron_left"
            :aria-label="locale.previous"
            :class="mi === 0 ? '' : 'invisible'"
            :disabled="!canPrev"
            data-nav="prev"
            @click="shift(-1)"
          />
          <h3 class="flex-1 text-center text-title-medium capitalize">{{ m.label }}</h3>
          <MIconButton
            icon="chevron_right"
            :aria-label="locale.next"
            :class="mi === monthsView.length - 1 ? '' : 'invisible'"
            :disabled="!canNext"
            data-nav="next"
            @click="shift(1)"
          />
        </div>
        <div role="grid" :aria-label="m.label" class="grid grid-cols-7">
          <div role="row" class="contents">
            <span
              v-for="w in weekdays"
              :key="w.long"
              role="columnheader"
              :aria-label="w.long"
              class="flex h-8 items-center justify-center text-label-medium text-on-surface-variant"
            >{{ w.short }}</span>
          </div>
          <div role="row" class="contents">
            <template v-for="(c, ci) in m.cells" :key="c?.key ?? `x${ci}`">
              <span v-if="!c" role="gridcell" />
              <div
                v-else
                role="gridcell"
                class="m3-availability__cell relative flex h-14 items-center justify-center"
                :data-state="stateOf(c.key)"
                :data-lone="stateOf(c.key) === 'start' && !end && !(hover && hover !== start && canCheckOut(hover)) ? '' : undefined"
              >
                <button
                  type="button"
                  class="m3-availability__day relative z-[1] flex h-12 w-full max-w-12 flex-col items-center justify-center rounded-full text-body-large leading-tight"
                  :class="[
                    stateOf(c.key) === 'start' || stateOf(c.key) === 'end' ? 'bg-primary text-on-primary' : '',
                    stateOf(c.key) === 'booked' ? 'text-on-surface/40 line-through' : '',
                    stateOf(c.key) === 'disabled' ? 'text-on-surface/40' : '',
                  ]"
                  :tabindex="c.key === tabKey ? 0 : -1"
                  :aria-label="dayLabel(c)"
                  :aria-pressed="stateOf(c.key) === 'start' || stateOf(c.key) === 'end' || stateOf(c.key) === 'range'"
                  :aria-disabled="!pickable(c.key) || disabled || undefined"
                  :data-date="c.key"
                  @click="select(c.key)"
                  @mouseenter="hover = c.key"
                  @focus="focusKey = c.key"
                  @keydown="onKeydown($event, c.key)"
                >
                  <slot name="day" :date="c.key" :day="c.day" :price="c.price" :state="stateOf(c.key)">
                    <span :class="{ 'font-medium': c.key === key(new Date()) }">{{ c.day }}</span>
                    <span
                      v-if="c.price !== undefined && stateOf(c.key) !== 'booked' && stateOf(c.key) !== 'disabled'"
                      class="text-[10px] tabular-nums"
                      :class="stateOf(c.key) === 'start' || stateOf(c.key) === 'end'
                        ? 'text-on-primary/80'
                        : c.price <= dealLimit ? 'font-medium text-success' : 'text-on-surface-variant'"
                    >{{ money(c.price, true) }}</span>
                  </slot>
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!hideFooter" class="mt-3 flex min-h-12 flex-wrap items-center gap-3 border-t border-outline-variant pt-3">
      <slot name="footer" :start="start" :end="end" :nights="nights" :total="total" :clear="clear">
        <p class="flex-1 text-body-large" data-summary>
          <template v-if="nights">
            {{ nightsText(nights) }}<template v-if="prices"> · <strong class="tabular-nums">{{ money(total) }}</strong></template>
          </template>
          <span v-else class="text-on-surface-variant">{{ hint }}</span>
        </p>
        <MButton v-if="start" variant="text" @click="clear">{{ locale.clear }}</MButton>
      </slot>
    </div>
  </div>
</template>

<style>
/* The band between check-in and check-out runs behind the day circles */
.m3-availability__cell[data-state='range']::before,
.m3-availability__cell[data-state='preview']::before,
.m3-availability__cell[data-state='start']::before,
.m3-availability__cell[data-state='end']::before {
  content: '';
  position: absolute;
  inset: 4px 0;
  background: var(--color-secondary-container);
}
.m3-availability__cell[data-state='preview']::before {
  background: color-mix(in srgb, var(--color-secondary-container) 55%, transparent);
}
.m3-availability__cell[data-state='start']::before {
  left: 50%;
}
.m3-availability__cell[data-state='end']::before {
  right: 50%;
}
/* A lone check-in (no check-out yet, none previewed) has no band */
.m3-availability__cell[data-lone]::before {
  display: none;
}
.m3-availability__cell[data-state='range'] .m3-availability__day,
.m3-availability__cell[data-state='preview'] .m3-availability__day {
  color: var(--color-on-secondary-container);
}
.m3-availability__day:not([aria-disabled]):not([aria-pressed='true']):hover {
  background: color-mix(in srgb, var(--color-on-surface) 8%, transparent);
}
.m3-availability__day[aria-disabled] {
  cursor: default;
}
.m3-availability__day:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: -1px;
}
.m3-availability__cell[data-state='checkout-only'] .m3-availability__day::after {
  content: '';
  position: absolute;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-outline);
}
</style>
