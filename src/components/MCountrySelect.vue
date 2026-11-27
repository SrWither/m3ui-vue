<script setup lang="ts">
/**
 * A country picker: every country (ISO 3166-1), named in the app's language by the browser (`Intl.DisplayNames`),
 * with its flag, searchable as you type. The v-model is the ISO alpha-2 code (`'AR'`). Built on `MAutocomplete`,
 * so it shares its look, keyboard and `mode="modal"`. Same country list as `MPhoneInput`.
 *
 * @event update:modelValue A country was picked (its code), or cleared (null)
 */
import { computed } from 'vue'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MAutocomplete from './MAutocomplete.vue'
import { useLocale } from '../composables/useLocale'
import { flagEmoji } from '../composables/phoneNumber'
import { PHONE_COUNTRIES } from '../data/phone-countries'

const props = withDefaults(
  defineProps<{
    /** The country's ISO alpha-2 code (v-model), or null */
    modelValue?: string | null
    /** Field label (the locale's "Country" by default) */
    label?: string
    /** Only these countries (codes), in this order */
    only?: string[]
    /** These first, above the rest (e.g. the ones your users pick most) */
    preferred?: string[]
    /** Show the flag emoji before each name (Windows shows the two letters instead) */
    flags?: boolean
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
  { modelValue: null, flags: true, variant: 'filled', mode: 'docked', clearable: false },
)

const emit = defineEmits<{ blur: []; 'update:modelValue': [code: string | null] }>()

const t = useLocale()

const names = computed(() => {
  try {
    return new Intl.DisplayNames([t.lang || 'en', 'en'], { type: 'region' })
  } catch {
    return null
  }
})
const nameOf = (code: string) => names.value?.of(code) ?? code

/** Every country code once (the phone list repeats none, but keep it safe) */
const ALL = [...new Set(PHONE_COUNTRIES.map((c) => c[0]))]

const options = computed(() => {
  const codes = props.only ?? ALL
  const named = codes.map((code) => ({ value: code, name: nameOf(code) }))
  if (!props.only) named.sort((a, b) => a.name.localeCompare(b.name, t.lang || undefined))
  const preferred = (props.preferred ?? []).filter((c) => codes.includes(c))
  const ordered = [...preferred.map((c) => named.find((n) => n.value === c)!), ...named.filter((n) => !preferred.includes(n.value))]
  return ordered.map((n) => ({ value: n.value, label: props.flags ? `${flagEmoji(n.value)} ${n.name}` : n.name }))
})
</script>

<template>
  <MAutocomplete
    :model-value="modelValue"
    :options="options"
    :label="label ?? t.country"
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
    leading-icon="public"
    @update:model-value="(v: unknown) => emit('update:modelValue', (v as string | null) ?? null)"
  />
</template>
