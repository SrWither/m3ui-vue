<script setup lang="ts">
/**
 * A compact metric card — title, value, optional icon, and a trend indicator, with a built-in loading skeleton.
 *
 * @slot footer Extra content appended after the trend indicator/label row (only rendered when trend,
 *   trendLabel, or this slot is present)
 */
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  /** Stat label text — required */
  title: string
  /** Main stat value — required */
  value: string | number
  /** Material Symbol icon shown in a colored container on the right */
  icon?: string
  /** Percentage change — positive shows green/up, negative red/down, zero neutral/flat */
  trend?: number
  /** Text next to the trend indicator (e.g. "vs last month") */
  trendLabel?: string
  /** Icon container color */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
  /** Show a skeleton placeholder instead of the value */
  loading?: boolean
}>(), { color: 'primary' })

const iconBg: Record<string, string> = {
  primary:   'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary:  'bg-tertiary-container text-on-tertiary-container',
  error:     'bg-error-container text-on-error-container',
  success:   'bg-success-container text-on-success-container',
}

const trendColor = computed(() => {
  if (props.trend == null) return ''
  return props.trend > 0 ? 'text-success' : props.trend < 0 ? 'text-error' : 'text-on-surface-variant'
})
const trendIcon = computed(() => {
  if (props.trend == null) return ''
  return props.trend > 0 ? 'trending_up' : props.trend < 0 ? 'trending_down' : 'trending_flat'
})
</script>

<template>
  <div class="flex flex-col gap-2 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="flex min-w-0 flex-col gap-1">
        <span class="truncate text-label-large text-on-surface-variant">{{ title }}</span>
        <template v-if="loading">
          <div class="h-8 w-24 animate-pulse rounded-md bg-on-surface/10" />
        </template>
        <span v-else class="truncate text-headline-medium font-medium text-on-surface">{{ value }}</span>
      </div>
      <div v-if="icon" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" :class="iconBg[color]">
        <MIcon :name="icon" :size="24" />
      </div>
    </div>
    <div v-if="trend != null || trendLabel || $slots.footer" class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span v-if="trend != null" class="inline-flex items-center gap-0.5 text-label-medium font-medium" :class="trendColor">
        <MIcon :name="trendIcon" :size="16" />
        {{ trend > 0 ? '+' : '' }}{{ trend }}%
      </span>
      <span v-if="trendLabel" class="text-label-medium text-on-surface-variant">{{ trendLabel }}</span>
      <slot name="footer" />
    </div>
  </div>
</template>
