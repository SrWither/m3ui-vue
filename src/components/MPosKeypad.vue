<script setup lang="ts">
/**
 * A large touch keypad for a point of sale, a kiosk or a cash drawer: amounts, quantities, a waiter's PIN. It
 * shows the value formatted (with a currency when one is given), can enter amounts cash-register style (digits
 * shift in from the right, `1` `2` `5` `0` → 12.50), offers quick-amount chips and, given the amount due, shows
 * what's left to pay or the change to give back.
 *
 * Holding delete clears everything. With the keypad focused (or `keyboard="global"`), the physical keyboard works
 * too: digits, `.`/`,`, Backspace, Escape to clear and Enter to submit.
 *
 * The value (v-model) is a plain decimal string ("12.50", or the digits of a PIN) so leading zeros survive.
 *
 * @slot display Replaces the value display. Slot props: `{ value, formatted, amount }`
 * @slot action Replaces the submit button. Slot props: `{ value, amount, submit }`
 * @event update:modelValue Emitted on every key — powers v-model
 * @event submit Emitted by the action button or Enter, with the value
 * @event key Emitted on every key press, with the key (`'0'`–`'9'`, `'00'`, `'.'`, `'backspace'`, `'clear'`)
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import { vRipple } from '../directives/vRipple'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Value (v-model): a decimal string like "12.50", or a digit string in `pin` mode */
    modelValue: string
    /**
     * What is typed: `amount` (decimals, currency formatting), `integer` (quantities, no decimals) or `pin`
     * (digits shown as dots, leading zeros kept)
     */
    mode?: 'amount' | 'integer' | 'pin'
    /** Decimal places of an amount */
    decimals?: number
    /**
     * How an amount is entered: `free` (a decimal-point key) or `shift` (cash register: digits shift in from the
     * right, with a `00` key instead of the point)
     */
    entry?: 'free' | 'shift'
    /** ISO 4217 code (e.g. "USD", "ARS") to format the amount as money. Unset shows a plain number */
    currency?: string
    /** Largest amount accepted; keys that would pass it are ignored */
    max?: number
    /** Most digits accepted (a PIN's length, for one). With `pin` mode, filling it emits `submit` on its own */
    maxLength?: number
    /** Chips above the keys with preset amounts */
    quickAmounts?: number[]
    /** Whether a quick amount replaces the value or adds to it */
    quickMode?: 'set' | 'add'
    /** Amount due: shows the remaining amount under the value, or the change once it's covered */
    due?: number
    /** Label of the submit button. Without it (and without the `action` slot) there is no button */
    actionLabel?: string
    /** Material Symbol on the submit button */
    actionIcon?: string
    /** Disables the submit button. By default it's disabled while the value is empty or doesn't cover `due` */
    actionDisabled?: boolean
    /** Hides the value display (e.g. the value is shown elsewhere) */
    hideDisplay?: boolean
    /** Physical keyboard: while the keypad is focused, always (`global`), or never */
    keyboard?: 'focus' | 'global' | 'none'
    /** A short vibration on every key, on devices that support it */
    haptics?: boolean
    /** Disables every key */
    disabled?: boolean
  }>(),
  {
    mode: 'amount',
    decimals: 2,
    entry: 'free',
    quickMode: 'set',
    actionDisabled: undefined,
    hideDisplay: false,
    keyboard: 'focus',
    haptics: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [string]
  submit: [string]
  key: [string]
}>()

const decimals = computed(() => (props.mode === 'amount' ? Math.max(0, props.decimals) : 0))
const shift = computed(() => props.mode === 'amount' && props.entry === 'shift' && decimals.value > 0)

/** The value as a number (NaN-safe) */
const amount = computed(() => {
  const n = Number(props.modelValue)
  return Number.isFinite(n) ? n : 0
})

type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | 'backspace' | 'clear'

const bottomLeft = computed<Key>(() => {
  if (shift.value) return '00'
  if (props.mode === 'amount' && decimals.value > 0) return '.'
  return 'clear'
})

const keys = computed<Key[]>(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9', bottomLeft.value, '0', 'backspace'])

function digitCount(v: string) {
  return v.replace(/\D/g, '').length
}

function withinLimits(next: string) {
  if (props.maxLength !== undefined && digitCount(next) > props.maxLength) return false
  if (props.max !== undefined && props.mode !== 'pin' && Number(next) > props.max) return false
  return true
}

// Cash-register entry: the value is its digits divided by 10^decimals
function shiftValue(digits: string) {
  const trimmed = digits.replace(/^0+/, '')
  if (!trimmed) return ''
  return (Number(trimmed) / 10 ** decimals.value).toFixed(decimals.value)
}

function apply(key: Key): string {
  const v = props.modelValue ?? ''
  if (key === 'clear') return ''
  if (shift.value) {
    const digits = v.replace(/\D/g, '').replace(/^0+/, '')
    if (key === 'backspace') return shiftValue(digits.slice(0, -1))
    if (key === '.') return v
    return shiftValue(digits + key)
  }
  if (key === 'backspace') {
    const next = v.slice(0, -1)
    return next === '0' && props.mode !== 'pin' ? '' : next
  }
  if (key === '.') {
    if (decimals.value === 0 || v.includes('.')) return v
    return (v || '0') + '.'
  }
  const digits = key
  if (props.mode !== 'pin') {
    // No leading zeros on a number
    if (v === '0') return digits === '00' ? v : digits.replace(/^0+(?=\d)/, '')
    if (!v && digits === '00') return '0'
    const dot = v.indexOf('.')
    if (dot >= 0) {
      const room = decimals.value - (v.length - dot - 1)
      if (room <= 0) return v
      return v + digits.slice(0, room)
    }
  }
  return v + digits
}

function press(key: Key) {
  if (props.disabled) return
  emit('key', key)
  if (props.haptics) navigator.vibrate?.(8)
  const next = apply(key)
  if (next === props.modelValue) return
  if (key !== 'backspace' && key !== 'clear' && !withinLimits(next)) return
  emit('update:modelValue', next)
  if (props.mode === 'pin' && props.maxLength !== undefined && next.length === props.maxLength) emit('submit', next)
}

// ── Display ─────────────────────────────────────────────────────────────

function formatAmount(value: string, fractionDigits?: number) {
  const hasDot = value.includes('.')
  const frac = hasDot ? value.split('.')[1] ?? '' : ''
  const minFrac = fractionDigits ?? (shift.value ? decimals.value : frac.length)
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: Math.max(minFrac, fractionDigits ?? 0),
  }
  if (props.currency) Object.assign(opts, { style: 'currency', currency: props.currency })
  let parts: Intl.NumberFormatPart[]
  try {
    parts = new Intl.NumberFormat(locale.lang, opts).formatToParts(Number(value || 0))
  } catch {
    return value || '0'
  }
  // "12." while typing: Intl drops a point with no digits after it, so put it back
  if (hasDot && minFrac === 0 && fractionDigits === undefined) {
    const sep = new Intl.NumberFormat(locale.lang).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.'
    const lastInt = parts.map((p) => p.type).lastIndexOf('integer')
    parts.splice(lastInt + 1, 0, { type: 'decimal', value: sep })
  }
  return parts.map((p) => p.value).join('')
}

const formatted = computed(() => {
  if (props.mode === 'pin') return props.modelValue
  return formatAmount(props.modelValue ?? '')
})

const pinSlots = computed(() => {
  const len = props.maxLength ?? Math.max(4, props.modelValue.length)
  return Array.from({ length: len }, (_, i) => i < props.modelValue.length)
})

const balance = computed(() => {
  if (props.due === undefined || props.mode === 'pin') return null
  const diff = amount.value - props.due
  const value = formatAmount(String(Math.abs(Math.round(diff * 10 ** decimals.value) / 10 ** decimals.value)), decimals.value)
  return diff >= 0
    ? { label: locale.keypadChange, value, covered: true }
    : { label: locale.keypadRemaining, value, covered: false }
})

const actionIsDisabled = computed(() => {
  if (props.disabled) return true
  if (props.actionDisabled !== undefined) return props.actionDisabled
  if (!props.modelValue) return true
  return props.due !== undefined && amount.value < props.due
})

function submit() {
  if (actionIsDisabled.value && (props.actionLabel || props.actionDisabled !== undefined)) return
  emit('submit', props.modelValue)
}

function quick(n: number) {
  if (props.disabled) return
  const next = props.quickMode === 'add' ? amount.value + n : n
  const capped = props.max !== undefined ? Math.min(props.max, next) : next
  const v = decimals.value > 0 && (shift.value || !Number.isInteger(capped)) ? capped.toFixed(decimals.value) : String(capped)
  emit('update:modelValue', v)
}

// ── Long press on delete clears ─────────────────────────────────────────

let holdTimer: ReturnType<typeof setTimeout> | null = null
let held = false

function onDeleteDown(e: PointerEvent) {
  if (e.button > 0 || props.disabled) return
  held = false
  holdTimer = setTimeout(() => {
    held = true
    press('clear')
  }, 500)
}
function cancelHold() {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
}
function onKeyClick(key: Key) {
  if (key === 'backspace' && held) {
    held = false
    return
  }
  press(key)
}

// ── Physical keyboard ───────────────────────────────────────────────────

const rootEl = ref<HTMLElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (props.disabled || e.ctrlKey || e.metaKey || e.altKey) return
  let key: Key | 'enter' | null = null
  if (/^[0-9]$/.test(e.key)) key = e.key as Key
  else if (e.key === '.' || e.key === ',') key = '.'
  else if (e.key === 'Backspace') key = 'backspace'
  else if (e.key === 'Escape' || e.key === 'Delete') key = 'clear'
  else if (e.key === 'Enter') key = 'enter'
  if (!key) return
  // Let a focused key button handle its own Enter/Space click
  if (key === 'enter' && (e.target as HTMLElement)?.closest?.('button')) return
  e.preventDefault()
  if (key === 'enter') submit()
  else press(key)
}

function onGlobalKeydown(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  // Never steal typing from a real field
  if (t?.closest?.('input, textarea, select, [contenteditable]')) return
  if (rootEl.value?.contains(t)) return // handled by the root listener
  onKeydown(e)
}

function bindGlobal(on: boolean) {
  if (typeof window === 'undefined') return
  if (on) window.addEventListener('keydown', onGlobalKeydown)
  else window.removeEventListener('keydown', onGlobalKeydown)
}
onMounted(() => bindGlobal(props.keyboard === 'global'))
watch(() => props.keyboard, (k, old) => {
  if (old === 'global') bindGlobal(false)
  if (k === 'global') bindGlobal(true)
})
onBeforeUnmount(() => {
  bindGlobal(false)
  cancelHold()
})

function keyLabel(key: Key) {
  if (key === '.') {
    return new Intl.NumberFormat(locale.lang).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.'
  }
  return key
}
</script>

<template>
  <div
    ref="rootEl"
    class="m3-pos-keypad flex flex-col gap-3 outline-none"
    :tabindex="keyboard === 'none' || disabled ? undefined : 0"
    @keydown="keyboard !== 'none' && onKeydown($event)"
  >
    <div v-if="!hideDisplay" class="flex flex-col items-end gap-1 px-2" aria-live="polite">
      <slot name="display" :value="modelValue" :formatted="formatted" :amount="amount">
        <div v-if="mode === 'pin'" class="flex h-14 w-full items-center justify-center gap-3" :aria-label="`${modelValue.length}/${pinSlots.length}`">
          <span
            v-for="(filled, i) in pinSlots"
            :key="i"
            class="h-4 w-4 rounded-full transition-[background-color,transform] duration-150"
            :class="filled ? 'scale-110 bg-primary' : 'bg-outline-variant'"
          />
        </div>
        <div
          v-else
          class="max-w-full truncate text-display-medium tabular-nums"
          :class="[modelValue ? 'text-on-surface' : 'text-on-surface-variant', disabled ? 'opacity-38' : '']"
        >{{ formatted }}</div>
      </slot>
      <div v-if="balance" class="text-title-medium tabular-nums" :class="balance.covered ? 'text-primary' : 'text-on-surface-variant'">
        {{ balance.label }}: {{ balance.value }}
      </div>
    </div>

    <div v-if="quickAmounts?.length && mode !== 'pin'" class="flex flex-wrap justify-center gap-2">
      <button
        v-for="q in quickAmounts"
        :key="q"
        v-ripple="{ disabled }"
        type="button"
        :disabled="disabled"
        class="relative h-8 cursor-pointer overflow-hidden rounded-sm border border-outline-variant px-4 text-label-large text-on-surface-variant transition-colors hover:bg-on-surface-variant/8 disabled:cursor-not-allowed disabled:opacity-38"
        @click="quick(q)"
      >{{ quickMode === 'add' ? '+' : '' }}{{ formatAmount(String(q), Number.isInteger(q) ? 0 : decimals) }}</button>
    </div>

    <div class="grid grid-cols-3 gap-2" role="group">
      <button
        v-for="key in keys"
        :key="key"
        v-ripple="{ disabled }"
        type="button"
        tabindex="-1"
        :disabled="disabled"
        :aria-label="key === 'backspace' ? locale.keypadDelete : key === 'clear' ? locale.keypadClear : undefined"
        :title="key === 'backspace' ? locale.keypadDelete : undefined"
        :data-key="key"
        class="m3-pos-key relative flex h-16 cursor-pointer items-center justify-center overflow-hidden text-headline-small tabular-nums transition-[border-radius,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-38"
        :class="key === 'backspace' || key === 'clear'
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-surface-container-highest text-on-surface'"
        @click="onKeyClick(key)"
        @pointerdown="key === 'backspace' && onDeleteDown($event)"
        @pointerup="cancelHold"
        @pointerleave="cancelHold"
        @pointercancel="cancelHold"
        @contextmenu.prevent
      >
        <MIcon v-if="key === 'backspace'" name="backspace" :size="28" />
        <span v-else-if="key === 'clear'" class="text-title-large">C</span>
        <span v-else>{{ keyLabel(key) }}</span>
      </button>
    </div>

    <slot name="action" :value="modelValue" :amount="amount" :submit="submit">
      <MButton
        v-if="actionLabel"
        size="md"
        class="w-full"
        :icon="actionIcon"
        :disabled="actionIsDisabled"
        @click="submit"
      >{{ actionLabel }}</MButton>
    </slot>
  </div>
</template>

<style>
.m3-pos-key {
  border-radius: var(--radius-xl, 1.75rem);
}
.m3-pos-key:not(:disabled):hover {
  background-image: linear-gradient(color-mix(in srgb, currentColor 8%, transparent), color-mix(in srgb, currentColor 8%, transparent));
}
.m3-pos-key:not(:disabled):active {
  border-radius: var(--radius-md, 0.75rem);
  background-image: linear-gradient(color-mix(in srgb, currentColor 10%, transparent), color-mix(in srgb, currentColor 10%, transparent));
}
.m3-pos-keypad:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 4px;
  border-radius: var(--radius-md, 0.75rem);
}
</style>
