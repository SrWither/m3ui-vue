<script setup lang="ts">
/**
 * Zoom, fit and lock buttons over an MFlow, as an M3 floating toolbar (put it in MFlow's default slot). Undo and
 * redo with `history`; a delete button shows while something deletable is selected (`delete`). Not an M3 spec component.
 *
 * @slot default More buttons at the end
 */
import { computed } from 'vue'
import { useFlow } from '../composables/useFlow'
import { panelPositionClass, type FlowPanelPosition } from '../composables/_flowPanel'
import { useLocale } from '../composables/useLocale'
import MIconButton from './MIconButton.vue'

const props = withDefaults(defineProps<{
  position?: FlowPanelPosition
  orientation?: 'vertical' | 'horizontal'
  zoom?: boolean
  fit?: boolean
  lock?: boolean
  /** Undo and redo buttons */
  history?: boolean
  /** A delete button while something deletable is selected (touch has no Delete key) */
  delete?: boolean
}>(), {
  position: 'bottom-left',
  orientation: 'vertical',
  zoom: true,
  fit: true,
  lock: true,
  history: false,
  delete: true,
})

const flow = useFlow()
const locale = useLocale()
const vertical = computed(() => props.orientation === 'vertical')
const deletable = computed(() => {
  const s = flow.selection.value
  return {
    nodes: s.nodes.filter((id) => flow.getNode(id)?.deletable !== false),
    edges: s.edges.filter((id) => flow.edges.value.find((e) => e.id === id)?.deletable !== false),
  }
})
const canDelete = computed(() => props.delete && !flow.locked.value && (deletable.value.nodes.length + deletable.value.edges.length > 0))
</script>

<template>
  <div
    class="m3-flow-controls absolute z-20 m-4 flex gap-1 rounded-full bg-surface-container p-1 shadow-elevation-3"
    :class="[panelPositionClass[position], vertical ? 'flex-col' : 'flex-row']"
    role="toolbar"
    :aria-orientation="orientation"
  >
    <template v-if="zoom">
      <MIconButton icon="add" :label="locale.flowZoomIn" :disabled="flow.viewport.value.zoom >= flow.maxZoom.value - 0.001" @click="flow.zoomIn()" />
      <MIconButton icon="remove" :label="locale.flowZoomOut" :disabled="flow.viewport.value.zoom <= flow.minZoom.value + 0.001" @click="flow.zoomOut()" />
    </template>
    <MIconButton v-if="fit" icon="fit_screen" :label="locale.flowFitView" @click="flow.fitView()" />
    <template v-if="history">
      <MIconButton icon="undo" :label="locale.flowUndo" :disabled="!flow.canUndo.value" @click="flow.undo()" />
      <MIconButton icon="redo" :label="locale.flowRedo" :disabled="!flow.canRedo.value" @click="flow.redo()" />
    </template>
    <!-- The toolbar grows to make room for it instead of jumping -->
    <Transition :name="vertical ? 'm3-flow-ctl-v' : 'm3-flow-ctl-h'">
      <MIconButton v-if="canDelete" icon="delete" :label="locale.flowDelete" color="error" @click="flow.remove(deletable)" />
    </Transition>
    <MIconButton
      v-if="lock"
      :icon="flow.locked.value ? 'lock' : 'lock_open'"
      :label="flow.locked.value ? locale.flowUnlock : locale.flowLock"
      @click="flow.locked.value = !flow.locked.value"
    />
    <slot />
  </div>
</template>

<style>
.m3-flow-ctl-v-enter-active,
.m3-flow-ctl-v-leave-active,
.m3-flow-ctl-h-enter-active,
.m3-flow-ctl-h-leave-active {
  overflow: hidden;
  transition: max-height 300ms cubic-bezier(0.2, 0, 0, 1), max-width 300ms cubic-bezier(0.2, 0, 0, 1), margin 300ms cubic-bezier(0.2, 0, 0, 1), scale 300ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms linear;
}
.m3-flow-ctl-v-enter-from,
.m3-flow-ctl-v-leave-to {
  max-height: 0;
  margin-top: -0.25rem;
  scale: 0.5;
  opacity: 0;
}
.m3-flow-ctl-v-enter-to,
.m3-flow-ctl-v-leave-from {
  max-height: 2.5rem;
}
.m3-flow-ctl-h-enter-from,
.m3-flow-ctl-h-leave-to {
  max-width: 0;
  margin-left: -0.25rem;
  scale: 0.5;
  opacity: 0;
}
.m3-flow-ctl-h-enter-to,
.m3-flow-ctl-h-leave-from {
  max-width: 2.5rem;
}
@media (prefers-reduced-motion: reduce) {
  .m3-flow-ctl-v-enter-active, .m3-flow-ctl-v-leave-active, .m3-flow-ctl-h-enter-active, .m3-flow-ctl-h-leave-active { transition: none; }
}
</style>
