<script setup lang="ts">
/**
 * Renders a single emoji character at a fixed pixel size, with optional accessible labeling.
 */
const props = withDefaults(
  defineProps<{
    /** The emoji character to display — required */
    emoji: string
    /** Size in pixels (sets font-size, width, and height) */
    size?: number
    /** Accessible label — when set, adds role="img" and aria-label */
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
