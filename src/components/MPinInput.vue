<script setup lang="ts">
/**
 * One box per character for OTP/PIN/verification codes. Typing advances to the next box, backspace on an empty
 * box goes back, and pasting a full code fills every box at once.
 *
 * @event update:modelValue Emitted on every box change — powers v-model
 * @event complete Fires once with the full code as soon as every box is filled — the natural place to trigger
 *   auto-submit
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'

const props = withDefaults(
  defineProps<{
    /** Bound code (v-model), e.g. "1234" */
    modelValue: string
    /** Number of boxes (ignored when groups is set) */
    length?: number
    /** Segment sizes for a grouped layout, e.g. [2, 4, 2, 3, 1, 3] renders `__ ____ __ ___ _ ___`. Overrides `length` (derived as the sum). */
    groups?: number[]
    /** Visual separator rendered between groups (only used when `groups` is set). */
    separator?: string
    /** Restricts which characters are accepted */
    type?: 'numeric' | 'alphanumeric'
    /** Renders each box as a password field (dots instead of characters) */
    masked?: boolean
    /** Visual style */
    variant?: 'filled' | 'outlined'
    /** Error state. A string is also the message (`:error="errors.x"`) */
    error?: boolean | string
    /** Error message shown when error is true */
    errorLabel?: string
    /** Marks as required — adds a red asterisk after the label; inside an `MForm` or with `rules`, also validates it */
    required?: boolean
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
    /** Hint text below the boxes */
    hint?: string
    /** Disables every box */
    disabled?: boolean
    /** Focuses the first box on mount */
    autoFocus?: boolean
    /** aria-label for the group of boxes */
    label?: string
  }>(),
  {
    modelValue: '',
    length: 6,
    separator: '-',
    type: 'numeric',
    masked: false,
    variant: 'filled',
    disabled: false,
    autoFocus: false,
  },
)

const totalLength = computed(() => (props.groups?.length ? props.groups.reduce((a, b) => a + b, 0) : props.length))

// Index (0-based) of the last box in each group except the last — a
// separator is rendered right after each of these boxes.
const groupBoundaries = computed(() => {
  const boundaries = new Set<number>()
  if (!props.groups?.length) return boundaries
  let sum = 0
  for (const size of props.groups.slice(0, -1)) {
    sum += size
    boundaries.add(sum - 1)
  }
  return boundaries
})

const emit = defineEmits<{ blur: []; 'update:modelValue': [string]; complete: [string] }>()

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
  focus: () => { inputEls.value[0]?.focus() },
  el: () => inputEls.value[0],
  setValue: (v) => emit('update:modelValue', v as string),
  isEmpty: (v) => String(v ?? '').length < props.length,
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
})

const inputEls = ref<(HTMLInputElement | null)[]>([])

function setInputEl(el: any, i: number) {
  inputEls.value[i] = el as HTMLInputElement | null
}

const allowedPattern = computed(() => (props.type === 'numeric' ? /[0-9]/ : /[a-zA-Z0-9]/))

// A gap can appear in the middle of the value if the user clicks past an
// empty box (e.g. fills 0 and 1, then clicks box 3 directly). '\0' preserves
// that empty slot's position; trailing empties are just dropped.
const EMPTY = '\0'

const digits = computed(() => Array.from({ length: totalLength.value }, (_, i) => {
  const c = props.modelValue[i]
  return c === undefined || c === EMPTY ? '' : c
}))

function charsToValue(chars: string[]): string {
  let end = chars.length
  while (end > 0 && !chars[end - 1]) end--
  return chars.slice(0, end).map((c) => c || EMPTY).join('')
}

function setValue(chars: string[]) {
  const next = charsToValue(chars)
  emit('update:modelValue', next)
  if (next.length === totalLength.value && !next.includes(EMPTY)) {
    emit('complete', next)
  }
}

function focusInput(i: number) {
  nextTick(() => inputEls.value[i]?.focus())
}

function onFocus(i: number) {
  inputEls.value[i]?.select()
}

function onInput(i: number, e: Event) {
  const input = e.target as HTMLInputElement
  const char = input.value.slice(-1)

  if (char && !allowedPattern.value.test(char)) {
    input.value = digits.value[i] ?? ''
    return
  }

  const chars = [...digits.value]
  chars[i] = char
  setValue(chars)

  if (char && i < totalLength.value - 1) {
    focusInput(i + 1)
  }
}

function onKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) {
    e.preventDefault()
    const chars = [...digits.value]
    chars[i - 1] = ''
    setValue(chars)
    focusInput(i - 1)
  } else if (e.key === 'ArrowLeft' && i > 0) {
    e.preventDefault()
    focusInput(i - 1)
  } else if (e.key === 'ArrowRight' && i < totalLength.value - 1) {
    e.preventDefault()
    focusInput(i + 1)
  }
}

function onPaste(i: number, e: ClipboardEvent) {
  e.preventDefault()
  const pasted = (e.clipboardData?.getData('text') ?? '').split('').filter((c) => allowedPattern.value.test(c))
  if (pasted.length === 0) return

  const chars = [...digits.value]
  let last = i
  for (const c of pasted) {
    if (last >= totalLength.value) break
    chars[last] = c
    last++
  }
  setValue(chars)
  focusInput(Math.min(last, totalLength.value - 1))
}

watch(
  () => props.autoFocus,
  (v) => {
    if (v) focusInput(0)
  },
  { immediate: true },
)

const boxClasses = computed(() => {
  const base = [
    // Shrinks below 48px when the row is narrower than all the boxes (flex: 0 1 3rem)
    'h-14 w-12 min-w-0 shrink text-center text-title-large outline-none',
    'transition-[border-color,border-width] duration-150',
    'disabled:cursor-not-allowed disabled:text-on-surface/38',
    hasError.value ? 'caret-error' : 'caret-primary',
  ]
  if (props.variant === 'outlined') {
    return [...base,
      'rounded-xs border bg-transparent text-on-surface',
      hasError.value
        ? 'border-error focus:border-2 focus:border-error'
        : 'border-outline hover:border-on-surface focus:border-2 focus:border-primary',
      'disabled:border-on-surface/12',
    ].join(' ')
  }
  return [...base,
    'rounded-t-xs bg-surface-container-highest border-b text-on-surface',
    hasError.value
      ? 'border-error focus:border-b-2 focus:border-error'
      : 'border-on-surface-variant hover:border-on-surface focus:border-b-2 focus:border-primary',
    'disabled:border-on-surface/38 disabled:bg-[color-mix(in_srgb,var(--color-on-surface)_4%,var(--color-surface-container-highest))]',
  ].join(' ')
})

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-1" @focusout="onFocusOut">
    <div role="group" :aria-label="label" class="flex min-w-0 items-center gap-2">
      <template v-for="(digit, i) in digits" :key="i">
        <input
          :ref="(el) => setInputEl(el, i)"
          :value="digit"
          :type="masked ? 'password' : 'text'"
          :inputmode="type === 'numeric' ? 'numeric' : 'text'"
          autocomplete="one-time-code"
          maxlength="1"
          :disabled="isDisabled"
          :aria-label="`Digit ${i + 1} of ${totalLength}`"
          :aria-invalid="hasError || undefined"
          :aria-describedby="errorMessage || hint ? messageId : undefined"
          :class="boxClasses"
          @input="onInput(i, $event)"
          @keydown="onKeydown(i, $event)"
          @paste="onPaste(i, $event)"
          @focus="onFocus(i)"
        />
        <span
          v-if="groupBoundaries.has(i)"
          aria-hidden="true"
          class="select-none text-title-large text-on-surface-variant"
        >{{ separator }}</span>
      </template>
    </div>

    <p v-if="errorMessage" :id="messageId" role="alert" class="px-1 text-body-small text-error">{{ errorMessage }}</p>
    <p v-else-if="hint" :id="messageId" class="px-1 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
