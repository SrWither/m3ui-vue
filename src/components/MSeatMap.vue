<script lang="ts">
/** A seat type: its key is the character that marks it in `layout`. */
export interface SeatCategory {
  /** Single character used for this category in `layout` rows */
  key: string
  /** Name shown in the legend and the seat's label, e.g. "Premium" */
  label: string
  /** A color role (`primary`, `secondary`, `tertiary`, `error`, `success`) or any CSS color. Default `primary` */
  color?: string
  /** Price, shown in the legend and the seat's label */
  price?: number
}

/** A seat as laid out by `MSeatMap`, given to the `seat` slot and the `select` event. */
export interface SeatInfo {
  /** Id used in v-model, `occupied` and `blocked`: "F12" (theater naming) or "12C" (plane naming) */
  id: string
  /** Row label, e.g. "F" or "12" */
  row: string
  /** Seat label within the row, e.g. "12" or "C" */
  number: string
  /** Category key (the layout character) */
  category: string
  /** Grid row and column (0-based, gaps included) */
  r: number
  c: number
}

export type SeatState = 'available' | 'selected' | 'occupied' | 'blocked'
</script>

<script setup lang="ts">
/**
 * Seat picker for a cinema, theater, stadium, bus or plane. The hall is drawn from rows of characters: each
 * character is a seat of the category with that `key`, and `_` or a space leaves a gap (an aisle, or an empty
 * row when the whole line is blank). Seats are named theater style (row letters, seat numbers: "F12") or plane
 * style (row numbers, seat letters: "12C"), and those names are the ids used in v-model.
 *
 * Arrow keys move between seats, Enter/Space picks one. With `max: 1` picking another seat moves the selection.
 *
 * @slot seat Replaces a seat's content (the button stays). Slot props: `{ seat, state, category }`
 * @slot legend Replaces the legend under the map. Slot props: `{ categories }`
 * @event update:modelValue Emitted with the ids of the selected seats — powers v-model
 * @event select Emitted when a seat is picked or released, with `(seat, selected)`
 * @event limit Emitted when a seat is picked while `max` seats are already selected
 */
import { computed, nextTick, ref } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Ids of the selected seats (v-model) */
    modelValue?: string[]
    /** Rows of the hall, top to bottom. Each character is a seat of that category; `_` or a space is a gap */
    layout: string[]
    /** Seat categories by layout character. Characters without one use a default "Standard" look */
    categories?: SeatCategory[]
    /** Ids of seats already taken */
    occupied?: string[]
    /** Ids of seats that can't be picked (out of service, kept free) */
    blocked?: string[]
    /** Seat naming: row letters + seat numbers ("F12"), or row numbers + seat letters ("12C") */
    naming?: 'theater' | 'plane'
    /** Custom row labels, one per seat row (blank rows don't count) */
    rowLabels?: string[]
    /** Seats are numbered from the left (`ltr`) or from the right (`rtl`) of each row */
    numbering?: 'ltr' | 'rtl'
    /** Most seats that can be selected */
    max?: number
    /** Label of the screen/stage. Defaults to the locale's "Screen"; `false` hides it */
    stage?: string | false
    /** Side the screen/stage is drawn on */
    stagePosition?: 'top' | 'bottom'
    /** Seat size in px */
    seatSize?: number
    /** Shows row labels at both ends of each row */
    showRowLabels?: boolean
    /** Shows the legend */
    legend?: boolean
    /** ISO 4217 code to format prices (e.g. "USD"). Unset shows plain numbers */
    currency?: string
    /** Disables picking */
    disabled?: boolean
  }>(),
  {
    modelValue: () => [],
    categories: () => [],
    occupied: () => [],
    blocked: () => [],
    stage: undefined, // without a default Vue casts an absent `string | false` prop to false
    naming: 'theater',
    numbering: 'ltr',
    stagePosition: 'top',
    seatSize: 32,
    showRowLabels: true,
    legend: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
  select: [SeatInfo, boolean]
  limit: []
}>()

const ROLES = ['primary', 'secondary', 'tertiary', 'error', 'success']
const PLANE_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ' // no I, as airlines do

function rowLetter(i: number): string {
  let s = ''
  i += 1
  while (i > 0) {
    const m = (i - 1) % 26
    s = String.fromCharCode(65 + m) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

const categoryMap = computed(() => new Map(props.categories.map((c) => [c.key, c])))

function colorsOf(key: string): { color: string; on: string } {
  const color = categoryMap.value.get(key)?.color ?? 'primary'
  if (ROLES.includes(color)) return { color: `var(--color-${color})`, on: `var(--color-on-${color})` }
  return { color, on: '#fff' }
}

interface Row { label: string; r: number; cells: (SeatInfo | null)[] }

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  let seatRow = 0
  props.layout.forEach((line, r) => {
    const chars = [...line]
    const seatCols = chars.map((ch, c) => (ch === '_' || ch === ' ' ? -1 : c)).filter((c) => c >= 0)
    if (!seatCols.length) {
      out.push({ label: '', r, cells: chars.map(() => null) })
      return
    }
    const label = props.rowLabels?.[seatRow] ?? (props.naming === 'plane' ? String(seatRow + 1) : rowLetter(seatRow))
    seatRow++
    const order = props.numbering === 'rtl' ? [...seatCols].reverse() : seatCols
    const indexOf = new Map(order.map((c, i) => [c, i]))
    out.push({
      label,
      r,
      cells: chars.map((ch, c) => {
        if (ch === '_' || ch === ' ') return null
        const i = indexOf.get(c)!
        const number = props.naming === 'plane' ? (PLANE_LETTERS[i] ?? String(i + 1)) : String(i + 1)
        const id = `${label}${number}`
        return { id, row: label, number, category: ch, r, c }
      }),
    })
  })
  return out
})

const columns = computed(() => Math.max(1, ...props.layout.map((l) => [...l].length)))

const seats = computed(() => rows.value.flatMap((row) => row.cells.filter((s): s is SeatInfo => !!s)))
const seatById = computed(() => new Map(seats.value.map((s) => [s.id, s])))

const selectedSet = computed(() => new Set(props.modelValue))
const occupiedSet = computed(() => new Set(props.occupied))
const blockedSet = computed(() => new Set(props.blocked))

function stateOf(seat: SeatInfo): SeatState {
  if (occupiedSet.value.has(seat.id)) return 'occupied'
  if (blockedSet.value.has(seat.id)) return 'blocked'
  if (selectedSet.value.has(seat.id)) return 'selected'
  return 'available'
}

function pickable(seat: SeatInfo) {
  const s = stateOf(seat)
  return s === 'available' || s === 'selected'
}

function toggle(seat: SeatInfo) {
  if (props.disabled || !pickable(seat)) return
  focusedId.value = seat.id
  if (selectedSet.value.has(seat.id)) {
    emit('update:modelValue', props.modelValue.filter((id) => id !== seat.id))
    emit('select', seat, false)
    return
  }
  if (props.max !== undefined && props.modelValue.length >= props.max) {
    if (props.max === 1) {
      const prev = seatById.value.get(props.modelValue[0]!)
      emit('update:modelValue', [seat.id])
      if (prev) emit('select', prev, false)
      emit('select', seat, true)
      return
    }
    emit('limit')
    return
  }
  emit('update:modelValue', [...props.modelValue, seat.id])
  emit('select', seat, true)
}

// ── Labels ──────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  try {
    return new Intl.NumberFormat(locale.lang, props.currency ? { style: 'currency', currency: props.currency } : {}).format(n)
  } catch {
    return String(n)
  }
}

function seatLabel(seat: SeatInfo) {
  const cat = categoryMap.value.get(seat.category)
  const parts = [locale.seatLabel.replace('{seat}', seat.id)]
  if (cat) parts.push(cat.label)
  if (cat?.price !== undefined) parts.push(formatPrice(cat.price))
  const state = stateOf(seat)
  if (state === 'occupied') parts.push(locale.seatOccupied)
  return parts.join(', ')
}

const stageText = computed(() => (props.stage === false ? '' : props.stage ?? locale.seatStage))

const legendCategories = computed(() => {
  const used = new Set(seats.value.map((s) => s.category))
  return props.categories.filter((c) => used.has(c.key))
})

// ── Keyboard: roving tabindex ───────────────────────────────────────────

const focusedId = ref<string | null>(null)
const seatEls = new Map<string, HTMLElement>()

function setSeatEl(id: string, el: unknown) {
  if (el) seatEls.set(id, el as HTMLElement)
  else seatEls.delete(id)
}

const tabStop = computed(() => {
  const focusable = seats.value.filter(pickable)
  if (focusedId.value && focusable.some((s) => s.id === focusedId.value)) return focusedId.value
  return focusable.find((s) => selectedSet.value.has(s.id))?.id ?? focusable[0]?.id ?? null
})

function moveFocus(from: SeatInfo, dr: number, dc: number) {
  const candidates = seats.value.filter((s) => pickable(s) && s.id !== from.id)
  let best: SeatInfo | null = null
  let bestScore = Infinity
  for (const s of candidates) {
    const rr = s.r - from.r
    const cc = s.c - from.c
    if (dr !== 0) {
      if (Math.sign(rr) !== dr) continue
      const score = Math.abs(rr) * 1000 + Math.abs(cc)
      if (score < bestScore) { best = s; bestScore = score }
    } else {
      if (rr !== 0 || Math.sign(cc) !== dc) continue
      const score = Math.abs(cc)
      if (score < bestScore) { best = s; bestScore = score }
    }
  }
  if (!best) return
  focusedId.value = best.id
  nextTick(() => seatEls.get(best!.id)?.focus())
}

function onKeydown(seat: SeatInfo, e: KeyboardEvent) {
  const dirs: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }
  const d = dirs[e.key]
  if (!d) return
  e.preventDefault()
  moveFocus(seat, d[0], d[1])
}

const gap = computed(() => Math.max(3, Math.round(props.seatSize / 8)))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="overflow-auto">
      <div class="mx-auto flex w-max flex-col items-center gap-4 p-2" :class="stagePosition === 'bottom' ? 'flex-col-reverse' : ''">
        <!-- Screen / stage -->
        <div v-if="stageText" class="flex w-full flex-col items-center gap-1" :class="stagePosition === 'bottom' ? 'flex-col-reverse' : ''" aria-hidden="true">
          <svg viewBox="0 0 200 16" preserveAspectRatio="none" class="h-4 w-[85%] text-primary" :class="stagePosition === 'bottom' ? 'rotate-180' : ''">
            <path d="M2 14 Q100 -6 198 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </svg>
          <span class="text-label-medium uppercase tracking-[0.2em] text-on-surface-variant">{{ stageText }}</span>
        </div>

        <!-- Seats -->
        <div
          role="group"
          :aria-label="stageText || undefined"
          class="grid"
          :style="{
            gridTemplateColumns: `${showRowLabels ? `${seatSize}px ` : ''}repeat(${columns}, ${seatSize}px)${showRowLabels ? ` ${seatSize}px` : ''}`,
            gap: `${gap}px`,
          }"
        >
          <template v-for="row in rows" :key="row.r">
            <span
              v-if="showRowLabels"
              aria-hidden="true"
              class="flex items-center justify-center text-label-medium text-on-surface-variant"
              :style="{ height: `${seatSize}px` }"
            >{{ row.label }}</span>
            <template v-for="(seat, c) in row.cells" :key="c">
              <span v-if="!seat" :style="{ height: `${seatSize}px` }" />
              <button
                v-else
                :ref="(el) => setSeatEl(seat.id, el)"
                type="button"
                class="m3-seat relative flex items-center justify-center outline-none transition-[background-color,border-color,transform] duration-150"
                :class="[`is-${stateOf(seat)}`, disabled ? 'cursor-default' : '']"
                :style="{
                  width: `${seatSize}px`,
                  height: `${seatSize}px`,
                  '--seat-color': colorsOf(seat.category).color,
                  '--seat-on-color': colorsOf(seat.category).on,
                }"
                :tabindex="tabStop === seat.id ? 0 : -1"
                :disabled="!pickable(seat)"
                :aria-pressed="stateOf(seat) === 'selected'"
                :aria-label="seatLabel(seat)"
                :title="seatLabel(seat)"
                :data-seat="seat.id"
                @click="toggle(seat)"
                @keydown="onKeydown(seat, $event)"
                @focus="focusedId = seat.id"
              >
                <slot name="seat" :seat="seat" :state="stateOf(seat)" :category="categoryMap.get(seat.category)">
                  <MIcon v-if="stateOf(seat) === 'selected'" name="check" :size="Math.round(seatSize * 0.6)" />
                  <MIcon v-else-if="stateOf(seat) === 'blocked'" name="block" :size="Math.round(seatSize * 0.5)" />
                </slot>
              </button>
            </template>
            <template v-if="row.cells.length < columns">
              <span v-for="n in columns - row.cells.length" :key="`pad-${n}`" />
            </template>
            <span
              v-if="showRowLabels"
              aria-hidden="true"
              class="flex items-center justify-center text-label-medium text-on-surface-variant"
              :style="{ height: `${seatSize}px` }"
            >{{ row.label }}</span>
          </template>
        </div>
      </div>
    </div>

    <div v-if="legend" class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-body-medium text-on-surface-variant">
      <slot name="legend" :categories="legendCategories">
        <template v-if="legendCategories.length">
          <span v-for="cat in legendCategories" :key="cat.key" class="flex items-center gap-2">
            <span
              class="m3-seat is-available h-4 w-4"
              :style="{ '--seat-color': colorsOf(cat.key).color, '--seat-on-color': colorsOf(cat.key).on }"
            />
            {{ cat.label }}<template v-if="cat.price !== undefined"> · {{ formatPrice(cat.price) }}</template>
          </span>
        </template>
        <span v-else class="flex items-center gap-2">
          <span class="m3-seat is-available h-4 w-4" :style="{ '--seat-color': 'var(--color-primary)' }" />
          {{ locale.seatAvailable }}
        </span>
        <span class="flex items-center gap-2">
          <span class="m3-seat is-selected h-4 w-4" :style="{ '--seat-color': 'var(--color-primary)' }" />
          {{ locale.seatSelected }}
        </span>
        <span v-if="occupied.length" class="flex items-center gap-2">
          <span class="m3-seat is-occupied h-4 w-4" />
          {{ locale.seatOccupied }}
        </span>
      </slot>
    </div>
  </div>
</template>

<style>
/* A seat: rounder at the back (top), like a chair seen from above */
.m3-seat {
  border-radius: 40% 40% 18% 18%;
  border: 2px solid transparent;
}
.m3-seat.is-available {
  background-color: color-mix(in srgb, var(--seat-color) 16%, var(--color-surface));
  border-color: color-mix(in srgb, var(--seat-color) 70%, transparent);
  cursor: pointer;
}
button.m3-seat.is-available:hover {
  background-color: color-mix(in srgb, var(--seat-color) 30%, var(--color-surface));
}
.m3-seat.is-selected {
  background-color: var(--seat-color);
  border-color: var(--seat-color);
  color: var(--seat-on-color, var(--color-on-primary));
  cursor: pointer;
}
button.m3-seat.is-selected:active,
button.m3-seat.is-available:active {
  transform: scale(0.9);
}
.m3-seat.is-occupied {
  background-color: color-mix(in srgb, var(--color-on-surface) 14%, transparent);
  cursor: not-allowed;
}
.m3-seat.is-blocked {
  border: 2px dashed var(--color-outline-variant);
  color: var(--color-outline);
  cursor: not-allowed;
}
.m3-seat:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .m3-seat {
    transition: none;
  }
}
</style>
