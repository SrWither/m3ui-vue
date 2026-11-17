<script lang="ts">
/** One choice in a `ProductOptionGroup`. */
export interface ProductOption {
  value: string
  label: string
  /** Price added by this option (per unit; negative lowers it) */
  price?: number
  /** Swatch color for `display: 'swatches'` (any CSS color) */
  color?: string
  /** Swatch image for `display: 'swatches'` */
  image?: string
  /** A line under the label in list display */
  description?: string
  disabled?: boolean
}

/**
 * A group of options of a product: a size, a color, extras, the sides of a combo.
 * - `single`: pick one (radio list, chips or swatches). Its value is a string.
 * - `multiple`: pick several, between `min` and `max` (checkbox list or chips). Its value is a string array.
 * - `quantity`: a count of each option, up to `max` in total (+/− rows). Its value is `{ [option]: count }`.
 */
export interface ProductOptionGroup {
  key: string
  label: string
  type?: 'single' | 'multiple' | 'quantity'
  /** How the options are drawn. Defaults to `list` (`chips` for sizes is a good fit, `swatches` for colors) */
  display?: 'list' | 'chips' | 'swatches'
  /** A single group must have a choice */
  required?: boolean
  /** Least selections / units in a multiple or quantity group */
  min?: number
  /** Most selections / units in a multiple or quantity group */
  max?: number
  options: ProductOption[]
}

export type ProductSelection = Record<string, string | string[] | Record<string, number> | undefined>
</script>

<script setup lang="ts">
/**
 * Picks the variant and extras of a product with the price updating live: a size and color in a store, the
 * doneness, sides and extras of a dish, the drinks of a combo. Groups are single choice, multiple choice (with
 * min/max) or per-option quantities; `isAvailable` crosses out combinations that don't exist (a size out of stock in
 * that color). The add button stays disabled until every group is satisfied.
 *
 * @slot header Content above the groups (the product's photo, name, description)
 * @slot option Replaces an option's label in list display. Slot props: `{ group, option, selected, available }`
 * @slot action Replaces the add button. Slot props: `{ valid, total, quantity, add }`
 * @event update:modelValue The selection, keyed by group key — powers v-model
 * @event update:quantity Units of the product — powers v-model:quantity
 * @event add Emitted by the add button with `{ selection, quantity, unitPrice, total }`
 */
import { computed } from 'vue'
import MIcon from './MIcon.vue'
import MRadio from './MRadio.vue'
import MCheckbox from './MCheckbox.vue'
import MIconButton from './MIconButton.vue'
import MButton from './MButton.vue'
import { useLocale } from '../composables/useLocale'
import { vRipple } from '../directives/vRipple'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** The option groups */
    groups: ProductOptionGroup[]
    /** The selection (v-model), keyed by group key */
    modelValue?: ProductSelection
    /** Price of the product before options */
    basePrice?: number
    /** Units of the product (v-model:quantity). Pass `null` to hide the quantity stepper */
    quantity?: number | null
    /** Most units of the product */
    maxQuantity?: number
    /** ISO 4217 code to format prices */
    currency?: string
    /** Label of the add button; without it there is no button */
    actionLabel?: string
    /**
     * Whether an option can be picked given the rest of the selection, e.g. a size out of stock in the chosen
     * color. Unavailable options are crossed out and can't be picked
     */
    isAvailable?: (group: ProductOptionGroup, option: ProductOption, selection: ProductSelection) => boolean
    disabled?: boolean
  }>(),
  {
    modelValue: () => ({}),
    basePrice: 0,
    quantity: 1,
    maxQuantity: 99,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [ProductSelection]
  'update:quantity': [number]
  add: [{ selection: ProductSelection; quantity: number; unitPrice: number; total: number }]
}>()

const sel = computed(() => props.modelValue)

function typeOf(g: ProductOptionGroup) {
  return g.type ?? 'single'
}

function single(g: ProductOptionGroup) {
  const v = sel.value[g.key]
  return typeof v === 'string' ? v : undefined
}
function multi(g: ProductOptionGroup): string[] {
  const v = sel.value[g.key]
  return Array.isArray(v) ? v : []
}
function counts(g: ProductOptionGroup): Record<string, number> {
  const v = sel.value[g.key]
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}
function countOf(g: ProductOptionGroup) {
  return typeOf(g) === 'multiple'
    ? multi(g).length
    : typeOf(g) === 'quantity'
      ? Object.values(counts(g)).reduce((s, n) => s + n, 0)
      : single(g) ? 1 : 0
}

function set(g: ProductOptionGroup, v: ProductSelection[string]) {
  emit('update:modelValue', { ...sel.value, [g.key]: v })
}

function available(g: ProductOptionGroup, o: ProductOption) {
  if (o.disabled) return false
  return props.isAvailable ? props.isAvailable(g, o, sel.value) : true
}

function isSelected(g: ProductOptionGroup, o: ProductOption) {
  const t = typeOf(g)
  return t === 'single' ? single(g) === o.value : t === 'multiple' ? multi(g).includes(o.value) : (counts(g)[o.value] ?? 0) > 0
}

function pick(g: ProductOptionGroup, o: ProductOption) {
  if (props.disabled || !available(g, o)) return
  const t = typeOf(g)
  if (t === 'single') {
    if (single(g) === o.value) {
      if (!g.required) set(g, undefined)
      return
    }
    set(g, o.value)
  } else if (t === 'multiple') {
    const cur = multi(g)
    if (cur.includes(o.value)) set(g, cur.filter((v) => v !== o.value))
    else if (g.max === 1) set(g, [o.value])
    else if (g.max === undefined || cur.length < g.max) set(g, [...cur, o.value])
  } else {
    step(g, o, 1)
  }
}

function step(g: ProductOptionGroup, o: ProductOption, d: number) {
  if (props.disabled) return
  const c = { ...counts(g) }
  const next = (c[o.value] ?? 0) + d
  if (next < 0) return
  if (d > 0 && (!available(g, o) || (g.max !== undefined && countOf(g) >= g.max))) return
  if (next === 0) delete c[o.value]
  else c[o.value] = next
  set(g, c)
}

function atMax(g: ProductOptionGroup) {
  return g.max !== undefined && countOf(g) >= g.max
}

/** Rule text and whether it's satisfied, per group */
function rule(g: ProductOptionGroup): { text: string; ok: boolean; required: boolean } {
  const t = typeOf(g)
  const n = countOf(g)
  if (t === 'single') return { text: g.required ? locale.configRequired : locale.configOptional, ok: !g.required || n === 1, required: !!g.required }
  const min = g.min ?? 0
  const max = g.max
  let text: string
  if (min > 0 && max === min) text = locale.configChooseExactly.replace('{n}', String(min))
  else if (min > 0) text = locale.configChooseAtLeast.replace('{n}', String(min))
  else if (max !== undefined) text = locale.configChooseUpTo.replace('{n}', String(max))
  else text = locale.configOptional
  return { text, ok: n >= min && (max === undefined || n <= max), required: min > 0 }
}

const valid = computed(() => props.groups.every((g) => rule(g).ok))

const unitPrice = computed(() => {
  let p = props.basePrice
  for (const g of props.groups) {
    for (const o of g.options) {
      if (!o.price) continue
      const t = typeOf(g)
      if (t === 'quantity') p += o.price * (counts(g)[o.value] ?? 0)
      else if (isSelected(g, o)) p += o.price
    }
  }
  return Math.round(p * 100) / 100
})
const qty = computed(() => props.quantity ?? 1)
const total = computed(() => Math.round(unitPrice.value * qty.value * 100) / 100)

function money(n: number, signed = false) {
  const s = new Intl.NumberFormat(locale.lang, props.currency ? { style: 'currency', currency: props.currency } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))
  return signed ? `${n < 0 ? '−' : '+'}${s}` : s
}

function setQty(d: number) {
  const next = Math.min(props.maxQuantity, Math.max(1, qty.value + d))
  if (next !== qty.value) emit('update:quantity', next)
}

function add() {
  if (!valid.value || props.disabled) return
  emit('add', { selection: sel.value, quantity: qty.value, unitPrice: unitPrice.value, total: total.value })
}

function selectedLabel(g: ProductOptionGroup) {
  return g.options.find((o) => o.value === single(g))?.label
}

defineExpose({ valid, unitPrice, total })
</script>

<template>
  <div class="m3-product-configurator flex flex-col gap-2 text-on-surface">
    <slot name="header" />

    <section
      v-for="g in groups"
      :key="g.key"
      class="flex flex-col"
      role="group"
      :aria-labelledby="`m3pc-${g.key}`"
      :data-group="g.key"
    >
      <div class="flex items-center gap-2 py-2">
        <h3 :id="`m3pc-${g.key}`" class="flex-1 text-title-medium">
          {{ g.label }}<span v-if="(g.display === 'swatches' || g.display === 'chips') && typeOf(g) === 'single' && selectedLabel(g)" class="text-body-large text-on-surface-variant">: {{ selectedLabel(g) }}</span>
        </h3>
        <span
          class="rounded-sm px-2 py-0.5 text-label-medium"
          :class="rule(g).ok
            ? 'bg-surface-container-high text-on-surface-variant'
            : rule(g).required ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-on-surface-variant'"
          data-rule
        >
          <MIcon v-if="rule(g).ok && rule(g).required" name="check" :size="14" class="-mt-0.5 me-0.5 align-middle" />{{ rule(g).text }}
        </span>
      </div>

      <!-- Swatches -->
      <div v-if="g.display === 'swatches'" class="flex flex-wrap gap-3 pb-2">
        <button
          v-for="o in g.options"
          :key="o.value"
          v-ripple
          type="button"
          class="m3-pc-swatch relative h-11 w-11 overflow-hidden rounded-full"
          :class="{ 'is-selected': isSelected(g, o), 'is-unavailable': !available(g, o) }"
          :style="{ background: o.image ? `center / cover url(${o.image})` : o.color }"
          :aria-label="o.price ? `${o.label} ${money(o.price, true)}` : o.label"
          :aria-pressed="isSelected(g, o)"
          :disabled="disabled || !available(g, o)"
          :title="o.label"
          :data-option="o.value"
          @click="pick(g, o)"
        />
      </div>

      <!-- Chips -->
      <div v-else-if="g.display === 'chips'" class="flex flex-wrap gap-2 pb-2">
        <button
          v-for="o in g.options"
          :key="o.value"
          v-ripple
          type="button"
          class="m3-pc-chip relative flex h-10 min-w-12 items-center justify-center gap-1 overflow-hidden rounded-sm border px-4 text-label-large transition-colors"
          :class="isSelected(g, o)
            ? 'border-transparent bg-secondary-container text-on-secondary-container'
            : 'border-outline-variant text-on-surface-variant'"
          :aria-pressed="isSelected(g, o)"
          :disabled="disabled || !available(g, o) || (!isSelected(g, o) && typeOf(g) === 'multiple' && atMax(g) && g.max !== 1)"
          :data-option="o.value"
          @click="pick(g, o)"
        >
          <MIcon v-if="isSelected(g, o)" name="check" :size="18" />
          <span :class="{ 'line-through': !available(g, o) }">{{ o.label }}</span>
          <span v-if="o.price" class="opacity-70">{{ money(o.price, true) }}</span>
        </button>
      </div>

      <!-- List -->
      <ul v-else role="list" class="flex flex-col">
        <li v-for="o in g.options" :key="o.value" :data-option="o.value">
          <div
            v-if="typeOf(g) === 'quantity'"
            class="flex min-h-14 items-center gap-3 py-1"
            :class="{ 'opacity-40': !available(g, o) && !counts(g)[o.value] }"
          >
            <div class="min-w-0 flex-1">
              <slot name="option" :group="g" :option="o" :selected="isSelected(g, o)" :available="available(g, o)">
                <div class="text-body-large">{{ o.label }}</div>
                <div v-if="o.description" class="text-body-medium text-on-surface-variant">{{ o.description }}</div>
              </slot>
            </div>
            <span v-if="o.price" class="text-body-medium text-on-surface-variant tabular-nums">{{ money(o.price, true) }}</span>
            <div class="flex items-center gap-1">
              <MIconButton
                v-if="counts(g)[o.value]"
                icon="remove"
                size="sm"
                variant="outlined"
                :aria-label="`${locale.configDecrease}: ${o.label}`"
                :disabled="disabled"
                @click="step(g, o, -1)"
              />
              <span v-if="counts(g)[o.value]" class="min-w-6 text-center text-title-medium tabular-nums" data-count>{{ counts(g)[o.value] }}</span>
              <MIconButton
                icon="add"
                size="sm"
                variant="tonal"
                :aria-label="`${locale.configIncrease}: ${o.label}`"
                :disabled="disabled || !available(g, o) || atMax(g)"
                @click="step(g, o, 1)"
              />
            </div>
          </div>
          <label
            v-else
            class="flex min-h-14 cursor-pointer items-center gap-2 py-1"
            :class="{ 'cursor-default opacity-40': !available(g, o) || (typeOf(g) === 'multiple' && !isSelected(g, o) && atMax(g) && g.max !== 1) }"
          >
            <MRadio
              v-if="typeOf(g) === 'single'"
              :model-value="single(g) ?? null"
              :value="o.value"
              :disabled="disabled || !available(g, o)"
              @update:model-value="pick(g, o)"
              @click="single(g) === o.value && pick(g, o)"
            />
            <MCheckbox
              v-else
              :model-value="isSelected(g, o)"
              :disabled="disabled || !available(g, o) || (!isSelected(g, o) && atMax(g) && g.max !== 1)"
              @update:model-value="pick(g, o)"
            />
            <div class="min-w-0 flex-1">
              <slot name="option" :group="g" :option="o" :selected="isSelected(g, o)" :available="available(g, o)">
                <div class="text-body-large" :class="{ 'line-through': !available(g, o) }">{{ o.label }}</div>
                <div v-if="o.description" class="text-body-medium text-on-surface-variant">{{ o.description }}</div>
              </slot>
            </div>
            <span v-if="!available(g, o)" class="text-label-medium text-on-surface-variant">{{ locale.configUnavailable }}</span>
            <span v-else-if="o.price" class="text-body-medium text-on-surface-variant tabular-nums">{{ money(o.price, true) }}</span>
          </label>
        </li>
      </ul>
    </section>

    <div v-if="quantity !== null || actionLabel || $slots.action" class="mt-2 flex items-center gap-3">
      <div v-if="quantity !== null" class="flex items-center gap-1 rounded-full border border-outline-variant p-1" role="group" :aria-label="locale.configQuantity">
        <MIconButton icon="remove" size="sm" :aria-label="locale.configDecrease" :disabled="disabled || qty <= 1" @click="setQty(-1)" />
        <span class="min-w-6 text-center text-title-medium tabular-nums" data-quantity>{{ qty }}</span>
        <MIconButton icon="add" size="sm" :aria-label="locale.configIncrease" :disabled="disabled || qty >= maxQuantity" @click="setQty(1)" />
      </div>
      <slot name="action" :valid="valid" :total="total" :quantity="qty" :add="add">
        <MButton v-if="actionLabel" class="flex-1" :disabled="disabled || !valid" data-action @click="add">
          {{ actionLabel }} · <span class="tabular-nums">{{ money(total) }}</span>
        </MButton>
      </slot>
    </div>
  </div>
</template>

<style>
.m3-pc-swatch {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-on-surface) 16%, transparent);
  outline-offset: 3px;
}
.m3-pc-swatch.is-selected {
  outline: 2px solid var(--color-primary);
}
.m3-pc-swatch:focus-visible {
  outline: 3px solid var(--color-secondary);
}
.m3-pc-swatch.is-unavailable {
  opacity: 0.5;
  cursor: default;
}
.m3-pc-swatch.is-unavailable::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top right, transparent calc(50% - 1px), var(--color-on-surface) 50%, transparent calc(50% + 1px));
}
.m3-pc-chip:disabled {
  opacity: 0.38;
  cursor: default;
}
.m3-pc-chip:focus-visible {
  outline: 3px solid var(--color-secondary);
  outline-offset: 2px;
}
</style>
