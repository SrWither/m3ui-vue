<script setup lang="ts">
/**
 * M3 Expressive's time scroll picker (a port of Compose's `TimeScroll`): an hour wheel and a minute wheel
 * side by side, plus an AM/PM toggle in 12-hour mode. It updates as the wheels turn; put it in a dialog or a
 * form for the confirm step.
 *
 * @event update:modelValue Emitted with the time as HH:MM (24-hour) whenever a wheel or AM/PM changes
 */
import { computed, ref, watch } from 'vue'
import MScrollField from './MScrollField.vue'
import { useLocale } from '../composables/useLocale'
import { FAST_SPATIAL, useSpring } from '../composables/_useSpring'

const props = withDefaults(defineProps<{
  /** Selected time in HH:MM, 24-hour (v-model); null shows 12:00 AM (00:00 in 24-hour mode) */
  modelValue: string | null
  /** 24-hour wheel (00–23) instead of 1–12 with AM/PM */
  use24h?: boolean
  /** Minute increment step; the minute wheel shows only multiples of it */
  minuteStep?: number
  /** Disables the wheels and the AM/PM toggle */
  disabled?: boolean
}>(), {
  modelValue: null,
  use24h: false,
  minuteStep: 1,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()
const locale = useLocale()

function parse(t: string | null) {
  const [h, m] = (t ?? '').split(':').map(Number)
  return { h: Number.isFinite(h) ? Math.min(23, Math.max(0, h!)) : 0, m: Number.isFinite(m) ? Math.min(59, Math.max(0, m!)) : 0 }
}

const step = computed(() => Math.min(30, Math.max(1, Math.floor(props.minuteStep))))
const hour = ref(0)
const minute = ref(0)

function sync() {
  const { h, m } = parse(props.modelValue)
  hour.value = h
  minute.value = Math.floor(m / step.value) * step.value
}
sync()
watch(() => [props.modelValue, step.value], sync)

const isPm = computed(() => hour.value >= 12)

// TimeScrollImpl's mapping: in 12-hour mode index 0..11 shows 1..12, and 12 o'clock is the last item
const hourCount = computed(() => (props.use24h ? 24 : 12))
const hourIndex = computed(() => (props.use24h ? hour.value : (hour.value % 12 || 12) - 1))
const minuteIndex = computed(() => Math.round(minute.value / step.value))

function commit(h: number, m: number) {
  hour.value = h
  minute.value = m
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  if (value !== props.modelValue) emit('update:modelValue', value)
}

function onHour(index: number) {
  const h = props.use24h ? index : ((index + 1) % 12) + (isPm.value ? 12 : 0)
  commit(h, minute.value)
}
function onMinute(index: number) {
  commit(hour.value, index * step.value)
}
function setPm(pm: boolean) {
  if (props.disabled || pm === isPm.value) return
  commit(hour.value + (pm ? 12 : -12), minute.value)
}

const pad = (n: number) => String(n).padStart(2, '0')
const formatHour = (i: number) => pad(props.use24h ? i : i + 1)
const formatMinute = (i: number) => pad(i * step.value)

// AM/PM in the app language, from Intl (no locale keys: every language already has them there)
const periods = computed(() => {
  const label = (h: number) => {
    try {
      return new Intl.DateTimeFormat(locale.lang, { hour: 'numeric', hour12: true })
        .formatToParts(new Date(2000, 0, 1, h))
        .find((p) => p.type === 'dayPeriod')?.value ?? (h < 12 ? 'AM' : 'PM')
    } catch {
      return h < 12 ? 'AM' : 'PM'
    }
  }
  return [label(9), label(21)] as const
})

// The period toggle is two ToggleButtons (TimePicker.kt's ToggleItem): a circle that becomes a 12dp
// rounded square when checked or pressed, on the ToggleButton's FastSpatial spring.
const periodEls: (HTMLElement | null)[] = [null, null]
const pressedPeriod = ref(-1)
const SIZE = 56
useSpring(
  () => [0, 1].map((i) => (pressedPeriod.value === i || (i === 1) === isPm.value ? 12 : SIZE / 2)),
  (v) => periodEls.forEach((el, i) => { if (el) el.style.borderRadius = `${v[i]}px` }),
  FAST_SPATIAL,
)
</script>

<template>
  <div class="inline-flex items-start select-none" :aria-disabled="disabled || undefined">
    <MScrollField
      :model-value="hourIndex"
      :count="hourCount"
      :height="120"
      :format="formatHour"
      :label="locale.timeHourSelection"
      :disabled="disabled"
      class="w-[100px]"
      @update:model-value="onHour"
    />
    <span
      aria-hidden="true"
      class="flex h-[120px] w-4 items-center justify-center pb-2 text-display-large text-on-surface"
      :class="disabled ? 'opacity-38' : ''"
    >:</span>
    <MScrollField
      :model-value="minuteIndex"
      :count="Math.ceil(60 / step)"
      :height="120"
      :format="formatMinute"
      :label="locale.timeMinuteSelection"
      :disabled="disabled"
      class="w-[100px]"
      @update:model-value="onMinute"
    />
    <div
      v-if="!use24h"
      role="radiogroup"
      :aria-label="locale.timePeriodToggle"
      class="ml-2 flex h-[120px] w-14 flex-col gap-2"
    >
      <button
        v-for="(text, i) in periods"
        :key="i"
        :ref="(el) => { periodEls[i] = el as HTMLElement | null }"
        type="button"
        role="radio"
        :aria-checked="(i === 1) === isPm"
        :disabled="disabled"
        class="relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden text-title-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-38 before:pointer-events-none before:absolute before:inset-0 before:bg-current before:opacity-0 before:transition-opacity before:content-[''] enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]"
        :class="(i === 1) === isPm
          ? 'bg-primary-container font-bold text-on-primary-container'
          : 'bg-surface-container-lowest text-on-surface-variant'"
        @pointerdown="pressedPeriod = i"
        @pointerup="pressedPeriod = -1"
        @pointerleave="pressedPeriod = -1"
        @pointercancel="pressedPeriod = -1"
        @click="setPm(i === 1)"
      >
        {{ text }}
      </button>
    </div>
  </div>
</template>
