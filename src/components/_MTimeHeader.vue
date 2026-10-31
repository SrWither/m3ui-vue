<script setup lang="ts">
// The timeline's two header rows (MGantt, MResourceTimeline): the coarser unit above, the finer below, and a dot
// for today
defineProps<{
  width: number
  topCells: { key: number; x: number; w: number; label: string; labelX: number }[]
  bottomCells: { key: number; x: number; w: number; label: string }[]
  todayX: number | null
}>()
</script>

<template>
  <div class="relative shrink-0 border-b border-outline-variant bg-surface-container-low" :style="{ width: `${width}px` }" aria-hidden="true">
    <div class="absolute inset-x-0 top-0 h-7">
      <div v-for="c in topCells" :key="c.key" class="absolute inset-y-0 border-l border-outline-variant/60" :style="{ left: `${c.x}px`, width: `${c.w}px` }">
        <span class="absolute top-1.5 truncate pl-2 text-label-medium whitespace-nowrap text-on-surface" :style="{ left: `${c.labelX}px` }">{{ c.label }}</span>
      </div>
    </div>
    <div class="absolute inset-x-0 bottom-0 h-7">
      <div
        v-for="c in bottomCells"
        :key="c.key"
        class="absolute inset-y-0 flex items-center justify-center overflow-hidden border-l border-outline-variant/60 text-label-small whitespace-nowrap text-on-surface-variant"
        :style="{ left: `${c.x}px`, width: `${c.w}px` }"
      >
        {{ c.label }}
      </div>
    </div>
    <div v-if="todayX !== null" class="absolute bottom-0 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary" :style="{ left: `${todayX}px` }" />
  </div>
</template>
