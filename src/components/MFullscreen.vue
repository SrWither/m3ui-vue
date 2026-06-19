<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    fixed?: boolean
    zIndex?: number
  }>(),
  { fixed: true, zIndex: 50 },
)

const style = computed(() => ({
  position: (props.fixed ? 'fixed' : 'absolute') as 'fixed' | 'absolute',
  inset: '0',
  zIndex: props.zIndex,
}))
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
