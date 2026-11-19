<script lang="ts">
export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

/** What the default slot receives: the time left, split into the units shown */
export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** Milliseconds left (0 once finished) */
  total: number
  finished: boolean
}
</script>

<script setup lang="ts">
/**
 * MCountdown — a countdown to a date: days, hours, minutes and seconds with rolling digits, in boxes or inline.
 * Unit names come from `Intl` in the app's language. Units left out of `units` fold into the next larger one shown
 * (no `days` → 50 hours). Ticks on the second boundary; every tick costs one timer, not one per digit.
 *
 * @slot default Replaces the whole rendering; receives `CountdownParts` (`days`, `hours`, `minutes`, `seconds`, `total`, `finished`)
 * @slot finished Shown instead of the countdown once it reaches zero
 * @event finished Emitted once when the countdown reaches zero (not on mount if `to` is already past)
 * @event tick Emitted every second with the `CountdownParts`
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MAnimatedNumber from './MAnimatedNumber.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** The moment it counts down to: a `Date`, a timestamp in ms, or a date string */
    to: Date | number | string
    /** Units shown, largest first; leaving one out folds it into the next larger one */
    units?: CountdownUnit[]
    /** `boxes`: each unit in its own container with its name below; `inline`: one line of text (3d 04h 12m) */
    variant?: 'boxes' | 'inline'
    /** Digit size */
    size?: 'sm' | 'md' | 'lg'
    /** Show unit names */
    labels?: boolean
    /** Hide leading units while they're zero (no "0 days" a few hours before) */
    hideEmpty?: boolean
    /** Roll the digits; false (or the system's reduced motion) swaps them */
    animate?: boolean
    /** BCP-47 language for the unit names; defaults to the app's locale */
    locale?: string
  }>(),
  {
    units: () => ['days', 'hours', 'minutes', 'seconds'],
    variant: 'boxes',
    size: 'md',
    labels: true,
    hideEmpty: false,
    animate: true,
  },
)

const emit = defineEmits<{ finished: []; tick: [CountdownParts] }>()

const t = useLocale()
const lang = computed(() => props.locale ?? t.lang)

const target = computed(() => {
  const v = props.to
  return v instanceof Date ? v.getTime() : typeof v === 'number' ? v : new Date(v).getTime()
})

const now = ref(Date.now())
const total = computed(() => (Number.isNaN(target.value) ? 0 : Math.max(0, target.value - now.value)))

const ORDER: CountdownUnit[] = ['days', 'hours', 'minutes', 'seconds']
const MS: Record<CountdownUnit, number> = { days: 86_400_000, hours: 3_600_000, minutes: 60_000, seconds: 1000 }

const shown = computed(() => ORDER.filter((u) => props.units.includes(u)))

const parts = computed<CountdownParts>(() => {
  // Round up to the smallest unit shown: 0.4s left reads 1s (30s left reads 1 min without seconds), and 0 only
  // appears when it's really over.
  const step = MS[shown.value[shown.value.length - 1] ?? 'seconds']
  let rest = Math.ceil(total.value / step) * step
  const out: CountdownParts = { days: 0, hours: 0, minutes: 0, seconds: 0, total: total.value, finished: total.value <= 0 }
  for (const u of shown.value) {
    out[u] = Math.floor(rest / MS[u])
    rest -= out[u] * MS[u]
  }
  return out
})

const visible = computed(() => {
  if (!props.hideEmpty) return shown.value
  const first = shown.value.findIndex((u) => parts.value[u] > 0)
  // Always keep the smallest unit, so the finished state still reads 00.
  return shown.value.slice(first === -1 ? shown.value.length - 1 : Math.min(first, shown.value.length - 1))
})

const INTL_UNIT: Record<CountdownUnit, string> = { days: 'day', hours: 'hour', minutes: 'minute', seconds: 'second' }

/** The language's own word for the unit, plural-aware ("1 día", "3 días"), or its narrow form for inline */
function unitLabel(u: CountdownUnit, n: number, display: 'long' | 'narrow') {
  try {
    const fmt = new Intl.NumberFormat(lang.value, { style: 'unit', unit: INTL_UNIT[u], unitDisplay: display })
    return fmt.formatToParts(n).filter((p) => p.type === 'unit' || (display === 'narrow' && p.type === 'literal'))
      .map((p) => p.value).join('').trim()
  } catch {
    return u
  }
}

const accessibleText = computed(() =>
  shown.value
    .map((u) => {
      try {
        return new Intl.NumberFormat(lang.value, { style: 'unit', unit: INTL_UNIT[u], unitDisplay: 'long' }).format(parts.value[u])
      } catch {
        return `${parts.value[u]} ${u}`
      }
    })
    .join(', '),
)

// Leading unit unpadded (3 days, 120 hours), the rest always two digits (04:09).
const digitFormat = (i: number) => ({ minimumIntegerDigits: i === 0 ? 1 : 2, useGrouping: false })

let timer: ReturnType<typeof setTimeout> | undefined
let done = false

function schedule() {
  clearTimeout(timer)
  if (total.value <= 0) return
  // Wake when the remaining time crosses the next whole second, so displayed seconds flip on time
  // (a late timer is harmless, it just reschedules from the new remainder).
  const delay = total.value % 1000 || 1000
  timer = setTimeout(step, delay)
}

function step() {
  now.value = Date.now()
  emit('tick', parts.value)
  if (total.value <= 0 && !done) {
    done = true
    emit('finished')
  }
  schedule()
}

watch(target, () => {
  now.value = Date.now()
  done = total.value <= 0
  schedule()
})

onMounted(() => {
  now.value = Date.now()
  done = total.value <= 0
  schedule()
})
onBeforeUnmount(() => clearTimeout(timer))

const sizeClass = computed(
  () => ({ sm: 'text-title-large', md: 'text-display-small', lg: 'text-display-medium' })[props.size],
)

defineExpose({ parts })
</script>

<template>
  <div class="m3-countdown" :data-variant="variant" role="timer" :aria-label="accessibleText">
    <slot v-if="parts.finished && $slots.finished" name="finished" />
    <slot v-else-if="$slots.default" v-bind="parts" />
    <div v-else-if="variant === 'boxes'" class="flex items-start gap-2" aria-hidden="true">
      <div v-for="(u, i) in visible" :key="u" class="flex flex-col items-center gap-1">
        <div
          class="flex min-w-[2ch] items-center justify-center rounded-md bg-surface-container-high px-3 py-2 tabular-nums text-on-surface"
          :class="sizeClass"
        >
          <MAnimatedNumber :value="parts[u]" :format="digitFormat(i)" :animate="animate" />
        </div>
        <span v-if="labels" class="text-label-medium text-on-surface-variant">{{ unitLabel(u, parts[u], 'long') }}</span>
      </div>
    </div>
    <span v-else class="inline-flex items-baseline gap-1.5 tabular-nums text-on-surface" :class="sizeClass" aria-hidden="true">
      <span v-for="(u, i) in visible" :key="u" class="inline-flex items-baseline">
        <MAnimatedNumber :value="parts[u]" :format="digitFormat(i)" :animate="animate" />
        <span v-if="labels" class="text-on-surface-variant">{{ unitLabel(u, parts[u], 'narrow') }}</span>
        <span v-else-if="i < visible.length - 1" class="text-on-surface-variant">:</span>
      </span>
    </span>
  </div>
</template>

<style>
/* Defaults in the base layer so the consumer's classes on the root win (see MShape). */
@layer base {
  .m3-countdown {
    display: inline-block;
  }
}
</style>
