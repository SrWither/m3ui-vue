<script lang="ts">
/** A stage of an `MTrackingTimeline`: Order placed, Preparing, On the way, Delivered… */
export interface TrackingStep {
  /** Its name */
  label: string
  /** A line under it in the details (who, where) */
  description?: string
  /** A Material Symbol for its dot */
  icon?: string
  /** When it happened (or is expected): shown as a time in the details */
  time?: string | number | Date
}

/** Where the order stands besides its step: on time, running late, or called off */
export type TrackingStatus = 'active' | 'delayed' | 'canceled'
</script>

<script setup lang="ts">
/**
 * An order's progress for deliveries, rides and shipments: the current stage and the arrival time on top ("12 min ·
 * Arrives 3:45 PM", kept up to date), a bar of stage icons whose current leg fills as it goes (`stepProgress`, e.g.
 * from `MMapRoute`'s progress), delayed and canceled states, and the stages with their times in a details list that
 * opens below. Not an M3 spec component: built from M3 pieces (`MTimeline`, `MCollapse`, the progress indicator's
 * track and color roles).
 *
 * @slot title Replaces the title (the current stage's name). Scope: `{ step, index }`
 * @slot extra Content between the bar and the details: the courier, a call button, a map
 * @event update:expanded The details opened or closed — powers v-model:expanded
 */
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import MIcon from './MIcon.vue'
import MButton from './MButton.vue'
import MCollapse from './MCollapse.vue'
import MTimeline from './MTimeline.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** The stages, in order */
    steps: TrackingStep[]
    /** The stage it's at (0-based): earlier ones are done. `steps.length` (or more) means all done */
    current: number
    /** How far along the current stage's leg it is, 0–1 (the bar fills toward the next stage) */
    stepProgress?: number
    /** The expected arrival: shows the minutes left and the time, and updates by itself */
    eta?: string | number | Date
    /** On time (`active`), running late (`delayed`) or called off (`canceled`) */
    status?: TrackingStatus
    /** The title, instead of the current stage's name */
    title?: string
    /** A line under the title ("Your courier is 2 blocks away") */
    message?: string
    /** Offer the stages with their times in a list that opens below */
    details?: boolean
    /** Whether the details are open (v-model:expanded) */
    expanded?: boolean
  }>(),
  { stepProgress: 0, status: 'active', details: true, expanded: undefined },
)

const emit = defineEmits<{ 'update:expanded': [open: boolean] }>()

const locale = useLocale()
const detailsId = useId()

const last = computed(() => props.steps.length - 1)
const done = computed(() => props.status !== 'canceled' && props.current >= last.value)
const at = computed(() => Math.min(Math.max(props.current, 0), last.value))

type State = 'done' | 'current' | 'upcoming'
const stateOf = (i: number): State => (done.value || i < at.value ? 'done' : i === at.value ? 'current' : 'upcoming')

/** How full the leg after stage i is, 0–1 */
const legFill = (i: number) => {
  if (done.value || i < at.value) return 1
  if (i === at.value && props.status !== 'canceled') return Math.min(Math.max(props.stepProgress, 0), 1)
  return 0
}

// ── Time ───────────────────────────────────────────────────────────
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => (now.value = Date.now()), 15_000) })
onBeforeUnmount(() => clearInterval(timer))

const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v))
const timeFormat = computed(() => new Intl.DateTimeFormat(locale.lang || undefined, { hour: 'numeric', minute: '2-digit' }))
const formatTime = (v: string | number | Date | undefined) => {
  if (v == null) return undefined
  const d = toDate(v)
  return Number.isNaN(d.getTime()) ? String(v) : timeFormat.value.format(d)
}

/** The minutes (or hours) left, as the big number */
const remaining = computed(() => {
  if (props.eta == null || done.value || props.status === 'canceled') return null
  const ms = toDate(props.eta).getTime() - now.value
  if (Number.isNaN(ms)) return null
  const min = Math.ceil(ms / 60_000)
  if (min <= 1) return { text: locale.trackingArrivingNow, short: true }
  const unit = min >= 90 ? 'hour' : 'minute'
  const value = unit === 'hour' ? Math.round(min / 60) : min
  return { text: new Intl.NumberFormat(locale.lang || undefined, { style: 'unit', unit, unitDisplay: 'short' }).format(value), short: false }
})
const etaLine = computed(() => {
  if (done.value) {
    const t = formatTime(props.steps[last.value]?.time)
    return t ? `${locale.trackingDelivered} · ${t}` : locale.trackingDelivered
  }
  if (props.eta == null || props.status === 'canceled') return null
  return locale.trackingArrives.replace('{time}', formatTime(props.eta) ?? '')
})

const heading = computed(() => props.title ?? props.steps[at.value]?.label ?? '')

// ── Details ────────────────────────────────────────────────────────
const openInner = ref(false)
const open = computed(() => props.expanded ?? openInner.value)
function toggle() {
  const next = !open.value
  openInner.value = next
  emit('update:expanded', next)
}
watch(() => props.expanded, (v) => { if (v != null) openInner.value = v })

const timelineItems = computed(() =>
  props.steps.map((s, i) => ({
    title: s.label,
    description: s.description,
    icon: s.icon,
    date: formatTime(s.time),
    color: props.status === 'canceled' && i === at.value ? ('error' as const) : undefined,
  })),
)

// Colors for the current stage by status: tertiary while late (M3's accent for "needs attention but not an error")
const accent = computed(() =>
  props.status === 'canceled' ? { solid: 'bg-error text-on-error', soft: 'bg-error-container text-on-error-container', fill: 'bg-error', text: 'text-error' }
  : props.status === 'delayed' ? { solid: 'bg-tertiary text-on-tertiary', soft: 'bg-tertiary-container text-on-tertiary-container', fill: 'bg-tertiary', text: 'text-tertiary' }
  : { solid: 'bg-primary text-on-primary', soft: 'bg-primary-container text-on-primary-container', fill: 'bg-primary', text: 'text-primary' },
)
const dotClass = (i: number) => {
  const s = stateOf(i)
  if (s === 'done') return 'bg-primary text-on-primary'
  if (s === 'current') return accent.value.soft
  return props.status === 'canceled' ? 'bg-surface-container-highest text-on-surface/38' : 'bg-surface-container-highest text-on-surface-variant'
}
const dotIcon = (i: number) => {
  if (props.status === 'canceled' && stateOf(i) === 'current') return 'close'
  return props.steps[i]?.icon ?? (stateOf(i) === 'done' ? 'check' : 'circle')
}
const statusChip = computed(() =>
  props.status === 'delayed' ? { label: locale.trackingDelayed, icon: 'schedule' } : props.status === 'canceled' ? { label: locale.trackingCanceled, icon: 'cancel' } : null,
)
</script>

<template>
  <section class="m3-tracking flex flex-col gap-4 rounded-xl bg-surface-container-low p-4" :aria-label="heading">
    <!-- Title, status and arrival -->
    <div class="flex items-start gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-title-large text-on-surface">
            <slot name="title" :step="steps[at]" :index="at">{{ heading }}</slot>
          </h3>
          <span
            v-if="statusChip"
            class="inline-flex h-6 items-center gap-1 rounded-sm px-2 text-label-medium"
            :class="accent.soft"
          >
            <MIcon :name="statusChip.icon" :size="16" />{{ statusChip.label }}
          </span>
        </div>
        <p v-if="message" class="mt-1 text-body-medium text-on-surface-variant">{{ message }}</p>
      </div>
      <div v-if="remaining || etaLine" class="shrink-0 text-right" aria-live="polite">
        <p v-if="remaining" class="tabular-nums" :class="[remaining.short ? 'text-title-medium' : 'text-headline-small', accent.text]">{{ remaining.text }}</p>
        <p v-if="etaLine" class="text-body-small text-on-surface-variant">{{ etaLine }}</p>
      </div>
    </div>

    <!-- The stages: dots joined by legs that fill -->
    <ol class="flex items-center" :aria-label="heading">
      <template v-for="(step, i) in steps" :key="i">
        <li
          class="relative flex shrink-0"
          :aria-current="stateOf(i) === 'current' && !done ? 'step' : undefined"
          :title="step.label"
        >
          <span class="sr-only">{{ step.label }}</span>
          <span
            v-if="stateOf(i) === 'current' && !done && status !== 'canceled'"
            class="m3-tracking-pulse absolute inset-0 rounded-full"
            :class="accent.fill"
            aria-hidden="true"
          />
          <span
            class="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300"
            :class="dotClass(i)"
            aria-hidden="true"
          >
            <MIcon :name="dotIcon(i)" :size="20" :filled="stateOf(i) !== 'upcoming'" />
          </span>
        </li>
        <li v-if="i < steps.length - 1" class="mx-1 h-1 min-w-4 flex-1 overflow-hidden rounded-full bg-surface-container-highest" aria-hidden="true">
          <span
            class="block h-full rounded-full transition-[width] duration-500 ease-out"
            :class="i < at || done ? 'bg-primary' : accent.fill"
            :style="{ width: `${legFill(i) * 100}%` }"
          />
        </li>
      </template>
    </ol>

    <slot name="extra" />

    <template v-if="details">
      <MCollapse :id="detailsId" :open="open">
        <MTimeline :items="timelineItems" :current="done ? steps.length : at" dense />
      </MCollapse>
      <MButton
        variant="text"
        size="sm"
        class="self-start"
        :icon="open ? 'expand_less' : 'expand_more'"
        :aria-expanded="open"
        :aria-controls="detailsId"
        @click="toggle"
      >
        {{ open ? locale.trackingHideDetails : locale.trackingShowDetails }}
      </MButton>
    </template>
  </section>
</template>

<style scoped>
/* The current stage breathes: a ring that grows and fades, like a live location dot */
.m3-tracking-pulse {
  animation: m3-tracking-pulse 1.8s cubic-bezier(0.2, 0, 0, 1) infinite;
}
@keyframes m3-tracking-pulse {
  from {
    transform: scale(1);
    opacity: 0.32;
  }
  to {
    transform: scale(1.7);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .m3-tracking-pulse {
    animation: none;
    display: none;
  }
}
</style>
