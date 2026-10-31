<script lang="ts">
import type { FloorTable } from './MFloorPlan.vue'
/** A table offered by the toolbar's Add a table menu */
export type FloorTablePreset = Partial<FloorTable> & { name?: string }
</script>

<script setup lang="ts">
/**
 * A toolbar for editing an MFloorPlan: move / draw a wall / drag out a zone, add a table (your presets) or decor (any
 * kind, yours too), duplicate, delete, undo and redo. Inside the plan's `#overlay` slot it finds the plan by itself;
 * anywhere else, pass the plan's template ref as `plan`. Not an M3 spec component.
 *
 * @slot default More controls at the start
 * @slot end More controls at the end
 */
import { computed, inject } from 'vue'
import { FLOOR_PLAN_KEY, floorDecorName, type FloorPlanContext } from '../composables/useFloorPlan'
import { useLocale } from '../composables/useLocale'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MMenu from './MMenu.vue'
import MMenuItem from './MMenuItem.vue'
import MSegmentedButton from './MSegmentedButton.vue'
import MTooltip from './MTooltip.vue'

const props = withDefaults(defineProps<{
  /** The plan: its template ref (or its `context`). Not needed inside the plan's slots */
  plan?: { context: FloorPlanContext } | FloorPlanContext | null
  /** Tables offered by Add a table (name, shape, seats, size…) */
  tables?: FloorTablePreset[]
  /** Decor kinds offered (default: every kind the plan knows, yours included) */
  decor?: string[]
  /** Move / wall / zone */
  tools?: boolean
  /** Undo and redo */
  history?: boolean
}>(), {
  plan: null,
  tables: () => [
    { shape: 'round', seats: 2 },
    { shape: 'round', seats: 4 },
    { shape: 'square', seats: 4 },
    { shape: 'rect', seats: 6 },
  ],
  tools: true,
  history: true,
})

const injected = inject(FLOOR_PLAN_KEY, null)
const ctx = computed<FloorPlanContext | null>(() => {
  const p = props.plan
  if (p && 'context' in p) return p.context
  return (p as FloorPlanContext | null) ?? injected
})
const locale = useLocale()
const decorKinds = computed(() => {
  const all = ctx.value?.kinds.value ?? {}
  return (props.decor ?? Object.keys(all)).filter((k) => all[k]).map((k) => ({
    kind: k,
    icon: all[k]!.icon ?? (all[k]!.shape === 'round' ? 'circle' : all[k]!.shape === 'text' ? 'title' : 'crop_square'),
    name: floorDecorName(k, all, locale),
  }))
})
const shapeName = (s?: FloorTable['shape']) => (s === 'round' ? locale.floorRound : s === 'rect' ? locale.floorLong : locale.floorSquare)
const presetName = (p: FloorTablePreset) => p.name ?? `${shapeName(p.shape)} · ${p.seats ?? 4}`
const presetIcon = (p: FloorTablePreset) => (p.shape === 'round' ? 'circle' : p.shape === 'rect' ? 'rectangle' : 'square')
const canDelete = computed(() => !!ctx.value && (!!ctx.value.picked.value || ctx.value.selection.value.length > 0))
const canDuplicate = computed(() => !!ctx.value && (ctx.value.selection.value.length > 0 || (!!ctx.value.picked.value && ctx.value.picked.value.kind !== 'wall')))
function add(p: FloorTablePreset) {
  const { name: _n, ...t } = p
  ctx.value?.addTable(t)
}
</script>

<template>
  <div v-if="ctx" class="m3-floor-plan-toolbar flex flex-wrap items-center gap-1 px-2 py-1" role="toolbar" :aria-label="locale.floorTools">
    <slot />
    <MSegmentedButton
      v-if="tools"
      :model-value="ctx.tool.value"
      :options="[
        { value: 'select', label: locale.floorMove, icon: 'open_with' },
        { value: 'wall', label: locale.floorDrawWall, icon: 'timeline' },
        { value: 'area', label: locale.floorDrawZone, icon: 'crop_square' },
      ]"
      density="compact"
      @update:model-value="ctx.tool.value = $event as 'select' | 'wall' | 'area'"
    />
    <template v-if="ctx.drawingWall.value">
      <MTooltip :text="locale.floorFinishWall" placement="top"><MIconButton icon="check" variant="filled" :label="locale.floorFinishWall" @click="ctx.finishWall()" /></MTooltip>
      <MTooltip :text="locale.floorCancel" placement="top"><MIconButton icon="close" :label="locale.floorCancel" @click="ctx.cancelWall()" /></MTooltip>
    </template>
    <MMenu>
      <template #trigger>
        <MTooltip :text="locale.floorAddTable" placement="top"><MIconButton icon="table_restaurant" :label="locale.floorAddTable" /></MTooltip>
      </template>
      <MMenuItem v-for="(p, i) in tables" :key="i" :icon="presetIcon(p)" @click="add(p)">{{ presetName(p) }}</MMenuItem>
    </MMenu>
    <MMenu v-if="decorKinds.length">
      <template #trigger>
        <MTooltip :text="locale.floorAddDecor" placement="top"><MIconButton icon="chair" :label="locale.floorAddDecor" /></MTooltip>
      </template>
      <MMenuItem v-for="d in decorKinds" :key="d.kind" @click="ctx.addDecor(d.kind)">
        <template #icon><MIcon :name="d.icon" /></template>
        {{ d.name }}
      </MMenuItem>
    </MMenu>
    <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
    <MTooltip :text="locale.floorDuplicate" placement="top"><MIconButton icon="content_copy" :label="locale.floorDuplicate" :disabled="!canDuplicate" @click="ctx.duplicate()" /></MTooltip>
    <MTooltip :text="locale.floorDelete" placement="top"><MIconButton icon="delete" :label="locale.floorDelete" :disabled="!canDelete" @click="ctx.removeSelected()" /></MTooltip>
    <template v-if="history">
      <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
      <MTooltip :text="locale.floorUndo" placement="top"><MIconButton icon="undo" :label="locale.floorUndo" :disabled="!ctx.canUndo.value" @click="ctx.undo()" /></MTooltip>
      <MTooltip :text="locale.floorRedo" placement="top"><MIconButton icon="redo" :label="locale.floorRedo" :disabled="!ctx.canRedo.value" @click="ctx.redo()" /></MTooltip>
    </template>
    <slot name="end" />
  </div>
</template>

<style>
@layer base {
  .m3-floor-plan-toolbar {
    border-radius: 9999px;
    background-color: var(--color-surface-container);
    color: var(--color-on-surface);
  }
}
</style>
