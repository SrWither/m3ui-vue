<script setup lang="ts">
/**
 * A group of radio buttons sharing a single selection, column or row layout.
 *
 * @event update:modelValue Emitted with the selected option's value.
 * @event blur Emitted when focus leaves the group
 */
import { ref } from 'vue'
import MRadio from './MRadio.vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'

interface Option {
  label: string
  value: unknown
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  /** Selected value (v-model) */
  modelValue: unknown
  /** Radio options */
  options: Option[]
  /** Group label */
  label?: string
  /** Layout direction */
  direction?: 'column' | 'row'
  /** Disables all radios */
  disabled?: boolean
  /** Radio color */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error'
  /** Error state. A string is also the message */
  error?: boolean | string
  /** Error message shown when `error` is true */
  errorLabel?: string
  /** Marks it as required (asterisk); inside an `MForm` or with `rules`, an option must be picked */
  required?: boolean
  /** Validation rules (functions or a Standard Schema); see `MForm` */
  rules?: ValidationRule | ValidationRule[]
  /** When the rules are checked and shown: on leaving it (default), on change, or only on submit */
  validateOn?: ValidateOn
  /** The key of this field in its `MForm` */
  name?: string
}>(), { direction: 'column', disabled: false, color: 'primary' })

const emit = defineEmits<{ 'update:modelValue': [unknown]; blur: [] }>()

const rootEl = ref<HTMLElement | null>(null)

const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => props.rules,
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  disabled: () => props.disabled,
  focus: () => { (rootEl.value?.querySelector<HTMLInputElement>('input:checked:not(:disabled)') ?? rootEl.value?.querySelector<HTMLInputElement>('input:not(:disabled)'))?.focus() },
  el: () => rootEl.value,
  setValue: (v) => emit('update:modelValue', v as unknown),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation
// Moving between its radios isn't leaving it
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
})

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})
</script>

<template>
  <div
    ref="rootEl"
    class="flex flex-col gap-2"
    role="radiogroup"
    :aria-label="label"
    :aria-required="required || undefined"
    :aria-invalid="hasError || undefined"
    :aria-describedby="errorMessage ? messageId : undefined"
    @focusout="onFocusOut"
  >
    <span v-if="label" class="text-label-large" :class="hasError ? 'text-error' : 'text-on-surface-variant'">{{ label }}<span v-if="required" class="text-error">&nbsp;*</span></span>
    <div
      class="flex gap-4"
      :class="direction === 'row' ? 'flex-row flex-wrap' : 'flex-col'"
    >
      <MRadio
        v-for="opt in options"
        :key="String(opt.value)"
        :model-value="modelValue"
        :value="opt.value"
        :label="opt.label"
        :color="color"
        :disabled="isDisabled || !!opt.disabled"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
    <!-- M3's radio has no error state: the message (and the group label) say so -->
    <p v-if="errorMessage" :id="messageId" role="alert" class="text-body-small text-error">{{ errorMessage }}</p>
  </div>
</template>
