<script setup lang="ts">
/**
 * A toolbar for an MGantt or an MResourceTimeline (put it in their default slot): the zoom as named scales, zoom in
 * and out, today, expand and collapse all, undo and redo. Not an M3 spec component.
 *
 * @slot default More controls at the start
 * @slot end More controls at the end
 */
import { computed, inject } from 'vue'
import { TIMELINE_CONTROLS_KEY, type GanttScale } from '../composables/useGantt'
import { useLocale } from '../composables/useLocale'
import MIconButton from './MIconButton.vue'
import MSegmentedButton from './MSegmentedButton.vue'

const props = withDefaults(defineProps<{
  /** The scales offered as a segmented button (`[]` hides it) */
  scales?: GanttScale[]
  zoom?: boolean
  today?: boolean
  /** Expand all / collapse all */
  fold?: boolean
  /** Undo and redo */
  history?: boolean
}>(), {
  scales: () => ['day', 'week', 'month', 'quarter'],
  zoom: true,
  today: true,
  fold: true,
  history: true,
})

const injected = inject(TIMELINE_CONTROLS_KEY, null)
if (!injected) throw new Error('MGanttControls must be inside <MGantt> or <MResourceTimeline>')
const gantt = injected
const locale = useLocale()
const NAMES: Record<GanttScale, keyof typeof locale> = {
  hour: 'ganttScaleHour',
  day: 'ganttScaleDay',
  week: 'ganttScaleWeek',
  month: 'ganttScaleMonth',
  quarter: 'ganttScaleQuarter',
  year: 'ganttScaleYear',
}
const options = computed(() => props.scales.map((s) => ({ value: s, label: locale[NAMES[s]] as string })))
</script>

<template>
  <div class="m3-gantt-controls flex flex-wrap items-center gap-2 border-b border-outline-variant px-3 py-2" role="toolbar">
    <slot />
    <MSegmentedButton
      v-if="options.length"
      :model-value="gantt.scale.value"
      :options="options"
      density="compact"
      @update:model-value="gantt.setScale($event as GanttScale)"
    />
    <div class="flex items-center">
      <template v-if="zoom">
        <MIconButton icon="zoom_out" :label="locale.ganttZoomOut" @click="gantt.zoomOut()" />
        <MIconButton icon="zoom_in" :label="locale.ganttZoomIn" @click="gantt.zoomIn()" />
      </template>
      <MIconButton v-if="today" icon="today" :label="locale.ganttToday" @click="gantt.scrollToDate()" />
      <MIconButton
        v-if="fold && gantt.foldable.value"
        :icon="gantt.folded.value ? 'unfold_more' : 'unfold_less'"
        :label="gantt.folded.value ? locale.ganttExpandAll : locale.ganttCollapseAll"
        @click="gantt.folded.value ? gantt.expandAll() : gantt.collapseAll()"
      />
      <template v-if="history && !gantt.readonly.value">
        <MIconButton icon="undo" :label="locale.ganttUndo" :disabled="!gantt.canUndo.value" @click="gantt.undo()" />
        <MIconButton icon="redo" :label="locale.ganttRedo" :disabled="!gantt.canRedo.value" @click="gantt.redo()" />
      </template>
    </div>
    <div class="flex-1" />
    <slot name="end" />
  </div>
</template>
