<script setup lang="ts">
withDefaults(defineProps<{
  vertical?: boolean
  label?: string
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
