<script setup lang="ts">
/**
 * Renders a Material Symbols Outlined glyph by name. Color follows the surrounding text color (set it with a
 * Tailwind text-* class). Decorative by default: hidden from assistive technology, which would otherwise read the
 * glyph's ligature text (its name, e.g. "arrow_drop_down"). Give it a `label` when the icon says something on its own.
 */
withDefaults(defineProps<{
  /** Material Symbol name (e.g. "settings", "favorite") */
  name: string
  /** Icon size in px */
  size?: number
  /** Filled glyph (the Material Symbols FILL axis), as M3 draws a selected icon */
  filled?: boolean
  /** What the icon means, when nothing next to it says so: makes it an image with this name instead of decoration */
  label?: string
}>(), { size: 24, filled: false })
</script>

<template>
  <span
    class="material-symbols-outlined leading-none"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :style="{ fontSize: `${size}px`, fontVariationSettings: filled ? `'FILL' 1` : undefined }"
  >{{ name }}</span>
</template>
