<script setup lang="ts">
/**
 * A line between groups of items in an MMenu or MContextMenu; with `gap` in an expressive menu it splits the
 * menu into separate rounded groups.
 */
withDefaults(
  defineProps<{
    /**
     * Marks this as a group boundary for `MMenu`/`MContextMenu`'s
     * `variant="expressive"` — instead of rendering this divider in place,
     * the parent menu splits its panel into two independently-rounded group
     * boxes with a small gap between them. Has no effect outside an
     * `expressive` menu, where it renders as a normal divider line.
     */
    gap?: boolean
  }>(),
  { gap: false },
)
</script>

<template>
  <hr class="my-1 border-outline-variant" />
</template>
