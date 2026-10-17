<script setup lang="ts">
/**
 * Renders a Material Symbols Outlined glyph by name. Color follows the surrounding text color (set it with a
 * Tailwind text-* class).
 */
withDefaults(defineProps<{
  /** Material Symbol name (e.g. "settings", "favorite") */
  name: string
  /** Icon size in px */
  size?: number
  /** Filled glyph (the Material Symbols FILL axis), as M3 draws a selected icon */
  filled?: boolean
}>(), { size: 24, filled: false })
</script>

<template>
  <span class="material-symbols-outlined leading-none" :style="{ fontSize: `${size}px`, fontVariationSettings: filled ? `'FILL' 1` : undefined }">{{
    name
  }}</span>
</template>
