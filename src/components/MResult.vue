<script setup lang="ts">
/**
 * A full result screen for the end of a flow: success, errors, empty states and HTTP error pages. Each status
 * comes with its own icon, colors, title and description, and you can override any of them. The default texts
 * come from the active locale (`useLocale`), so they follow the language passed to `createM3UI({ locale })`.
 *
 * @slot actions Action buttons, in a centered row below the description
 * @slot default Extra content below the actions row, e.g. a secondary link or fine print
 */
import { computed } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale, type M3Locale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  /**
   * Required. Picks the icon, its colors, and the default title/description. The three HTTP statuses also show
   * the code in large type above the icon
   */
  status: 'success' | 'error' | 'warning' | 'info' | '404' | '403' | '500'
  /** Custom title, replaces the status default */
  title?: string
  /** Custom description, replaces the status default */
  description?: string
}>(), {})

const t = useLocale()

const STATUS_STYLE = {
  success: { icon: 'check_circle', bg: 'bg-success-container', text: 'text-on-success-container' },
  error: { icon: 'error', bg: 'bg-error-container', text: 'text-on-error-container' },
  warning: { icon: 'warning', bg: 'bg-tertiary-container', text: 'text-on-tertiary-container' },
  info: { icon: 'info', bg: 'bg-primary-container', text: 'text-on-primary-container' },
  '404': { icon: 'search_off', bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
  '403': { icon: 'lock', bg: 'bg-error-container', text: 'text-on-error-container' },
  '500': { icon: 'cloud_off', bg: 'bg-error-container', text: 'text-on-error-container' },
} as const

// Locale keys follow the status: success → resultSuccessTitle, 404 → result404Title, …
const config = computed(() => {
  const key = props.status.charAt(0).toUpperCase() + props.status.slice(1)
  return {
    ...STATUS_STYLE[props.status],
    defaultTitle: t[`result${key}Title` as keyof M3Locale],
    defaultDesc: t[`result${key}Desc` as keyof M3Locale],
  }
})

const httpCode = computed(() => {
  if (props.status === '404' || props.status === '403' || props.status === '500') return props.status
  return null
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-14 text-center">
    <!-- HTTP code -->
    <span v-if="httpCode" class="text-display-small font-medium text-on-surface-variant/30">
      {{ httpCode }}
    </span>

    <!-- Icon -->
    <div class="flex h-20 w-20 items-center justify-center rounded-full" :class="[config.bg, config.text]">
      <MIcon :name="config.icon" :size="40" />
    </div>

    <!-- Title -->
    <h2 class="text-headline-small font-medium text-on-surface">
      {{ title ?? config.defaultTitle }}
    </h2>

    <!-- Description -->
    <p v-if="description ?? config.defaultDesc" class="max-w-md text-body-large text-on-surface-variant">
      {{ description ?? config.defaultDesc }}
    </p>

    <!-- Actions slot -->
    <div v-if="$slots.actions" class="mt-2 flex flex-wrap items-center justify-center gap-3">
      <slot name="actions" />
    </div>

    <!-- Extra content -->
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
