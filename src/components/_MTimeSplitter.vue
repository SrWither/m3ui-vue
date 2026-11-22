<script setup lang="ts">
// The divider between MGantt's / MResourceTimeline's list and timeline: a line always there (the list's border),
// with a grip centered in the view, both primary while hovered, focused or dragged. Wider for a finger. Its
// listeners (pointerdown, keys, dblclick) fall through from the parent.
defineProps<{
  label: string
  value: number
  active: boolean
  /** Where the grip's center sits, px from the body's top (the middle of what's in view) */
  gripTop: number
}>()
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-valuenow="value"
    tabindex="0"
    class="group/split absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none outline-none pointer-coarse:-right-3 pointer-coarse:w-6"
  >
    <span
      class="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors duration-150 group-hover/split:bg-primary group-focus-visible/split:bg-primary"
      :class="active ? 'bg-primary' : 'bg-transparent'"
    />
    <span
      class="pointer-events-none absolute left-1/2 flex h-8 w-3 -translate-1/2 flex-col items-center justify-center gap-[3px] rounded-full border transition-colors duration-150 pointer-coarse:h-10 pointer-coarse:w-4"
      :class="active
        ? 'border-primary bg-primary text-on-primary'
        : 'border-outline-variant bg-surface-container-high text-on-surface-variant group-hover/split:border-primary group-hover/split:bg-primary group-hover/split:text-on-primary group-focus-visible/split:border-primary group-focus-visible/split:bg-primary group-focus-visible/split:text-on-primary'"
      :style="{ top: `${gripTop}px` }"
    >
      <span v-for="i in 3" :key="i" class="size-[3px] rounded-full bg-current" />
    </span>
  </div>
</template>
