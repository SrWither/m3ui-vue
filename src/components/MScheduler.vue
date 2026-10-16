<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

export interface SchedulerEvent {
  id: string | number
  title: string
  /**
   * Start: a datetime (`2026-10-17T09:30`, or ISO with a zone). For an all-day event, a date
   * (`2026-10-17`).
   */
  start: string
  /** End: a datetime (exclusive). For an all-day event, the last day (inclusive). */
  end: string
  /** Shown in the all-day row instead of the time grid. Events that span days go there too. */
  allDay?: boolean
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
}

const props = withDefaults(
  defineProps<{
    events?: SchedulerEvent[]
    /** 'week' or 'day'; use v-model:view to follow the header's toggle. */
    view?: 'week' | 'day'
    /** The date shown (`YYYY-MM-DD`), today by default; use v-model:date to follow navigation. */
    date?: string
    startHour?: number
    endHour?: number
    /** First day of the week: 0 = Sunday, 1 = Monday. */
    weekStartsOn?: 0 | 1
    /** Height of one hour row, in px. */
    hourHeight?: number
    /** A line across today's column at the current time. */
    nowIndicator?: boolean
    locale?: string
    prevLabel?: string
    nextLabel?: string
    todayLabel?: string
    dayViewLabel?: string
    weekViewLabel?: string
    allDayLabel?: string
  }>(),
  {
    events: () => [],
    view: 'week',
    startHour: 7,
    endHour: 22,
    weekStartsOn: 1,
    hourHeight: 56,
    nowIndicator: true,
  },
)

// Falls back to the app's own configured locale (via createM3UI/useLocale) rather than a
// fixed default, matching the pattern MRelativeTime already uses.
const resolvedLocale = computed(() => props.locale ?? locale.lang)

const emit = defineEmits<{
  eventClick: [SchedulerEvent]
  slotClick: [{ date: string; hour: number }]
  'update:date': [string]
  'update:view': ['week' | 'day']
}>()

defineSlots<{
  /** Content of an event block. */
  event?: (scope: { event: SchedulerEvent; allDay: boolean }) => unknown
}>()

// ── Dates ─────────────────────────────────────────────────────────────────────────────────────

/** A date-only string is local midnight (`new Date('2026-10-17')` alone would be UTC). */
function parse(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00`) : new Date(s)
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function startOfWeek(d: Date) {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  const diff = (dt.getDay() - props.weekStartsOn + 7) % 7
  return addDays(dt, -diff)
}

const currentDate = ref(props.date ? parse(props.date) : new Date())
const currentView = ref(props.view)
watch(() => props.date, (d) => d && fmt(parse(d)) !== fmt(currentDate.value) && (currentDate.value = parse(d)))
watch(() => props.view, (v) => (currentView.value = v))

function setDate(d: Date) {
  currentDate.value = d
  emit('update:date', fmt(d))
}

function setView(v: 'week' | 'day') {
  currentView.value = v
  emit('update:view', v)
}

const visibleDays = computed(() => {
  if (currentView.value === 'day') {
    const d = new Date(currentDate.value)
    d.setHours(0, 0, 0, 0)
    return [d]
  }
  const start = startOfWeek(currentDate.value)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
})
const visibleKeys = computed(() => visibleDays.value.map(fmt))

const now = ref(new Date())
let nowTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => (nowTimer = setInterval(() => (now.value = new Date()), 60_000)))
onBeforeUnmount(() => nowTimer && clearInterval(nowTimer))
const todayKey = computed(() => fmt(now.value))

const dayFormat = computed(() => new Intl.DateTimeFormat(resolvedLocale.value, { weekday: 'short' }))
const dateFormat = computed(() => new Intl.DateTimeFormat(resolvedLocale.value, { day: 'numeric' }))
const timeFormat = computed(() => new Intl.DateTimeFormat(resolvedLocale.value, { hour: '2-digit', minute: '2-digit' }))

const headerLabel = computed(() => {
  if (currentView.value === 'day') {
    return new Intl.DateTimeFormat(resolvedLocale.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(currentDate.value)
  }
  const start = visibleDays.value[0]!
  const end = visibleDays.value[6]!
  const f = new Intl.DateTimeFormat(resolvedLocale.value, { day: 'numeric', month: 'short' })
  return `${f.format(start)} – ${f.format(end)}, ${end.getFullYear()}`
})

function navigate(delta: number) {
  setDate(addDays(currentDate.value, delta * (currentView.value === 'week' ? 7 : 1)))
}

function openDay(d: Date) {
  if (currentView.value === 'day') return
  setDate(d)
  setView('day')
}

// ── Layout ────────────────────────────────────────────────────────────────────────────────────

const hours = computed(() => Array.from({ length: props.endHour - props.startHour }, (_, i) => props.startHour + i))
const gridStyle = computed(() => ({
  gridTemplateColumns: `4rem repeat(${visibleDays.value.length}, ${currentView.value === 'week' ? 'minmax(5.5rem, 1fr)' : 'minmax(0, 1fr)'})`,
}))

/** Everything that doesn't fit in one day's time grid goes to the all-day row. */
function isBandEvent(ev: SchedulerEvent) {
  if (ev.allDay) return true
  const start = parse(ev.start)
  const lastInstant = new Date(parse(ev.end).getTime() - 1)
  return fmt(start) !== fmt(lastInstant)
}

interface Bar { event: SchedulerEvent; from: number; to: number; lane: number; clippedStart: boolean; clippedEnd: boolean }

const bars = computed<Bar[]>(() => {
  const keys = visibleKeys.value
  const first = keys[0]!
  const last = keys[keys.length - 1]!
  const placed: Bar[] = []
  const laneEnds: number[] = []
  const candidates = props.events
    .filter(isBandEvent)
    .map((event) => {
      const startKey = fmt(parse(event.start))
      const endKey = event.allDay ? fmt(parse(event.end)) : fmt(new Date(parse(event.end).getTime() - 1))
      return { event, startKey, endKey }
    })
    .filter(({ startKey, endKey }) => endKey >= first && startKey <= last)
    .sort((a, b) => a.startKey.localeCompare(b.startKey) || b.endKey.localeCompare(a.endKey))
  for (const { event, startKey, endKey } of candidates) {
    const from = startKey < first ? 0 : keys.indexOf(startKey)
    const to = endKey > last ? keys.length - 1 : keys.indexOf(endKey)
    let lane = laneEnds.findIndex((end) => end < from)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = to
    placed.push({ event, from, to, lane, clippedStart: startKey < first, clippedEnd: endKey > last })
  }
  return placed
})
const laneCount = computed(() => bars.value.reduce((n, b) => Math.max(n, b.lane + 1), 0))

interface Block { event: SchedulerEvent; top: number; height: number; column: number; columns: number; minutes: number }

/** Timed events of one day, placed in side-by-side columns where they overlap. */
function blocksFor(day: Date): Block[] {
  const key = fmt(day)
  const lo = props.startHour * 60
  const hi = props.endHour * 60
  const items = props.events
    .filter((ev) => !isBandEvent(ev) && fmt(parse(ev.start)) === key)
    .map((event) => {
      const s = parse(event.start)
      const e = parse(event.end)
      const startMin = s.getHours() * 60 + s.getMinutes()
      const endMin = fmt(e) === key ? e.getHours() * 60 + e.getMinutes() : 24 * 60
      return { event, startMin, endMin: Math.max(endMin, startMin + 15) }
    })
    .filter((it) => it.endMin > lo && it.startMin < hi)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  const blocks: Block[] = []
  let cluster: { item: (typeof items)[number]; column: number }[] = []
  let clusterEnd = -1
  const flush = () => {
    const columns = cluster.reduce((n, c) => Math.max(n, c.column + 1), 0)
    for (const { item, column } of cluster) {
      const top = ((Math.max(item.startMin, lo) - lo) / 60) * props.hourHeight
      const bottom = ((Math.min(item.endMin, hi) - lo) / 60) * props.hourHeight
      blocks.push({ event: item.event, top, height: Math.max(bottom - top, 20), column, columns, minutes: item.endMin - item.startMin })
    }
    cluster = []
  }
  for (const item of items) {
    if (item.startMin >= clusterEnd && cluster.length) flush()
    const taken = new Set(cluster.filter((c) => c.item.endMin > item.startMin).map((c) => c.column))
    let column = 0
    while (taken.has(column)) column++
    cluster.push({ item, column })
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  if (cluster.length) flush()
  return blocks
}

const nowTop = computed(() => {
  const min = now.value.getHours() * 60 + now.value.getMinutes()
  if (min < props.startHour * 60 || min >= props.endHour * 60) return null
  return ((min - props.startHour * 60) / 60) * props.hourHeight
})

function timeLabel(ev: SchedulerEvent) {
  return `${timeFormat.value.format(parse(ev.start))} – ${timeFormat.value.format(parse(ev.end))}`
}

function onColumnClick(e: MouseEvent, day: Date) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const hour = Math.min(props.startHour + Math.floor((e.clientY - rect.top) / props.hourHeight), props.endHour - 1)
  emit('slotClick', { date: fmt(day), hour: Math.max(hour, props.startHour) })
}

const eventColors: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container border-primary/30',
  secondary: 'bg-secondary-container text-on-secondary-container border-secondary/30',
  tertiary: 'bg-tertiary-container text-on-tertiary-container border-tertiary/30',
  error: 'bg-error-container text-on-error-container border-error/30',
  success: 'bg-success-container text-on-success-container border-success/30',
}
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-lg border border-outline-variant">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container px-4 py-3">
      <div class="flex items-center gap-1">
        <MIconButton icon="chevron_left" :label="prevLabel ?? locale.previous" :size="36" @click="navigate(-1)" />
        <MIconButton icon="chevron_right" :label="nextLabel ?? locale.next" :size="36" @click="navigate(1)" />
        <button
          type="button"
          class="ml-2 cursor-pointer rounded-full border border-outline px-3 py-1 text-label-medium text-on-surface transition-colors hover:bg-on-surface/8"
          @click="setDate(new Date())"
        >
          {{ todayLabel ?? locale.today }}
        </button>
      </div>

      <h3 class="text-title-medium font-medium capitalize text-on-surface">{{ headerLabel }}</h3>

      <div class="flex rounded-full bg-surface-container-high p-0.5">
        <button
          v-for="v in (['day', 'week'] as const)"
          :key="v"
          type="button"
          class="cursor-pointer rounded-full px-3 py-1 text-label-medium transition-all duration-150"
          :class="currentView === v ? 'bg-secondary-container text-on-secondary-container shadow-elevation-1' : 'text-on-surface-variant hover:bg-on-surface/8'"
          @click="setView(v)"
        >
          {{ v === 'day' ? (dayViewLabel ?? locale.dayView) : (weekViewLabel ?? locale.weekView) }}
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <div class="min-w-fit">
        <!-- Day headers -->
        <div class="sticky top-0 z-20 grid border-b border-outline-variant bg-surface-container" :style="gridStyle">
          <div class="border-r border-outline-variant" />
          <button
            v-for="day in visibleDays"
            :key="fmt(day)"
            type="button"
            class="border-r border-outline-variant px-2 py-2 text-center last:border-r-0"
            :class="[fmt(day) === todayKey ? 'bg-primary-container/30' : '', currentView === 'week' ? 'cursor-pointer hover:bg-on-surface/8' : 'cursor-default']"
            :tabindex="currentView === 'week' ? 0 : -1"
            @click="openDay(day)"
          >
            <span class="block text-label-small uppercase text-on-surface-variant">{{ dayFormat.format(day) }}</span>
            <span
              class="mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-title-medium"
              :class="fmt(day) === todayKey ? 'bg-primary font-medium text-on-primary' : 'text-on-surface'"
            >
              {{ dateFormat.format(day) }}
            </span>
          </button>
        </div>

        <!-- All-day row: all-day events and events spanning several days -->
        <div v-if="laneCount" class="grid border-b border-outline-variant" :style="gridStyle" data-scheduler-all-day>
          <div class="flex items-start justify-end border-r border-outline-variant px-2 py-1.5 text-right text-label-small text-on-surface-variant">
            {{ allDayLabel ?? locale.allDay }}
          </div>
          <div
            class="grid gap-y-1 py-1"
            :style="{ gridColumn: `2 / span ${visibleDays.length}`, gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${laneCount}, 1.5rem)` }"
          >
            <button
              v-for="bar in bars"
              :key="bar.event.id"
              type="button"
              class="mx-0.5 flex min-w-0 cursor-pointer items-center overflow-hidden border-l-[3px] px-2 text-left text-label-small font-medium transition-opacity hover:opacity-90"
              :class="[eventColors[bar.event.color ?? 'primary'], bar.clippedStart ? 'rounded-r border-l-0' : 'rounded', bar.clippedEnd ? 'rounded-r-none' : '']"
              :style="{ gridColumn: `${bar.from + 1} / ${bar.to + 2}`, gridRow: bar.lane + 1 }"
              :aria-label="bar.event.title"
              data-scheduler-bar
              @click="emit('eventClick', bar.event)"
            >
              <slot name="event" :event="bar.event" :all-day="true">
                <span v-if="bar.clippedStart" aria-hidden="true" class="mr-1">‹</span>
                <span class="truncate">{{ bar.event.title }}</span>
                <span v-if="bar.clippedEnd" aria-hidden="true" class="ml-auto pl-1">›</span>
              </slot>
            </button>
          </div>
        </div>

        <!-- Time grid -->
        <div class="grid" :style="gridStyle">
          <div class="border-r border-outline-variant">
            <div v-for="hour in hours" :key="hour" class="relative pr-2 text-right" :style="{ height: `${hourHeight}px` }">
              <span v-if="hour !== startHour" class="relative -top-2 text-label-small text-on-surface-variant">{{ String(hour).padStart(2, '0') }}:00</span>
            </div>
          </div>

          <div
            v-for="day in visibleDays"
            :key="fmt(day)"
            class="relative cursor-pointer border-r border-outline-variant/50 last:border-r-0"
            :class="fmt(day) === todayKey ? 'bg-primary-container/5' : ''"
            :data-scheduler-day="fmt(day)"
            @click="onColumnClick($event, day)"
          >
            <div v-for="hour in hours" :key="hour" class="border-b border-outline-variant/50" :style="{ height: `${hourHeight}px` }" />

            <button
              v-for="b in blocksFor(day)"
              :key="b.event.id"
              type="button"
              class="absolute z-5 cursor-pointer overflow-hidden rounded border-l-[3px] px-2 py-1 text-left transition-opacity hover:opacity-90"
              :class="eventColors[b.event.color ?? 'primary']"
              :style="{
                top: `${b.top + 1}px`,
                height: `${b.height - 2}px`,
                left: `calc(${(b.column / b.columns) * 100}% + 2px)`,
                width: `calc(${100 / b.columns}% - 4px)`,
              }"
              :aria-label="`${b.event.title}, ${timeLabel(b.event)}`"
              data-scheduler-event
              @click.stop="emit('eventClick', b.event)"
            >
              <slot name="event" :event="b.event" :all-day="false">
                <p class="truncate text-label-small font-medium">{{ b.event.title }}</p>
                <p v-if="b.minutes >= 45" class="truncate text-label-small opacity-70">{{ timeLabel(b.event) }}</p>
              </slot>
            </button>

            <div
              v-if="nowIndicator && fmt(day) === todayKey && nowTop !== null"
              class="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-error"
              :style="{ top: `${nowTop}px` }"
              data-scheduler-now
            >
              <span class="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-error" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
