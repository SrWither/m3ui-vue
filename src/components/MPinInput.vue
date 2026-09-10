<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    length?: number
    /** Segment sizes for a grouped layout, e.g. [2, 4, 2, 3, 1, 3] renders `__ ____ __ ___ _ ___`. Overrides `length` (derived as the sum). */
    groups?: number[]
    /** Visual separator rendered between groups (only used when `groups` is set). */
    separator?: string
    type?: 'numeric' | 'alphanumeric'
    masked?: boolean
    variant?: 'filled' | 'outlined'
    error?: boolean
    errorLabel?: string
    hint?: string
    disabled?: boolean
    autoFocus?: boolean
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

const emit = defineEmits<{ 'update:modelValue': [string]; complete: [string] }>()

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
    'h-14 w-12 text-center text-title-large text-on-surface outline-none',
    'transition-[border-color,border-width] duration-150',
    'disabled:cursor-not-allowed disabled:opacity-[0.38]',
  ]
  if (props.variant === 'outlined') {
    return [...base,
      'rounded-sm border bg-transparent',
      props.error
        ? 'border-error focus:border-2 focus:border-error'
        : 'border-outline hover:border-on-surface focus:border-2 focus:border-primary',
    ].join(' ')
  }
  return [...base,
    'rounded-t-sm bg-surface-container-highest border-b',
    props.error
      ? 'border-error focus:border-b-2 focus:border-error'
      : 'border-on-surface-variant hover:border-on-surface focus:border-b-2 focus:border-primary',
  ].join(' ')
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div role="group" :aria-label="label" class="flex items-center gap-2">
      <template v-for="(digit, i) in digits" :key="i">
        <input
          :ref="(el) => setInputEl(el, i)"
          :value="digit"
          :type="masked ? 'password' : 'text'"
          :inputmode="type === 'numeric' ? 'numeric' : 'text'"
          autocomplete="one-time-code"
          maxlength="1"
          :disabled="disabled"
          :aria-label="`Digit ${i + 1} of ${totalLength}`"
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

    <p v-if="error && errorLabel" class="px-1 text-body-small text-error">{{ errorLabel }}</p>
    <p v-else-if="hint" class="px-1 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
