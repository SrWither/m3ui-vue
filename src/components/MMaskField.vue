<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'

export type MaskPreset = 'credit-card' | 'phone' | 'date' | 'time' | 'cpf' | 'cnpj' | 'zip'

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
    modelValue: string
    label: string
    mask: string | MaskPreset
    variant?: 'filled' | 'outlined'
    error?: string
    hint?: string
    disabled?: boolean
    required?: boolean
    leadingIcon?: string
    clearable?: boolean
    fieldBg?: string
  }>(),
  {
    variant: 'filled',
    clearable: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const id = useId()
const fieldBgEl = ref<HTMLElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldBgEl, () => props.fieldBg)
const inputEl = ref<HTMLInputElement | null>(null)

const resolvedMask = computed(() => PRESETS[props.mask as MaskPreset] ?? props.mask)

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
      requestAnimationFrame(() => {
        if (inputEl.value) inputEl.value.value = masked
      })
    }
  }
}

const hasTrailing = computed(() => props.clearable)

const inputClasses = computed(() => {
  const pl = props.leadingIcon ? 'pl-12' : 'pl-4'
  const pr = hasTrailing.value ? 'pr-12' : 'pr-4'
  const base = [
    'peer block w-full text-body-large text-on-surface outline-none placeholder:text-transparent',
    'transition-[border-color,border-width] duration-150',
    'disabled:cursor-not-allowed disabled:opacity-[0.38]',
    'h-14', pl, pr,
  ]
  if (props.variant === 'outlined') {
    return [...base,
      'rounded-sm border bg-transparent py-4',
      props.error
        ? 'border-error focus:border-2 focus:border-error'
        : 'border-outline hover:border-on-surface focus:border-2 focus:border-primary',
    ].join(' ')
  }
  return [...base,
    'rounded-t-sm bg-surface-container-highest border-b pt-6 pb-2',
    props.error
      ? 'border-error focus:border-b-2 focus:border-error'
      : 'border-on-surface-variant hover:border-on-surface focus:border-b-2 focus:border-primary',
  ].join(' ')
})

const labelClasses = computed(() => {
  const left = props.leadingIcon
    ? (props.variant === 'outlined' ? 'left-11' : 'left-12')
    : (props.variant === 'outlined' ? 'left-3' : 'left-4')
  const base = [
    'pointer-events-none absolute truncate transition-all duration-200',
    left, 'right-4', 'top-1/2 -translate-y-1/2 text-body-large',
  ]
  if (props.variant === 'outlined') {
    return [...base,
      'peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-label-small peer-focus:right-auto peer-focus:max-w-[calc(100%-1.5rem)] peer-focus:bg-[var(--field-bg)] peer-focus:px-1',
      'peer-[&:not(:placeholder-shown)]:-top-2.5 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:right-auto peer-[&:not(:placeholder-shown)]:max-w-[calc(100%-1.5rem)]',
      'peer-[&:not(:placeholder-shown)]:text-label-small peer-[&:not(:placeholder-shown)]:bg-[var(--field-bg)] peer-[&:not(:placeholder-shown)]:px-1',
      props.error ? 'text-error peer-focus:text-error' : 'text-on-surface-variant peer-focus:text-primary',
    ].join(' ')
  }
  return [...base,
    'peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-label-small',
    'peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-label-small',
    props.error ? 'text-error peer-focus:text-error' : 'text-on-surface-variant peer-focus:text-primary',
  ].join(' ')
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
        class="pointer-events-none absolute left-3.5 text-on-surface-variant"
        :class="variant === 'filled' ? 'top-[57%] -translate-y-1/2' : 'top-[55%] -translate-y-1/2'"
      >
        <MIcon :name="leadingIcon" :size="20" />
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
        @input="onInput"
        @keydown="onKeydown"
      />

      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <button
        v-if="showClear"
        type="button"
        class="absolute right-3 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        :class="variant === 'filled' ? 'top-[57%] -translate-y-1/2' : 'top-[55%] -translate-y-1/2'"
        @click="emit('update:modelValue', '')"
      >
        <MIcon name="close" :size="18" />
      </button>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
