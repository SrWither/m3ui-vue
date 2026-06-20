<script setup lang="ts">
import { ref, computed } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

export interface SchedulerEvent {
  id: string | number
  title: string
  start: string
  end: string
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
}

const props = withDefaults(
  defineProps<{
    events?: SchedulerEvent[]
    view?: 'week' | 'day'
    startHour?: number
    endHour?: number
    locale?: string
    prevLabel?: string
    nextLabel?: string
    todayLabel?: string
    dayViewLabel?: string
    weekViewLabel?: string
  }>(),
  {
    events: () => [],
    view: 'week',
    startHour: 7,
    endHour: 22,
    locale: 'es-ES',
  },
)

const emit = defineEmits<{
  eventClick: [SchedulerEvent]
  slotClick: [{ date: string; hour: number }]
}>()

const currentDate = ref(new Date())
const currentView = ref(props.view)

const hours = computed(() =>
  Array.from({ length: props.endHour - props.startHour }, (_, i) => props.startHour + i),
)

function startOfWeek(d: Date) {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

const weekDays = computed(() => {
  const start = startOfWeek(currentDate.value)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
})

const visibleDays = computed(() =>
  currentView.value === 'day' ? [currentDate.value] : weekDays.value,
)

const todayIso = (() => {
  const d = new Date()
  return fmt(d)
})()

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dayFormat = new Intl.DateTimeFormat(props.locale, { weekday: 'short' })
const dateFormat = new Intl.DateTimeFormat(props.locale, { day: 'numeric' })

const headerLabel = computed(() => {
  if (currentView.value === 'day') {
    return new Intl.DateTimeFormat(props.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(currentDate.value)
  }
  const start = weekDays.value[0]!
  const end = weekDays.value[6]!
  const f = new Intl.DateTimeFormat(props.locale, { day: 'numeric', month: 'short' })
  return `${f.format(start)} – ${f.format(end)}, ${end.getFullYear()}`
})

function navigate(delta: number) {
  const d = new Date(currentDate.value)
  if (currentView.value === 'week') d.setDate(d.getDate() + delta * 7)
  else d.setDate(d.getDate() + delta)
  currentDate.value = d
}

function goToday() { currentDate.value = new Date() }

function eventsForDayHour(day: Date, hour: number) {
  const dayStr = fmt(day)
  return props.events.filter((ev) => {
    const start = new Date(ev.start)
    const end = new Date(ev.end)
    const evDay = fmt(start)
    if (evDay !== dayStr) return false
    const evStartHour = start.getHours()
    const evEndHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
    return hour >= evStartHour && hour < evEndHour
  })
}

function isEventStart(ev: SchedulerEvent, hour: number) {
  return new Date(ev.start).getHours() === hour
}

function eventDuration(ev: SchedulerEvent) {
  const start = new Date(ev.start)
  const end = new Date(ev.end)
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000))
}

function timeLabel(ev: SchedulerEvent) {
  const f = new Intl.DateTimeFormat(props.locale, { hour: '2-digit', minute: '2-digit' })
  return `${f.format(new Date(ev.start))} – ${f.format(new Date(ev.end))}`
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
    <div class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-3">
      <div class="flex items-center gap-1">
        <MIconButton icon="chevron_left" :label="prevLabel ?? locale.previous" :size="36" @click="navigate(-1)" />
        <MIconButton icon="chevron_right" :label="nextLabel ?? locale.next" :size="36" @click="navigate(1)" />
        <button
          type="button"
          class="ml-2 cursor-pointer rounded-full border border-outline px-3 py-1 text-label-medium text-on-surface transition-colors hover:bg-on-surface/8"
          @click="goToday"
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
          @click="currentView = v"
        >
          {{ v === 'day' ? (dayViewLabel ?? locale.dayView) : (weekViewLabel ?? locale.weekView) }}
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="overflow-auto">
      <table class="w-full border-collapse">
        <!-- Day headers -->
        <thead>
          <tr>
            <th class="sticky top-0 z-10 w-16 border-b border-r border-outline-variant bg-surface-container p-2" />
            <th
              v-for="day in visibleDays"
              :key="fmt(day)"
              class="sticky top-0 z-10 border-b border-r border-outline-variant bg-surface-container px-2 py-2 text-center last:border-r-0"
              :class="fmt(day) === todayIso ? 'bg-primary-container/30' : ''"
            >
              <div class="text-label-small uppercase text-on-surface-variant">{{ dayFormat.format(day) }}</div>
              <div
                class="mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-title-medium"
                :class="fmt(day) === todayIso ? 'bg-primary text-on-primary font-medium' : 'text-on-surface'"
              >
                {{ dateFormat.format(day) }}
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="hour in hours" :key="hour">
            <!-- Hour label -->
            <td class="w-16 border-r border-b border-outline-variant/50 p-0 pr-2 text-right align-top">
              <span class="relative -top-2.5 text-label-small text-on-surface-variant">
                {{ String(hour).padStart(2, '0') }}:00
              </span>
            </td>

            <!-- Day cells -->
            <td
              v-for="day in visibleDays"
              :key="fmt(day)"
              class="relative h-14 border-r border-b border-outline-variant/50 p-0 last:border-r-0"
              :class="fmt(day) === todayIso ? 'bg-primary-container/5' : ''"
              @click="emit('slotClick', { date: fmt(day), hour })"
            >
              <template v-for="ev in eventsForDayHour(day, hour)" :key="ev.id">
                <button
                  v-if="isEventStart(ev, hour)"
                  type="button"
                  class="absolute inset-x-0.5 top-0.5 z-5 cursor-pointer overflow-hidden rounded border-l-[3px] px-2 py-1 text-left transition-opacity hover:opacity-90"
                  :class="eventColors[ev.color ?? 'primary']"
                  :style="{ height: `calc(${eventDuration(ev) * 100}% - 4px)` }"
                  @click.stop="emit('eventClick', ev)"
                >
                  <p class="truncate text-label-small font-medium">{{ ev.title }}</p>
                  <p class="truncate text-label-small opacity-70">{{ timeLabel(ev) }}</p>
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
