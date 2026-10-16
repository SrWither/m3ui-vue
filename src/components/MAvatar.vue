<script setup lang="ts">
/**
 * A circular initials avatar. There's no image-source prop — it always renders extracted initials or a fallback
 * string, never a photo.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Full name — initials are extracted automatically (first + last). Takes priority over fallback */
  name?: string
  /** Custom text shown when name is not provided (e.g. 'AJ'). Falls back to '?' if neither is set */
  fallback?: string
  /** Avatar size in px — also scales the font size proportionally (40%) */
  size?: number
}>(), { size: 40 })

const initials = computed(() => {
  if (props.name) {
    const parts = props.name.trim().split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
    return (first + last).toUpperCase() || props.fallback || '?'
  }
  return props.fallback || '?'
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
