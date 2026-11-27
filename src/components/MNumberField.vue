<script setup lang="ts">
/**
 * A numeric text field with +/- stepper buttons, min/max clamping, and keyboard arrow support.
 *
 * @event update:modelValue Emitted on every change — typing, stepper clicks, or arrow keys — powers v-model
 * @event debounced Emitted debounce ms after the user stops typing (only when debounce > 0). Stepper
 *   clicks/arrow keys still emit instantly
 */
import { computed, ref, useId } from 'vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useDebounce } from '../composables/useDebounce'
import { FIELD_PADDING_RIGHT, fieldLabelClasses, vOverflowTitle, type FieldRightInset } from '../composables/_fieldLayout'

const props = withDefaults(
  defineProps<{
    /** Bound numeric value (v-model) */
    modelValue: number | null
    /** Field label */
    label: string
    /** Visual style */
    variant?: 'filled' | 'outlined'
    /** Minimum allowed value */
    min?: number
    /** Maximum allowed value */
    max?: number
    /** Increment/decrement step */
    step?: number
    /** Error state. A string is also the message (`:error="errors.x"`) */
    error?: boolean | string
    /** Error message shown when error is true */
    errorLabel?: string
    /**
     * Validation rules: functions `(value, ctx) => true | 'message'` (may be async; see the built-in `required`,
     * `email`, `minLength`…) or a Standard Schema (zod, valibot…). Checked in order; the first failure is shown
     */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving the field (default; live after that), while typing, or only on submit (`MForm`) */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm`'s values, errors and schema */
    name?: string
    /** Hint text */
    hint?: string
    /** Disables the field */
    disabled?: boolean
    /** Marks as required — adds a red asterisk after the label */
    required?: boolean
    /** Material Symbol icon */
    leadingIcon?: string
    /** Show +/- buttons */
    stepper?: boolean
    /**
     * Overrides the auto-detected background color used to cut the floating label out of the outlined border
     */
    fieldBg?: string
    /** Delay (ms) before firing the @debounced event */
    debounce?: number
  }>(),
  {
    variant: 'filled',
    step: 1,
    stepper: true,
    modelValue: null,
    debounce: 0,
  },
)

const emit = defineEmits<{ blur: []; 'update:modelValue': [number | null]; debounced: [number | null] }>()

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
  focus: () => { inputEl.value?.focus() },
  el: () => inputEl.value,
  setValue: (v) => emit('update:modelValue', v as number | null),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
})

const id = useId()
const fieldBgEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldBgEl, () => props.fieldBg)

const { debounced: emitDebounced } = useDebounce((v: number | null) => emit('debounced', v), props.debounce)

const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined)

function clamp(val: number): number {
  if (props.min !== undefined && val < props.min) return props.min
  if (props.max !== undefined && val > props.max) return props.max
  return val
}

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '') {
    emit('update:modelValue', null)
    if (props.debounce > 0) emitDebounced(null)
    return
  }
  const n = Number(raw)
  if (!Number.isNaN(n)) {
    const v = clamp(n)
    emit('update:modelValue', v)
    if (props.debounce > 0) emitDebounced(v)
  }
}

function increment() {
  if (isDisabled.value) return
  const v = clamp((props.modelValue ?? 0) + props.step)
  emit('update:modelValue', v)
  if (props.debounce > 0) emitDebounced(v)
}

function decrement() {
  if (isDisabled.value) return
  const v = clamp((props.modelValue ?? 0) - props.step)
  emit('update:modelValue', v)
  if (props.debounce > 0) emitDebounced(v)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') { e.preventDefault(); increment() }
  if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
}

// The label and the text both stop before the trailing controls
const rightInset = computed<FieldRightInset>(() => (props.stepper ? 'right-24' : 'right-4'))

const inputClasses = computed(() => {
  const pl = props.leadingIcon ? 'pl-12' : 'pl-4'
  const pr = FIELD_PADDING_RIGHT[rightInset.value]
  const base = [
    'peer block w-full text-body-large text-on-surface outline-none placeholder:text-transparent',
    'transition-[border-color,border-width] duration-150',
    'disabled:cursor-not-allowed disabled:text-on-surface/38',
    hasError.value ? 'caret-error' : 'caret-primary',
    'h-14', pl, pr,
  ]
  if (props.variant === 'outlined') {
    return [...base,
      'rounded-xs border bg-transparent py-4',
      hasError.value
        ? 'border-error focus:border-2 focus:border-error'
        : 'border-outline hover:border-on-surface focus:border-2 focus:border-primary',
      'disabled:border-on-surface/12',
    ].join(' ')
  }
  return [...base,
    'rounded-t-xs bg-surface-container-highest border-b pt-6 pb-2',
    hasError.value
      ? 'border-error focus:border-b-2 focus:border-error'
      : 'border-on-surface-variant hover:border-on-surface focus:border-b-2 focus:border-primary',
    'disabled:border-on-surface/38 disabled:bg-[color-mix(in_srgb,var(--color-on-surface)_4%,var(--color-surface-container-highest))]',
  ].join(' ')
})

const labelClasses = computed(() =>
  fieldLabelClasses({
    variant: props.variant,
    leading: !!props.leadingIcon,
    right: rightInset.value,
    floated: 'peer',
    color: [
      hasError.value ? 'text-error peer-focus:text-error' : 'text-on-surface-variant peer-focus:text-primary',
      'peer-disabled:text-on-surface/38',
    ].join(' '),
  }),
)

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
  /** The `<input>` (or `<textarea>`) element */
  inputEl: inputEl,
  /** Focuses the field */
  focus: (options?: FocusOptions) => inputEl.value?.focus(options),
  /** Takes focus away from the field */
  blur: () => inputEl.value?.blur(),
  /** Selects all its text */
  select: () => inputEl.value?.select(),
})
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-1" @focusout="onFocusOut">
    <div
      ref="fieldBgEl"
      class="relative"
      :class="variant === 'outlined' ? 'mt-2' : ''"
      :style="variant === 'outlined' ? { '--field-bg': resolvedFieldBg } : undefined"
    >
      <div
        v-if="leadingIcon"
        class="pointer-events-none absolute left-3.5"
        :class="[
          variant === 'filled' ? 'top-4.5' : 'top-4',
          isDisabled ? 'text-on-surface/38' : 'text-on-surface-variant',
        ]"
      >
        <MIcon :name="leadingIcon" :size="24" />
      </div>

      <input
        ref="inputEl"
        :aria-invalid="hasError || undefined"
        :aria-describedby="errorMessage || hint ? messageId : undefined"
        :id="id"
        type="number"
        :value="modelValue ?? ''"
        :disabled="isDisabled"
        :required="required"
        :min="min"
        :max="max"
        :step="step"
        placeholder=" "
        :class="inputClasses"
        v-overflow-title
        @input="onInput"
        @keydown="onKeydown"
      />

      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <div v-if="stepper" class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <MIconButton icon="remove" label="Decrease" :size="32" :disabled="isDisabled || (min !== undefined && (modelValue ?? 0) <= min)" @click="decrement" />
        <MIconButton icon="add" label="Increase" :size="32" :disabled="isDisabled || (max !== undefined && (modelValue ?? 0) >= max)" @click="increment" />
      </div>
    </div>

    <p v-if="errorMessage" :id="messageId" role="alert" class="px-4 text-body-small text-error">{{ errorMessage }}</p>
    <p v-else-if="hint" :id="messageId" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>

<style scoped>
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
</style>
