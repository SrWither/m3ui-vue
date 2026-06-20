<script setup lang="ts">
import { computed, ref, useId, onMounted, onUnmounted, nextTick } from 'vue'
import MIcon from './MIcon.vue'
import MCheckbox from './MCheckbox.vue'
import { useFieldBg } from '../composables/useFieldBg'

export interface MultiSelectOption {
  label: string
  value: unknown
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: unknown[]
    options: MultiSelectOption[]
    label?: string
    placeholder?: string
    variant?: 'filled' | 'outlined'
    disabled?: boolean
    error?: string
    hint?: string
    required?: boolean
    leadingIcon?: string
    fieldBg?: string
    searchable?: boolean
    maxChips?: number
    clearable?: boolean
  }>(),
  {
    modelValue: () => [],
    variant: 'filled',
    disabled: false,
    required: false,
    searchable: true,
    maxChips: 3,
    clearable: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [unknown[]] }>()

const id = useId()
const open = ref(false)
const search = ref('')
const fieldEl = ref<HTMLElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldEl, () => props.fieldBg)
const dropdownEl = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const dropPos = ref({ top: '0px', left: '0px', width: '0px' })

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function includes(arr: unknown[], val: unknown): boolean {
  return arr.some((v) => eq(v, val))
}

const hasValue = computed(() => props.modelValue.length > 0)

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

const visibleChips = computed(() =>
  props.modelValue.slice(0, props.maxChips).map((v) => ({
    value: v,
    label: props.options.find((o) => eq(o.value, v))?.label ?? String(v),
  })),
)

const overflowCount = computed(() => Math.max(0, props.modelValue.length - props.maxChips))

function toggle(value: unknown) {
  const current = props.modelValue
  if (includes(current, value)) {
    emit('update:modelValue', current.filter((v) => !eq(v, value)))
  } else {
    emit('update:modelValue', [...current, value])
  }
}

function removeChip(value: unknown, e: Event) {
  e.stopPropagation()
  emit('update:modelValue', props.modelValue.filter((v) => !eq(v, value)))
}

function computeDropPos() {
  if (!fieldEl.value) return
  const rect = fieldEl.value.getBoundingClientRect()
  dropPos.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

async function openDropdown() {
  if (props.disabled) return
  computeDropPos()
  open.value = true
  search.value = ''
  await nextTick()
  searchInput.value?.focus()
}

function close() {
  open.value = false
  search.value = ''
}

function onOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (!fieldEl.value?.contains(t) && !dropdownEl.value?.contains(t)) close()
}

function onScroll(e: Event) {
  if (!open.value) return
  if (dropdownEl.value?.contains(e.target as Node)) return
  if (!fieldEl.value) return
  const rect = fieldEl.value.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    close()
    return
  }
  computeDropPos()
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
  const base = [
    'flex min-h-[56px] w-full cursor-pointer items-center gap-1.5 flex-wrap',
    'transition-[border-color,border-width] duration-150',
    props.leadingIcon ? 'pl-12 pr-10' : 'pl-4 pr-10',
  ]

  if (props.variant === 'outlined') {
    return [
      ...base,
      'rounded-sm border bg-transparent py-2',
      open.value
        ? (props.error ? 'border-2 border-error' : 'border-2 border-primary')
        : (props.error ? 'border-error' : 'border-outline hover:border-on-surface'),
    ].join(' ')
  }

  return [
    ...base,
    'rounded-t-sm bg-surface-container-highest border-b pb-2',
    hasValue.value || open.value ? 'pt-7' : 'pt-4',
    open.value
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

  const unFloated = 'top-1/2 -translate-y-1/2 text-body-large'
  const active = open.value || hasValue.value

  return [
    'pointer-events-none absolute right-10 truncate transition-all duration-200',
    left,
    active ? floated : unFloated,
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
      <div
        v-if="leadingIcon"
        class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
      >
        <MIcon :name="leadingIcon" :size="20" />
      </div>

      <!-- Trigger field -->
      <div
        :id="id"
        :class="triggerClasses"
        role="button"
        :tabindex="disabled ? -1 : 0"
        :aria-expanded="open"
        :aria-haspopup="true"
        @click="open ? close() : openDropdown()"
        @keydown.enter.prevent="open ? close() : openDropdown()"
        @keydown.space.prevent="open ? close() : openDropdown()"
        @keydown.escape="close()"
      >
        <template v-if="hasValue">
          <span
            v-for="(chip, i) in visibleChips"
            :key="i"
            class="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-label-small text-on-secondary-container"
          >
            {{ chip.label }}
            <button
              type="button"
              class="flex h-4 w-4 items-center justify-center rounded-full hover:bg-on-secondary-container/20"
              @click="removeChip(chip.value, $event)"
            >
              <MIcon name="close" :size="12" />
            </button>
          </span>
          <span
            v-if="overflowCount > 0"
            class="rounded-full bg-surface-container-high px-2 py-0.5 text-label-small text-on-surface-variant"
          >
            +{{ overflowCount }}
          </span>
        </template>
        <span v-else-if="!open" class="text-body-large text-on-surface-variant opacity-0">
          {{ placeholder }}
        </span>
      </div>

      <label :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="absolute right-9 top-7 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click.stop="emit('update:modelValue', []); close()"
      >
        <MIcon name="close" :size="18" />
      </button>

      <div class="pointer-events-none absolute right-2 top-7 -translate-y-1/2">
        <MIcon
          :name="open ? 'arrow_drop_up' : 'arrow_drop_down'"
          :size="24"
          class="text-on-surface-variant"
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
        class="fixed z-500 max-h-60 overflow-auto rounded-sm bg-surface-container shadow-elevation-2"
        :style="dropPos"
      >
        <!-- Search -->
        <div v-if="searchable" class="sticky top-0 bg-surface-container px-3 py-2">
          <div class="flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5">
            <MIcon name="search" :size="16" class="shrink-0 text-on-surface-variant" />
            <input
              ref="searchInput"
              v-model="search"
              type="text"
              placeholder="Buscar..."
              class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant"
            />
          </div>
        </div>

        <div class="flex flex-col py-1">
          <label
            v-for="(opt, i) in filteredOptions"
            :key="i"
            class="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-on-surface/8"
            :class="opt.disabled ? 'cursor-not-allowed opacity-38' : ''"
          >
            <MCheckbox
              :model-value="includes(modelValue, opt.value)"
              :disabled="opt.disabled"
              @update:model-value="!opt.disabled && toggle(opt.value)"
            />
            <span class="text-body-large text-on-surface">{{ opt.label }}</span>
          </label>
          <p
            v-if="filteredOptions.length === 0"
            class="px-4 py-3 text-center text-body-small text-on-surface-variant"
          >
            Sin resultados
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
