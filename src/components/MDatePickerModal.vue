<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIconButton from './MIconButton.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  modelValue: string | null
  show?: boolean
  min?: string
  max?: string
  locale?: string
  title?: string
}>(), {
  modelValue: null,
  show: false,
  locale: 'es-ES',
})

const locale = useLocale()
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
  selected.value = day.iso
}

// ── Display ────────────────────────────────────────────────────────
const headerDate = computed(() => {
  if (!selected.value) return '—'
  const d = new Date(selected.value + 'T00:00:00')
  return new Intl.DateTimeFormat(props.locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(d)
})

// ── Input mode ─────────────────────────────────────────────────────
function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function displayToIso(display: string) {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
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

function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') cancel() }
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-dp-modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="cancel"
      >
        <div class="dp-box w-[360px] rounded-[28px] bg-surface-container-high shadow-elevation-3">
          <!-- Header -->
          <div class="px-6 pt-6 pb-4">
            <p class="mb-3 text-label-medium text-on-surface-variant">
              {{ title || locale.selectDate }}
            </p>
            <div class="flex items-center justify-between">
              <span class="text-headline-medium font-medium capitalize text-on-surface">
                {{ headerDate }}
              </span>
              <MIconButton
                :icon="inputMode === 'calendar' ? 'edit' : 'calendar_today'"
                :label="inputMode === 'calendar' ? 'Switch to input' : 'Switch to calendar'"
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
              <span v-for="wd in WEEKDAYS" :key="wd" class="py-1 text-label-small font-medium text-on-surface-variant">
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
            <label class="mb-2 block text-label-medium text-on-surface-variant">Date (DD/MM/YYYY)</label>
            <input
              v-model="dateInput"
              type="text"
              placeholder="23/06/2026"
              maxlength="10"
              class="h-14 w-full rounded-sm border border-outline bg-transparent px-4 text-body-large text-on-surface outline-none transition-colors focus:border-2 focus:border-primary"
              @keydown.enter="applyInput"
              @blur="applyInput"
            />
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-2 px-6 pb-4">
            <MButton variant="text" @click="cancel">{{ locale.cancel }}</MButton>
            <MButton variant="text" :disabled="!selected" @click="confirm">OK</MButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-dp-modal-enter-active,
.m3-dp-modal-leave-active {
  transition: opacity 0.15s ease;
}
.m3-dp-modal-enter-from,
.m3-dp-modal-leave-to {
  opacity: 0;
}
.m3-dp-modal-enter-active .dp-box,
.m3-dp-modal-leave-active .dp-box {
  transition: transform 0.15s ease;
}
.m3-dp-modal-enter-from .dp-box,
.m3-dp-modal-leave-to .dp-box {
  transform: scale(0.95);
}
</style>
