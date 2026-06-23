<script setup lang="ts">
import { computed, ref, useId, onMounted, onUnmounted, watch, nextTick } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useLocale } from '../composables/useLocale'
import type { SelectOption } from './MSelect.vue'

const props = withDefaults(
  defineProps<{
    modelValue: unknown
    options: SelectOption[]
    label?: string
    placeholder?: string
    variant?: 'filled' | 'outlined'
    mode?: 'docked' | 'modal'
    disabled?: boolean
    error?: string
    hint?: string
    required?: boolean
    leadingIcon?: string
    clearable?: boolean
    fieldBg?: string
    noResultsText?: string
  }>(),
  {
    modelValue: undefined,
    variant: 'filled',
    mode: 'docked',
    disabled: false,
    required: false,
    clearable: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [unknown] }>()

const locale = useLocale()
const id = useId()
const open = ref(false)
const modalOpen = ref(false)
const modalSearch = ref('')
const search = ref('')
const highlightIndex = ref(-1)
const fieldEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const { resolvedFieldBg } = useFieldBg(fieldEl, () => props.fieldBg)
const dropdownEl = ref<HTMLElement | null>(null)
const dropPos = ref({ top: '0px', left: '0px', width: '0px' })

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

const hasValue = computed(() => props.modelValue != null && props.modelValue !== '')
const selectedLabel = computed(
  () => props.options.find((o) => eq(o.value, props.modelValue))?.label ?? '',
)

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

const resolvedNoResultsText = computed(() => props.noResultsText ?? locale.noResults)

function computeDropPos() {
  if (!fieldEl.value) return
  const rect = fieldEl.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const dropH = Math.min(240, filteredOptions.value.length * 52 + 8)
  const openAbove = spaceBelow < dropH && rect.top > dropH
  dropPos.value = {
    top: openAbove ? `${rect.top - 4 - dropH}px` : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

const modalFilteredOptions = computed(() => {
  if (!modalSearch.value) return props.options
  const q = modalSearch.value.toLowerCase()
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

function openDropdown() {
  if (props.disabled || open.value) return
  if (props.mode === 'modal') {
    modalOpen.value = true
    modalSearch.value = ''
    return
  }
  computeDropPos()
  open.value = true
  highlightIndex.value = -1
}

function closeDropdown() {
  open.value = false
  modalOpen.value = false
  search.value = ''
  modalSearch.value = ''
  highlightIndex.value = -1
}

function select(opt: SelectOption) {
  if (opt.disabled) return
  emit('update:modelValue', opt.value)
  closeDropdown()
  nextTick(() => inputEl.value?.blur())
}

watch(modalOpen, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})

function onInputFocus() {
  search.value = ''
  openDropdown()
}

function onInputBlur(e: FocusEvent) {
  const related = e.relatedTarget as Node | null
  if (dropdownEl.value?.contains(related) || fieldEl.value?.contains(related)) return
  closeDropdown()
}

function onInput(e: Event) {
  search.value = (e.target as HTMLInputElement).value
  if (!open.value) openDropdown()
  highlightIndex.value = -1
  nextTick(computeDropPos)
}

function onOutsideClick(e: MouseEvent) {
  if (modalOpen.value) return
  const t = e.target as Node
  if (!fieldEl.value?.contains(t) && !dropdownEl.value?.contains(t)) closeDropdown()
}

function onScroll(e: Event) {
  if (!open.value) return
  if (dropdownEl.value?.contains(e.target as Node)) return
  closeDropdown()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeDropdown()
    inputEl.value?.blur()
    return
  }

  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openDropdown()
      return
    }
    return
  }

  const opts = filteredOptions.value.filter((o) => !o.disabled)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = highlightIndex.value < opts.length - 1 ? highlightIndex.value + 1 : 0
    scrollToHighlighted()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = highlightIndex.value > 0 ? highlightIndex.value - 1 : opts.length - 1
    scrollToHighlighted()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const idx = highlightIndex.value >= 0 ? highlightIndex.value : 0
    const target = opts[idx]
    if (target) {
      select(target)
    }
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    if (!dropdownEl.value) return
    const items = dropdownEl.value.querySelectorAll('[data-option]')
    const item = items[highlightIndex.value] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  })
}

// Map highlight index to the full filteredOptions index (skipping disabled)
function getEnabledIndex(opt: SelectOption): number {
  return filteredOptions.value.filter((o) => !o.disabled).indexOf(opt)
}

onMounted(() => {
  document.addEventListener('mousedown', onOutsideClick)
  window.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideClick)
  window.removeEventListener('scroll', onScroll, true)
  document.body.style.overflow = ''
})

// Recompute dropdown position when filtered options change while open
watch(filteredOptions, () => {
  if (open.value) nextTick(computeDropPos)
})

const displayValue = computed(() => {
  if (open.value) return search.value
  return selectedLabel.value
})

const triggerClasses = computed(() => {
  const pl = props.leadingIcon ? 'pl-12' : 'pl-4'
  const base = [
    'flex w-full items-center pr-10 text-body-large transition-[border-color,border-width] duration-150',
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

  const unFloated = props.variant === 'filled'
    ? 'top-[53%] -translate-y-1/2 text-body-large'
    : 'top-1/2 -translate-y-1/2 text-body-large'

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
        class="pointer-events-none absolute left-3.5 text-on-surface-variant"
        :class="variant === 'filled' ? 'top-5' : 'top-4.5'"
      >
        <MIcon :name="leadingIcon" :size="20" />
      </div>

      <!-- Input trigger -->
      <input
        :id="id"
        ref="inputEl"
        type="text"
        :value="displayValue"
        :placeholder="!label ? placeholder : undefined"
        :disabled="disabled"
        autocomplete="off"
        role="combobox"
        :aria-expanded="open"
        :aria-disabled="disabled"
        :class="[
          triggerClasses,
          'outline-none text-on-surface',
          disabled ? 'pointer-events-none opacity-[0.38]' : 'cursor-text',
        ]"
        @focus="onInputFocus"
        @blur="onInputBlur"
        @input="onInput"
        @keydown="onKeydown"
      />

      <!-- Floating label -->
      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <!-- Clear button -->
      <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="absolute right-9 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click.stop="emit('update:modelValue', undefined as any); closeDropdown()"
      >
        <MIcon name="close" :size="18" />
      </button>

      <!-- Arrow icon -->
      <div class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex h-6 items-center">
        <MIcon
          name="arrow_drop_down"
          :size="24"
          class="text-on-surface-variant transition-transform duration-200"
          :class="open || modalOpen ? 'rotate-180' : ''"
        />
      </div>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>

  <!-- Docked dropdown -->
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
        v-if="open && mode === 'docked'"
        ref="dropdownEl"
        class="fixed z-500 max-h-60 overflow-auto rounded-sm bg-surface-container py-1 shadow-elevation-2"
        :style="dropPos"
      >
        <div
          v-for="(opt, i) in filteredOptions"
          :key="i"
          data-option
          class="flex cursor-pointer items-center gap-3 px-4 py-3 text-body-large"
          :class="[
            opt.disabled
              ? 'cursor-not-allowed opacity-38 text-on-surface'
              : 'text-on-surface hover:bg-on-surface/8',
            eq(opt.value, modelValue) ? 'bg-primary/8 text-primary font-medium' : '',
            getEnabledIndex(opt) === highlightIndex && !opt.disabled ? 'bg-on-surface/12' : '',
          ]"
          @mousedown.prevent="select(opt)"
        >
          <MIcon
            v-if="eq(opt.value, modelValue)"
            name="check"
            :size="18"
            class="shrink-0 text-primary"
          />
          <span v-else class="w-[18px] shrink-0" />
          {{ opt.label }}
        </div>
        <p
          v-if="!filteredOptions.length"
          class="px-4 py-3 text-center text-body-small text-on-surface-variant"
        >
          {{ resolvedNoResultsText }}
        </p>
      </div>
    </Transition>

    <!-- Modal -->
    <Transition name="m3-ac-modal">
      <div
        v-if="modalOpen && mode === 'modal'"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="closeDropdown"
      >
        <div class="ac-modal-box flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-[28px] bg-surface-container-high shadow-elevation-3">
          <div class="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 class="text-headline-small text-on-surface">{{ label || placeholder }}</h2>
            <MIconButton icon="close" :label="locale.close" @click="closeDropdown" />
          </div>

          <div class="px-6 pb-3">
            <div class="flex items-center gap-2 rounded-full bg-surface-container-highest px-3 py-2">
              <MIcon name="search" :size="16" class="shrink-0 text-on-surface-variant" />
              <input
                v-model="modalSearch"
                type="text"
                :placeholder="locale.search"
                class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant"
              />
            </div>
          </div>

          <div class="h-px bg-outline-variant" />

          <div class="flex-1 overflow-y-auto py-2">
            <div
              v-for="(opt, i) in modalFilteredOptions"
              :key="i"
              class="flex cursor-pointer items-center gap-4 px-6 py-3.5 text-body-large transition-colors"
              :class="[
                opt.disabled
                  ? 'cursor-not-allowed opacity-38 text-on-surface'
                  : 'text-on-surface hover:bg-on-surface/8',
                eq(opt.value, modelValue) ? 'bg-primary/8' : '',
              ]"
              @click="select(opt)"
            >
              <MIcon
                :name="eq(opt.value, modelValue) ? 'radio_button_checked' : 'radio_button_unchecked'"
                :size="20"
                :class="eq(opt.value, modelValue) ? 'text-primary' : 'text-on-surface-variant'"
              />
              <span :class="eq(opt.value, modelValue) ? 'text-primary font-medium' : ''">
                {{ opt.label }}
              </span>
            </div>
            <p
              v-if="!modalFilteredOptions.length"
              class="px-6 py-4 text-center text-body-medium text-on-surface-variant"
            >
              {{ resolvedNoResultsText }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-ac-modal-enter-active,
.m3-ac-modal-leave-active {
  transition: opacity 0.15s ease;
}
.m3-ac-modal-enter-from,
.m3-ac-modal-leave-to {
  opacity: 0;
}
.m3-ac-modal-enter-active .ac-modal-box,
.m3-ac-modal-leave-active .ac-modal-box {
  transition: transform 0.15s ease;
}
.m3-ac-modal-enter-from .ac-modal-box,
.m3-ac-modal-leave-to .ac-modal-box {
  transform: scale(0.95);
}
</style>
