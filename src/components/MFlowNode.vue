<script setup lang="ts">
/**
 * MFlow's default node, also for `#node-<type>` slots of your own: an M3 card with an icon, a label and a
 * subtitle, and a handle on each side edges run through (target where they arrive, source where they leave; the
 * sides follow MFlow's `direction` or the node's `sourcePosition`/`targetPosition`). Selected it gets a primary
 * outline; lifted while dragged (elevation level 4, like MKanban's cards). Not an M3 spec component.
 *
 * @slot default Below the header, inside the card
 * @slot icon Instead of the `icon`
 * @slot trailing At the end of the header (a status, a menu button). Controls in it don't start a drag
 */
import { computed, inject } from 'vue'
import { FLOW_KEY, FLOW_NODE_KEY, type FlowPosition } from '../composables/useFlow'
import MFlowHandle from './MFlowHandle.vue'

const props = withDefaults(defineProps<{
  label?: string
  subtitle?: string
  /** Material Symbol */
  icon?: string
  variant?: 'outlined' | 'filled' | 'elevated'
  /** The icon container's color role */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral'
  /** Which handles it draws */
  handles?: 'both' | 'source' | 'target' | 'none'
  sourcePosition?: FlowPosition
  targetPosition?: FlowPosition
}>(), {
  variant: 'outlined',
  color: 'primary',
  handles: 'both',
})

const flow = inject(FLOW_KEY, null)
const state = inject(FLOW_NODE_KEY, null)
const selected = computed(() => state?.selected.value ?? false)
const dragging = computed(() => state?.dragging.value ?? false)
const sides = computed(() => {
  const n = state?.node.value
  const d = n && flow ? flow.sidePositions(n) : { source: 'right' as FlowPosition, target: 'left' as FlowPosition }
  return { source: props.sourcePosition ?? d.source, target: props.targetPosition ?? d.target }
})

const VARIANT = {
  outlined: 'bg-surface border-outline-variant',
  filled: 'bg-surface-container-highest border-transparent',
  elevated: 'bg-surface-container-low border-transparent shadow-elevation-1',
}
const ICON = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container-highest text-on-surface-variant',
}
</script>

<template>
  <div
    class="m3-flow-card rounded-md border text-on-surface transition-[box-shadow,border-color] duration-200"
    :class="[
      VARIANT[variant],
      selected && 'border-primary! ring-1 ring-primary',
      dragging ? 'shadow-elevation-4!' : variant === 'elevated' ? 'hover:shadow-elevation-2' : 'hover:shadow-elevation-1',
    ]"
  >
    <div class="flex items-center gap-3 p-3">
      <slot name="icon">
        <span v-if="icon" class="flex size-10 shrink-0 items-center justify-center rounded-sm" :class="ICON[color]">
          <span class="material-symbols-outlined text-[24px]" aria-hidden="true">{{ icon }}</span>
        </span>
      </slot>
      <div class="min-w-0 flex-1">
        <div v-if="label" class="truncate text-title-small">{{ label }}</div>
        <div v-if="subtitle" class="truncate text-body-small text-on-surface-variant">{{ subtitle }}</div>
      </div>
      <div v-if="$slots.trailing" class="shrink-0" data-flow-nodrag>
        <slot name="trailing" />
      </div>
    </div>
    <div v-if="$slots.default" class="px-3 pb-3">
      <slot />
    </div>
    <MFlowHandle v-if="state && (handles === 'both' || handles === 'target')" type="target" :position="sides.target" />
    <MFlowHandle v-if="state && (handles === 'both' || handles === 'source')" type="source" :position="sides.source" />
  </div>
</template>

<style>
/* Defaults in the base layer, so a width or position class of yours on the node wins */
@layer base {
  .m3-flow-card {
    position: relative;
    min-width: 11rem;
    max-width: 18rem;
  }
}
</style>
