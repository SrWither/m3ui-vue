<script lang="ts">
/** The inputs of an `MMortgageCalculator` (its v-model). */
export interface MortgageInput {
  /** Price of the property */
  price: number
  /** Down payment, in money (not percent) */
  down: number
  /** Yearly interest rate, in percent */
  rate: number
  /** Term in years */
  years: number
}
</script>

<script setup lang="ts">
/**
 * A mortgage / loan calculator for a property listing or a bank: price, down payment, rate and term in, the monthly
 * payment, the principal vs interest split and the yearly amortization schedule out. Supports the french system
 * (the same payment every month) and the german one (the same principal every month, falling payments). The math
 * is also exported on its own as `amortize()`.
 *
 * @slot summary Replaces the result panel. Slot props: `{ loan, monthly, schedule }`
 * @event update:modelValue The inputs — powers v-model
 */
import { computed, ref } from 'vue'
import MNumberField from './MNumberField.vue'
import MSlider from './MSlider.vue'
import MButton from './MButton.vue'
import { amortize } from '../composables/mortgage'
import { useLocale } from '../composables/useLocale'
import { vRipple } from '../directives/vRipple'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** The inputs (v-model) */
    modelValue: MortgageInput
    /** `french`: fixed payment. `german`: fixed principal, payments fall over time */
    system?: 'french' | 'german'
    /** Terms offered, in years */
    terms?: number[]
    /** Monthly costs added on top of the loan payment, e.g. property tax or insurance */
    extras?: { label: string; amount: number }[]
    /** ISO 4217 code to format amounts */
    currency?: string
    /** Fields layout: the default filled or outlined */
    variant?: 'filled' | 'outlined'
    /** Hides the inputs, showing only the results (for a read-only quote) */
    readonly?: boolean
    /** Shows the yearly schedule open */
    scheduleOpen?: boolean
  }>(),
  {
    system: 'french',
    terms: () => [10, 15, 20, 25, 30],
    extras: () => [],
    variant: 'outlined',
    readonly: false,
    scheduleOpen: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [MortgageInput] }>()

function update(patch: Partial<MortgageInput>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const loan = computed(() => Math.max(0, props.modelValue.price - props.modelValue.down))
const downPercent = computed(() => (props.modelValue.price > 0 ? (props.modelValue.down / props.modelValue.price) * 100 : 0))

const schedule = computed(() =>
  amortize({ principal: loan.value, rate: props.modelValue.rate, years: props.modelValue.years, system: props.system }),
)
const extrasTotal = computed(() => props.extras.reduce((s, e) => s + e.amount, 0))
const monthly = computed(() => schedule.value.firstPayment + extrasTotal.value)

/** The schedule folded by year */
const years = computed(() => {
  const out: { year: number; principal: number; interest: number; balance: number }[] = []
  for (const p of schedule.value.payments) {
    const y = Math.ceil(p.n / 12)
    const row = out[y - 1] ?? (out[y - 1] = { year: y, principal: 0, interest: 0, balance: 0 })
    row.principal += p.principal
    row.interest += p.interest
    row.balance = p.balance
  }
  return out
})

const fmt = computed(() =>
  new Intl.NumberFormat(locale.lang, props.currency ? { style: 'currency', currency: props.currency, maximumFractionDigits: 0 } : { maximumFractionDigits: 0 }),
)
const fmtCents = computed(() =>
  new Intl.NumberFormat(locale.lang, props.currency ? { style: 'currency', currency: props.currency } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
)

// Donut: principal vs interest of everything paid
const interestShare = computed(() => {
  const t = schedule.value.totalPaid
  return t > 0 ? schedule.value.totalInterest / t : 0
})
const R = 52
const C = 2 * Math.PI * R

const showSchedule = ref(props.scheduleOpen)

defineExpose({ loan, monthly, schedule })
</script>

<template>
  <div class="m3-mortgage @container text-on-surface">
    <div class="grid gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div v-if="!readonly" class="flex flex-col gap-4">
        <MNumberField
          :model-value="modelValue.price"
          :label="locale.mortgagePrice"
          :variant="variant"
          :min="0"
          :step="1000"
          leading-icon="home"
          data-field="price"
          @update:model-value="(v) => update({ price: v ?? 0, down: Math.min(modelValue.down, v ?? 0) })"
        />
        <div class="flex flex-col gap-1">
          <MNumberField
            :model-value="modelValue.down"
            :label="locale.mortgageDown"
            :variant="variant"
            :min="0"
            :max="modelValue.price"
            :step="1000"
            :hint="`${downPercent.toFixed(1)}%`"
            leading-icon="savings"
            data-field="down"
            @update:model-value="(v) => update({ down: Math.min(v ?? 0, modelValue.price) })"
          />
          <MSlider
            :model-value="Math.round(downPercent)"
            :min="0"
            :max="100"
            :step="1"
            size="xs"
            :aria-label="locale.mortgageDown"
            @update:model-value="(v) => update({ down: Math.round((modelValue.price * (v as number)) / 100) })"
          />
        </div>
        <MNumberField
          :model-value="modelValue.rate"
          :label="locale.mortgageRate"
          :variant="variant"
          :min="0"
          :max="100"
          :step="0.05"
          leading-icon="percent"
          data-field="rate"
          @update:model-value="(v) => update({ rate: v ?? 0 })"
        />
        <div>
          <p class="mb-2 text-label-large text-on-surface-variant">{{ locale.mortgageTerm }}</p>
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="locale.mortgageTerm">
            <button
              v-for="t in terms"
              :key="t"
              v-ripple
              type="button"
              role="radio"
              :aria-checked="modelValue.years === t"
              class="relative flex h-9 items-center gap-1 overflow-hidden rounded-sm border px-3 text-label-large transition-colors"
              :class="modelValue.years === t
                ? 'border-transparent bg-secondary-container text-on-secondary-container'
                : 'border-outline-variant text-on-surface-variant'"
              :data-term="t"
              @click="update({ years: t })"
            >
              {{ locale.mortgageYears.replace('{n}', String(t)) }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 rounded-lg bg-surface-container p-5">
        <slot name="summary" :loan="loan" :monthly="monthly" :schedule="schedule">
          <div>
            <p class="text-label-large text-on-surface-variant">
              {{ system === 'german' ? locale.mortgageFirstPayment : locale.mortgageMonthly }}
            </p>
            <p class="text-display-small font-medium tabular-nums text-primary" data-monthly>{{ fmtCents.format(monthly) }}</p>
            <p v-if="extras.length" class="text-body-medium text-on-surface-variant tabular-nums" data-extras>
              {{ fmtCents.format(schedule.firstPayment) }}<template v-for="e in extras" :key="e.label"> + {{ e.label }} {{ fmtCents.format(e.amount) }}</template>
            </p>
            <p v-if="system === 'german' && schedule.payments.length" class="text-body-medium text-on-surface-variant tabular-nums">
              {{ locale.mortgageLastPayment }}: {{ fmtCents.format(schedule.lastPayment + extrasTotal) }}
            </p>
          </div>

          <div class="flex items-center gap-5">
            <svg viewBox="0 0 128 128" class="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="64" cy="64" :r="R" fill="none" stroke="var(--color-primary)" stroke-width="16" />
              <circle
                cx="64"
                cy="64"
                :r="R"
                fill="none"
                stroke="var(--color-tertiary)"
                stroke-width="16"
                :stroke-dasharray="`${interestShare * C} ${C}`"
                class="transition-[stroke-dasharray] duration-300"
              />
            </svg>
            <dl class="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-body-medium">
              <dt class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-primary" />{{ locale.mortgageLoan }}</dt>
              <dd class="text-end tabular-nums" data-loan>{{ fmt.format(loan) }}</dd>
              <dt class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-tertiary" />{{ locale.mortgageInterest }}</dt>
              <dd class="text-end tabular-nums" data-interest>{{ fmt.format(schedule.totalInterest) }}</dd>
              <dt class="mt-1 border-t border-outline-variant pt-1 font-medium">{{ locale.mortgageTotal }}</dt>
              <dd class="mt-1 border-t border-outline-variant pt-1 text-end font-medium tabular-nums">{{ fmt.format(schedule.totalPaid) }}</dd>
            </dl>
          </div>
        </slot>
      </div>
    </div>

    <div v-if="years.length" class="mt-4">
      <MButton variant="text" :icon="showSchedule ? 'expand_less' : 'expand_more'" :aria-expanded="showSchedule" data-toggle-schedule @click="showSchedule = !showSchedule">
        {{ locale.mortgageSchedule }}
      </MButton>
      <div v-if="showSchedule" class="mt-2 max-h-80 overflow-auto rounded-md border border-outline-variant">
        <table class="w-full text-body-medium tabular-nums" data-schedule>
          <thead class="sticky top-0 bg-surface-container-high text-label-large text-on-surface-variant">
            <tr>
              <th class="px-3 py-2 text-start font-medium">{{ locale.mortgageYear }}</th>
              <th class="px-3 py-2 text-end font-medium">{{ locale.mortgagePrincipal }}</th>
              <th class="px-3 py-2 text-end font-medium">{{ locale.mortgageInterest }}</th>
              <th class="px-3 py-2 text-end font-medium">{{ locale.mortgageBalance }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="y in years" :key="y.year" class="border-t border-outline-variant">
              <td class="px-3 py-1.5">{{ y.year }}</td>
              <td class="px-3 py-1.5 text-end">{{ fmt.format(y.principal) }}</td>
              <td class="px-3 py-1.5 text-end">{{ fmt.format(y.interest) }}</td>
              <td class="px-3 py-1.5 text-end">
                <div class="flex items-center justify-end gap-2">
                  <span class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-highest sm:block">
                    <span class="block h-full bg-primary" :style="{ width: `${loan ? (y.balance / loan) * 100 : 0}%` }" />
                  </span>
                  {{ fmt.format(y.balance) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
