<script setup lang="ts">
import { computed, ref, useId, onMounted, onUnmounted } from 'vue'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null
    options: { label: string; value: string | number; disabled?: boolean }[]
    label?: string
    placeholder?: string
    variant?: 'filled' | 'outlined'
    disabled?: boolean
    error?: string
    hint?: string
    required?: boolean
    leadingIcon?: string
    fieldBg?: string
  }>(),
  {
    modelValue: null,
    variant: 'filled',
    disabled: false,
    required: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [string | number] }>()

const id = useId()
const open = ref(false)
const fieldEl = ref<HTMLElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldEl, () => props.fieldBg)
const dropdownEl = ref<HTMLElement | null>(null)
const dropPos = ref({ top: '0px', left: '0px', width: '0px' })

const hasValue = computed(() => props.modelValue !== null && props.modelValue !== '')
const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
)

function computeDropPos() {
  if (!fieldEl.value) return
  const rect = fieldEl.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const dropH = Math.min(240, props.options.length * 52 + 8)
  const openAbove = spaceBelow < dropH && rect.top > dropH
  dropPos.value = {
    top: openAbove ? `${rect.top - 4 - dropH}px` : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

function toggle() {
  if (props.disabled) return
  if (!open.value) computeDropPos()
  open.value = !open.value
}

function select(opt: { value: string | number; disabled?: boolean }) {
  if (opt.disabled) return
  emit('update:modelValue', opt.value)
  open.value = false
}

function onOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (!fieldEl.value?.contains(t) && !dropdownEl.value?.contains(t)) open.value = false
}

function onScroll(e: Event) {
  if (!open.value) return
  // Scrolling inside the dropdown list itself — do nothing
  if (dropdownEl.value?.contains(e.target as Node)) return
  // Recompute position to track the trigger element as the page scrolls
  if (!fieldEl.value) return
  const rect = fieldEl.value.getBoundingClientRect()
  // Only close if the trigger has scrolled completely out of the viewport
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    open.value = false
    return
  }
  computeDropPos()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { open.value = false; return }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); return }
  if (!open.value) return
  const opts = props.options.filter((o) => !o.disabled)
  const idx = opts.findIndex((o) => o.value === props.modelValue)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = opts[(idx + 1) % opts.length]
    if (next) emit('update:modelValue', next.value)
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = opts[(idx - 1 + opts.length) % opts.length]
    if (prev) emit('update:modelValue', prev.value)
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onOutsideClick)
  window.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideClick)
  window.removeEventListener('scroll', onScroll, true)
})

const triggerClasses = computed(() => {
  const pl = props.leadingIcon ? 'pl-12' : 'pl-4'
  const base = [
    'flex w-full cursor-pointer items-center pr-10 text-body-large transition-[border-color,border-width] duration-150',
    pl,
  ]

  if (props.variant === 'outlined') {
    return [
      ...base,
      'h-14 rounded-sm border bg-transparent',
      open.value
        ? (props.error ? 'border-2 border-error' : 'border-2 border-primary')
        : (props.error ? 'border-error' : 'border-outline hover:border-on-surface'),
    ].join(' ')
  }

  return [
    ...base,
    'h-14 rounded-t-sm bg-surface-container-highest border-b pt-6 pb-2',
    open.value
      ? (props.error ? 'border-b-2 border-error' : 'border-b-2 border-primary')
      : (props.error ? 'border-error' : 'border-on-surface-variant hover:border-on-surface'),
  ].join(' ')
})

const isFloated = computed(() => hasValue.value || open.value)

const labelClasses = computed(() => {
  const left = props.leadingIcon
    ? (props.variant === 'outlined' ? 'left-11' : 'left-12')
    : (props.variant === 'outlined' ? 'left-3' : 'left-4')

  const floated = props.variant === 'outlined'
    ? '-top-2.5 translate-y-0 text-label-small bg-[var(--field-bg)] px-1 right-auto max-w-[calc(100%-1.5rem)]'
    : 'top-2 translate-y-0 text-label-small'

  const unFloated = 'top-1/2 -translate-y-1/2 text-body-large'

  return [
    'pointer-events-none absolute right-10 truncate transition-all duration-200',
    left,
    isFloated.value ? floated : unFloated,
    open.value
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
      <!-- Leading icon -->
      <div
        v-if="leadingIcon"
        class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
      >
        <MIcon :name="leadingIcon" :size="20" />
      </div>

      <!-- Custom trigger -->
      <div
        :id="id"
        :tabindex="disabled ? -1 : 0"
        role="combobox"
        :aria-expanded="open"
        :aria-disabled="disabled"
        :class="[triggerClasses, disabled ? 'pointer-events-none opacity-[0.38]' : '']"
        @click="toggle"
        @keydown="onKeydown"
      >
        <span v-if="hasValue" class="text-on-surface">{{ selectedLabel }}</span>
      </div>

      <!-- Floating label -->
      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <!-- Arrow icon -->
      <div class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <MIcon
          :name="open ? 'arrow_drop_up' : 'arrow_drop_down'"
          :size="24"
          class="text-on-surface-variant transition-transform duration-200"
        />
      </div>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>

  <!-- Dropdown teleported to body to escape overflow clipping -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-[opacity,transform] duration-150"
      enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-[opacity,transform] duration-100"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
    >
      <div
        v-if="open"
        ref="dropdownEl"
        class="fixed z-[500] max-h-60 overflow-auto rounded-sm bg-surface-container py-1 shadow-elevation-2"
        :style="dropPos"
      >
        <div
          v-for="opt in options"
          :key="opt.value"
          class="flex cursor-pointer items-center gap-3 px-4 py-3 text-body-large"
          :class="[
            opt.disabled
              ? 'cursor-not-allowed opacity-38 text-on-surface'
              : 'text-on-surface hover:bg-on-surface/8',
            opt.value === modelValue ? 'bg-primary/8 text-primary font-medium' : '',
          ]"
          @click="select(opt)"
        >
          <MIcon
            v-if="opt.value === modelValue"
            name="check"
            :size="18"
            class="shrink-0 text-primary"
          />
          <span v-else class="w-[18px] shrink-0" />
          {{ opt.label }}
        </div>
        <p
          v-if="!options.length"
          class="px-4 py-3 text-center text-body-small text-on-surface-variant"
        >
          Sin opciones
        </p>
      </div>
    </Transition>
  </Teleport>
</template>
