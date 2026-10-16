<script setup lang="ts">
/**
 * A thin separator line, horizontal or vertical, with an optional centered label.
 */
withDefaults(defineProps<{
  /** Render as a vertical divider (fills the height of a flex container) */
  vertical?: boolean
  /** Text label in the middle of the divider (horizontal only) */
  label?: string
  /** Add left margin (ml-16) to align with content that has a leading icon */
  inset?: boolean
}>(), { vertical: false, inset: false })
</script>

<template>
  <div
    v-if="!vertical"
    class="flex items-center gap-3"
    :class="inset && 'ml-16'"
    role="separator"
  >
    <div class="h-px flex-1 bg-outline-variant" />
    <span v-if="label" class="shrink-0 text-label-small text-on-surface-variant">{{ label }}</span>
    <div v-if="label" class="h-px flex-1 bg-outline-variant" />
  </div>

  <div
    v-else
    class="w-px self-stretch bg-outline-variant"
    role="separator"
  />
</template>
