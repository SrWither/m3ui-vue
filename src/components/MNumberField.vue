<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useFieldBg } from '../composables/useFieldBg'

const props = withDefaults(
  defineProps<{
    modelValue: number | null
    label: string
    variant?: 'filled' | 'outlined'
    min?: number
    max?: number
    step?: number
    error?: string
    hint?: string
    disabled?: boolean
    required?: boolean
    leadingIcon?: string
    stepper?: boolean
    fieldBg?: string
  }>(),
  {
    variant: 'filled',
    step: 1,
    stepper: true,
    modelValue: null,
  },
)

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const id = useId()
const fieldBgEl = ref<HTMLElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldBgEl, () => props.fieldBg)

const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined)

function clamp(val: number): number {
  if (props.min !== undefined && val < props.min) return props.min
  if (props.max !== undefined && val > props.max) return props.max
  return val
}

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '') { emit('update:modelValue', null); return }
  const n = Number(raw)
  if (!Number.isNaN(n)) emit('update:modelValue', clamp(n))
}

function increment() {
  if (props.disabled) return
  const current = props.modelValue ?? 0
  emit('update:modelValue', clamp(current + props.step))
}

function decrement() {
  if (props.disabled) return
  const current = props.modelValue ?? 0
  emit('update:modelValue', clamp(current - props.step))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') { e.preventDefault(); increment() }
  if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
}

const inputClasses = computed(() => {
  const pl = props.leadingIcon ? 'pl-12' : 'pl-4'
  const pr = props.stepper ? 'pr-24' : 'pr-4'
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

  const unfloatedTop = props.variant === 'filled' ? 'top-[53%]' : 'top-1/2'
  const base = [
    'pointer-events-none absolute truncate transition-all duration-200',
    left, 'right-4', `${unfloatedTop} -translate-y-1/2 text-body-large`,
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
        :class="variant === 'filled' ? 'top-5' : 'top-4.5'"
      >
        <MIcon :name="leadingIcon" :size="20" />
      </div>

      <input
        :id="id"
        type="number"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :min="min"
        :max="max"
        :step="step"
        placeholder=" "
        :class="inputClasses"
        @input="onInput"
        @keydown="onKeydown"
      />

      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <div v-if="stepper" class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <MIconButton icon="remove" label="Decrease" :size="32" :disabled="disabled || (min !== undefined && (modelValue ?? 0) <= min)" @click="decrement" />
        <MIconButton icon="add" label="Increase" :size="32" :disabled="disabled || (max !== undefined && (modelValue ?? 0) >= max)" @click="increment" />
      </div>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
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
