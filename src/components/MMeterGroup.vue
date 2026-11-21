<script lang="ts">
/** One part of the meter */
export interface MeterItem {
  label: string
  value: number
  /** An M3 color role (`primary`, `tertiary`...) or any CSS color; defaults to the next of a set of roles */
  color?: string
  /** Material Symbol shown in the legend instead of the color dot */
  icon?: string
}
</script>

<script setup lang="ts">
/**
 * MMeterGroup — several values sharing one bar, like a phone's storage screen: photos, apps, system and what's left
 * of the total. Each part is a segment with its own color, separated by a gap (M3's linear progress track gap),
 * growing in on mount and sliding when values change; the legend lists each part with its value and share, and
 * hovering a part highlights it in both places. Values over `max` are scaled to fit.
 *
 * @slot label Replaces the header's text on the left (defaults to `label`)
 * @slot summary Replaces the header's text on the right (defaults to "used of max")
 * @slot legend-item Replaces a legend entry; receives `item`, `percent`, `formatted` and `color`
 * @event select Emitted with the item (and its index) when a segment or legend entry is clicked
 */
import { computed, onMounted, ref } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    items: MeterItem[]
    /** The whole bar; defaults to the sum of the values (no remaining part) */
    max?: number
    /** Title above the bar */
    label?: string
    /** Unit appended to formatted values ("GB") */
    unit?: string
    /** Intl.NumberFormat options for values */
    numberFormat?: Intl.NumberFormatOptions
    /** Formats a value; overrides `unit` and `numberFormat` */
    format?: (value: number) => string
    /** Bar thickness */
    size?: 'sm' | 'md' | 'lg'
    /** Legend below the bar */
    legend?: boolean
    /** Show each part's share (%) in the legend */
    percent?: boolean
    /** With `max`, list what's left as a last legend entry (outlined dot) */
    showRemaining?: boolean
    /** The remaining entry's label; defaults to the locale's */
    remainingLabel?: string
    /** Show "used of max" on the right of the header */
    summary?: boolean
    /** Grow the segments in on mount (off with reduced motion) */
    animate?: boolean
    /** BCP-47 language for numbers; defaults to the app's locale */
    locale?: string
  }>(),
  { size: 'md', legend: true, percent: false, showRemaining: true, summary: true, animate: true },
)

const emit = defineEmits<{ select: [item: MeterItem, index: number] }>()

const t = useLocale()
const lang = computed(() => props.locale ?? t.lang)

const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'success', 'on-surface', 'on-surface-variant', 'outline', 'inverse-primary', 'primary-container', 'secondary-container', 'tertiary-container'])
const CYCLE = ['primary', 'tertiary', 'secondary', 'error', 'success']
const colorOf = (item: MeterItem, i: number) => {
  const c = item.color ?? CYCLE[i % CYCLE.length]!
  return ROLES.has(c) ? `var(--color-${c})` : c
}

const used = computed(() => props.items.reduce((s, it) => s + Math.max(0, it.value), 0))
// The bar's whole: max, unless the values overflow it (then they're scaled to fit)
const whole = computed(() => Math.max(props.max ?? used.value, used.value) || 1)
const remaining = computed(() => (props.max != null ? Math.max(0, props.max - used.value) : 0))

const nf = computed(() => new Intl.NumberFormat(lang.value, props.numberFormat))
const pf = computed(() => new Intl.NumberFormat(lang.value, { style: 'percent', maximumFractionDigits: 1 }))
function fmt(v: number) {
  if (props.format) return props.format(v)
  return props.unit ? `${nf.value.format(v)} ${props.unit}` : nf.value.format(v)
}

const segments = computed(() =>
  props.items
    .map((item, index) => ({ item, index, share: Math.max(0, item.value) / whole.value, color: colorOf(item, index) }))
    .filter((s) => s.share > 0),
)

const thickness = computed(() => ({ sm: 4, md: 12, lg: 20 })[props.size])
const gapPx = computed(() => (props.size === 'sm' ? 2 : 4))
// The track for what's left only shows when something is left; the gaps come off the segments' widths, so the
// shares stay exact and a full bar isn't clipped
const hasTrack = computed(() => used.value < whole.value)
const totalGap = computed(() => Math.max(0, segments.value.length + (hasTrack.value ? 1 : 0) - 1) * gapPx.value)
const widthOf = (share: number) => `calc((100% - ${totalGap.value}px) * ${share})`

// Grows in from zero on mount: the segments render at 0 and get their width one frame later
const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const shown = ref(!props.animate || reduced)
onMounted(() => {
  if (!shown.value) requestAnimationFrame(() => requestAnimationFrame(() => { shown.value = true }))
})

const hovered = ref<number | null>(null)

const summaryText = computed(() =>
  props.max != null ? t.meterUsedOf.replace('{used}', fmt(used.value)).replace('{max}', fmt(props.max)) : fmt(used.value),
)
const ariaText = computed(() =>
  [props.label, ...props.items.map((it) => `${it.label}: ${fmt(it.value)}`), props.max != null ? `${props.remainingLabel ?? t.meterRemaining}: ${fmt(remaining.value)}` : '']
    .filter(Boolean)
    .join(', '),
)
</script>

<template>
  <div class="m3-meter-group flex flex-col gap-3" role="group" :aria-label="label">
    <!-- Header -->
    <div v-if="label || $slots.label || summary || $slots.summary" class="flex items-baseline justify-between gap-4">
      <span class="text-title-small font-medium text-on-surface"><slot name="label">{{ label }}</slot></span>
      <span v-if="summary || $slots.summary" class="text-body-medium text-on-surface-variant tabular-nums">
        <slot name="summary" :used="used" :max="max">{{ summaryText }}</slot>
      </span>
    </div>

    <!-- Bar: the segments, then the track for what's left, 4dp gaps between them (M3 linear progress) -->
    <div
      class="flex w-full rounded-full"
      :class="size !== 'sm' && 'overflow-hidden'"
      :style="{ height: `${thickness}px`, gap: `${gapPx}px` }"
      role="img"
      :aria-label="ariaText"
    >
      <div
        v-for="s in segments"
        :key="s.index"
        class="m3-meter-segment h-full shrink-0 cursor-pointer"
        :class="[hovered !== null && hovered !== s.index && 'opacity-40', size === 'sm' && 'm3-meter-hit rounded-full']"
        :style="{ width: shown ? widthOf(s.share) : '0px', backgroundColor: s.color }"
        @mouseenter="hovered = s.index"
        @mouseleave="hovered = null"
        @click="emit('select', s.item, s.index)"
      />
      <div v-if="hasTrack || !shown" class="h-full min-w-0 flex-1 bg-secondary-container" :class="size === 'sm' && 'rounded-full'" />
    </div>

    <!-- Legend -->
    <ul v-if="legend" class="flex flex-wrap gap-x-5 gap-y-2" aria-hidden="true">
      <li
        v-for="(item, i) in items"
        :key="i"
        class="flex cursor-pointer items-center gap-2 text-body-medium transition-opacity"
        :class="hovered !== null && hovered !== i && 'opacity-40'"
        @mouseenter="hovered = i"
        @mouseleave="hovered = null"
        @click="emit('select', item, i)"
      >
        <slot name="legend-item" :item="item" :percent="item.value / whole" :formatted="fmt(item.value)" :color="colorOf(item, i)">
          <MIcon v-if="item.icon" :name="item.icon" :size="18" :style="{ color: colorOf(item, i) }" />
          <span v-else class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: colorOf(item, i) }" />
          <span class="text-on-surface">{{ item.label }}</span>
          <span class="text-on-surface-variant tabular-nums">
            {{ fmt(item.value) }}<template v-if="percent"> · {{ pf.format(item.value / whole) }}</template>
          </span>
        </slot>
      </li>
      <li v-if="max != null && showRemaining" class="flex items-center gap-2 text-body-medium">
        <span class="size-2.5 shrink-0 rounded-full border-2 border-secondary-container" />
        <span class="text-on-surface">{{ remainingLabel ?? t.meterRemaining }}</span>
        <span class="text-on-surface-variant tabular-nums">
          {{ fmt(remaining) }}<template v-if="percent"> · {{ pf.format(remaining / whole) }}</template>
        </span>
      </li>
    </ul>
  </div>
</template>

<style>
/* sm is 4px tall: a taller invisible hit area, so the pointer finds a segment without aiming at a hairline */
.m3-meter-hit {
  position: relative;
}
.m3-meter-hit::after {
  content: '';
  position: absolute;
  inset: -8px 0;
}
.m3-meter-segment {
  transition:
    width 700ms cubic-bezier(0.2, 0, 0, 1),
    opacity 150ms;
}
</style>
