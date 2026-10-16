<script setup lang="ts">
/**
 * Secondary text component with muted color by default — a thin wrapper around `MText`.
 *
 * @slot default The subtitle text.
 */
import { computed } from 'vue'
import MText from './MText.vue'
import type { TextVariant } from './MText.vue'

const props = withDefaults(
  defineProps<{
    /** Subtitle size (maps to body-large/medium/small) */
    size?: 'large' | 'medium' | 'small'
    /** Text color */
    color?: 'on-surface' | 'on-surface-variant' | 'primary' | 'secondary' | 'tertiary' | 'error' | 'inherit'
    /** Text alignment */
    align?: 'left' | 'center' | 'right'
    /** Truncate text with ellipsis on overflow */
    truncate?: boolean
  }>(),
  { size: 'large', color: 'on-surface-variant' },
)

const variantMap: Record<string, TextVariant> = {
  large: 'body-large',
  medium: 'body-medium',
  small: 'body-small',
}

const variant = computed(() => variantMap[props.size])
</script>

<template>
  <MText :variant="variant" :color="color" :align="align" :truncate="truncate">
    <slot />
  </MText>
</template>
