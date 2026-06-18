<script setup lang="ts">
import MIcon from './MIcon.vue'

withDefaults(defineProps<{ icon?: string }>(), {})
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-body-large text-on-surface hover:bg-on-surface/8"
  >
    <MIcon v-if="icon" :name="icon" :size="20" class="text-on-surface-variant" />
    <slot />
  </button>
</template>
