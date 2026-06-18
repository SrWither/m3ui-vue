<script setup lang="ts">
import MIcon from './MIcon.vue'

withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  compact?: boolean
}>(), { icon: 'inbox' })
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center"
    :class="compact ? 'gap-2 py-6' : 'gap-3 py-14'"
  >
    <div
      class="flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
      :class="compact ? 'h-12 w-12' : 'h-16 w-16'"
    >
      <MIcon :name="icon" :size="compact ? 24 : 32" />
    </div>
    <h3
      class="font-medium text-on-surface"
      :class="compact ? 'text-title-small' : 'text-title-medium'"
    >
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="max-w-sm text-on-surface-variant"
      :class="compact ? 'text-body-small' : 'text-body-medium'"
    >
      {{ description }}
    </p>
    <div v-if="$slots.actions" :class="compact ? 'mt-1' : 'mt-2'">
      <slot name="actions" />
    </div>
  </div>
</template>
