<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    inline?: boolean
  }>(),
  { inline: false },
)

const classes = computed(() => [
  props.inline ? 'inline-flex' : 'flex',
  'items-center justify-center',
])
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
