<script setup lang="ts">
/**
 * A loading placeholder shape — text, circular, rectangular, or rounded — with pulse or wave animation.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Skeleton shape */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  /** CSS width (defaults to 100%, or 40px for circular) */
  width?: string
  /** CSS height (defaults to 14px for text, 40px for circular, 100px otherwise) */
  height?: string
  /** Number of text lines (text variant only) — the last line renders at 60% width */
  lines?: number
  /** Animation style */
  animation?: 'pulse' | 'wave' | 'none'
  /**
   * Corner radius: an M3 shape step (`none`, `xs` 4px, `sm` 8px, `md` 12px, `lg` 16px, `xl` 28px, `full`) or any CSS
   * length, to match the card or thumbnail it stands in for. Defaults to the variant's (a Tailwind `rounded-*` class
   * works too)
   */
  radius?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | (string & {})
}>(), {
  variant: 'text',
  animation: 'pulse',
  lines: 1,
})

const STEPS: Record<string, string> = { none: '0', full: '9999px' }
const borderRadius = computed(() => {
  const r = props.radius
  if (!r) return undefined
  return STEPS[r] ?? (/^(xs|sm|md|lg|xl)$/.test(r) ? `var(--radius-${r})` : r)
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
      :style="{ width: i === lines ? '60%' : (width ?? '100%'), borderRadius }"
    />
  </div>

  <!-- Single element -->
  <div
    v-else
    class="m3-skeleton bg-on-surface/10"
    :class="[
      `m3-skeleton-${variant}`,
      animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'skeleton-wave' : '',
    ]"
    :style="{ width, height, borderRadius }"
  />
</template>

<style>
/* Default size and corners in the base layer, so a consumer's w-40, aspect-video or rounded-xl wins */
@layer base {
  .m3-skeleton { width: 100%; height: 100px; border-radius: var(--radius-sm); }
  .m3-skeleton-rounded { border-radius: var(--radius-lg); }
  .m3-skeleton-text { height: 14px; border-radius: 9999px; }
  .m3-skeleton-circular { width: 40px; height: 40px; border-radius: 9999px; }
}
</style>

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
