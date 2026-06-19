<script setup lang="ts">
import { computed } from 'vue'
import MText from './MText.vue'
import type { TextVariant } from './MText.vue'

const props = withDefaults(
  defineProps<{
    size?: 'large' | 'medium' | 'small'
    color?: 'on-surface' | 'on-surface-variant' | 'primary' | 'secondary' | 'tertiary' | 'error' | 'inherit'
    align?: 'left' | 'center' | 'right'
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
