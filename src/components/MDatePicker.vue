<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useFieldBg } from '../composables/useFieldBg'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  error?: string
  hint?: string
  locale?: string
  fieldBg?: string
}>(), { locale: 'es-ES' })

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const dropPos = ref({ top: '0px', left: '0px' })
const { resolvedFieldBg } = useFieldBg(triggerEl, () => props.fieldBg)

const viewDate = ref(props.modelValue ? new Date(props.modelValue + 'T00:00:00') : new Date())
watch(() => props.modelValue, (v) => {
  if (v) viewDate.value = new Date(v + 'T00:00:00')
})

const WEEKDAYS = (() => {
  const f = new Intl.DateTimeFormat(props.locale, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, i + 1) // Mon=1 Jan 2024
    return f.format(d)
  })
})()

const monthLabel = computed(() => {
  const f = new Intl.DateTimeFormat(props.locale, { month: 'long', year: 'numeric' })
  return f.format(viewDate.value)
})

const calendarDays = computed(() => {
  const y = viewDate.value.getFullYear()
  const m = viewDate.value.getMonth()
  const first = new Date(y, m, 1)
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const days: { date: number; current: boolean; iso: string; disabled: boolean }[] = []

  const prevMonth = new Date(y, m, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonth - i
    const iso = fmt(y, m - 1, d)
    days.push({ date: d, current: false, iso, disabled: isOutOfRange(iso) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = fmt(y, m, d)
    days.push({ date: d, current: true, iso, disabled: isOutOfRange(iso) })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const iso = fmt(y, m + 1, d)
    days.push({ date: d, current: false, iso, disabled: isOutOfRange(iso) })
  }
  return days
})

function fmt(y: number, m: number, d: number) {
  const dt = new Date(y, m, d)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function isOutOfRange(iso: string) {
  if (props.min && iso < props.min) return true
  if (props.max && iso > props.max) return true
  return false
}

const isToday = (iso: string) => iso === fmt(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

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
  emit('update:modelValue', day.iso)
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
}

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  const d = new Date(props.modelValue + 'T00:00:00')
  return new Intl.DateTimeFormat(props.locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
})

function computeDropPos() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  const panelH = 380
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const above = spaceBelow < panelH && rect.top > panelH
  dropPos.value = {
    top: above ? `${rect.top - 4 - panelH}px` : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
}

function onClickOutside(e: MouseEvent) {
  const t = e.target as Node
  if (triggerEl.value?.contains(t)) return
  if (panelEl.value?.contains(t)) return
  open.value = false
}

function onScroll(e: Event) {
  if (!open.value) return
  if (panelEl.value?.contains(e.target as Node)) return
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) { open.value = false; return }
  computeDropPos()
}

watch(open, (v) => {
  if (v) {
    computeDropPos()
    setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
  }
})

onMounted(() => window.addEventListener('scroll', onScroll, true))
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Trigger -->
    <div ref="triggerEl" class="relative mt-2" :style="{ '--field-bg': resolvedFieldBg }">
      <button
        type="button"
        class="flex h-14 w-full items-center gap-2 rounded-sm border bg-transparent px-4 text-left text-body-large transition-[border-color,border-width] duration-150"
        :class="[
          disabled ? 'pointer-events-none opacity-[0.38]' : 'cursor-pointer',
          open
            ? error ? 'border-2 border-error' : 'border-2 border-primary'
            : error ? 'border-error' : 'border-outline hover:border-on-surface',
        ]"
        @click="!disabled && (open = !open)"
      >
        <MIcon name="calendar_today" :size="20" class="shrink-0 text-on-surface-variant" />
        <span v-if="displayValue" class="flex-1 text-on-surface">{{ displayValue }}</span>
        <span v-else class="flex-1 text-on-surface-variant">{{ placeholder || label || 'Seleccionar fecha' }}</span>
        <MIcon
          v-if="modelValue"
          name="close"
          :size="18"
          class="shrink-0 cursor-pointer text-on-surface-variant hover:text-on-surface"
          @click.stop="clear"
        />
      </button>
      <label
        v-if="label"
        class="pointer-events-none absolute -top-2.5 left-3 bg-(--field-bg) px-1 text-label-small transition-colors"
        :class="open ? (error ? 'text-error' : 'text-primary') : error ? 'text-error' : 'text-on-surface-variant'"
      >
        {{ label }}
      </label>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>

    <!-- Calendar dropdown -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-150"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
        leave-active-class="transition-[opacity,transform] duration-100"
        leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      >
        <div
          v-if="open"
          ref="panelEl"
          class="fixed z-500 w-[320px] rounded-lg bg-surface-container p-4 shadow-elevation-3"
          :style="dropPos"
        >
          <!-- Header -->
          <div class="mb-3 flex items-center justify-between">
            <MIconButton icon="chevron_left" label="Mes anterior" :size="36" @click="prevMonth" />
            <span class="text-title-small font-medium capitalize text-on-surface">{{ monthLabel }}</span>
            <MIconButton icon="chevron_right" label="Mes siguiente" :size="36" @click="nextMonth" />
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
              class="flex h-9 w-full items-center justify-center rounded-full text-body-medium transition-colors duration-100"
              :class="[
                day.disabled
                  ? 'cursor-not-allowed text-on-surface/25'
                  : day.iso === modelValue
                    ? 'bg-primary text-on-primary'
                    : isToday(day.iso)
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
      </Transition>
    </Teleport>
  </div>
</template>
