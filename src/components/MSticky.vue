<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    top?: string | number
    zIndex?: number
  }>(),
  { top: 0, zIndex: 40 },
)

function toUnit(v: string | number) {
  return typeof v === 'number' ? `${v}px` : v
}

const style = computed(() => ({
  position: 'sticky' as const,
  top: toUnit(props.top),
  zIndex: props.zIndex,
}))
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
