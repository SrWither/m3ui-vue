<script setup lang="ts">
/**
 * Zoom, fit and lock buttons over an MFlow, as an M3 floating toolbar (put it in MFlow's default slot). Undo and
 * redo with `history`. Not an M3 spec component.
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
}>(), {
  position: 'bottom-left',
  orientation: 'vertical',
  zoom: true,
  fit: true,
  lock: true,
  history: false,
})

const flow = useFlow()
const locale = useLocale()
const vertical = computed(() => props.orientation === 'vertical')
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
    <MIconButton
      v-if="lock"
      :icon="flow.locked.value ? 'lock' : 'lock_open'"
      :label="flow.locked.value ? locale.flowUnlock : locale.flowLock"
      @click="flow.locked.value = !flow.locked.value"
    />
    <slot />
  </div>
</template>
