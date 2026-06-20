<script setup lang="ts">
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    type?: 'info' | 'success' | 'warning' | 'error'
    title?: string
    closeable?: boolean
    closeAriaLabel?: string
  }>(),
  {
    type: 'info',
    closeable: false,
  },
)

const locale = useLocale()

const emit = defineEmits<{ close: [] }>()

const config = {
  info: {
    icon: 'info',
    container: 'bg-primary-container text-on-primary-container',
    iconColor: 'text-primary',
  },
  success: {
    icon: 'check_circle',
    container: 'bg-success-container text-on-success-container',
    iconColor: 'text-success',
  },
  warning: {
    icon: 'warning',
    container: 'bg-tertiary-container text-on-tertiary-container',
    iconColor: 'text-tertiary',
  },
  error: {
    icon: 'error',
    container: 'bg-error-container text-on-error-container',
    iconColor: 'text-error',
  },
}
</script>

<template>
  <div class="flex items-start gap-3 rounded-md p-4" :class="config[type].container">
    <MIcon
      :name="config[type].icon"
      :size="20"
      class="mt-0.5 shrink-0"
      :class="config[type].iconColor"
    />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="mb-0.5 text-label-large font-medium">{{ title }}</p>
      <div class="text-body-medium">
        <slot />
      </div>
      <div v-if="$slots.actions" class="mt-3 flex flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>
    <button
      v-if="closeable"
      type="button"
      class="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8"
      :aria-label="closeAriaLabel ?? locale.close"
      @click="emit('close')"
    >
      <MIcon name="close" :size="18" />
    </button>
  </div>
</template>
