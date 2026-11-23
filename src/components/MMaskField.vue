<script setup lang="ts">
/**
 * A text field with a formatting mask — built-in presets or a custom pattern where `#` stands for a digit.
 *
 * @event update:modelValue Emitted on every keystroke — powers v-model
 * @event debounced Emitted debounce ms after the user stops typing (only when debounce > 0)
 */
import { computed, ref, useId, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useDebounce } from '../composables/useDebounce'
import { useLocale } from '../composables/useLocale'
import { FIELD_PADDING_RIGHT, fieldLabelClasses, vOverflowTitle, type FieldRightInset } from '../composables/_fieldLayout'

export type MaskPreset = 'credit-card' | 'phone' | 'date' | 'time' | 'cpf' | 'cnpj' | 'zip'

const locale = useLocale()
const PRESETS: Record<MaskPreset, string> = {
  'credit-card': '#### #### #### ####',
  phone: '(###) ###-####',
  date: '##/##/####',
  time: '##:##',
  cpf: '###.###.###-##',
  cnpj: '##.###.###/####-##',
  zip: '#####-####',
}

const props = withDefaults(
  defineProps<{
    /** Masked value (v-model) */
    modelValue: string
    /** Field label */
    label: string
    /** Mask pattern (# = digit) or a built-in preset name (see `MaskPreset`) */
    mask: string | MaskPreset
    /** Visual style */
    variant?: 'filled' | 'outlined'
    /** Error state */
    error?: boolean
    /** Error message shown when error is true */
    errorLabel?: string
    /** Hint text */
    hint?: string
    /** Disables the field */
    disabled?: boolean
    /** Marks as required — adds a red asterisk after the label */
    required?: boolean
    /** Material Symbol icon */
    leadingIcon?: string
    /** Show clear button */
    clearable?: boolean
    /**
     * Overrides the auto-detected background color used to cut the floating label out of the outlined border
     */
    fieldBg?: string
    /** Delay (ms) before firing the @debounced event */
    debounce?: number
  }>(),
  {
    variant: 'filled',
    clearable: false,
    debounce: 0,
  },
)

const emit = defineEmits<{ 'update:modelValue': [string]; debounced: [string] }>()

const id = useId()
const fieldBgEl = ref<HTMLElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldBgEl, () => props.fieldBg)
const inputEl = ref<HTMLInputElement | null>(null)

const resolvedMask = computed(() => PRESETS[props.mask as MaskPreset] ?? props.mask)

const { debounced: emitDebounced, cancel: cancelDebounce } = useDebounce((v: string) => emit('debounced', v), props.debounce)

const showClear = computed(() => props.clearable && props.modelValue.length > 0 && !props.disabled)

function rawToMasked(raw: string, mask: string): string {
  let result = ''
  let ri = 0
  for (let mi = 0; mi < mask.length && ri < raw.length; mi++) {
    if (mask[mi] === '#') {
      result += raw[ri++]
    } else {
      result += mask[mi]
      if (raw[ri] === mask[mi]) ri++
    }
  }
  return result
}

function maskedToRaw(masked: string): string {
  const mask = resolvedMask.value
  let raw = ''
  for (let i = 0; i < masked.length && i < mask.length; i++) {
    if (mask[i] === '#') raw += masked[i]
  }
  return raw
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value.replace(/[^\d]/g, '')
  const masked = rawToMasked(raw, resolvedMask.value)
  emit('update:modelValue', masked)
  if (props.debounce > 0) emitDebounced(masked)

  requestAnimationFrame(() => {
    if (inputEl.value) inputEl.value.value = masked
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Backspace' && props.modelValue.length > 0) {
    const raw = maskedToRaw(props.modelValue)
    if (raw.length > 0) {
      e.preventDefault()
      const newRaw = raw.slice(0, -1)
      const masked = rawToMasked(newRaw, resolvedMask.value)
      emit('update:modelValue', masked)
      if (props.debounce > 0) emitDebounced(masked)
      requestAnimationFrame(() => {
        if (inputEl.value) inputEl.value.value = masked
      })
    }
  }
}

const hasTrailing = computed(() => props.clearable)

// The label and the text both stop before the trailing controls
const rightInset = computed<FieldRightInset>(() => (hasTrailing.value ? 'right-12' : 'right-4'))

const inputClasses = computed(() => {
  const pl = props.leadingIcon ? 'pl-12' : 'pl-4'
  const pr = FIELD_PADDING_RIGHT[rightInset.value]
  const base = [
    'peer block w-full text-body-large text-on-surface outline-none placeholder:text-transparent',
    'transition-[border-color,border-width] duration-150',
    'disabled:cursor-not-allowed disabled:text-on-surface/38',
    props.error ? 'caret-error' : 'caret-primary',
    'h-14', pl, pr,
  ]
  if (props.variant === 'outlined') {
    return [...base,
      'rounded-xs border bg-transparent py-4',
      props.error
        ? 'border-error focus:border-2 focus:border-error'
        : 'border-outline hover:border-on-surface focus:border-2 focus:border-primary',
      'disabled:border-on-surface/12',
    ].join(' ')
  }
  return [...base,
    'rounded-t-xs bg-surface-container-highest border-b pt-6 pb-2',
    props.error
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
      props.error ? 'text-error peer-focus:text-error' : 'text-on-surface-variant peer-focus:text-primary',
      'peer-disabled:text-on-surface/38',
    ].join(' '),
  }),
)

defineExpose({
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
  <div class="flex flex-col gap-1">
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
          disabled ? 'text-on-surface/38' : 'text-on-surface-variant',
        ]"
      >
        <MIcon :name="leadingIcon" :size="24" />
      </div>

      <input
        :id="id"
        ref="inputEl"
        type="text"
        inputmode="numeric"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        placeholder=" "
        :class="inputClasses"
        v-overflow-title
        @input="onInput"
        @keydown="onKeydown"
      />

      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <button
        :aria-label="locale.clear"
        v-if="showClear"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click="cancelDebounce(); emit('update:modelValue', '')"
      >
        <MIcon name="close" :size="18" />
      </button>
    </div>

    <p v-if="error && errorLabel" class="px-4 text-body-small text-error">{{ errorLabel }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
