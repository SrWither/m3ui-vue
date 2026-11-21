<script lang="ts">
/** One day of `data` when given as an array */
export interface HeatmapDay {
  /** YYYY-MM-DD */
  date: string
  value: number
}

/** A cell, as the tooltip slot and the select event get it */
export interface HeatmapCell {
  /** YYYY-MM-DD */
  date: string
  value: number
  /** 0 (nothing) to levels - 1 (the most) */
  level: number
}
</script>

<script setup lang="ts">
/**
 * MCalendarHeatmap — activity per day as a grid of weeks (a column per week, a row per weekday), each day tinted by
 * how much happened: commits, workouts, sales, habits. Month and weekday names come from `Intl` in the app's
 * language. Hover or focus a day for its value; arrow keys move by day (up/down) and by week (left/right), and
 * Enter/Space or a click select it (v-model). Scrolls sideways when it doesn't fit, starting at the latest week.
 *
 * @slot tooltip Replaces the tooltip's text; receives the `HeatmapCell` (`date`, `value`, `level`)
 * @event update:modelValue Emitted with the date (YYYY-MM-DD) of the day picked — powers v-model
 * @event select Emitted with the `HeatmapCell` of the day picked
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'
import { isoDate } from '../composables/_useCalendarMonth'

const props = withDefaults(
  defineProps<{
    /** Values per day: `{ '2026-11-20': 4 }` or `[{ date: '2026-11-20', value: 4 }]`. Missing days are 0 */
    data: Record<string, number> | HeatmapDay[]
    /** Last day shown (YYYY-MM-DD or a Date); defaults to today */
    end?: string | Date
    /** First day shown; defaults to `weeks` weeks before `end` */
    start?: string | Date
    /** How many weeks to show when there's no `start` */
    weeks?: number
    /** First day of the week: 1 Monday (default, like the date pickers), 0 Sunday */
    weekStart?: 0 | 1
    /** Number of tints, the empty one included */
    levels?: number
    /** The value that gets the darkest tint; defaults to the largest value shown */
    max?: number
    /** An M3 color role (`primary`, `tertiary`, `success`...) or any CSS color */
    color?: string
    /** Side of a day's square, in px */
    cellSize?: number
    /** Space between days, in px */
    gap?: number
    /** Month names above the weeks */
    monthLabels?: boolean
    /** Weekday names (Mon, Wed, Fri) beside the rows */
    dayLabels?: boolean
    /** The "Less ▢▢▢ More" scale below */
    legend?: boolean
    /** Show the day's value on hover and focus */
    tooltip?: boolean
    /** The tooltip's text (and each day's accessible name); defaults to "value · date" */
    formatTooltip?: (cell: HeatmapCell) => string
    /** BCP-47 language for month/weekday names and numbers; defaults to the app's locale */
    locale?: string
    /** Selected day, YYYY-MM-DD (v-model); outlined */
    modelValue?: string | null
    /** Accessible name of the grid */
    label?: string
  }>(),
  {
    weeks: 53,
    weekStart: 1,
    levels: 5,
    color: 'primary',
    cellSize: 12,
    gap: 3,
    monthLabels: true,
    dayLabels: true,
    legend: true,
    tooltip: true,
    modelValue: null,
  },
)

const emit = defineEmits<{ 'update:modelValue': [string]; select: [HeatmapCell] }>()

const t = useLocale()
const lang = computed(() => props.locale ?? t.lang)

const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'success', 'on-surface', 'on-surface-variant', 'outline', 'inverse-primary'])
const baseColor = computed(() => (ROLES.has(props.color) ? `var(--color-${props.color})` : props.color))

const toDate = (v: string | Date) => (v instanceof Date ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : new Date(v + 'T00:00:00'))
const iso = (d: Date) => isoDate(d.getFullYear(), d.getMonth(), d.getDate())

const values = computed(() => {
  const d = props.data ?? {}
  if (!Array.isArray(d)) return d
  const out: Record<string, number> = {}
  for (const { date, value } of d) out[date] = (out[date] ?? 0) + value
  return out
})

const range = computed(() => {
  const end = toDate(props.end ?? new Date())
  const start = props.start ? toDate(props.start) : new Date(end.getFullYear(), end.getMonth(), end.getDate() - (props.weeks * 7 - 1))
  return { start: iso(start), end: iso(end), startDate: start, endDate: end }
})

const maxValue = computed(() => {
  if (props.max != null) return props.max
  let m = 0
  for (const [date, v] of Object.entries(values.value)) if (date >= range.value.start && date <= range.value.end && v > m) m = v
  return m
})

function levelOf(value: number) {
  if (value <= 0 || maxValue.value <= 0) return 0
  return Math.min(props.levels - 1, Math.max(1, Math.ceil((value / maxValue.value) * (props.levels - 1))))
}

// Level 0 is the empty container; the rest mix the color into it, evenly up to the full color
function levelColor(level: number) {
  if (level === 0) return 'var(--color-surface-container-highest)'
  const steps = props.levels - 1
  const pct = steps <= 1 ? 100 : Math.round(25 + (75 * (level - 1)) / (steps - 1))
  return `color-mix(in srgb, ${baseColor.value} ${pct}%, var(--color-surface-container-highest))`
}

interface Cell extends HeatmapCell { inRange: boolean }

// Rows are weekdays, columns weeks, from the week holding `start` to the one holding `end`
const grid = computed(() => {
  const { startDate, endDate, start, end } = range.value
  const lead = (startDate.getDay() - props.weekStart + 7) % 7
  const first = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - lead)
  const span = Math.round((endDate.getTime() - first.getTime()) / 86_400_000) + 1
  const cols = Math.ceil(span / 7)
  const rows: Cell[][] = Array.from({ length: 7 }, () => [])
  const firstOfCol: string[] = []
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const date = isoDate(first.getFullYear(), first.getMonth(), first.getDate() + c * 7 + r)
      const inRange = date >= start && date <= end
      const value = inRange ? (values.value[date] ?? 0) : 0
      rows[r]!.push({ date, value, level: inRange ? levelOf(value) : 0, inRange })
      if (inRange && firstOfCol[c] === undefined) firstOfCol[c] = date
    }
  }
  return { rows, cols, firstOfCol }
})

// A month's name over the first week that starts in it, unless too close to the previous one (or the edge) to fit
const months = computed(() => {
  const f = new Intl.DateTimeFormat(lang.value, { month: 'short' })
  const out: { col: number; label: string }[] = []
  let prev = ''
  grid.value.firstOfCol.forEach((date, col) => {
    if (!date) return
    const ym = date.slice(0, 7)
    if (ym === prev) return
    prev = ym
    const last = out[out.length - 1]
    if (last && col - last.col < 3) return
    if (!last && grid.value.cols - col < 2) return
    out.push({ col, label: f.format(new Date(date + 'T00:00:00')) })
  })
  // The first label is dropped when the next month starts too soon after it
  if (out.length > 1 && out[1]!.col - out[0]!.col < 3) out.shift()
  return out
})

// Monday, Wednesday and Friday, whatever the week starts on
const weekdayLabels = computed(() => {
  const f = new Intl.DateTimeFormat(lang.value, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, r) => {
    const day = (props.weekStart + r) % 7
    return day === 1 || day === 3 || day === 5 ? f.format(new Date(2024, 0, 7 + day)) : ''
  })
})

const numberFormat = computed(() => new Intl.NumberFormat(lang.value))
const dateFormat = computed(() => new Intl.DateTimeFormat(lang.value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))
function describe(cell: HeatmapCell) {
  if (props.formatTooltip) return props.formatTooltip(cell)
  return `${numberFormat.value.format(cell.value)} · ${dateFormat.value.format(new Date(cell.date + 'T00:00:00'))}`
}

const legendLevels = computed(() => Array.from({ length: props.levels }, (_, i) => i))

// ── Focus, selection, tooltip ─────────────────────────────────────
const root = ref<HTMLElement>()
const scroller = ref<HTMLElement>()
const focusDate = ref<string>(props.modelValue ?? range.value.end)
watch(() => props.modelValue, (v) => { if (v) focusDate.value = v })
// Keeps the Tab stop inside the range when the range changes
const tabStop = computed(() => {
  const { start, end } = range.value
  return focusDate.value < start ? start : focusDate.value > end ? end : focusDate.value
})

const tip = ref<{ cell: HeatmapCell; x: number; y: number } | null>(null)

function showTip(cell: Cell, e: Event) {
  if (!props.tooltip || !cell.inRange || !root.value) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const o = root.value.getBoundingClientRect()
  tip.value = { cell, x: r.left - o.left + r.width / 2, y: r.top - o.top }
}

function pick(cell: Cell) {
  if (!cell.inRange) return
  focusDate.value = cell.date
  emit('update:modelValue', cell.date)
  emit('select', { date: cell.date, value: cell.value, level: cell.level })
}

function cellAt(date: string) {
  for (const row of grid.value.rows) for (const c of row) if (c.date === date) return c
  return undefined
}

async function onKey(e: KeyboardEvent) {
  const by: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
  const { start, end } = range.value
  let next: string | undefined
  if (e.key in by) {
    const d = new Date(tabStop.value + 'T00:00:00')
    next = isoDate(d.getFullYear(), d.getMonth(), d.getDate() + by[e.key]!)
    if (next < start || next > end) return e.preventDefault()
  } else if (e.key === 'Home') next = start
  else if (e.key === 'End') next = end
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    const c = cellAt(tabStop.value)
    if (c) pick(c)
    return
  } else return
  e.preventDefault()
  focusDate.value = next
  await nextTick()
  const el = root.value?.querySelector<HTMLElement>(`[data-date="${next}"]`)
  el?.focus()
  if (el) showTip(cellAt(next)!, { currentTarget: el } as unknown as Event)
}

// Starts on the latest weeks
onMounted(() => {
  if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth
})

const step = computed(() => props.cellSize + props.gap)
</script>

<template>
  <div ref="root" class="m3-heatmap relative inline-flex max-w-full flex-col gap-2 text-on-surface-variant">
    <div class="flex min-w-0">
      <!-- Weekday names -->
      <div
        v-if="dayLabels"
        class="grid shrink-0 pr-2 text-label-small"
        :style="{ gridTemplateRows: `repeat(7, ${cellSize}px)`, rowGap: `${gap}px`, marginTop: monthLabels ? '20px' : undefined }"
        aria-hidden="true"
      >
        <span v-for="(d, i) in weekdayLabels" :key="i" class="flex items-center leading-none">{{ d }}</span>
      </div>

      <div ref="scroller" class="min-w-0 overflow-x-auto" @scroll="tip = null">
        <!-- Month names -->
        <div v-if="monthLabels" class="relative h-5 text-label-small" aria-hidden="true" :style="{ width: `${grid.cols * step - gap}px` }">
          <span v-for="m in months" :key="m.col" class="absolute top-0 capitalize whitespace-nowrap" :style="{ left: `${m.col * step}px` }">{{ m.label }}</span>
        </div>

        <div
          role="grid"
          :aria-label="label"
          class="grid"
          :style="{ gridTemplateColumns: `repeat(${grid.cols}, ${cellSize}px)`, gridAutoRows: `${cellSize}px`, gap: `${gap}px` }"
          @keydown="onKey"
          @mouseleave="tip = null"
        >
          <div v-for="(row, r) in grid.rows" :key="r" role="row" class="contents">
            <div
              v-for="cell in row"
              :key="cell.date"
              :role="cell.inRange ? 'gridcell' : 'presentation'"
              :data-date="cell.inRange ? cell.date : undefined"
              :data-level="cell.inRange ? cell.level : undefined"
              :tabindex="cell.inRange ? (cell.date === tabStop ? 0 : -1) : undefined"
              :aria-label="cell.inRange ? describe(cell) : undefined"
              :aria-selected="cell.inRange ? cell.date === modelValue : undefined"
              class="m3-heatmap-cell rounded-[3px] outline-none"
              :class="[
                cell.inRange ? 'cursor-pointer' : 'invisible',
                cell.date === modelValue && 'm3-heatmap-selected',
              ]"
              :style="{ backgroundColor: levelColor(cell.level) }"
              @mouseenter="showTip(cell, $event)"
              @focus="showTip(cell, $event)"
              @blur="tip = null"
              @click="pick(cell)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="legend" class="flex items-center justify-end gap-1 text-label-small" aria-hidden="true">
      <span class="mr-1">{{ t.heatmapLess }}</span>
      <span
        v-for="l in legendLevels"
        :key="l"
        class="rounded-[3px]"
        :style="{ width: `${cellSize}px`, height: `${cellSize}px`, backgroundColor: levelColor(l) }"
      />
      <span class="ml-1">{{ t.heatmapMore }}</span>
    </div>

    <!-- Tooltip: M3 plain tooltip (inverse surface, extra-small corners) -->
    <div
      v-if="tip"
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xs bg-inverse-surface px-2 py-1 text-body-small text-inverse-on-surface shadow-elevation-1"
      :style="{ left: `${tip.x}px`, top: `${tip.y - 4}px` }"
      aria-hidden="true"
    >
      <slot name="tooltip" v-bind="tip.cell">{{ describe(tip.cell) }}</slot>
    </div>
  </div>
</template>

<style>
.m3-heatmap-cell {
  transition: box-shadow 100ms;
}
.m3-heatmap-cell:hover {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-on-surface) 38%, transparent);
}
.m3-heatmap-cell:focus-visible {
  box-shadow: 0 0 0 2px var(--color-secondary);
}
.m3-heatmap-selected,
.m3-heatmap-selected:hover {
  box-shadow: 0 0 0 2px var(--color-on-surface);
}
</style>
