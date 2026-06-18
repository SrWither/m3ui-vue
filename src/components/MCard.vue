<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'elevated' | 'filled' | 'outlined'
    clickable?: boolean
    elevated?: boolean
    /** src URL for a full-bleed header image */
    image?: string
    imageAlt?: string
    imageHeight?: string
    title?: string
    subtitle?: string
  }>(),
  { variant: 'elevated', clickable: false, elevated: false },
)

const resolvedVariant = computed(() => (props.elevated ? 'elevated' : props.variant))

const variantClasses: Record<string, string> = {
  elevated: 'bg-surface-container-low shadow-elevation-1',
  filled: 'bg-surface-container-highest',
  outlined: 'bg-surface border border-outline-variant',
}

// Expose the card's background as --field-bg so outlined text-field labels
// inside the card automatically match without needing the fieldBg prop.
const fieldBgByVariant: Record<string, string> = {
  elevated: 'var(--color-surface-container-low)',
  filled: 'var(--color-surface-container-highest)',
  outlined: 'var(--color-surface)',
}
</script>

<template>
  <div
    class="overflow-hidden rounded-md transition-shadow duration-150"
    :class="[
      variantClasses[resolvedVariant],
      clickable ? 'cursor-pointer hover:shadow-elevation-2 active:shadow-elevation-1' : '',
    ]"
    :style="{ '--field-bg': fieldBgByVariant[resolvedVariant] }"
  >
    <!-- Optional header image -->
    <div v-if="image || $slots.media" :class="['w-full overflow-hidden', imageHeight ?? 'h-48']">
      <img
        v-if="image"
        :src="image"
        :alt="imageAlt ?? ''"
        class="h-full w-full object-cover"
      />
      <slot v-else name="media" />
    </div>

    <div v-if="$slots.header" class="px-4 pt-4 pb-2">
      <slot name="header" />
    </div>
    <div v-else-if="title" class="px-4 pt-4 pb-2">
      <h3 class="text-title-large font-medium text-on-surface">{{ title }}</h3>
      <p v-if="subtitle" class="mt-1 text-body-medium text-on-surface-variant">{{ subtitle }}</p>
    </div>

    <slot />

    <div v-if="$slots.actions" class="flex justify-end gap-2 px-4 pt-2 pb-4">
      <slot name="actions" />
    </div>
  </div>
</template>
