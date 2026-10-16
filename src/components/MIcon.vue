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
}>(), { size: 24 })
</script>

<template>
  <span class="material-symbols-outlined leading-none" :style="{ fontSize: `${size}px` }">{{
    name
  }}</span>
</template>
