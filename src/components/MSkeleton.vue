<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string
  height?: string
  lines?: number
  animation?: 'pulse' | 'wave' | 'none'
}>(), {
  variant: 'text',
  animation: 'pulse',
  lines: 1,
})
</script>

<template>
  <!-- Multi-line text skeleton -->
  <div v-if="variant === 'text' && lines > 1" class="flex flex-col gap-2.5">
    <div
      v-for="i in lines"
      :key="i"
      class="h-3.5 rounded-full bg-on-surface/10"
      :class="animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'skeleton-wave' : ''"
      :style="{ width: i === lines ? '60%' : (width ?? '100%') }"
    />
  </div>

  <!-- Single element -->
  <div
    v-else
    class="bg-on-surface/10"
    :class="[
      variant === 'circular' ? 'rounded-full' : variant === 'rounded' ? 'rounded-lg' : variant === 'text' ? 'rounded-full' : 'rounded-sm',
      animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'skeleton-wave' : '',
    ]"
    :style="{
      width: width ?? (variant === 'circular' ? '40px' : '100%'),
      height: height ?? (variant === 'circular' ? '40px' : variant === 'text' ? '14px' : '100px'),
    }"
  />
</template>

<style scoped>
@keyframes skeleton-wave-move {
  0%   { transform: translateX(-100%); }
  60%  { transform: translateX(100%); }
  100% { transform: translateX(100%); }
}
.skeleton-wave {
  position: relative;
  overflow: hidden;
}
.skeleton-wave::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, var(--color-on-surface) 50%, transparent 100%);
  opacity: 0.06;
  animation: skeleton-wave-move 1.8s ease-in-out infinite;
}
</style>
