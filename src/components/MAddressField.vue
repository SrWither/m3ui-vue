<script setup lang="ts">
/**
 * An address field: a text field that looks places up through a `MapSearchProvider` (OpenStreetMap's Nominatim by
 * default, or your own function) and lists them under it to pick one. The picked place (label, `[lng, lat]`, extent,
 * kind) is the v-model; editing the text afterwards clears it. Enter searches (Nominatim's public server allows no
 * search-as-you-type); with `instant`, it searches while typing, debounced, for providers that allow it. Arrow keys
 * move through the results, Enter picks, Escape closes. Needs no map: put it in any form. Available from the `/map`
 * entry point.
 *
 * @event update:modelValue A place was picked, or the text changed after picking one (null)
 * @event select A place was picked
 * @event blur Focus left the field and its list
 */
import { computed, nextTick, onBeforeUnmount, provide, ref, shallowRef, useId, watch, watchEffect } from 'vue'
import { FORM_KEY, useFieldValidation, type FormContext } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import MTextField from './MTextField.vue'
import { useLocale } from '../composables/useLocale'
import { useEscapeStack } from '../composables/_useEscapeStack'
import { useFollowAnchor } from '../composables/_useFollowAnchor'
import { POPUP_MARGIN, fitPopup } from '../composables/_popupPosition'
import { nominatimProvider, placeIcon, type MapSearchProvider, type MapSearchResult } from '../composables/mapSearch'

// The root is the field plus a teleported list: attributes go on the field
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The picked place (v-model), or null */
    modelValue?: MapSearchResult | null
    /** Where to search: `nominatimProvider(options)` by default, or your own function */
    provider?: MapSearchProvider
    /** The field's label (the locale's "Address" by default) */
    label?: string
    /** Field style */
    variant?: 'filled' | 'outlined'
    /** Material Symbol on the left */
    leadingIcon?: string
    /** Search while typing (debounced), for providers that allow it; Nominatim's public server doesn't */
    instant?: boolean
    /** The delay before an `instant` search, in ms */
    debounce?: number
    /** Characters needed before searching */
    minLength?: number
    /** Helper text below the field */
    hint?: string
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Validation rules (functions or a Standard Schema), run on the picked place (null until one is picked); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving the field (default), while typing, or only on submit */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm` */
    name?: string
    /** Marks it as required; inside an `MForm` or with `rules`, a place must be picked (typed text alone isn't enough) */
    required?: boolean
    /** Disables the field */
    disabled?: boolean
  }>(),
  { modelValue: null, variant: 'filled', leadingIcon: 'location_on', instant: false, debounce: 400, minLength: 3 },
)

const emit = defineEmits<{
  'update:modelValue': [place: MapSearchResult | null]
  select: [place: MapSearchResult]
  blur: []
}>()

const t = useLocale()
const uid = useId()
const listId = `${uid}-list`
const optionId = (i: number) => `${uid}-opt-${i}`
const provider = computed(() => props.provider ?? nominatimProvider())

const text = ref(props.modelValue?.label ?? '')
const results = shallowRef<MapSearchResult[]>([])
const loading = ref(false)
const searched = ref(false)
const focused = ref(false)
const open = ref(false)
const active = ref(-1)
let controller: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined

const field = ref<InstanceType<typeof MTextField>>()

// Validates the picked place, not the text: the inner MTextField is kept out of the MForm
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
  focus: () => field.value?.focus(),
  el: () => wrapEl.value,
  setValue: (v) => emit('update:modelValue', (v as MapSearchResult | null) ?? null),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const fieldError = computed(() => validation.message.value || validation.hasError.value)
provide(FORM_KEY, null as unknown as FormContext)
const wrapEl = ref<HTMLElement>()
const listEl = ref<HTMLElement>()
// The field's box (MTextField's first child), without its hint
const anchorEl = computed(() => (wrapEl.value?.firstElementChild?.firstElementChild as HTMLElement | null) ?? null)
const listPos = ref<Record<string, string>>({})

const longEnough = computed(() => text.value.trim().length >= props.minLength)
/** "Press Enter to search": typed enough, not searched for this text yet, and no search while typing */
const showHint = computed(() => !props.instant && focused.value && longEnough.value && !searched.value && !loading.value && !props.modelValue)

// The picked place shows as the text; a new one from outside replaces it
watch(() => props.modelValue, (place) => {
  if (place && place.label !== text.value) text.value = place.label
  // Reset from outside (a form cleared): not while the user is typing, which also sets it to null
  else if (!place && !focused.value) text.value = ''
})

async function search() {
  const q = text.value.trim()
  if (q.length < props.minLength) return
  controller?.abort()
  clearTimeout(timer)
  controller = new AbortController()
  const mine = controller
  loading.value = true
  open.value = true
  try {
    results.value = await provider.value(q, mine.signal)
    active.value = results.value.length ? 0 : -1
  } catch {
    if (mine.signal.aborted) return
    results.value = []
  } finally {
    if (controller === mine) {
      loading.value = false
      searched.value = true
    }
  }
}

function onText(value: string | number) {
  text.value = String(value)
  searched.value = false
  results.value = []
  active.value = -1
  if (props.modelValue) emit('update:modelValue', null)
  controller?.abort()
  loading.value = false
  clearTimeout(timer)
  if (!longEnough.value) {
    open.value = false
    return
  }
  open.value = !props.instant // the hint row
  if (props.instant) timer = setTimeout(search, props.debounce)
}

function pick(place: MapSearchResult) {
  text.value = place.label
  open.value = false
  results.value = []
  searched.value = false
  emit('update:modelValue', place)
  emit('select', place)
}

function clear() {
  controller?.abort()
  clearTimeout(timer)
  text.value = ''
  results.value = []
  searched.value = false
  loading.value = false
  open.value = false
  if (props.modelValue) emit('update:modelValue', null)
  field.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const r = results.value[active.value]
    if (open.value && r && searched.value) pick(r)
    else void search()
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!open.value || !results.value.length) return
    e.preventDefault()
    const n = results.value.length
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    nextTick(() => listEl.value?.querySelector(`#${CSS.escape(optionId(active.value))}`)?.scrollIntoView({ block: 'nearest' }))
  }
}

function onFocusIn() {
  focused.value = true
  if (searched.value && results.value.length && !props.modelValue) open.value = true
  else if (showHint.value) open.value = true
}
function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && (wrapEl.value?.contains(next) || listEl.value?.contains(next))) return
  focused.value = false
  open.value = false
  validation.onBlur()
  emit('blur')
}

// Escape closes the list (and only that, inside a dialog)
useEscapeStack(() => open.value, () => (open.value = false))

const visible = computed(() => open.value && (loading.value || searched.value || showHint.value))

// The list hangs under the field, as wide as it, or above it when there's no room
function place() {
  const anchor = anchorEl.value?.getBoundingClientRect()
  const list = listEl.value
  if (!anchor || !list) return
  const h = list.offsetHeight
  const top = fitPopup([anchor.bottom + 4, anchor.top - 4 - h], h, window.innerHeight, POPUP_MARGIN)
  listPos.value = { top: `${top}px`, left: `${anchor.left}px`, width: `${anchor.width}px` }
}
watch([visible, results, loading], () => nextTick(place))
useFollowAnchor({ open: () => visible.value, anchor: anchorEl, popup: listEl, place, close: () => (open.value = false) })

// The input as an ARIA combobox pointing at its list and the result the arrows are on
watchEffect(() => {
  const input = field.value?.inputEl as HTMLInputElement | undefined
  if (!input) return
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', String(visible.value && results.value.length > 0))
  input.setAttribute('aria-controls', listId)
  input.setAttribute('enterkeyhint', 'search')
  if (visible.value && active.value >= 0 && results.value.length) input.setAttribute('aria-activedescendant', optionId(active.value))
  else input.removeAttribute('aria-activedescendant')
})

onBeforeUnmount(() => {
  controller?.abort()
  clearTimeout(timer)
})

/** A result's first part (the place itself) and the rest (where it is) */
function parts(label: string) {
  const i = label.indexOf(', ')
  return i < 0 ? [label, ''] : [label.slice(0, i), label.slice(i + 2)]
}

defineExpose({
  /** Searches for the current text now */
  search,
  /** Empties the field */
  clear,
  /** Focuses the field */
  focus: () => field.value?.focus(),
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})
</script>

<template>
  <div ref="wrapEl" v-bind="$attrs" @focusin="onFocusIn" @focusout="onFocusOut" @keydown="onKeydown">
    <MTextField
      ref="field"
      :model-value="text"
      :label="label ?? t.mapAddress"
      :variant="variant"
      :leading-icon="leadingIcon"
      :hint="hint"
      :error="fieldError"
      :required="required"
      :disabled="isDisabled"
      autocomplete="street-address"
      @update:model-value="onText"
    >
      <!-- Always passed: MTextField reserves the room for #trailing only when the slot exists from the start -->
      <template #trailing>
        <MSpinner v-if="loading" :size="20" class="m-2" />
        <MIconButton v-else-if="text" icon="close" :label="t.clearSearch" size="sm" :disabled="isDisabled" @click="clear" />
      </template>
    </MTextField>
  </div>

  <Teleport to="body">
    <div
      v-if="visible"
      :id="listId"
      ref="listEl"
      role="listbox"
      :aria-label="label ?? t.mapAddress"
      class="fixed z-500 max-h-72 overflow-auto rounded-xs bg-surface-container py-1 shadow-elevation-2"
      :style="listPos"
    >
      <div v-if="loading" class="flex items-center gap-3 px-4 py-3 text-body-medium text-on-surface-variant" role="status">
        <MSpinner :size="20" />{{ t.mapSearching }}
      </div>
      <div v-else-if="showHint" class="flex items-center gap-3 px-4 py-3 text-body-medium text-on-surface-variant">
        <MIcon name="keyboard_return" :size="20" />{{ t.mapPressEnterToSearch }}
      </div>
      <div v-else-if="!results.length" class="flex items-center gap-3 px-4 py-3 text-body-medium text-on-surface-variant" role="status">
        <MIcon name="search_off" :size="20" />{{ t.mapNoPlaces }}
      </div>
      <template v-else>
        <div
          v-for="(r, i) in results"
          :id="optionId(i)"
          :key="i"
          role="option"
          :aria-selected="i === active"
          class="flex cursor-pointer items-center gap-3 px-4 py-2 text-on-surface hover:bg-on-surface/8"
          :class="i === active ? 'bg-on-surface/12' : ''"
          @mousedown.prevent="pick(r)"
          @mousemove="active = i"
        >
          <MIcon :name="placeIcon(r.type)" :size="20" class="shrink-0 text-on-surface-variant" />
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-body-large">{{ parts(r.label)[0] }}</span>
            <span v-if="parts(r.label)[1]" class="truncate text-body-small text-on-surface-variant">{{ parts(r.label)[1] }}</span>
          </span>
        </div>
      </template>
    </div>
  </Teleport>
</template>
