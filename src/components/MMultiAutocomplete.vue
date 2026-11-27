<script setup lang="ts">
/**
 * Multi-value autocomplete with inline search. Type to filter, Enter to toggle, Backspace to remove last chip.
 *
 * @event update:modelValue Emitted on selection change — powers v-model
 * @event debounced Emitted debounce ms after the user stops typing the search query (only when debounce > 0)
 */
import { computed, ref, useId, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MCheckbox from './MCheckbox.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useLocale } from '../composables/useLocale'
import { useFollowAnchor } from '../composables/_useFollowAnchor'
import { useDebounce } from '../composables/useDebounce'
import type { MultiSelectOption } from './MMultiSelect.vue'
import { useScrollLock } from '../composables/_useScrollLock'
import { useEscapeStack } from '../composables/_useEscapeStack'
import { FIELD_PADDING_RIGHT, fieldLabelClasses, vOverflowTitle, type FieldRightInset } from '../composables/_fieldLayout'

// Root is a fragment (field div + a sibling Teleport for the dropdown panel), so Vue can't
// auto-apply a consumer's class/attrs to either one — forward them onto the field div below.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Selected values (v-model) */
    modelValue: unknown[]
    /** The options to choose from; see `MultiSelectOption`. */
    options: MultiSelectOption[]
    /** Floating label text */
    label?: string
    /** Input placeholder */
    placeholder?: string
    /** Field style */
    variant?: 'filled' | 'outlined'
    /** Dropdown mode: docked (inline) or modal (dialog) */
    mode?: 'docked' | 'modal'
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
    /** Show a clear-all button */
    clearable?: boolean
    /** Max visible chips before "+N" */
    maxChips?: number
    /** Text when no options match */
    noResultsText?: string
    /** Remove already-selected options from the dropdown */
    hideSelected?: boolean
    /** Delay (ms) before filtering and firing @debounced. Selection is always instant */
    debounce?: number
  }>(),
  {
    modelValue: () => [],
    variant: 'filled',
    mode: 'docked',
    disabled: false,
    required: false,
    clearable: false,
    maxChips: 3,
    hideSelected: false,
    debounce: 0,
  },
)

const emit = defineEmits<{ blur: []; 'update:modelValue': [unknown[]]; debounced: [string] }>()

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
  setValue: (v) => emit('update:modelValue', v as unknown[]),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation

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
const filterQuery = ref('')
const modalFilterQuery = ref('')

const { debounced: setFilterQuery } = useDebounce((v: string) => { filterQuery.value = v; emit('debounced', v) }, props.debounce)
const { debounced: setModalFilterQuery } = useDebounce((v: string) => { modalFilterQuery.value = v; emit('debounced', v) }, props.debounce)

function updateSearch(v: string) {
  search.value = v
  if (props.debounce > 0) setFilterQuery(v)
  else filterQuery.value = v
}

function updateModalSearch(v: string) {
  modalSearch.value = v
  if (props.debounce > 0) setModalFilterQuery(v)
  else modalFilterQuery.value = v
}

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
  let opts = props.options
  if (props.hideSelected) {
    opts = opts.filter((o) => !includes(props.modelValue, o.value))
  }
  if (!filterQuery.value) return opts
  const q = filterQuery.value.toLowerCase()
  return opts.filter((o) => o.label.toLowerCase().includes(q))
})

const resolvedNoResultsText = computed(() => props.noResultsText ?? locale.noResults)

const visibleChips = computed(() =>
  props.modelValue.slice(0, props.maxChips).map((v) => ({
    value: v,
    label: props.options.find((o) => eq(o.value, v))?.label ?? String(v),
  })),
)

const overflowCount = computed(() => Math.max(0, props.modelValue.length - props.maxChips))
const chipsExpanded = ref(false)

const displayChips = computed(() => {
  const all = props.modelValue.map((v) => ({
    value: v,
    label: props.options.find((o) => eq(o.value, v))?.label ?? String(v),
  }))
  return chipsExpanded.value ? all : all.slice(0, props.maxChips)
})

const overflowLabels = computed(() =>
  props.modelValue.slice(props.maxChips).map((v) =>
    props.options.find((o) => eq(o.value, v))?.label ?? String(v),
  ).join(', '),
)

function toggle(value: unknown) {
  const current = props.modelValue
  if (includes(current, value)) {
    emit('update:modelValue', current.filter((v) => !eq(v, value)))
  } else {
    emit('update:modelValue', [...current, value])
  }
  search.value = ''
  nextTick(() => inputEl.value?.focus())
}

function removeChip(value: unknown, e: Event) {
  e.stopPropagation()
  if (isDisabled.value) return
  emit('update:modelValue', props.modelValue.filter((v) => !eq(v, value)))
  nextTick(() => inputEl.value?.focus())
}

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
  let opts = props.options
  if (props.hideSelected) {
    opts = opts.filter((o) => !includes(props.modelValue, o.value))
  }
  if (!modalFilterQuery.value) return opts
  const q = modalFilterQuery.value.toLowerCase()
  return opts.filter((o) => o.label.toLowerCase().includes(q))
})

function openDropdown() {
  if (isDisabled.value || open.value) return
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
  filterQuery.value = ''
  modalFilterQuery.value = ''
  highlightIndex.value = -1
}

useScrollLock(modalOpen)
useEscapeStack(modalOpen, closeDropdown)

function onInputFocus() {
  openDropdown()
}

function onInputBlur(e: FocusEvent) {
  if (modalOpen.value) return
  const related = e.relatedTarget as Node | null
  if (dropdownEl.value?.contains(related) || fieldEl.value?.contains(related)) return
  closeDropdown()
}

function onInput(e: Event) {
  updateSearch((e.target as HTMLInputElement).value)
  if (!open.value) openDropdown()
  highlightIndex.value = -1
  nextTick(computeDropPos)
}

function onOutsideClick(e: MouseEvent) {
  if (modalOpen.value) return
  const t = e.target as Node
  if (!fieldEl.value?.contains(t) && !dropdownEl.value?.contains(t)) closeDropdown()
}

// Stays on its field while the page or a container scrolls, the window/zoom changes or the field resizes
useFollowAnchor({ open: () => open.value, anchor: fieldEl, popup: dropdownEl, place: computeDropPos, close: closeDropdown })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // Closing the list uses the key: keep it from also closing a dialog around the field. With nothing open it
    // only leaves the field and passes on
    if (open.value || modalOpen.value) e.stopPropagation()
    closeDropdown()
    inputEl.value?.blur()
    return
  }

  if (e.key === 'Backspace' && !search.value && hasValue.value) {
    const last = props.modelValue[props.modelValue.length - 1]
    emit('update:modelValue', props.modelValue.filter((v) => !eq(v, last)))
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
      toggle(target.value)
      highlightIndex.value = -1
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

function getEnabledIndex(opt: MultiSelectOption): number {
  return filteredOptions.value.filter((o) => !o.disabled).indexOf(opt)
}

onMounted(() => {
  document.addEventListener('mousedown', onOutsideClick)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideClick)
})

watch(filteredOptions, () => {
  if (open.value) nextTick(computeDropPos)
})

const isFloated = computed(() => hasValue.value || open.value)

// Chips wrap before the trailing controls; the label stops there too
const rightInset = computed<FieldRightInset>(() => (props.clearable ? 'right-16' : 'right-10'))

const triggerClasses = computed(() => {
  const base = [
    'flex min-h-[56px] w-full min-w-0 items-center gap-1.5 flex-wrap',
    'transition-[border-color,border-width] duration-150',
    props.leadingIcon ? 'pl-12' : 'pl-4',
    FIELD_PADDING_RIGHT[rightInset.value],
  ]

  if (props.variant === 'outlined') {
    const border = isDisabled.value
      ? 'border-on-surface/12'
      : open.value
        ? (hasError.value ? 'border-2 border-error' : 'border-2 border-primary')
        : (hasError.value ? 'border-error' : 'border-outline hover:border-on-surface')
    return [...base, 'rounded-xs border bg-transparent py-2', border].join(' ')
  }

  const border = isDisabled.value
    ? 'border-on-surface/38'
    : open.value
      ? (hasError.value ? 'border-b-2 border-error' : 'border-b-2 border-primary')
      : (hasError.value ? 'border-error' : 'border-on-surface-variant hover:border-on-surface')
  const bg = isDisabled.value
    ? 'bg-[color-mix(in_srgb,var(--color-on-surface)_4%,var(--color-surface-container-highest))]'
    : 'bg-surface-container-highest'
  return [...base, 'rounded-t-xs border-b pb-2', isFloated.value ? 'pt-7' : 'pt-4', bg, border].join(' ')
})

const labelClasses = computed(() =>
  fieldLabelClasses({
    variant: props.variant,
    leading: !!props.leadingIcon,
    right: rightInset.value,
    floated: isFloated.value,
    color: isDisabled.value
      ? 'text-on-surface/38'
      : open.value
        ? (hasError.value ? 'text-error' : 'text-primary')
        : (hasError.value ? 'text-error' : 'text-on-surface-variant'),
  }),
)

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})

// Last: it watches `open`, declared above
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
}, () => open.value)
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-1" v-bind="$attrs" @focusout="onFocusOut">
    <div
      ref="fieldEl"
      class="relative"
      :class="variant === 'outlined' ? 'mt-2' : ''"
      :style="variant === 'outlined' ? { '--field-bg': resolvedFieldBg } : undefined"
    >
      <!-- Leading icon -->
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

      <!-- Trigger field with chips and inline input -->
      <div
        :class="[
          triggerClasses,
          isDisabled ? 'pointer-events-none' : 'cursor-text',
        ]"
        @click="inputEl?.focus()"
      >
        <template v-if="hasValue">
          <span
            v-for="(chip, i) in displayChips"
            :key="i"
            class="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-label-small"
            :class="isDisabled ? 'bg-on-surface/12 text-on-surface/38' : 'bg-secondary-container text-on-secondary-container'"
          >
            <span v-overflow-title class="min-w-0 truncate">{{ chip.label }}</span>
            <button
              :aria-label="`${locale.remove} ${chip.label}`"
              v-if="!isDisabled"
              type="button"
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-on-secondary-container/20"
              @click="removeChip(chip.value, $event)"
            >
              <MIcon name="close" :size="12" />
            </button>
          </span>
          <span
            v-if="overflowCount > 0 && !chipsExpanded"
            :title="overflowLabels"
            class="cursor-pointer rounded-full bg-surface-container-high px-2 py-0.5 text-label-small text-on-surface-variant transition-colors hover:bg-on-surface/12"
            @click.stop="chipsExpanded = true"
          >
            +{{ overflowCount }}
          </span>
          <span
            v-if="chipsExpanded && modelValue.length > maxChips"
            class="cursor-pointer rounded-full bg-surface-container-high px-2 py-0.5 text-label-small text-on-surface-variant transition-colors hover:bg-on-surface/12"
            @click.stop="chipsExpanded = false"
          >
            <MIcon name="unfold_less" :size="14" />
          </span>
        </template>

        <input
          :id="id"
          ref="inputEl"
        :aria-invalid="hasError || undefined"
        :aria-describedby="errorMessage || hint ? messageId : undefined"
          type="text"
          :value="search"
          :placeholder="!label && !hasValue ? placeholder : undefined"
          :disabled="disabled"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          :aria-controls="open ? `${id}-list` : undefined"
          :aria-expanded="open"
          :aria-disabled="disabled"
          :class="[
            'flex-1 min-w-[60px] bg-transparent text-body-large outline-none placeholder:text-on-surface-variant',
            hasError ? 'caret-error' : 'caret-primary',
            disabled ? 'text-on-surface/38' : 'text-on-surface',
          ]"
          @focus="onInputFocus"
          @blur="onInputBlur"
          @input="onInput"
          @keydown="onKeydown"
        />
      </div>

      <!-- Floating label -->
      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <!-- Clear button -->
      <button
        :aria-label="locale.clear"
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="absolute right-9 top-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click.stop="emit('update:modelValue', []); closeDropdown()"
      >
        <MIcon name="close" :size="18" />
      </button>

      <!-- Arrow icon -->
      <div class="pointer-events-none absolute right-2 top-4">
        <MIcon
          name="arrow_drop_down"
          :size="24"
          class="transition-transform duration-200"
          :class="[
            open || modalOpen ? 'rotate-180' : '',
            disabled ? 'text-on-surface/38' : 'text-on-surface-variant',
          ]"
        />
      </div>
    </div>

    <p v-if="errorMessage" :id="messageId" role="alert" class="px-4 text-body-small text-error">{{ errorMessage }}</p>
    <p v-else-if="hint" :id="messageId" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
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
        class="fixed z-500 max-h-60 overflow-auto rounded-xs bg-surface-container shadow-elevation-2"
        :style="dropPos"
      >
        <div :id="`${id}-list`" role="group" :aria-label="label || undefined" class="flex flex-col py-1">
          <label
            v-for="(opt, i) in filteredOptions"
            :key="i"
            data-option
            class="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-on-surface/8"
            :class="[
              opt.disabled ? 'cursor-not-allowed opacity-38' : '',
              getEnabledIndex(opt) === highlightIndex && !opt.disabled ? 'bg-on-surface/12' : '',
            ]"
            @mousedown.prevent="!opt.disabled && toggle(opt.value)"
          >
            <MCheckbox
              :model-value="includes(modelValue, opt.value)"
              :disabled="opt.disabled"
            />
            <span class="text-body-large text-on-surface">{{ opt.label }}</span>
          </label>
          <p
            v-if="!filteredOptions.length"
            class="px-4 py-3 text-center text-body-small text-on-surface-variant"
          >
            {{ resolvedNoResultsText }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Modal -->
    <Transition name="m3-mac-modal">
      <div
        v-if="modalOpen && mode === 'modal'"
        class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/32 p-4"
        @click.self="closeDropdown"
      >
        <div class="mac-modal-box flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-[28px] bg-surface-container-high shadow-elevation-3">
          <div class="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 class="text-headline-small text-on-surface">{{ label || placeholder }}</h2>
            <MIconButton icon="close" :label="locale.close" @click="closeDropdown" />
          </div>

          <div class="px-6 pb-3">
            <div class="flex items-center gap-2 rounded-full bg-surface-container-highest px-3 py-2">
              <MIcon name="search" :size="16" class="shrink-0 text-on-surface-variant" />
              <input
                :value="modalSearch"
                type="text"
                :placeholder="locale.search"
                class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant"
                @input="updateModalSearch(($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="h-px bg-outline-variant" />

          <div class="flex-1 overflow-y-auto py-2">
            <label
              v-for="(opt, i) in modalFilteredOptions"
              :key="i"
              class="flex cursor-pointer items-center gap-4 px-6 py-3 transition-colors hover:bg-on-surface/8"
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
.m3-mac-modal-enter-active,
.m3-mac-modal-leave-active {
  transition: opacity 0.15s ease;
}
.m3-mac-modal-enter-from,
.m3-mac-modal-leave-to {
  opacity: 0;
}
.m3-mac-modal-enter-active .mac-modal-box,
.m3-mac-modal-leave-active .mac-modal-box {
  transition: transform 0.15s ease;
}
.m3-mac-modal-enter-from .mac-modal-box,
.m3-mac-modal-leave-to .mac-modal-box {
  transform: scale(0.95);
}
</style>
