<script setup lang="ts">
/**
 * A toolbar for an MGantt or an MResourceTimeline (put it in their default slot): show / hide the task list (MGantt),
 * the zoom as named scales, zoom in and out, fit everything, today, expand and collapse all, undo and redo. With a
 * finger (`pointer: coarse`) its icon buttons are 48 px. Not an M3 spec component.
 *
 * @slot default More controls at the start
 * @slot end More controls at the end
 */
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { TIMELINE_CONTROLS_KEY, type GanttScale } from '../composables/useGantt'
import { useLocale } from '../composables/useLocale'
import MIconButton from './MIconButton.vue'
import MSegmentedButton from './MSegmentedButton.vue'

const props = withDefaults(defineProps<{
  /** The scales offered as a segmented button (`[]` hides it) */
  scales?: GanttScale[]
  zoom?: boolean
  /** A button that zooms and scrolls so every task fits the width */
  fit?: boolean
  /** A button that shows / hides MGantt's task list */
  list?: boolean
  today?: boolean
  /** Expand all / collapse all */
  fold?: boolean
  /** Undo and redo */
  history?: boolean
}>(), {
  scales: () => ['day', 'week', 'month', 'quarter'],
  zoom: true,
  fit: true,
  list: true,
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
// 48 px targets for a finger
const coarse = ref(false)
let mq: MediaQueryList | undefined
const onMq = () => { coarse.value = !!mq?.matches }
onMounted(() => {
  mq = window.matchMedia?.('(pointer: coarse)')
  onMq()
  mq?.addEventListener?.('change', onMq)
})
onBeforeUnmount(() => mq?.removeEventListener?.('change', onMq))
const size = computed(() => (coarse.value ? 48 : 'sm'))
const showList = computed(() => props.list && !!gantt.hasList?.value && !!gantt.setGridCollapsed)
const options = computed(() => props.scales.map((s) => ({ value: s, label: locale[NAMES[s]] as string })))
</script>

<template>
  <div class="m3-gantt-controls flex flex-wrap items-center gap-2 border-b border-outline-variant px-3 py-2" role="toolbar">
    <MIconButton
      v-if="showList"
      :size="size"
      :icon="gantt.gridCollapsed!.value ? 'left_panel_open' : 'left_panel_close'"
      :label="gantt.gridCollapsed!.value ? locale.ganttShowList : locale.ganttHideList"
      @click="gantt.setGridCollapsed!(!gantt.gridCollapsed!.value)"
    />
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
        <MIconButton :size="size" icon="zoom_out" :label="locale.ganttZoomOut" @click="gantt.zoomOut()" />
        <MIconButton :size="size" icon="zoom_in" :label="locale.ganttZoomIn" @click="gantt.zoomIn()" />
      </template>
      <MIconButton v-if="fit" :size="size" icon="fit_width" :label="locale.ganttFit" @click="gantt.fit()" />
      <MIconButton v-if="today" :size="size" icon="today" :label="locale.ganttToday" @click="gantt.scrollToDate()" />
      <MIconButton
        v-if="fold && gantt.foldable.value"
        :size="size"
        :icon="gantt.folded.value ? 'unfold_more' : 'unfold_less'"
        :label="gantt.folded.value ? locale.ganttExpandAll : locale.ganttCollapseAll"
        @click="gantt.folded.value ? gantt.expandAll() : gantt.collapseAll()"
      />
      <template v-if="history && !gantt.readonly.value">
        <MIconButton :size="size" icon="undo" :label="locale.ganttUndo" :disabled="!gantt.canUndo.value" @click="gantt.undo()" />
        <MIconButton :size="size" icon="redo" :label="locale.ganttRedo" :disabled="!gantt.canRedo.value" @click="gantt.redo()" />
      </template>
    </div>
    <div class="flex-1" />
    <slot name="end" />
  </div>
</template>
