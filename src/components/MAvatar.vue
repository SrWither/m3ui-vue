<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 40 })

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
})
</script>

<template>
  <div
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-container font-medium text-on-primary-container"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` }"
  >
    {{ initials }}
  </div>
</template>
