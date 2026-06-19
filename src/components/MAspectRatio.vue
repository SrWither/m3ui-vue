<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    ratio?: string | number
  }>(),
  { ratio: '16/9' },
)

const style = computed(() => ({
  aspectRatio: String(props.ratio),
}))
</script>

<template>
  <div class="relative overflow-hidden" :style="style">
    <slot />
  </div>
</template>
