<script lang="ts">
/** A line of an `MReceipt`. `price` is the unit price; the line amount is `price × quantity`. */
export interface ReceiptItem {
  name: string
  quantity?: number
  price: number
  /** Extra text under the name, e.g. "No onion" or a SKU */
  note?: string
}

/**
 * A line after the subtotal: a discount, a tax, a tip, a service fee. Give `amount` (negative for a discount) or
 * `percent` of the subtotal (negative for a discount). `included` marks a tax already inside the prices: it's
 * shown but not added again. Percentages apply to the running total, in the order given (put discounts first).
 */
export interface ReceiptAdjustment {
  label: string
  amount?: number
  percent?: number
  included?: boolean
}

/** A payment toward the total, e.g. `{ method: 'Cash', amount: 50 }`. Paying more than the total shows the change. */
export interface ReceiptPayment {
  method: string
  amount: number
}
</script>

<script setup lang="ts">
/**
 * A sales receipt in the look of a thermal printer ticket (58 or 80 mm): header, lines with quantity and amount,
 * subtotal, discounts and taxes, total, payments and change. All the math is done in cents, so totals never drift.
 * `print()` prints only the receipt, sized to the paper.
 *
 * @slot header Top of the receipt: the store's logo, name, address, tax id
 * @slot footer Bottom of the receipt: a thank-you line, a QR, return policy
 * @slot item Replaces a line. Slot props: `{ item, amount }`
 */
import { computed, ref } from 'vue'
import { useLocale } from '../composables/useLocale'
import { printElement } from '../composables/_printElement'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** The lines sold */
    items: ReceiptItem[]
    /** Discounts, taxes, tips, fees, applied after the subtotal in this order */
    adjustments?: ReceiptAdjustment[]
    /** Payments made; more than the total shows the change */
    payments?: ReceiptPayment[]
    /** ISO 4217 code, e.g. "USD". Without one, amounts are plain numbers */
    currency?: string
    /** Receipt / invoice number, shown under the header */
    number?: string | number
    /** Date of the sale (Date, ISO string or epoch ms) */
    date?: Date | string | number
    /** Paper width: 58 mm, 80 mm, or the width of the container */
    paper?: '58mm' | '80mm' | 'auto'
    /** Torn zigzag edges at the top and bottom, or straight */
    edge?: 'zigzag' | 'straight'
    /** Text at the bottom when the `footer` slot isn't used */
    footer?: string
  }>(),
  {
    adjustments: () => [],
    payments: () => [],
    paper: '80mm',
    edge: 'zigzag',
  },
)

const cents = (n: number) => Math.round(n * 100)

const lines = computed(() =>
  props.items.map((item) => ({ item, amount: cents(item.price * (item.quantity ?? 1)) })),
)
const subtotal = computed(() => lines.value.reduce((s, l) => s + l.amount, 0))

/** Rounds half away from zero, so a 10% discount of 30.05 is −3.01 like its +3.01 counterpart */
const roundAway = (n: number) => Math.sign(n) * Math.round(Math.abs(n))

// Percentages apply to the running total, in order: a discount first, then a tax on the discounted amount.
// An included tax is the part of the running total that is already tax: base − base / (1 + rate)
const adjustmentLines = computed(() => {
  let running = subtotal.value
  return props.adjustments.map((a) => {
    let value: number
    if (a.amount !== undefined) value = cents(a.amount)
    else if (a.included) value = roundAway(running - running / (1 + (a.percent ?? 0) / 100))
    else value = roundAway((running * (a.percent ?? 0)) / 100)
    if (!a.included) running += value
    return { ...a, value }
  })
})
const total = computed(() =>
  adjustmentLines.value.reduce((s, a) => (a.included ? s : s + a.value), subtotal.value),
)
const paid = computed(() => props.payments.reduce((s, p) => s + cents(p.amount), 0))
const change = computed(() => (props.payments.length ? paid.value - total.value : 0))

function money(c: number) {
  const n = c / 100
  return new Intl.NumberFormat(
    locale.lang,
    props.currency ? { style: 'currency', currency: props.currency } : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  ).format(n)
}

function qty(n: number) {
  return new Intl.NumberFormat(locale.lang, { maximumFractionDigits: 3 }).format(n)
}

const dateText = computed(() => {
  if (props.date === undefined) return ''
  const d = props.date instanceof Date ? props.date : new Date(props.date)
  return new Intl.DateTimeFormat(locale.lang, { dateStyle: 'short', timeStyle: 'short' }).format(d)
})

const rootEl = ref<HTMLElement | null>(null)

/** Prints only the receipt, in a hidden frame sized to the paper */
function print() {
  if (!rootEl.value) return
  printElement(rootEl.value, {
    page: `${props.paper === 'auto' ? 'auto' : props.paper} auto`,
    css: '.m3-receipt{box-shadow:none!important;width:100%!important;max-width:none!important}',
  })
}

defineExpose({
  print,
  /** Totals in the receipt's units (not cents) */
  totals: computed(() => ({
    subtotal: subtotal.value / 100,
    total: total.value / 100,
    paid: paid.value / 100,
    change: change.value / 100,
  })),
})
</script>

<template>
  <div
    ref="rootEl"
    class="m3-receipt font-mono text-body-medium"
    :class="[`m3-receipt--${edge}`]"
    :style="paper === 'auto' ? undefined : { width: paper === '58mm' ? '58mm' : '80mm' }"
  >
    <div class="px-4 py-5">
      <div v-if="$slots.header" class="mb-3 text-center">
        <slot name="header" />
      </div>
      <div v-if="number !== undefined || dateText" class="flex justify-between gap-2 text-body-small">
        <span v-if="number !== undefined">#{{ number }}</span>
        <span v-if="dateText" class="ms-auto">{{ dateText }}</span>
      </div>

      <hr class="m3-receipt__rule" />

      <ul role="list" class="flex flex-col gap-1.5">
        <li v-for="(l, i) in lines" :key="i">
          <slot name="item" :item="l.item" :amount="l.amount / 100">
            <div class="flex items-baseline gap-2">
              <span class="min-w-0 flex-1 break-words">{{ l.item.name }}</span>
              <span class="tabular-nums">{{ money(l.amount) }}</span>
            </div>
            <div v-if="(l.item.quantity ?? 1) !== 1" class="text-body-small opacity-70 tabular-nums">
              {{ qty(l.item.quantity ?? 1) }} × {{ money(cents(l.item.price)) }}
            </div>
            <div v-if="l.item.note" class="text-body-small opacity-70">{{ l.item.note }}</div>
          </slot>
        </li>
      </ul>

      <hr class="m3-receipt__rule" />

      <div class="flex flex-col gap-1">
        <div v-if="adjustmentLines.length" class="flex justify-between gap-2" data-receipt="subtotal">
          <span>{{ locale.receiptSubtotal }}</span>
          <span class="tabular-nums">{{ money(subtotal) }}</span>
        </div>
        <div
          v-for="(a, i) in adjustmentLines"
          :key="i"
          class="flex justify-between gap-2"
          :class="a.included ? 'text-body-small opacity-70' : ''"
        >
          <span>{{ a.label }}<template v-if="a.percent !== undefined && a.amount === undefined"> ({{ Math.abs(a.percent) }}%)</template></span>
          <span class="tabular-nums">{{ money(a.value) }}</span>
        </div>
        <div class="mt-1 flex justify-between gap-2 text-title-medium font-bold" data-receipt="total">
          <span>{{ locale.receiptTotal }}</span>
          <span class="tabular-nums">{{ money(total) }}</span>
        </div>
      </div>

      <template v-if="payments.length">
        <hr class="m3-receipt__rule" />
        <div class="flex flex-col gap-1">
          <div v-for="(p, i) in payments" :key="i" class="flex justify-between gap-2">
            <span>{{ p.method }}</span>
            <span class="tabular-nums">{{ money(cents(p.amount)) }}</span>
          </div>
          <div v-if="change > 0" class="flex justify-between gap-2 font-bold" data-receipt="change">
            <span>{{ locale.receiptChange }}</span>
            <span class="tabular-nums">{{ money(change) }}</span>
          </div>
        </div>
      </template>

      <div v-if="$slots.footer || footer" class="mt-4 text-center text-body-small">
        <slot name="footer">{{ footer }}</slot>
      </div>
    </div>
  </div>
</template>

<style>
@layer base {
  .m3-receipt {
    max-width: 100%;
    background: var(--color-surface-container-lowest);
    color: var(--color-on-surface);
    box-shadow: var(--shadow-elevation-1);
  }
}
.m3-receipt--zigzag {
  --m3-receipt-tooth: 6px;
  -webkit-mask:
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / calc(2 * var(--m3-receipt-tooth)) 51% repeat-x,
    conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top / calc(2 * var(--m3-receipt-tooth)) 51% repeat-x;
  mask:
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / calc(2 * var(--m3-receipt-tooth)) 51% repeat-x,
    conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top / calc(2 * var(--m3-receipt-tooth)) 51% repeat-x;
  box-shadow: none;
}
.m3-receipt--straight {
  border-radius: var(--radius-xs, 4px);
}
.m3-receipt__rule {
  margin: 0.75rem 0;
  border: 0;
  border-top: 1px dashed currentColor;
  opacity: 0.4;
}
</style>
