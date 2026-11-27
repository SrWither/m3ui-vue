<script setup lang="ts">
/**
 * A cron expression editor: the five-field expression in a text field, a sentence saying what it means in the app's
 * language ("At 09:00, Monday to Friday"), the next times it runs, and, with `builder`, controls for the common
 * schedules (every few minutes, hourly, daily, weekly on some days, monthly on a day) so nobody has to remember cron.
 * Anything else stays editable as text (Custom). Invalid text shows an error and isn't emitted until it's valid.
 *
 * @event update:modelValue The expression changed (only valid ones)
 * @event blur Emitted when focus leaves the whole field
 */
import { computed, provide, ref, watch } from 'vue'
import { FORM_KEY, useFieldValidation, useFocusLeave, type FormContext } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MChip from './MChip.vue'
import MIcon from './MIcon.vue'
import MNumberField from './MNumberField.vue'
import MTextField from './MTextField.vue'
import MTimePicker from './MTimePicker.vue'
import { useLocale } from '../composables/useLocale'
import { describeCron, nextCronRuns, parseCron } from '../composables/cron'

type Frequency = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

const props = withDefaults(
  defineProps<{
    /** The expression (v-model): `minute hour day-of-month month day-of-week`, or a macro (`@daily`) */
    modelValue: string
    /** Field label (the locale's "Cron expression" by default) */
    label?: string
    /** Show the schedule controls above the expression */
    builder?: boolean
    /** How many upcoming runs to list (0: none) */
    nextRuns?: number
    /** Field style */
    variant?: 'filled' | 'outlined'
    /** Disables it */
    disabled?: boolean
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Marks it as required; inside an `MForm` or with `rules`, an expression must be set */
    required?: boolean
    /** Validation rules (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving it (default), on change, or only on submit */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm` */
    name?: string
  }>(),
  { builder: true, nextRuns: 3, variant: 'filled', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [expression: string]; blur: [] }>()

const rootEl = ref<HTMLElement | null>(null)

const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => props.rules,
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  validateDebounce: () => props.validateDebounce,
  disabled: () => props.disabled,
  focus: () => { rootEl.value?.querySelector<HTMLElement>('input, button')?.focus() },
  el: () => rootEl.value,
  setValue: (v) => emit('update:modelValue', v as string),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage } = validation
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
})
// Its inner fields (every, time, the expression) are its own business, not the form's
provide(FORM_KEY, null as unknown as FormContext)

const t = useLocale()
const lang = computed(() => t.lang || undefined)

// The text field keeps what's typed, valid or not; the v-model only ever gets valid expressions
const text = ref(props.modelValue)
watch(() => props.modelValue, (v) => { if (v !== text.value && parseCron(v)) text.value = v })
const schedule = computed(() => parseCron(text.value))
const invalid = computed(() => text.value.trim() !== '' && !schedule.value)

function onText(v: string | number) {
  text.value = String(v)
  if (parseCron(text.value)) emit('update:modelValue', text.value.trim())
}
function set(expression: string) {
  text.value = expression
  emit('update:modelValue', expression)
}

const summary = computed(() => describeCron(text.value, t))
const runs = computed(() => (props.nextRuns > 0 && schedule.value ? nextCronRuns(text.value, props.nextRuns) : []))
const runFormat = computed(() => new Intl.DateTimeFormat(lang.value, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))

// ── The builder ────────────────────────────────────────────────────────────────────────────────

const single = (field: string) => (/^\d+$/.test(field) ? Number(field) : null)

/** Which simple schedule the expression is, if any */
const frequency = computed<Frequency>(() => {
  const s = schedule.value
  if (!s) return 'custom'
  const [m, h, dom, mon, dow] = s.fields as [string, string, string, string, string]
  if (mon !== '*') return 'custom'
  if (/^\*\/\d+$/.test(m) && h === '*' && dom === '*' && dow === '*') return 'minutes'
  if (single(m) === null) return 'custom'
  if (h === '*' && dom === '*' && dow === '*') return 'hourly'
  if (single(h) === null) return 'custom'
  if (dom === '*' && dow === '*') return 'daily'
  if (dom === '*') return 'weekly'
  if (single(dom) !== null && dow === '*') return 'monthly'
  return 'custom'
})
// Picking Custom keeps the expression but shows it as such
const customPicked = ref(false)
const shown = computed<Frequency>(() => (customPicked.value ? 'custom' : frequency.value))

const fields = computed(() => schedule.value?.fields ?? ['0', '9', '*', '*', '*'])
const minute = computed(() => single(fields.value[0]!) ?? 0)
const hour = computed(() => single(fields.value[1]!) ?? 9)
const every = computed(() => Number(/^\*\/(\d+)$/.exec(fields.value[0]!)?.[1] ?? 15))
const time = computed(() => `${String(hour.value).padStart(2, '0')}:${String(minute.value).padStart(2, '0')}`)
const dayOfMonth = computed(() => single(fields.value[2]!) ?? 1)
const weekdays = computed(() => (schedule.value && !schedule.value.any.weekdays ? schedule.value.weekdays : []))

function pick(f: Frequency) {
  customPicked.value = f === 'custom'
  const m = minute.value
  const h = hour.value
  if (f === 'minutes') set(`*/${every.value} * * * *`)
  else if (f === 'hourly') set(`${m} * * * *`)
  else if (f === 'daily') set(`${m} ${h} * * *`)
  else if (f === 'weekly') set(`${m} ${h} * * ${weekdays.value.length ? weekdays.value.join(',') : '1-5'}`)
  else if (f === 'monthly') set(`${m} ${h} ${dayOfMonth.value} * *`)
}

function setTime(v: string | null) {
  if (!v) return
  const [h, m] = v.split(':').map(Number) as [number, number]
  const [, , dom, mon, dow] = fields.value
  set(`${m} ${h} ${dom} ${mon} ${dow}`)
}
function setEvery(n: number | null) {
  if (n && n >= 1 && n <= 59) set(`*/${Math.round(n)} * * * *`)
}
function setMinute(n: number | null) {
  if (n !== null && n >= 0 && n <= 59) set(`${Math.round(n)} * * * *`)
}
function setDay(n: number | null) {
  if (n && n >= 1 && n <= 31) set(`${minute.value} ${hour.value} ${Math.round(n)} * *`)
}
function toggleWeekday(d: number) {
  const next = weekdays.value.includes(d) ? weekdays.value.filter((x) => x !== d) : [...weekdays.value, d].sort((a, b) => a - b)
  // At least one day: unticking the last one leaves it
  if (!next.length) return
  set(`${minute.value} ${hour.value} * * ${compactDays(next)}`)
}
/** 1,2,3,4,5 → 1-5 */
function compactDays(days: number[]) {
  const out: string[] = []
  for (let i = 0; i < days.length; i++) {
    let j = i
    while (j + 1 < days.length && days[j + 1] === days[j]! + 1) j++
    out.push(j - i >= 2 ? `${days[i]}-${days[j]}` : days.slice(i, j + 1).join(','))
    i = j
  }
  return out.join(',')
}

const FREQS = computed<{ value: Frequency; label: string }[]>(() => [
  { value: 'minutes', label: t.cronFreqMinutes },
  { value: 'hourly', label: t.cronFreqHourly },
  { value: 'daily', label: t.cronFreqDaily },
  { value: 'weekly', label: t.cronFreqWeekly },
  { value: 'monthly', label: t.cronFreqMonthly },
  { value: 'custom', label: t.cronFreqCustom },
])
// Monday first, as most calendars outside the US
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const dayName = (d: number) => new Intl.DateTimeFormat(lang.value, { weekday: 'short' }).format(new Date(2024, 0, 7 + d))

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})
</script>

<template>
  <div ref="rootEl" class="m3-cron-field flex flex-col gap-3" @focusout="onFocusOut">
    <template v-if="builder">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="label ?? t.cronExpression">
        <MChip
          v-for="f in FREQS"
          :key="f.value"
          type="filter"
          :selected="shown === f.value"
          :disabled="isDisabled"
          @click="pick(f.value)"
        >
          {{ f.label }}
        </MChip>
      </div>

      <div v-if="shown !== 'custom'" class="flex flex-wrap items-start gap-3">
        <MNumberField
          v-if="shown === 'minutes'"
          :model-value="every"
          :label="t.cronEvery"
          :min="1"
          :max="59"
          :variant="variant"
          :disabled="isDisabled"
          class="w-44"
          @update:model-value="setEvery"
        />
        <MNumberField
          v-else-if="shown === 'hourly'"
          :model-value="minute"
          :label="t.cronMinute"
          :min="0"
          :max="59"
          :variant="variant"
          :disabled="isDisabled"
          class="w-44"
          @update:model-value="setMinute"
        />
        <template v-else>
          <MTimePicker :model-value="time" :label="t.cronTime" :minute-step="1" :disabled="isDisabled" class="w-44" @update:model-value="setTime" />
          <MNumberField
            v-if="shown === 'monthly'"
            :model-value="dayOfMonth"
            :label="t.cronDayOfMonth"
            :min="1"
            :max="31"
            :variant="variant"
            :disabled="isDisabled"
            class="w-44"
            @update:model-value="setDay"
          />
        </template>
      </div>

      <div v-if="shown === 'weekly'" class="flex flex-wrap gap-2">
        <MChip
          v-for="d in WEEK"
          :key="d"
          type="filter"
          :selected="weekdays.includes(d)"
          :disabled="disabled"
          @click="toggleWeekday(d)"
        >
          {{ dayName(d) }}
        </MChip>
      </div>
    </template>

    <MTextField
      :model-value="text"
      :label="label ?? t.cronExpression"
      :variant="variant"
      :disabled="disabled"
      :error="invalid ? t.cronInvalid : (errorMessage || hasError)"
      :required="required"
      autocomplete="off"
      class="m3-cron-field__input"
      @update:model-value="onText"
    />

    <p v-if="summary" class="flex items-start gap-2 text-body-medium text-on-surface" aria-live="polite">
      <MIcon name="schedule" :size="20" class="shrink-0 text-on-surface-variant" />
      <span class="first-letter:uppercase">{{ summary }}</span>
    </p>

    <div v-if="runs.length" class="flex flex-col gap-1">
      <span class="text-label-medium text-on-surface-variant">{{ t.cronNextRuns }}</span>
      <ul class="flex flex-col gap-0.5 text-body-small text-on-surface-variant">
        <li v-for="r in runs" :key="r.getTime()" class="first-letter:uppercase">{{ runFormat.format(r) }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* The expression in the mono font, its label in the field's */
.m3-cron-field__input :deep(input) {
  font-family: var(--font-mono);
}
</style>
