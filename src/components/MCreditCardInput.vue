<script lang="ts">
/** Value of `MCreditCardInput` (v-model). `number` holds digits only; `expiry` is `MM/YY`. */
export interface CreditCardValue {
  number: string
  expiry: string
  cvc: string
  name?: string
}

export type CreditCardField = 'number' | 'expiry' | 'cvc' | 'name'
</script>

<script setup lang="ts">
/**
 * Card payment fields: number, expiry, security code and optionally the cardholder's name, with a live card
 * preview that turns over while the security code is typed. The number is grouped as its network prints it
 * (4-6-5 for American Express), the network is detected from the first digits, and every field is checked
 * (length, Luhn checksum, a future expiry, the code's length for that network).
 *
 * It only collects and checks what is typed: it doesn't tokenize or send anything. Hand the value to your
 * payment provider's SDK.
 *
 * @slot brand Replaces the network wordmark on the preview. Slot props: `{ brand, name }`
 * @event update:modelValue Emitted on every change — powers v-model
 * @event complete Emitted when every field becomes valid, with the value
 * @event brand Emitted when the detected network changes
 * @event blur Emitted when focus leaves the card fields
 */
import { computed, nextTick, onMounted, provide, reactive, ref, watch } from 'vue'
import { FORM_KEY, useFieldValidation, useFocusLeave, type FormContext } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MTextField from './MTextField.vue'
import { useLocale } from '../composables/useLocale'
import {
  detectCardBrand,
  formatCardNumber,
  isValidCardNumber,
  isValidExpiry,
  type CardBrand,
} from '../composables/cardBrand'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Card value (v-model) */
    modelValue: CreditCardValue
    /** Shows the card preview above the fields */
    preview?: boolean
    /** Adds the "Name on card" field */
    showName?: boolean
    /** Visual style of the fields */
    variant?: 'filled' | 'outlined'
    /** Moves focus to the next field once one is complete and valid */
    autoAdvance?: boolean
    /** Error messages to show regardless of the built-in checks, e.g. a decline from the server */
    errors?: Partial<Record<CreditCardField, string>>
    /** Disables every field */
    disabled?: boolean
    /** Error state for the whole card (e.g. a decline). A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Inside an `MForm` or with `rules`, an empty card fails (an empty optional card passes; a half-typed one never does) */
    required?: boolean
    /** More validation rules on the whole value (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving the card fields (default), while typing, or only on submit */
    validateOn?: ValidateOn
    /** The key of the card value in its `MForm` */
    name?: string
  }>(),
  {
    preview: true,
    showName: false,
    variant: 'filled',
    autoAdvance: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [CreditCardValue]
  complete: [CreditCardValue]
  brand: [CardBrand]
  blur: []
}>()

const numberField = ref<InstanceType<typeof MTextField> | null>(null)
const expiryField = ref<InstanceType<typeof MTextField> | null>(null)
const cvcField = ref<InstanceType<typeof MTextField> | null>(null)
const nameField = ref<InstanceType<typeof MTextField> | null>(null)

const brandInfo = computed(() => detectCardBrand(props.modelValue.number ?? ''))
const maxDigits = computed(() => Math.max(...brandInfo.value.lengths))

const formattedNumber = computed(() => formatCardNumber(props.modelValue.number ?? ''))

const validity = computed(() => ({
  number: isValidCardNumber(props.modelValue.number ?? ''),
  expiry: isValidExpiry(props.modelValue.expiry ?? ''),
  cvc: new RegExp(`^\\d{${brandInfo.value.cvcLength}}$`).test(props.modelValue.cvc ?? ''),
  name: !props.showName || !!props.modelValue.name?.trim(),
}))
const valid = computed(() => Object.values(validity.value).every(Boolean))

watch(valid, (v) => { if (v) emit('complete', { ...props.modelValue }) })
watch(() => brandInfo.value.brand, (b) => emit('brand', b))

// A field shows its error once it has been left (or validate() was called)
const touched = reactive<Record<CreditCardField, boolean>>({ number: false, expiry: false, cvc: false, name: false })

const messages: Record<CreditCardField, () => string> = {
  number: () => locale.cardInvalidNumber,
  expiry: () => locale.cardInvalidExpiry,
  cvc: () => locale.cardInvalidCvc,
  name: () => '',
}

const isBlank = (v: CreditCardValue) => !v.number && !v.expiry && !v.cvc && !v.name?.trim()
// The card's own checks are one more rule: an empty card passes unless required, anything typed must be valid
const cardRule: ValidationRule<CreditCardValue> = (v) => {
  if (isBlank(v ?? ({} as CreditCardValue)) || valid.value) return true
  const bad = (['number', 'expiry', 'cvc', 'name'] as const).find((f) => !validity.value[f])!
  return messages[bad]() || locale.validationRequired
}
const rootEl = ref<HTMLElement | null>(null)
const touchAll = () => { touched.number = touched.expiry = touched.cvc = touched.name = true }
const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => [...(props.rules ? (Array.isArray(props.rules) ? props.rules : [props.rules]) : []), cardRule],
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  disabled: () => props.disabled,
  focus: () => {
    const bad = (['number', 'name', 'expiry', 'cvc'] as const).find((f) => !!errorFor(f)) ?? 'number'
    ;({ number: numberField, expiry: expiryField, cvc: cvcField, name: nameField })[bad].value?.focus()
  },
  el: () => rootEl.value,
  setValue: (v) => emit('update:modelValue', v as CreditCardValue),
  isEmpty: (v) => isBlank(v as CreditCardValue),
  onValidate: touchAll,
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { message: cardMessage, messageId } = validation
// Leaving the card (not moving between its fields) shows every field's error, like a submit
const onCardLeave = useFocusLeave(() => rootEl.value, () => {
  touchAll()
  validation.onBlur()
  emit('blur')
})
// Its MTextFields are its own: the form sees one field, the card
provide(FORM_KEY, null as unknown as FormContext)
/** A message for the whole card (from outside or the consumer's rules), when no field already shows one */
const cardError = computed(() =>
  cardMessage.value && !(['number', 'expiry', 'cvc', 'name'] as const).some((f) => errorFor(f)) ? cardMessage.value : null,
)

function errorFor(field: CreditCardField): string | undefined {
  if (props.errors?.[field]) return props.errors[field]
  if (!touched[field] || validity.value[field]) return undefined
  return messages[field]() || undefined
}

function update(patch: Partial<CreditCardValue>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

// Writes the reformatted text into the input (Vue skips the patch when the bound value didn't change, e.g. a
// letter or a digit past the maximum was typed) and puts the caret back after the same number of digits
function restoreCaret(field: InstanceType<typeof MTextField> | null, text: string, digitsBefore: number) {
  nextTick(() => {
    const el = field?.inputEl as HTMLInputElement | null | undefined
    if (!el) return
    if (el.value !== text) el.value = text
    if (document.activeElement !== el) return
    let pos = 0
    let seen = 0
    while (pos < el.value.length && seen < digitsBefore) {
      if (/\d/.test(el.value[pos]!)) seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
  })
}

function digitsBeforeCaret(field: InstanceType<typeof MTextField> | null, text: string) {
  const el = field?.inputEl as HTMLInputElement | null | undefined
  const caret = el?.selectionStart ?? text.length
  return text.slice(0, caret).replace(/\D/g, '').length
}

function onNumber(text: string) {
  const before = digitsBeforeCaret(numberField.value, text)
  const digits = text.replace(/\D/g, '').slice(0, Math.max(...detectCardBrand(text).lengths))
  update({ number: digits })
  restoreCaret(numberField.value, formatCardNumber(digits), before)
  if (props.autoAdvance && digits.length === Math.max(...detectCardBrand(digits).lengths) && isValidCardNumber(digits)) {
    nextTick(() => (props.showName ? nameField.value : expiryField.value)?.focus())
  }
}

function formatExpiry(digits: string) {
  // A first digit above 1 can only be a single-digit month
  if (digits.length === 1 && Number(digits) > 1) digits = '0' + digits
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}` : digits
}

function onExpiry(text: string) {
  const before = digitsBeforeCaret(expiryField.value, text)
  const digits = text.replace(/\D/g, '').slice(0, 4)
  const expiry = formatExpiry(digits)
  update({ expiry })
  restoreCaret(expiryField.value, expiry, before + (digits.length === 1 && expiry.length === 2 ? 1 : 0))
  if (props.autoAdvance && expiry.length === 5 && isValidExpiry(expiry)) nextTick(() => cvcField.value?.focus())
}

function onCvc(text: string) {
  const cvc = text.replace(/\D/g, '').slice(0, brandInfo.value.cvcLength)
  update({ cvc })
  restoreCaret(cvcField.value, cvc, digitsBeforeCaret(cvcField.value, text))
}

function onName(text: string) {
  update({ name: text })
}

// Re-trim the security code when the network changes to one with a shorter code
watch(() => brandInfo.value.cvcLength, (len) => {
  if ((props.modelValue.cvc ?? '').length > len) update({ cvc: props.modelValue.cvc.slice(0, len) })
})

const cvcFocused = ref(false)
const focusedField = ref<CreditCardField | null>(null)

onMounted(() => {
  // MTextField forwards attrs to its wrapper, so input hints are set on the inputs here
  const set = (f: InstanceType<typeof MTextField> | null, attrs: Record<string, string>) => {
    const el = f?.inputEl as HTMLInputElement | null | undefined
    if (el) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  }
  set(numberField.value, { inputmode: 'numeric', name: 'cc-number' })
  set(expiryField.value, { inputmode: 'numeric', name: 'cc-exp', maxlength: '5' })
  set(cvcField.value, { inputmode: 'numeric', name: 'cc-csc', maxlength: '4' })
  set(nameField.value, { name: 'cc-name', autocapitalize: 'characters' })
})

function onFocusIn(field: CreditCardField) {
  focusedField.value = field
  cvcFocused.value = field === 'cvc'
}
function onFocusOut(field: CreditCardField) {
  touched[field] = true
  if (focusedField.value === field) focusedField.value = null
  if (field === 'cvc') cvcFocused.value = false
}

// Preview: placeholder bullets where digits haven't been typed yet
const previewNumber = computed(() => {
  const digits = props.modelValue.number ?? ''
  const len = Math.max(digits.length, brandInfo.value.brand === 'amex' ? 15 : brandInfo.value.brand === 'diners' && digits.length <= 14 ? 14 : 16)
  const { gaps } = brandInfo.value
  let out = ''
  for (let i = 0; i < len; i++) {
    if (i > 0 && gaps.includes(i)) out += ' '
    out += digits[i] ?? '•'
  }
  return out
})
const previewExpiry = computed(() => props.modelValue.expiry || 'MM/YY')
const previewCvc = computed(() => (props.modelValue.cvc ?? '').padEnd(brandInfo.value.cvcLength, '•'))

defineExpose({
  /** Detected card network */
  brand: computed(() => brandInfo.value.brand),
  /** Whether every field is valid */
  valid,
  /** Shows the errors of every field (as if each had been visited) and returns whether all are valid */
  validate: () => {
    touchAll()
    void validation.validate()
    return valid.value
  },
  /** Hides every error until the fields are left again */
  resetValidation: () => {
    touched.number = touched.expiry = touched.cvc = touched.name = false
    validation.resetValidation()
  },
  /** Focuses a field (the number by default) */
  focus: (field: CreditCardField = 'number') =>
    ({ number: numberField, expiry: expiryField, cvc: cvcField, name: nameField })[field].value?.focus(),
})
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-4" @focusout="onCardLeave">
    <div v-if="preview" class="m3-cc-preview mx-auto w-full max-w-[340px]" aria-hidden="true">
      <div class="m3-cc-preview__inner relative aspect-[1.586]" :class="{ 'is-flipped': cvcFocused }">
        <!-- Front -->
        <div class="m3-cc-preview__face absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl bg-linear-135 from-primary to-tertiary p-5 text-on-primary shadow-elevation-2">
          <div class="flex items-start justify-between">
            <div class="h-8 w-11 rounded-md bg-on-primary/25 ring-1 ring-on-primary/30" />
            <slot name="brand" :brand="brandInfo.brand" :name="brandInfo.name">
              <span class="text-title-medium font-bold italic tracking-wide" :class="brandInfo.name ? 'opacity-100' : 'opacity-0'">{{ brandInfo.name }}</span>
            </slot>
          </div>
          <div
            class="m3-cc-mono text-title-large tracking-[0.12em] tabular-nums whitespace-nowrap"
            :class="focusedField === 'number' ? 'opacity-100' : 'opacity-90'"
          >{{ previewNumber }}</div>
          <div class="flex items-end justify-between gap-3 text-label-large uppercase">
            <span class="min-w-0 truncate" :class="{ 'opacity-60': !modelValue.name }">{{ modelValue.name || (showName ? locale.cardName : '') }}</span>
            <span class="m3-cc-mono shrink-0 tabular-nums" :class="{ 'opacity-60': !modelValue.expiry }">{{ previewExpiry }}</span>
          </div>
        </div>
        <!-- Back -->
        <div class="m3-cc-preview__face m3-cc-preview__back absolute inset-0 overflow-hidden rounded-xl bg-linear-135 from-tertiary to-primary text-on-primary shadow-elevation-2">
          <div class="mt-6 h-10 bg-on-surface/80" />
          <div class="mx-5 mt-5 flex h-9 items-center justify-end rounded-sm bg-surface-container-highest px-3 text-on-surface">
            <span class="m3-cc-mono text-title-medium italic tracking-widest">{{ previewCvc }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div @focusin="onFocusIn('number')" @focusout="onFocusOut('number')">
        <MTextField
          ref="numberField"
          :model-value="formattedNumber"
          :label="locale.cardNumber"
          :variant="variant"
          :disabled="isDisabled"
          autocomplete="cc-number"
          leading-icon="credit_card"
          :error="!!errorFor('number')"
          :error-label="errorFor('number')"
          @update:model-value="onNumber"
        />
      </div>
      <div v-if="showName" @focusin="onFocusIn('name')" @focusout="onFocusOut('name')">
        <MTextField
          ref="nameField"
          :model-value="modelValue.name ?? ''"
          :label="locale.cardName"
          :variant="variant"
          :disabled="isDisabled"
          autocomplete="cc-name"
          :error="!!errors?.name"
          :error-label="errors?.name"
          @update:model-value="onName"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div @focusin="onFocusIn('expiry')" @focusout="onFocusOut('expiry')">
          <MTextField
            ref="expiryField"
            :model-value="modelValue.expiry ?? ''"
            :label="locale.cardExpiry"
            :variant="variant"
            :disabled="isDisabled"
            autocomplete="cc-exp"
            :error="!!errorFor('expiry')"
            :error-label="errorFor('expiry')"
            @update:model-value="onExpiry"
          />
        </div>
        <div @focusin="onFocusIn('cvc')" @focusout="onFocusOut('cvc')">
          <MTextField
            ref="cvcField"
            :model-value="modelValue.cvc ?? ''"
            :label="locale.cardCvc"
            :variant="variant"
            :disabled="isDisabled"
            autocomplete="cc-csc"
            :error="!!errorFor('cvc')"
            :error-label="errorFor('cvc')"
            @update:model-value="onCvc"
          />
        </div>
      </div>
    </div>
    <p v-if="cardError" :id="messageId" role="alert" class="px-4 text-body-small text-error">{{ cardError }}</p>
  </div>
</template>

<style>
.m3-cc-preview {
  perspective: 1200px;
}
.m3-cc-preview__inner {
  transform-style: preserve-3d;
  transition: transform 500ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-cc-preview__inner.is-flipped {
  transform: rotateY(180deg);
}
.m3-cc-preview__face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.m3-cc-preview__back {
  transform: rotateY(180deg);
}
.m3-cc-mono {
  font-family: var(--font-mono, ui-monospace, monospace);
}
@media (prefers-reduced-motion: reduce) {
  .m3-cc-preview__inner {
    transition: none;
  }
}
</style>
