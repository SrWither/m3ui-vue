<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    top?: string | number
    right?: string | number
    bottom?: string | number
    left?: string | number
    inset?: boolean
    zIndex?: number
  }>(),
  { inset: false, zIndex: 50 },
)

function toUnit(v: string | number | undefined) {
  if (v === undefined) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

const style = computed(() => ({
  position: 'fixed' as const,
  top: props.inset ? '0' : toUnit(props.top),
  right: props.inset ? '0' : toUnit(props.right),
  bottom: props.inset ? '0' : toUnit(props.bottom),
  left: props.inset ? '0' : toUnit(props.left),
  zIndex: props.zIndex,
}))
</script>

<template>
  <div :style="style">
    <slot />
  </div>
</template>
