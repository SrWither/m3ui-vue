<script setup lang="ts">
/**
 * A modal, centered date picker with calendar and keyboard input modes. For a field that opens a dropdown
 * calendar, use MDatePicker.
 *
 * @event update:modelValue Emitted when a date is confirmed — powers v-model
 * @event update:show Emitted when the dialog opens or closes — powers v-model:show
 */
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MDialog from './MDialog.vue'
import MIconButton from './MIconButton.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { isoDate as fmt, useCalendarMonth } from '../composables/_useCalendarMonth'

const props = withDefaults(defineProps<{
  /** Selected date in YYYY-MM-DD format (v-model) */
  modelValue: string | null
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
  modelValue: null,
  show: false,
})

const locale = useLocale()

// Falls back to the app's own configured locale (via createM3UI/useLocale) rather than a
// fixed default, matching the pattern MRelativeTime already uses — previously this defaulted
// to a hardcoded 'es-ES' regardless of what locale the app actually provided.
const resolvedLocale = computed(() => props.locale ?? locale.lang)

const emit = defineEmits<{
  'update:modelValue': [string | null]
  'update:show': [boolean]
}>()

const inputMode = ref<'calendar' | 'input'>('calendar')
const selected = ref<string | null>(null)
const viewDate = ref(new Date())
const dateInput = ref('')

watch(() => props.show, (open) => {
  if (open) {
    selected.value = props.modelValue ?? null
    viewDate.value = props.modelValue ? new Date(props.modelValue + 'T00:00:00') : new Date()
    inputMode.value = 'calendar'
    dateInput.value = props.modelValue ? isoToDisplay(props.modelValue) : ''
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
  selected.value = day.iso
}

// ── Display ────────────────────────────────────────────────────────
const headerDate = computed(() => {
  if (!selected.value) return '—'
  const d = new Date(selected.value + 'T00:00:00')
  return new Intl.DateTimeFormat(resolvedLocale.value, { weekday: 'short', month: 'short', day: 'numeric' }).format(d)
})

// ── Input mode ─────────────────────────────────────────────────────
// The text input follows the locale's numeric date: its order and separator, from Intl (DD/MM/YYYY in Spain,
// MM/DD/YYYY in the US, YYYY. MM. DD in Korea…). It was DD/MM/YYYY for every language.
const dateFormat = computed(() => {
  const parts = new Intl.DateTimeFormat(resolvedLocale.value, { day: '2-digit', month: '2-digit', year: 'numeric' })
    .formatToParts(new Date(2026, 5, 23))
  const order = parts.map((p) => p.type).filter((t): t is 'day' | 'month' | 'year' => t === 'day' || t === 'month' || t === 'year')
  const sep = parts.find((p) => p.type === 'literal')?.value ?? '/'
  return { order: order.length === 3 ? order : (['day', 'month', 'year'] as const), sep }
})
// The placeholder: DD/MM/YYYY in the locale's order
const datePattern = computed(() =>
  dateFormat.value.order.map((t) => (t === 'day' ? 'DD' : t === 'month' ? 'MM' : 'YYYY')).join(dateFormat.value.sep.trim() || '/'),
)

function isoToDisplay(iso: string) {
  const [year, month, day] = iso.split('-')
  const parts: Record<string, string | undefined> = { year, month, day }
  return dateFormat.value.order.map((t) => parts[t]).join(dateFormat.value.sep)
}

// Any separator is accepted; a day or month may have one digit. Not a real date (31/02): null
function displayToIso(display: string) {
  const nums = display.trim().split(/\D+/).filter(Boolean)
  if (nums.length !== 3) return null
  const parts: Record<string, string> = {}
  dateFormat.value.order.forEach((t, i) => { parts[t] = nums[i]! })
  const { year, month, day } = parts as { year: string; month: string; day: string }
  if (year.length !== 4 || month.length > 2 || day.length > 2) return null
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function applyInput() {
  const iso = displayToIso(dateInput.value)
  if (!iso) return
  if (!isOOR(iso)) {
    selected.value = iso
    viewDate.value = new Date(iso + 'T00:00:00')
  }
}

// ── Actions ────────────────────────────────────────────────────────
function cancel() { emit('update:show', false) }

function confirm() {
  if (inputMode.value === 'input') applyInput()
  if (selected.value) {
    emit('update:modelValue', selected.value)
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
  <MDialog :model-value="show" bare max-width="360px" :title="title || locale.selectDate" @update:model-value="onDialog">
    <!-- Header -->
    <div class="px-6 pt-6 pb-4">
      <p class="mb-3 text-label-large text-on-surface-variant">
        {{ title || locale.selectDate }}
      </p>
      <div class="flex items-center justify-between">
        <span class="text-headline-large font-medium capitalize text-on-surface-variant">
          {{ headerDate }}
        </span>
        <MIconButton
          :icon="inputMode === 'calendar' ? 'edit' : 'calendar_today'"
          :label="inputMode === 'calendar' ? locale.dateToggleInput : locale.dateToggleCalendar"
          @click="inputMode = inputMode === 'calendar' ? 'input' : 'calendar'"
        />
      </div>
    </div>

    <div class="h-px bg-outline-variant" />

    <!-- Calendar mode -->
    <div v-if="inputMode === 'calendar'" class="px-4 pt-3 pb-2">
      <!-- Month nav -->
      <div class="mb-2 flex items-center justify-between">
        <MIconButton icon="chevron_left" :label="locale.previousMonth" :size="36" @click="prevMonth" />
        <span class="text-title-small font-medium capitalize text-on-surface">{{ monthLabel }}</span>
        <MIconButton icon="chevron_right" :label="locale.nextMonth" :size="36" @click="nextMonth" />
      </div>

      <!-- Weekday headers -->
      <div class="mb-1 grid grid-cols-7 gap-0.5 text-center">
        <span v-for="wd in WEEKDAYS" :key="wd" class="py-1 text-body-large font-medium text-on-surface">
          {{ wd }}
        </span>
      </div>

      <!-- Days grid -->
      <div class="grid grid-cols-7 gap-0.5">
        <button
          v-for="(day, i) in calendarDays"
          :key="i"
          type="button"
          class="flex h-10 w-full items-center justify-center rounded-full text-body-medium transition-colors duration-100"
          :class="[
            day.disabled
              ? 'cursor-not-allowed text-on-surface/25'
              : day.iso === selected
                ? 'bg-primary text-on-primary'
                : day.iso === todayIso
                  ? 'border border-primary text-primary cursor-pointer hover:bg-primary/8'
                  : day.current
                    ? 'cursor-pointer text-on-surface hover:bg-on-surface/8'
                    : 'cursor-pointer text-on-surface-variant/50 hover:bg-on-surface/4',
          ]"
          :disabled="day.disabled"
          @click="selectDay(day)"
        >
          {{ day.date }}
        </button>
      </div>
    </div>

    <!-- Input mode -->
    <div v-else class="px-6 py-6">
      <label class="mb-2 block text-label-medium text-on-surface-variant">{{ locale.dateInputLabel }} ({{ datePattern }})</label>
      <input
        v-model="dateInput"
        type="text"
        :placeholder="datePattern"
        maxlength="14"
        class="h-14 w-full rounded-xs border border-outline bg-transparent px-4 text-body-large text-on-surface caret-primary outline-none transition-colors focus:border-2 focus:border-primary"
        @keydown.enter="applyInput"
        @blur="applyInput"
      />
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 px-6 pb-4">
      <MButton variant="text" @click="cancel">{{ locale.cancel }}</MButton>
      <MButton variant="text" :disabled="!selected" @click="confirm">{{ locale.ok }}</MButton>
    </div>
  </MDialog>
</template>
