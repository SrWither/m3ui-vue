<script setup lang="ts">
/**
 * A time zone picker: every IANA time zone the browser knows (`Intl.supportedValuesOf('timeZone')`), labelled with
 * its current UTC offset and its city ("UTC−03:00 · Buenos Aires"), sorted by offset and searchable by city, region
 * or offset. The v-model is the IANA name (`'America/Argentina/Buenos_Aires'`); `detect` starts it on the user's own.
 * Offsets are today's (they move with daylight saving). Built on `MAutocomplete`.
 *
 * @event update:modelValue A time zone was picked (its IANA name), or cleared (null)
 */
import { computed, onMounted } from 'vue'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MAutocomplete from './MAutocomplete.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** The IANA time zone name (v-model), or null */
    modelValue?: string | null
    /** Field label (the locale's "Time zone" by default) */
    label?: string
    /** Only these zones, instead of every one */
    only?: string[]
    /** Start on the user's own zone when the v-model is empty */
    detect?: boolean
    /** Field style */
    variant?: 'filled' | 'outlined'
    /** Dropdown, or a dialog on small screens */
    mode?: 'docked' | 'modal'
    /** Show a clear button */
    clearable?: boolean
    /** Helper text below the field */
    hint?: string
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Validation rules (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving the field (default), while typing, or only on submit */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm` */
    name?: string
    /** Marks it as required */
    required?: boolean
    /** Disables the field */
    disabled?: boolean
  }>(),
  { modelValue: null, detect: false, variant: 'filled', mode: 'docked', clearable: false },
)

const emit = defineEmits<{ blur: []; 'update:modelValue': [zone: string | null] }>()

const t = useLocale()

/** Every zone the browser knows; a few common ones where it can't list them */
function allZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  try {
    const zones = intl.supportedValuesOf?.('timeZone')
    if (zones?.length) return zones
  } catch { /* older engines */ }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City',
    'America/Bogota', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Europe/London', 'Europe/Madrid',
    'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai',
    'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland']
}

/** The zone's offset from UTC right now, in minutes */
function offsetOf(zone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at)
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0
  } catch {
    return 0
  }
}

const fmtOffset = (min: number) => {
  const sign = min < 0 ? '−' : '+'
  const a = Math.abs(min)
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}
/** America/Argentina/Buenos_Aires → Buenos Aires (America) */
function cityOf(zone: string) {
  const parts = zone.split('/')
  const city = parts[parts.length - 1]!.replace(/_/g, ' ')
  return parts.length > 1 ? `${city} (${parts[0]!.replace(/_/g, ' ')})` : city
}

const options = computed(() => {
  const now = new Date()
  return (props.only ?? allZones())
    .map((zone) => ({ zone, offset: offsetOf(zone, now) }))
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone))
    .map(({ zone, offset }) => ({ value: zone, label: `${fmtOffset(offset)} · ${cityOf(zone)}` }))
})

onMounted(() => {
  if (!props.detect || props.modelValue) return
  const own = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (own) emit('update:modelValue', own)
})
</script>

<template>
  <MAutocomplete
    :model-value="modelValue"
    :options="options"
    :label="label ?? t.timeZone"
    :variant="variant"
    :mode="mode"
    :clearable="clearable"
    :hint="hint"
    :error="error"
    :error-label="errorLabel"
    :rules="rules"
    :validate-on="validateOn"
    :validate-debounce="validateDebounce"
    :name="name"
    @blur="emit('blur')"
    :required="required"
    :disabled="disabled"
    leading-icon="schedule"
    @update:model-value="(v: unknown) => emit('update:modelValue', (v as string | null) ?? null)"
  />
</template>
