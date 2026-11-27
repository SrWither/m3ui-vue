<script setup lang="ts">
/**
 * MPhoneInput — a phone number field with a country selector: flag, calling code and a searchable list of every
 * country (names from `Intl` in the app's language). The number is formatted as it's typed with the country's
 * mask (Argentina's mobiles with the 9 too) and bound as E.164 (`+541123456789`), ready for an API or an SMS
 * provider. Pasting or typing a full international number (`+34...`, `0034...`) switches the country. Without a
 * `country`, it starts on the region of the app's locale (es-AR → Argentina). Filled or outlined, like MTextField.
 *
 * @slot flag Replaces the flag emoji (on the button and in the list), e.g. with an image set that also shows on
 *   Windows, which has no flag emoji; receives `iso2`
 * @event update:modelValue Emitted with the number in E.164, or null when empty — powers v-model
 * @event update:country Emitted with the ISO code when the country changes — powers v-model:country
 * @event update:valid Emitted when the number becomes (in)valid for its country — powers v-model:valid
 * @event blur Focus left the field and its country list
 */
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { FORM_KEY, useFieldValidation, useFocusLeave } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
import MIcon from './MIcon.vue'
import { useFieldBg } from '../composables/useFieldBg'
import { useLocale } from '../composables/useLocale'
import { useFollowAnchor } from '../composables/_useFollowAnchor'
import { POPUP_MARGIN, dropdownX, fitPopup } from '../composables/_popupPosition'
import { useEscapeStack } from '../composables/_useEscapeStack'
import {
  flagEmoji,
  formatNational,
  isValidNational,
  nationalDigits,
  parsePhone,
  phoneCountries,
  phoneCountry,
  toE164,
  type PhoneCountry,
} from '../composables/phoneNumber'

const props = withDefaults(
  defineProps<{
    /** The number in E.164 (`+541123456789`), or null (v-model) */
    modelValue?: string | null
    /** Field label */
    label: string
    /** ISO 3166-1 alpha-2 code of the country (v-model:country) */
    country?: string
    /** Country to start on when there's neither a number nor `country`; defaults to the locale's region, else US */
    defaultCountry?: string
    /** Only these countries (ISO codes) in the list */
    countries?: string[]
    /** Countries pinned at the top of the list */
    preferred?: string[]
    /** Visual style */
    variant?: 'filled' | 'outlined'
    /** Puts the field in error state. A string is also the message */
    error?: boolean | string
    /** Error message below the field (when `error`, or when `validate` finds the number incomplete) */
    errorLabel?: string
    /** More validation rules (functions or a Standard Schema), run on the E.164 value; see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving the field (default), while typing, or only on submit */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm` */
    name?: string
    /** Hint text below the field */
    hint?: string
    /** Disables the field */
    disabled?: boolean
    /** Marks as required — adds a red asterisk after the label */
    required?: boolean
    /** After leaving the field, show an error when the number doesn't fit its country's length (and block an `MForm`'s submit) */
    validate?: boolean
    /** Placeholder; defaults to an example in the country's format */
    placeholder?: string
    /** Show flag emoji */
    flags?: boolean
    /** Overrides the auto-detected background behind the outlined label */
    fieldBg?: string
    /** BCP-47 language for country names; defaults to the app's locale */
    locale?: string
  }>(),
  { modelValue: null, variant: 'filled', validate: true, flags: true },
)

const emit = defineEmits<{
  'update:modelValue': [string | null]
  'update:country': [string]
  'update:valid': [boolean]
  blur: []
}>()

const t = useLocale()
const lang = computed(() => props.locale ?? t.lang)
const id = useId()
const listId = `${id}-countries`

// ── Country and number ────────────────────────────────────────────
function localeRegion() {
  const tags = [props.locale ?? t.lang, typeof navigator !== 'undefined' ? navigator.language : '']
  for (const tag of tags) {
    try {
      const region = tag && new Intl.Locale(tag).maximize().region
      if (region && phoneCountry(region)) return region
    } catch { /* not a valid tag */ }
  }
  return 'US'
}

const initial = props.modelValue ? parsePhone(props.modelValue, props.country) : null
const iso = ref((props.country ?? initial?.country.iso2 ?? props.defaultCountry ?? localeRegion()).toUpperCase())
const country = computed<PhoneCountry>(() => phoneCountry(iso.value) ?? phoneCountry('US')!)
const national = ref(initial?.national ?? '')
const e164 = computed(() => toE164(national.value, country.value))
const valid = computed(() => isValidNational(national.value, country.value))

watch(() => props.country, (c) => { if (c && c.toUpperCase() !== iso.value) setCountry(c.toUpperCase(), false) })
watch(() => props.modelValue, (v) => {
  if ((v ?? null) === e164.value) return
  const p = v ? parsePhone(v, iso.value) : null
  national.value = p?.national ?? ''
  if (p && p.country.iso2 !== iso.value) {
    iso.value = p.country.iso2
    emit('update:country', iso.value)
  }
})
watch(valid, (v) => emit('update:valid', v), { immediate: true })
// v-model:country gets the country picked from the number or the locale when it didn't set one
if (props.country?.toUpperCase() !== iso.value) emit('update:country', iso.value)

function setCountry(code: string, notify = true) {
  if (!phoneCountry(code)) return
  iso.value = code
  national.value = nationalDigits(national.value, country.value)
  if (notify) emit('update:country', code)
  emit('update:modelValue', e164.value)
}

const display = computed(() => formatNational(national.value, country.value))
const examplePlaceholder = computed(() => {
  const mask = country.value.masks[0]
  let n = 0
  return mask ? mask.replace(/#/g, () => String((n++ % 9) + 1)) : ''
})

// ── Typing ────────────────────────────────────────────────────────
const inputEl = ref<HTMLInputElement>()

// Puts the caret after the n-th digit of the formatted text, so reformatting doesn't throw it to the end
function caretAfterDigits(text: string, n: number) {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) if (/\d/.test(text[i]!) && ++seen === n) return i + 1
  return text.length
}

function commit(raw: string, digitsBeforeCaret: number) {
  const trimmed = raw.trim()
  let dropped = 0
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    // A full international number: the country comes from its calling code
    const p = parsePhone(trimmed, iso.value)
    if (p) {
      if (p.country.iso2 !== iso.value) {
        iso.value = p.country.iso2
        emit('update:country', iso.value)
      }
      national.value = p.national
      digitsBeforeCaret = p.national.length
    } else national.value = ''
  } else {
    const before = raw.replace(/\D/g, '').length
    national.value = nationalDigits(raw, country.value)
    dropped = before - national.value.length
  }
  emit('update:modelValue', e164.value)
  const el = inputEl.value
  if (!el) return
  el.value = display.value
  const pos = caretAfterDigits(display.value, digitsBeforeCaret - dropped)
  el.setSelectionRange(pos, pos)
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const caret = el.selectionStart ?? el.value.length
  commit(el.value, el.value.slice(0, caret).replace(/\D/g, '').length)
}

// Backspace right after a separator ("(212) |") deletes the digit before it instead of a separator the mask puts back
function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLInputElement
  if (e.key !== 'Backspace' || el.selectionStart !== el.selectionEnd || !el.selectionStart) return
  const before = el.value.slice(0, el.selectionStart)
  if (/\d$/.test(before)) return
  e.preventDefault()
  const digitsBefore = before.replace(/\D/g, '').length
  if (!digitsBefore) return
  const digits = el.value.replace(/\D/g, '')
  commit(digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore), digitsBefore - 1)
}

// The number's own check (`validate`) is one more rule, after the consumer's
const phoneRule: ValidationRule = () => !props.validate || !national.value || valid.value || props.errorLabel || t.phoneInvalid
const inForm = !!inject(FORM_KEY, null)
const rootEl = ref<HTMLElement | null>(null)
const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => [...(props.rules ? (Array.isArray(props.rules) ? props.rules : [props.rules]) : []), phoneRule],
  // phoneRule is always there: `required` alone (no MForm, no rules) still only shows the asterisk
  required: () => props.required && (inForm || !!props.rules),
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  validateDebounce: () => props.validateDebounce,
  disabled: () => props.disabled,
  focus: () => inputEl.value?.focus(),
  el: () => inputEl.value,
  setValue: (v) => emit('update:modelValue', (v as string | null) ?? null),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const isError = validation.hasError
const errorText = validation.message
const messageId = validation.messageId

// ── Country list ──────────────────────────────────────────────────
const open = ref(false)
const search = ref('')
const active = ref(0)
const fieldEl = ref<HTMLElement | null>(null)
const buttonEl = ref<HTMLButtonElement>()
const panelEl = ref<HTMLElement>()
const searchEl = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()
const panelPos = ref<Record<string, string>>({})

const { resolvedFieldBg } = useFieldBg(fieldEl, () => props.fieldBg)

const regionNames = computed(() => {
  try {
    return new Intl.DisplayNames([lang.value, 'en'], { type: 'region' })
  } catch {
    return null
  }
})
const nameOf = (code: string) => {
  try {
    return regionNames.value?.of(code) ?? code
  } catch {
    return code
  }
}
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const allCountries = computed(() => {
  const only = props.countries?.map((c) => c.toUpperCase())
  const list = phoneCountries()
    .filter((c) => !only || only.includes(c.iso2))
    .map((c) => ({ ...c, name: nameOf(c.iso2) }))
  return list.sort((a, b) => a.name.localeCompare(b.name, lang.value))
})

const options = computed(() => {
  const q = fold(search.value.trim()).replace(/^\+/, '')
  if (q) {
    return allCountries.value
      .filter((c) => fold(c.name).includes(q) || c.iso2.toLowerCase() === q || c.dial.startsWith(q))
      .map((c) => ({ ...c, pinned: false }))
  }
  const pinned = (props.preferred ?? []).map((p) => allCountries.value.find((c) => c.iso2 === p.toUpperCase())).filter((c) => !!c)
  return [...pinned.map((c) => ({ ...c, pinned: true })), ...allCountries.value.map((c) => ({ ...c, pinned: false }))]
})
const lastPinned = computed(() => {
  let last = -1
  options.value.forEach((o, i) => { if (o.pinned) last = i })
  return last
})

function place() {
  const anchor = fieldEl.value?.getBoundingClientRect()
  const panel = panelEl.value
  if (!anchor || !panel) return
  const width = Math.max(anchor.width, 280)
  panel.style.width = `${width}px`
  const h = panel.offsetHeight
  const left = dropdownX(anchor, width, window.innerWidth, 'start')
  const top = fitPopup([anchor.bottom + 4, anchor.top - 4 - h], h, window.innerHeight, POPUP_MARGIN)
  panelPos.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

async function openList() {
  if (isDisabled.value) return
  open.value = true
  search.value = ''
  await nextTick()
  active.value = Math.max(0, options.value.findIndex((o) => o.iso2 === iso.value && !o.pinned))
  place()
  searchEl.value?.focus({ preventScroll: true })
  scrollActive('center')
}

function closeList(refocus = true) {
  if (!open.value) return
  open.value = false
  if (refocus) buttonEl.value?.focus()
}

function choose(code: string) {
  setCountry(code)
  closeList(false)
  inputEl.value?.focus()
}

function scrollActive(block: ScrollLogicalPosition = 'nearest') {
  nextTick(() => listEl.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)?.scrollIntoView({ block }))
}

function onSearchKey(e: KeyboardEvent) {
  const n = options.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (!n) return
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    scrollActive()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const o = options.value[active.value]
    if (o) choose(o.iso2)
  } else if (e.key === 'Tab') closeList(false)
}

watch(search, () => { active.value = 0 })

useEscapeStack(open, () => closeList())

function onDocDown(e: MouseEvent) {
  const target = e.target as Node
  if (panelEl.value?.contains(target) || buttonEl.value?.contains(target)) return
  closeList(false)
}
// Stays on its field while the page or a container scrolls, the window/zoom changes or the field resizes
useFollowAnchor({ open: () => open.value, anchor: fieldEl, popup: panelEl, place: place, close: () => closeList(false) })
watch(open, (v) => {
  if (v) {
    document.addEventListener('mousedown', onDocDown)
  } else {
    document.removeEventListener('mousedown', onDocDown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocDown)
})

// Last: it watches `open`, declared above
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
}, () => open.value)

defineExpose({
  focus: (options?: FocusOptions) => inputEl.value?.focus(options),
  /** Checks its rules (and the number's length) and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
  /** Whether the number fits its country's length */
  valid,
})
</script>

<template>
  <div ref="rootEl" class="m3-phone-input flex flex-col gap-1" @focusout="onFocusOut">
    <div
      ref="fieldEl"
      class="group relative flex h-14 transition-[border-color,border-width] duration-150"
      :class="[
        variant === 'outlined'
          ? [
              'mt-2 items-center rounded-xs border',
              isDisabled
                ? 'border-on-surface/12'
                : isError
                  ? 'border-error focus-within:border-2 focus-within:border-error'
                  : 'border-outline hover:border-on-surface focus-within:border-2 focus-within:border-primary',
            ]
          : [
              'items-end rounded-t-xs border-b bg-surface-container-highest pb-2',
              isDisabled
                ? 'border-b-on-surface/38 bg-[color-mix(in_srgb,var(--color-on-surface)_4%,var(--color-surface-container-highest))]'
                : isError
                  ? 'border-b-error focus-within:border-b-2 focus-within:border-b-error'
                  : 'border-b-on-surface-variant hover:border-b-on-surface focus-within:border-b-2 focus-within:border-b-primary',
            ],
      ]"
      :style="variant === 'outlined' ? { '--field-bg': resolvedFieldBg } : undefined"
    >
      <!-- The label stays floated: the calling code is always there -->
      <label
        :for="id"
        class="pointer-events-none absolute truncate text-label-small"
        :class="[
          variant === 'outlined' ? 'left-3 -top-2.5 max-w-[calc(100%-1.5rem)] bg-[var(--field-bg)] px-1' : 'left-4 top-2 right-4',
          isDisabled ? 'text-on-surface/38' : isError ? 'text-error' : 'text-on-surface-variant group-focus-within:text-primary',
        ]"
      >
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <!-- Country -->
      <button
        ref="buttonEl"
        type="button"
        class="m3-phone-country ml-1 flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full pr-1 pl-3 text-body-large text-on-surface outline-none transition-colors hover:bg-on-surface/8 focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-not-allowed disabled:text-on-surface/38"
        :class="variant === 'filled' && '-mb-1'"
        :disabled="isDisabled"
        :aria-label="`${t.phoneCountry}: ${nameOf(country.iso2)} +${country.dial}`"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        @click="open ? closeList() : openList()"
      >
        <slot name="flag" :iso2="country.iso2">
          <span v-if="flags" class="text-[20px] leading-none" aria-hidden="true">{{ flagEmoji(country.iso2) }}</span>
        </slot>
        <span class="tabular-nums">+{{ country.dial }}</span>
        <MIcon name="arrow_drop_down" :size="20" class="text-on-surface-variant transition-transform duration-200" :class="open && 'rotate-180'" />
      </button>

      <input
        :id="id"
        ref="inputEl"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        :value="display"
        :disabled="isDisabled"
        :required="required"
        :placeholder="placeholder ?? examplePlaceholder"
        :aria-invalid="isError || undefined"
        :aria-describedby="errorText || hint ? messageId : undefined"
        class="min-w-0 flex-1 bg-transparent pr-4 pl-1 text-body-large text-on-surface outline-none placeholder:text-on-surface-variant/60 disabled:cursor-not-allowed disabled:text-on-surface/38"
        :class="isError ? 'caret-error' : 'caret-primary'"
        @input="onInput"
        @keydown="onKeydown"
      />
    </div>

    <p v-if="errorText" :id="messageId" role="alert" class="px-4 text-body-small text-error">{{ errorText }}</p>
    <p v-else-if="hint" :id="messageId" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>

    <!-- Country list: a menu surface (surface-container, elevation 2) with a search field on top -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          ref="panelEl"
          class="fixed z-500 flex max-h-[min(360px,calc(100vh-16px))] flex-col overflow-hidden rounded-xs bg-surface-container py-2 shadow-elevation-2"
          :style="panelPos"
        >
          <div class="px-3 pb-2">
            <div class="flex h-10 items-center gap-2 rounded-full bg-surface-container-highest px-3 text-on-surface-variant focus-within:ring-2 focus-within:ring-primary">
              <MIcon name="search" :size="20" />
              <input
                ref="searchEl"
                v-model="search"
                type="text"
                class="min-w-0 flex-1 bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
                :placeholder="t.phoneSearchCountry"
                :aria-label="t.phoneSearchCountry"
                role="combobox"
                aria-expanded="true"
                :aria-controls="listId"
                :aria-activedescendant="options[active] ? `${listId}-${active}` : undefined"
                autocomplete="off"
                @keydown="onSearchKey"
              />
            </div>
          </div>
          <ul :id="listId" ref="listEl" role="listbox" :aria-label="t.phoneCountry" class="min-h-0 flex-1 overflow-y-auto">
            <template v-for="(o, i) in options" :key="`${o.iso2}-${o.pinned}`">
              <li
                :id="`${listId}-${i}`"
                role="option"
                :data-index="i"
                :aria-selected="o.iso2 === iso"
                class="flex h-12 cursor-pointer items-center gap-3 px-4 text-body-large"
                :class="[
                  o.iso2 === iso ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface',
                  i === active && o.iso2 !== iso && 'bg-on-surface/8',
                  i === active && o.iso2 === iso && 'ring-2 ring-inset ring-secondary',
                ]"
                @mousemove="active = i"
                @click="choose(o.iso2)"
              >
                <slot name="flag" :iso2="o.iso2">
                  <span v-if="flags" class="text-[20px] leading-none" aria-hidden="true">{{ flagEmoji(o.iso2) }}</span>
                </slot>
                <span class="min-w-0 flex-1 truncate">{{ o.name }}</span>
                <span class="tabular-nums text-on-surface-variant">+{{ o.dial }}</span>
              </li>
              <li v-if="i === lastPinned" role="separator" class="my-2 h-px bg-outline-variant" />
            </template>
            <li v-if="!options.length" class="px-4 py-3 text-body-medium text-on-surface-variant">{{ t.noResults }}</li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
