<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    label?: string
    placeholder?: string
    variant?: 'filled' | 'outlined'
    disabled?: boolean
    error?: string
    hint?: string
    required?: boolean
    leadingIcon?: string
    fieldBg?: string
    maxTags?: number
    duplicates?: boolean
    clearable?: boolean
  }>(),
  {
    modelValue: () => [],
    variant: 'filled',
    disabled: false,
    required: false,
    duplicates: false,
    clearable: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const id = useId()
const focused = ref(false)
const inputValue = ref('')
const fieldEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldEl, () => props.fieldBg)

const hasValue = computed(() => props.modelValue.length > 0)
const canAddMore = computed(() => props.maxTags == null || props.modelValue.length < props.maxTags)

function addTag(raw: string) {
  const tag = raw.trim()
  if (!tag) return
  if (!props.duplicates && props.modelValue.includes(tag)) return
  if (!canAddMore.value) return
  emit('update:modelValue', [...props.modelValue, tag])
}

function removeTag(index: number, e?: Event) {
  e?.stopPropagation()
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
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

function focusInput() {
  if (!props.disabled) {
    inputEl.value?.focus()
  }
}

const triggerClasses = computed(() => {
  const base = [
    'flex min-h-[56px] w-full cursor-text items-center gap-1.5 flex-wrap',
    'transition-[border-color,border-width] duration-150',
    props.leadingIcon ? 'pl-12 pr-10' : 'pl-4 pr-10',
  ]

  if (props.variant === 'outlined') {
    return [
      ...base,
      'rounded-sm border bg-transparent py-2',
      focused.value
        ? (props.error ? 'border-2 border-error' : 'border-2 border-primary')
        : (props.error ? 'border-error' : 'border-outline hover:border-on-surface'),
    ].join(' ')
  }

  return [
    ...base,
    'rounded-t-sm bg-surface-container-highest border-b pb-2',
    hasValue.value || focused.value ? 'pt-7' : 'pt-4',
    focused.value
      ? (props.error ? 'border-b-2 border-error' : 'border-b-2 border-primary')
      : (props.error ? 'border-error' : 'border-on-surface-variant hover:border-on-surface'),
  ].join(' ')
})

const labelClasses = computed(() => {
  const left = props.leadingIcon
    ? (props.variant === 'outlined' ? 'left-11' : 'left-12')
    : (props.variant === 'outlined' ? 'left-3' : 'left-4')

  const floated = props.variant === 'outlined'
    ? '-top-2.5 translate-y-0 text-label-small bg-[var(--field-bg)] px-1 right-auto max-w-[calc(100%-1.5rem)]'
    : 'top-2 translate-y-0 text-label-small'

  const unFloated = props.variant === 'filled'
    ? 'top-[53%] -translate-y-1/2 text-body-large'
    : 'top-1/2 -translate-y-1/2 text-body-large'
  const active = focused.value || hasValue.value

  return [
    'pointer-events-none absolute right-10 truncate transition-all duration-200',
    left,
    active ? floated : unFloated,
    focused.value
      ? (props.error ? 'text-error' : 'text-primary')
      : (props.error ? 'text-error' : 'text-on-surface-variant'),
  ].join(' ')
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      ref="fieldEl"
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

      <!-- Trigger field -->
      <div
        :id="id"
        :class="triggerClasses"
        @click="focusInput"
      >
        <span
          v-for="(tag, i) in modelValue"
          :key="i"
          class="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-label-small text-on-secondary-container"
        >
          {{ tag }}
          <button
            v-if="!disabled"
            type="button"
            class="flex h-4 w-4 items-center justify-center rounded-full hover:bg-on-secondary-container/20"
            @click="removeTag(i, $event)"
          >
            <MIcon name="close" :size="12" />
          </button>
        </span>

        <input
          ref="inputEl"
          :value="inputValue"
          type="text"
          class="min-w-[60px] flex-1 bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
          :placeholder="!hasValue && (!label || focused) ? placeholder : ''"
          :disabled="disabled"
          :readonly="!canAddMore"
          @input="onInput"
          @keydown="onKeydown"
          @paste="onPaste"
          @focus="focused = true"
          @blur="focused = false"
        />
      </div>

      <label :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="absolute right-2 top-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click.stop="emit('update:modelValue', []); inputValue = ''"
      >
        <MIcon name="close" :size="18" />
      </button>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
