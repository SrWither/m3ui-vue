<script setup lang="ts">
/**
 * Type and press Enter or comma to add a free-form tag. Backspace on an empty input removes the last tag.
 *
 * @event update:modelValue Emitted whenever a tag is added or removed — powers v-model
 * @event debounced Emitted debounce ms after the tag list stops changing (only when debounce > 0)
 */
import { computed, ref, useId } from 'vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useDebounce } from '../composables/useDebounce'
import { useLocale } from '../composables/useLocale'
import { FIELD_PADDING_RIGHT, fieldLabelClasses, vOverflowTitle, type FieldRightInset } from '../composables/_fieldLayout'

const locale = useLocale()
const props = withDefaults(
  defineProps<{
    /** Array of tags (v-model) */
    modelValue: string[]
    /** Floating label text */
    label?: string
    /** Input placeholder */
    placeholder?: string
    /** Field style */
    variant?: 'filled' | 'outlined'
    /** Disables the field */
    disabled?: boolean
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
    /** Helper text below field */
    hint?: string
    /** Marks as required — adds a red asterisk after the label */
    required?: boolean
    /** Material Symbol icon name */
    leadingIcon?: string
    /**
     * Overrides the auto-detected background color used to cut the floating label out of the outlined border
     */
    fieldBg?: string
    /** Max number of tags allowed */
    maxTags?: number
    /** Allow duplicate tags */
    duplicates?: boolean
    /** Show a clear-all button */
    clearable?: boolean
    /** Delay (ms) before firing the @debounced event */
    debounce?: number
  }>(),
  {
    modelValue: () => [],
    variant: 'filled',
    disabled: false,
    required: false,
    duplicates: false,
    clearable: false,
    debounce: 0,
  },
)

const emit = defineEmits<{ blur: []; 'update:modelValue': [string[]]; debounced: [string[]] }>()

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
  setValue: (v) => emit('update:modelValue', v as string[]),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
})

const id = useId()
const focused = ref(false)
const inputValue = ref('')
const fieldEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldEl, () => props.fieldBg)

const { debounced: emitDebounced, cancel: cancelDebounce } = useDebounce((v: string[]) => emit('debounced', v), props.debounce)

const hasValue = computed(() => props.modelValue.length > 0)
const canAddMore = computed(() => props.maxTags == null || props.modelValue.length < props.maxTags)

function addTag(raw: string) {
  const tag = raw.trim()
  if (!tag) return
  if (!props.duplicates && props.modelValue.includes(tag)) return
  if (!canAddMore.value) return
  const next = [...props.modelValue, tag]
  emit('update:modelValue', next)
  if (props.debounce > 0) emitDebounced(next)
}

function removeTag(index: number, e?: Event) {
  e?.stopPropagation()
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
  if (props.debounce > 0) emitDebounced(next)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag(inputValue.value)
    inputValue.value = ''
  } else if (e.key === 'Backspace' && inputValue.value === '' && props.modelValue.length > 0) {
    removeTag(props.modelValue.length - 1)
  }
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  // Handle comma typed via input event (covers paste with commas too)
  if (value.includes(',')) {
    const parts = value.split(',')
    for (const part of parts.slice(0, -1)) {
      addTag(part)
    }
    inputValue.value = parts[parts.length - 1] ?? ''
  } else {
    inputValue.value = value
  }
}

function onPaste(e: ClipboardEvent) {
  const pasted = e.clipboardData?.getData('text') ?? ''
  if (pasted.includes(',')) {
    e.preventDefault()
    const parts = pasted.split(',')
    for (const part of parts) {
      addTag(part)
    }
  }
}

function onBlur() {
  if (inputValue.value.trim()) {
    addTag(inputValue.value)
    inputValue.value = ''
  }
  focused.value = false
}

function focusInput() {
  if (!isDisabled.value) {
    inputEl.value?.focus()
  }
}

// Chips wrap before the trailing controls; the label stops there too
const rightInset = computed<FieldRightInset>(() => ('right-10'))

const triggerClasses = computed(() => {
  const base = [
    'flex min-h-[56px] w-full min-w-0 items-center gap-1.5 flex-wrap',
    'transition-[border-color,border-width] duration-150',
    isDisabled.value ? 'cursor-not-allowed' : 'cursor-text',
    props.leadingIcon ? 'pl-12' : 'pl-4',
    FIELD_PADDING_RIGHT[rightInset.value],
  ]

  if (props.variant === 'outlined') {
    const border = isDisabled.value
      ? 'border-on-surface/12'
      : focused.value
        ? (hasError.value ? 'border-2 border-error' : 'border-2 border-primary')
        : (hasError.value ? 'border-error' : 'border-outline hover:border-on-surface')
    return [...base, 'rounded-xs border bg-transparent py-2', border].join(' ')
  }

  const border = isDisabled.value
    ? 'border-on-surface/38'
    : focused.value
      ? (hasError.value ? 'border-b-2 border-error' : 'border-b-2 border-primary')
      : (hasError.value ? 'border-error' : 'border-on-surface-variant hover:border-on-surface')
  const bg = isDisabled.value
    ? 'bg-[color-mix(in_srgb,var(--color-on-surface)_4%,var(--color-surface-container-highest))]'
    : 'bg-surface-container-highest'
  return [...base, 'rounded-t-xs border-b pb-2', hasValue.value || focused.value ? 'pt-7' : 'pt-4', bg, border].join(' ')
})

const labelClasses = computed(() =>
  fieldLabelClasses({
    variant: props.variant,
    leading: !!props.leadingIcon,
    right: rightInset.value,
    floated: focused.value || hasValue.value,
    color: isDisabled.value
      ? 'text-on-surface/38'
      : focused.value
        ? (hasError.value ? 'text-error' : 'text-primary')
        : (hasError.value ? 'text-error' : 'text-on-surface-variant'),
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
  /** Selects part of its text (e.g. a file name without its extension) */
  setSelectionRange: (start: number, end: number, direction?: 'forward' | 'backward' | 'none') => inputEl.value?.setSelectionRange(start, end, direction),
})
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-1" @focusout="onFocusOut">
    <div
      ref="fieldEl"
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

      <!-- Trigger field -->
      <div
        :id="id"
        :class="triggerClasses"
        @click="focusInput"
      >
        <span
          v-for="(tag, i) in modelValue"
          :key="i"
          class="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-label-small"
          :class="isDisabled ? 'bg-on-surface/12 text-on-surface/38' : 'bg-secondary-container text-on-secondary-container'"
        >
          <span v-overflow-title class="min-w-0 truncate">{{ tag }}</span>
          <button
            :aria-label="`${locale.remove} ${tag}`"
            v-if="!isDisabled"
            type="button"
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-on-secondary-container/20"
            @click="removeTag(i, $event)"
          >
            <MIcon name="close" :size="12" />
          </button>
        </span>

        <input
          ref="inputEl"
        :aria-invalid="hasError || undefined"
        :aria-describedby="errorMessage || hint ? messageId : undefined"
          :value="inputValue"
          type="text"
          enterkeyhint="done"
          autocomplete="off"
          :class="[
            'min-w-[60px] flex-1 bg-transparent text-body-large outline-none placeholder:text-on-surface-variant',
            hasError ? 'caret-error' : 'caret-primary',
            isDisabled ? 'text-on-surface/38' : 'text-on-surface',
          ]"
          :placeholder="!hasValue && (!label || focused) ? placeholder : ''"
          :disabled="isDisabled"
          :readonly="!canAddMore"
          @input="onInput"
          @keydown="onKeydown"
          @paste="onPaste"
          @focus="focused = true"
          @blur="onBlur"
        />
      </div>

      <label :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <button
        :aria-label="locale.clear"
        v-if="clearable && hasValue && !isDisabled"
        type="button"
        class="absolute right-2 top-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click.stop="cancelDebounce(); emit('update:modelValue', []); inputValue = ''"
      >
        <MIcon name="close" :size="18" />
      </button>
    </div>

    <p v-if="errorMessage" :id="messageId" role="alert" class="px-4 text-body-small text-error">{{ errorMessage }}</p>
    <p v-else-if="hint" :id="messageId" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
