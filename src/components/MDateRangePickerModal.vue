<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

export interface DateRange {
  start: string | null
  end: string | null
}

const props = withDefaults(defineProps<{
  modelValue: DateRange
  show?: boolean
  min?: string
  max?: string
  locale?: string
  title?: string
}>(), {
  show: false,
  locale: 'es-ES',
})

const locale = useLocale()
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
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

// ── Calendar logic ─────────────────────────────────────────────────
const WEEKDAYS = computed(() => {
  const f = new Intl.DateTimeFormat(props.locale, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, i + 1)))
})

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(props.locale, { month: 'long', year: 'numeric' }).format(viewDate.value),
)

const calendarDays = computed(() => {
  const y = viewDate.value.getFullYear()
  const m = viewDate.value.getMonth()
  const first = new Date(y, m, 1)
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const days: { date: number; current: boolean; iso: string; disabled: boolean }[] = []

  const prevDays = new Date(y, m, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevDays - i
    const iso = fmt(y, m - 1, d)
    days.push({ date: d, current: false, iso, disabled: isOOR(iso) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = fmt(y, m, d)
    days.push({ date: d, current: true, iso, disabled: isOOR(iso) })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const iso = fmt(y, m + 1, d)
    days.push({ date: d, current: false, iso, disabled: isOOR(iso) })
  }
  return days
})

function fmt(y: number, m: number, d: number) {
  const dt = new Date(y, m, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function isOOR(iso: string) {
  if (props.min && iso < props.min) return true
  if (props.max && iso > props.max) return true
  return false
}

const todayIso = fmt(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

function prevMonth() {
  const d = new Date(viewDate.value)
  d.setMonth(d.getMonth() - 1)
  viewDate.value = d
}
function nextMonth() {
  const d = new Date(viewDate.value)
  d.setMonth(d.getMonth() + 1)
  viewDate.value = d
}

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
  return new Intl.DateTimeFormat(props.locale, { month: 'short', day: 'numeric' }).format(d)
}

// ── Actions ────────────────────────────────────────────────────────
function cancel() { emit('update:show', false) }

function confirm() {
  if (start.value && end.value) {
    emit('update:modelValue', { start: start.value, end: end.value })
    emit('update:show', false)
  }
}

function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') cancel() }
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-drp-modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="cancel"
      >
        <div class="drp-box w-[360px] rounded-[28px] bg-surface-container-high shadow-elevation-3">
          <!-- Header -->
          <div class="px-6 pt-6 pb-4">
            <p class="mb-3 text-label-medium text-on-surface-variant">
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
              <span v-for="wd in WEEKDAYS" :key="wd" class="py-1 text-label-small font-medium text-on-surface-variant">
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
            <MButton variant="text" :disabled="!start || !end" @click="confirm">OK</MButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-drp-modal-enter-active,
.m3-drp-modal-leave-active {
  transition: opacity 0.15s ease;
}
.m3-drp-modal-enter-from,
.m3-drp-modal-leave-to {
  opacity: 0;
}
.m3-drp-modal-enter-active .drp-box,
.m3-drp-modal-leave-active .drp-box {
  transition: transform 0.15s ease;
}
.m3-drp-modal-enter-from .drp-box,
.m3-drp-modal-leave-to .drp-box {
  transform: scale(0.95);
}
</style>
