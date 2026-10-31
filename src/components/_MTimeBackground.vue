<script setup lang="ts">
// The timeline's background (MGantt, MResourceTimeline): shaded time off, a line per header cell, today's line
defineProps<{
  offTimes: { x: number; w: number }[]
  cells: { key: number; x: number }[]
  todayX: number | null
}>()
</script>

<template>
  <div class="pointer-events-none absolute inset-0">
    <div v-for="d in offTimes" :key="`o${d.x}`" class="absolute inset-y-0 bg-on-surface/4" :style="{ left: `${d.x}px`, width: `${d.w}px` }" />
    <div v-for="c in cells" :key="c.key" class="absolute inset-y-0 border-l border-outline-variant/40" :style="{ left: `${c.x}px` }" />
    <div v-if="todayX !== null" class="absolute inset-y-0 z-[1] w-0.5 -translate-x-1/2 bg-primary" :style="{ left: `${todayX}px` }" />
  </div>
</template>
