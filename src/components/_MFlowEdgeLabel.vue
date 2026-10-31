<script setup lang="ts">
// An edge's label, in an HTML layer over the edges: a small chip at the path's middle (or MFlow's #edge-label)
import { computed, inject, type Slot } from 'vue'
import { FLOW_KEY, type FlowEdge } from '../composables/useFlow'
import { SlotOutlet } from '../composables/_flowSlot'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{ edge: FlowEdge; render?: Slot }>()

const flow = inject(FLOW_KEY)!
const geo = computed(() => flow.edgeGeometry(props.edge))
const selected = computed(() => flow.selectedEdges.value.has(props.edge.id))
// A selected edge offers a delete button beside its label (or alone): the way to disconnect on touch
const deletable = computed(() => selected.value && props.edge.deletable !== false && !flow.locked.value)
const locale = useLocale()
// A press on it deletes through MFlow's own pointerdown; its click is only for the keyboard (detail 0). The tap that
// selects the edge makes it appear right under the finger, and that touch's click lands on it when it lifts
function onClick(e: MouseEvent) {
  if (e.detail === 0) flow.remove({ edges: [props.edge.id] })
}
const TONES = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
}
</script>

<template>
  <div
    v-if="geo"
    class="m3-flow-edge-label absolute top-0 left-0 cursor-pointer"
    :style="{ transform: `translate(${geo.labelX}px, ${geo.labelY}px) translate(-50%, -50%)` }"
    :data-flow-edge="edge.id"
  >
    <div class="flex items-center gap-1">
      <SlotOutlet v-if="render" :fn="render" :scope="{ edge, selected }" />
      <span
        v-else-if="edge.label"
        class="block rounded-sm px-2 py-0.5 text-label-medium whitespace-nowrap transition-colors"
        :class="selected ? 'bg-secondary-container text-on-secondary-container' : TONES[edge.labelTone ?? 'neutral']"
      >{{ edge.label }}</span>
      <button
        v-if="deletable"
        type="button"
        class="m3-flow-edge-delete relative flex size-6 cursor-pointer items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant shadow-elevation-1 transition-colors outline-none before:absolute before:-inset-2 hover:bg-error-container hover:text-on-error-container focus-visible:ring-2 focus-visible:ring-secondary"
        :data-flow-edge-delete="edge.id"
        :aria-label="locale.flowDeleteEdge"
        @click="onClick"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
      </button>
    </div>
  </div>
</template>
