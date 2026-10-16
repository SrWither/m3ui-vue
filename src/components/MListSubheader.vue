<script setup lang="ts">
/**
 * A small heading that labels a group of items inside an MList.
 *
 * @slot default Subheader text/content
 */
withDefaults(
  defineProps<{
    /** Align with items that have a leading icon (adds left padding) */
    inset?: boolean
  }>(),
  { inset: false },
)
</script>

<template>
  <li
    class="px-4 pt-4 pb-2 text-label-medium font-medium text-on-surface-variant"
    :class="inset && 'pl-16'"
    role="presentation"
  >
    <slot />
  </li>
</template>
