<script setup lang="ts">
import { computed } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale, type M3Locale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  status: 'success' | 'error' | 'warning' | 'info' | '404' | '403' | '500'
  title?: string
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
