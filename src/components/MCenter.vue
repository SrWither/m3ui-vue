<script setup lang="ts">
/**
 * Centers its children both horizontally and vertically.
 *
 * @slot default Content, centered.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Use inline-flex instead of flex */
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
