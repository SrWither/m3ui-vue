<script setup lang="ts">
/**
 * Semantic heading component in three sizes — a thin wrapper around `MText` at medium weight.
 *
 * @slot default The title text.
 */
import { computed } from 'vue'
import MText from './MText.vue'
import type { TextVariant } from './MText.vue'

const props = withDefaults(
  defineProps<{
    /** Title size (maps to headline-large/medium/small) */
    size?: 'large' | 'medium' | 'small'
    /** Text color */
    color?: 'on-surface' | 'on-surface-variant' | 'primary' | 'secondary' | 'tertiary' | 'error' | 'inherit'
    /** Text alignment */
    align?: 'left' | 'center' | 'right'
    /** Truncate text with ellipsis on overflow */
    truncate?: boolean
  }>(),
  { size: 'large', color: 'inherit' },
)

const variantMap: Record<string, TextVariant> = {
  large: 'headline-large',
  medium: 'headline-medium',
  small: 'headline-small',
}

const variant = computed(() => variantMap[props.size])
</script>

<template>
  <MText :variant="variant" weight="medium" :color="color" :align="align" :truncate="truncate">
    <slot />
  </MText>
</template>
