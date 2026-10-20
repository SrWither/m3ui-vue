<script setup lang="ts">
/**
 * A modal, centered date range picker with range highlighting — the sibling of MDateRangePicker, a fully
 * separate component rather than a shared internal.
 *
 * @event update:modelValue Emitted when the end date is confirmed — powers v-model
 * @event update:show Emitted when the dialog opens or closes — powers v-model:show
 */
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MDialog from './MDialog.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'
import { isoDate as fmt, useCalendarMonth } from '../composables/_useCalendarMonth'

export interface DateRange {
  start: string | null
  end: string | null
}

const props = withDefaults(defineProps<{
  /** Selected date range (v-model) — see `DateRange` */
  modelValue: DateRange
  /** Controls dialog visibility (v-model:show) */
  show?: boolean
  /** Minimum selectable date (YYYY-MM-DD) */
  min?: string
  /** Maximum selectable date (YYYY-MM-DD) */
  max?: string
  /**
   * Locale for month/day names. Falls back to the app's configured locale (createM3UI({ locale })) — same
   * pattern as MRelativeTime
   */
  locale?: string
  /** Dialog title */
  title?: string
}>(), {
  show: false,
})

const locale = useLocale()

// Falls back to the app's own configured locale (via createM3UI/useLocale) rather than a
// fixed default, matching the pattern MRelativeTime already uses — previously this defaulted
// to a hardcoded 'es-ES' regardless of what locale the app actually provided.
const resolvedLocale = computed(() => props.locale ?? locale.lang)

const emit = defineEmits<{
  'update:modelValue': [DateRange]
  'update:show': [boolean]
}>()

const picking = ref<'start' | 'end'>('start')
const start = ref<string | null>(null)
const end = ref<string | null>(null)
const hovered = ref<string | null>(null)
const viewDate = ref(new Date())

watch(() => props.show, (open) => {
  if (open) {
    start.value = props.modelValue?.start ?? null
    end.value = props.modelValue?.end ?? null
    picking.value = start.value && !end.value ? 'end' : 'start'
    viewDate.value = props.modelValue?.start
      ? new Date(props.modelValue.start + 'T00:00:00')
      : new Date()
  }
})

// ── Calendar logic ─────────────────────────────────────────────────
// Weekday names, the month's title and its six-week grid, shared with the other date pickers
const { weekdays: WEEKDAYS, monthLabel, days: calendarDays, isOutOfRange: isOOR, prevMonth, nextMonth } = useCalendarMonth(viewDate, {
  locale: () => resolvedLocale.value,
  min: () => props.min,
  max: () => props.max,
})

const todayIso = fmt(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

function selectDay(day: typeof calendarDays.value[0]) {
  if (day.disabled) return
  if (picking.value === 'start') {
    start.value = day.iso
    end.value = null
    picking.value = 'end'
  } else {
    if (day.iso < start.value!) {
      start.value = day.iso
      end.value = null
    } else {
      end.value = day.iso
      picking.value = 'start'
    }
  }
}

function isInRange(iso: string) {
  const effectiveEnd = end.value ?? hovered.value
  if (!start.value || !effectiveEnd) return false
  const lo = start.value < effectiveEnd ? start.value : effectiveEnd
  const hi = start.value < effectiveEnd ? effectiveEnd : start.value
  return iso > lo && iso < hi
}

// ── Display ────────────────────────────────────────────────────────
const fmtDisplay = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat(resolvedLocale.value, { month: 'short', day: 'numeric' }).format(d)
}

// ── Actions ────────────────────────────────────────────────────────
function cancel() { emit('update:show', false) }

function confirm() {
  if (start.value && end.value) {
    emit('update:modelValue', { start: start.value, end: end.value })
    emit('update:show', false)
  }
}

// Escape or the scrim (MDialog) cancel, like the Cancel button
function onDialog(open: boolean) {
  if (!open) cancel()
}
</script>

<template>
  <!-- MDialog's bare box: scrim, Escape, scroll lock, the open/close animation and dialog semantics -->
  <MDialog :model-value="show" bare max-width="360px" :title="title || locale.selectRange" @update:model-value="onDialog">
    <!-- Header -->
    <div class="px-6 pt-6 pb-4">
      <p class="mb-3 text-label-large text-on-surface-variant">
        {{ title || locale.selectRange }}
      </p>
      <div class="flex items-center gap-3">
        <div
          class="flex-1 rounded-lg px-3 py-2 text-center transition-colors"
          :class="picking === 'start' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface'"
          @click="picking = 'start'"
        >
          <p class="text-label-small text-on-surface-variant">{{ locale.pickStart }}</p>
          <p class="text-title-medium font-medium capitalize">{{ fmtDisplay(start) }}</p>
        </div>
        <span class="text-on-surface-variant">→</span>
        <div
          class="flex-1 rounded-lg px-3 py-2 text-center transition-colors"
          :class="picking === 'end' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface'"
          @click="start && (picking = 'end')"
        >
          <p class="text-label-small text-on-surface-variant">{{ locale.pickEnd }}</p>
          <p class="text-title-medium font-medium capitalize">{{ fmtDisplay(end) }}</p>
        </div>
      </div>
    </div>

    <div class="h-px bg-outline-variant" />

    <!-- Calendar -->
    <div class="px-4 pt-3 pb-2">
      <div class="mb-2 flex items-center justify-between">
        <MIconButton icon="chevron_left" :label="locale.previousMonth" :size="36" @click="prevMonth" />
        <span class="text-title-small font-medium capitalize text-on-surface">{{ monthLabel }}</span>
        <MIconButton icon="chevron_right" :label="locale.nextMonth" :size="36" @click="nextMonth" />
      </div>

      <div class="mb-1 grid grid-cols-7 gap-0.5 text-center">
        <span v-for="wd in WEEKDAYS" :key="wd" class="py-1 text-body-large font-medium text-on-surface">
          {{ wd }}
        </span>
      </div>

      <div class="grid grid-cols-7 gap-0.5">
        <button
          v-for="(day, i) in calendarDays"
          :key="i"
          type="button"
          class="flex h-10 w-full items-center justify-center text-body-medium transition-colors duration-100"
          :class="[
            day.disabled
              ? 'cursor-not-allowed text-on-surface/25 rounded-full'
              : day.iso === start || day.iso === end
                ? 'bg-primary text-on-primary rounded-full'
                : isInRange(day.iso)
                  ? 'bg-primary/12 text-on-surface cursor-pointer'
                  : day.iso === todayIso
                    ? 'border border-primary text-primary rounded-full cursor-pointer hover:bg-primary/8'
                    : day.current
                      ? 'cursor-pointer text-on-surface rounded-full hover:bg-on-surface/8'
                      : 'cursor-pointer text-on-surface-variant/50 rounded-full hover:bg-on-surface/4',
          ]"
          :disabled="day.disabled"
          @mouseenter="picking === 'end' && (hovered = day.iso)"
          @click="selectDay(day)"
        >
          {{ day.date }}
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 px-6 py-4">
      <MButton variant="text" @click="cancel">{{ locale.cancel }}</MButton>
      <MButton variant="text" :disabled="!start || !end" @click="confirm">{{ locale.ok }}</MButton>
    </div>
  </MDialog>
</template>
