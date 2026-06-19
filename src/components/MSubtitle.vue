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
