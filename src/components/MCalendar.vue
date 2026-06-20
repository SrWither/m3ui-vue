<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

export interface CalendarEvent {
  id: string | number
  title: string
  date: string
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
  icon?: string
}

const props = withDefaults(defineProps<{
  events?: CalendarEvent[]
  locale?: string
  todayLabel?: string
  prevMonthLabel?: string
  nextMonthLabel?: string
}>(), {
  events: () => [],
  locale: 'es-ES',
})

const localeStrings = useLocale()

const emit = defineEmits<{
  dateClick: [string]
  eventClick: [CalendarEvent]
}>()

const viewDate = ref(new Date())

const WEEKDAYS = (() => {
  const f = new Intl.DateTimeFormat(props.locale, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, i + 1)))
})()

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(props.locale, { month: 'long', year: 'numeric' }).format(viewDate.value)
)

function fmt(y: number, m: number, d: number) {
  const dt = new Date(y, m, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const todayIso = fmt(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

interface CalendarDay {
  date: number
  iso: string
  current: boolean
  events: CalendarEvent[]
}

const calendarDays = computed<CalendarDay[]>(() => {
  const y = viewDate.value.getFullYear()
  const m = viewDate.value.getMonth()
  const first = new Date(y, m, 1)
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const days: CalendarDay[] = []

  const eventMap = new Map<string, CalendarEvent[]>()
  for (const ev of props.events) {
    if (!eventMap.has(ev.date)) eventMap.set(ev.date, [])
    eventMap.get(ev.date)!.push(ev)
  }

  const prevMonth = new Date(y, m, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonth - i
    const iso = fmt(y, m - 1, d)
    days.push({ date: d, current: false, iso, events: eventMap.get(iso) ?? [] })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = fmt(y, m, d)
    days.push({ date: d, current: true, iso, events: eventMap.get(iso) ?? [] })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const iso = fmt(y, m + 1, d)
    days.push({ date: d, current: false, iso, events: eventMap.get(iso) ?? [] })
  }
  return days
})

function prevMonth() { const d = new Date(viewDate.value); d.setMonth(d.getMonth() - 1); viewDate.value = d }
function nextMonth() { const d = new Date(viewDate.value); d.setMonth(d.getMonth() + 1); viewDate.value = d }
function goToday() { viewDate.value = new Date() }

const eventColor: Record<string, string> = {
  primary:   'bg-primary text-on-primary',
  secondary: 'bg-secondary text-on-secondary',
  tertiary:  'bg-tertiary text-on-tertiary',
  error:     'bg-error text-on-error',
  success:   'bg-success text-on-success',
}
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-lg border border-outline-variant">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-3">
      <div class="flex items-center gap-1">
        <MIconButton icon="chevron_left" :label="prevMonthLabel ?? localeStrings.previousMonth" :size="36" @click="prevMonth" />
        <MIconButton icon="chevron_right" :label="nextMonthLabel ?? localeStrings.nextMonth" :size="36" @click="nextMonth" />
      </div>
      <h3 class="text-title-medium font-medium capitalize text-on-surface">{{ monthLabel }}</h3>
      <button
        type="button"
        class="cursor-pointer rounded-full border border-outline px-3 py-1 text-label-medium text-on-surface transition-colors hover:bg-on-surface/8"
        @click="goToday"
      >
        {{ todayLabel ?? localeStrings.today }}
      </button>
    </div>

    <!-- Weekday headers -->
    <div class="grid grid-cols-7 border-b border-outline-variant bg-surface-container-high">
      <div
        v-for="wd in WEEKDAYS"
        :key="wd"
        class="py-2 text-center text-label-small font-medium uppercase text-on-surface-variant"
      >
        {{ wd }}
      </div>
    </div>

    <!-- Days grid -->
    <div class="grid grid-cols-7">
      <div
        v-for="(day, i) in calendarDays"
        :key="i"
        class="flex min-h-[80px] cursor-pointer flex-col border-b border-r border-outline-variant/50 p-1.5 transition-colors hover:bg-on-surface/3"
        :class="[
          !day.current ? 'bg-surface-container-lowest/50' : 'bg-surface',
          (i + 1) % 7 === 0 ? 'border-r-0' : '',
          i >= 35 ? 'border-b-0' : '',
        ]"
        @click="emit('dateClick', day.iso)"
      >
        <!-- Day number -->
        <span
          class="mb-0.5 flex h-6 w-6 items-center justify-center self-end rounded-full text-label-medium"
          :class="
            day.iso === todayIso
              ? 'bg-primary text-on-primary font-medium'
              : day.current
                ? 'text-on-surface'
                : 'text-on-surface-variant/40'
          "
        >
          {{ day.date }}
        </span>

        <!-- Events -->
        <div v-if="day.events.length" class="flex flex-col gap-0.5">
          <button
            v-for="ev in day.events.slice(0, 2)"
            :key="ev.id"
            type="button"
            class="flex w-full cursor-pointer items-center gap-1 truncate rounded px-1 py-0.5 text-left text-label-small transition-opacity hover:opacity-80"
            :class="eventColor[ev.color ?? 'primary']"
            @click.stop="emit('eventClick', ev)"
          >
            <MIcon v-if="ev.icon" :name="ev.icon" :size="12" />
            <span class="truncate">{{ ev.title }}</span>
          </button>
          <span
            v-if="day.events.length > 2"
            class="px-1 text-label-small text-on-surface-variant"
          >
            +{{ day.events.length - 2 }} {{ localeStrings.more }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
