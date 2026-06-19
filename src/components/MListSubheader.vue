<script setup lang="ts">
withDefaults(
  defineProps<{
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
