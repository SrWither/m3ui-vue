<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    emoji: string
    size?: number
    label?: string
  }>(),
  { size: 24 },
)
</script>

<template>
  <span
    class="inline-flex items-center justify-center leading-none"
    :style="{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }"
    :aria-label="label"
    :role="label ? 'img' : undefined"
  >{{ emoji }}</span>
</template>
