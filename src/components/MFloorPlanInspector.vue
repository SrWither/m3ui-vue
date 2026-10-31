<script setup lang="ts">
/**
 * Edits what's picked on an MFloorPlan: a table (name, seats, shape, angle; split it if merged), several tables (merge
 * them), a zone (name, color), a wall (thickness, delete a corner) or decor (text, size, angle); duplicate and delete.
 * A slot per kind adds fields of your own below the built-in ones, with an `update` to change the item (an undo step).
 * Inside the plan's `#overlay` slot it finds the plan by itself; anywhere else, pass the plan's template ref as `plan`.
 * Not an M3 spec component.
 *
 * @slot table Below a table's fields: `{ table, update }`
 * @slot tables Below several picked tables: `{ ids }`
 * @slot area Below a zone's fields: `{ area, update }`
 * @slot wall Below a wall's fields: `{ wall, update }`
 * @slot decor Below a decor item's fields: `{ item, kind, update }`
 * @slot empty When nothing is picked
 */
import { computed, inject } from 'vue'
import { FLOOR_PLAN_KEY, floorDecorName, type FloorPlanContext } from '../composables/useFloorPlan'
import { useLocale } from '../composables/useLocale'
import type { FloorArea, FloorDecor, FloorTable, FloorWall } from './MFloorPlan.vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import MNumberField from './MNumberField.vue'
import MSegmentedButton from './MSegmentedButton.vue'
import MSlider from './MSlider.vue'
import MTextField from './MTextField.vue'

const props = withDefaults(defineProps<{
  /** The plan: its template ref (or its `context`). Not needed inside the plan's slots */
  plan?: { context: FloorPlanContext } | FloorPlanContext | null
  /** Colors offered for zones: M3 color roles or CSS colors */
  zoneColors?: string[]
  /** Merge and split buttons */
  merging?: boolean
}>(), {
  plan: null,
  zoneColors: () => ['secondary', 'tertiary', 'primary', 'success', 'error'],
  merging: true,
})

const injected = inject(FLOOR_PLAN_KEY, null)
const ctx = computed<FloorPlanContext | null>(() => {
  const p = props.plan
  if (p && 'context' in p) return p.context
  return (p as FloorPlanContext | null) ?? injected
})
const locale = useLocale()

const table = computed(() => {
  const c = ctx.value
  if (!c || c.picked.value || c.selection.value.length !== 1) return undefined
  return c.tables.value.find((t) => t.id === c.selection.value[0])
})
const many = computed(() => (ctx.value && !ctx.value.picked.value && ctx.value.selection.value.length > 1 ? ctx.value.selection.value : null))
const area = computed(() => (ctx.value?.picked.value?.kind === 'area' ? ctx.value.areas.value.find((a) => a.id === ctx.value!.picked.value!.id) : undefined))
const wall = computed(() => (ctx.value?.picked.value?.kind === 'wall' ? ctx.value.walls.value.find((w) => w.id === ctx.value!.picked.value!.id) : undefined))
const vertex = computed(() => ctx.value?.picked.value?.vertex)
const item = computed(() => (ctx.value?.picked.value?.kind === 'decor' ? ctx.value.decor.value.find((d) => d.id === ctx.value!.picked.value!.id) : undefined))
const kind = computed(() => (item.value ? ctx.value!.kinds.value[item.value.kind] : undefined))
const mergeOf = computed(() => (table.value ? ctx.value!.merges.value.find((m) => m.tables.includes(table.value!.id)) : undefined))

const upTable = (p: Partial<FloorTable>) => ctx.value!.update('table', table.value!.id, p)
const upArea = (p: Partial<FloorArea>) => ctx.value!.update('area', area.value!.id, p)
const upWall = (p: Partial<FloorWall>) => ctx.value!.update('wall', wall.value!.id, p)
const upDecor = (p: Partial<FloorDecor>) => ctx.value!.update('decor', item.value!.id, p)
const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'success', 'surface'])
const swatch = (c: string) => (ROLES.has(c) ? `var(--color-${c})` : c)
function deleteCorner() {
  ctx.value!.removeSelected()
}
</script>

<template>
  <div v-if="ctx" class="m3-floor-plan-inspector flex flex-col gap-3">
    <!-- A table -->
    <template v-if="table">
      <div class="flex items-center gap-2 text-title-small"><MIcon name="table_restaurant" :size="18" />{{ locale.floorTableN.replace('{label}', table.label) }}</div>
      <div class="grid grid-cols-2 gap-3">
        <MTextField :model-value="table.label" :label="locale.floorLabel" variant="outlined" @update:model-value="upTable({ label: String($event) })" />
        <MNumberField :model-value="table.seats ?? 0" :label="locale.floorSeatsField" variant="outlined" :min="0" :max="40" @update:model-value="upTable({ seats: $event ?? 0, width: undefined, height: undefined })" />
      </div>
      <MSegmentedButton
        :model-value="table.shape ?? 'square'"
        :options="[{ value: 'round', label: locale.floorRound }, { value: 'square', label: locale.floorSquare }, { value: 'rect', label: locale.floorLong }]"
        density="compact"
        @update:model-value="upTable({ shape: $event as FloorTable['shape'], width: undefined, height: undefined })"
      />
      <div>
        <div class="text-label-medium text-on-surface-variant">{{ locale.floorAngle }} · {{ table.rotation ?? 0 }}°</div>
        <MSlider :model-value="table.rotation ?? 0" :min="0" :max="345" :step="15" :label="locale.floorAngle" @update:model-value="upTable({ rotation: $event as number })" />
      </div>
      <slot name="table" :table="table" :update="upTable" />
      <div class="flex flex-wrap gap-2">
        <MButton v-if="merging && mergeOf" variant="tonal" icon="call_split" @click="ctx.split(mergeOf.id)">{{ locale.floorSplit }} · {{ mergeOf.label }}</MButton>
        <MButton variant="text" icon="content_copy" @click="ctx.duplicate()">{{ locale.floorDuplicate }}</MButton>
        <MButton variant="text" color="error" icon="delete" @click="ctx.removeSelected()">{{ locale.floorDelete }}</MButton>
      </div>
    </template>

    <!-- Several tables -->
    <template v-else-if="many">
      <div class="flex items-center gap-2 text-title-small"><MIcon name="select_all" :size="18" />{{ locale.floorTablesPicked.replace('{n}', String(many.length)) }}</div>
      <slot name="tables" :ids="many" />
      <div class="flex flex-wrap gap-2">
        <MButton v-if="merging" variant="tonal" icon="join" @click="ctx.merge(many)">{{ locale.floorMerge }}</MButton>
        <MButton variant="text" icon="content_copy" @click="ctx.duplicate()">{{ locale.floorDuplicate }}</MButton>
        <MButton variant="text" color="error" icon="delete" @click="ctx.removeSelected()">{{ locale.floorDelete }}</MButton>
      </div>
    </template>

    <!-- A zone -->
    <template v-else-if="area">
      <div class="flex items-center gap-2 text-title-small"><MIcon name="crop_square" :size="18" />{{ locale.floorZone }}</div>
      <MTextField :model-value="area.label ?? ''" :label="locale.floorLabel" variant="outlined" @update:model-value="upArea({ label: String($event) })" />
      <div>
        <div class="mb-1 text-label-medium text-on-surface-variant">{{ locale.floorColor }}</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in zoneColors"
            :key="c"
            type="button"
            class="size-8 rounded-full border border-outline-variant outline-offset-2"
            :class="(area.color ?? 'secondary') === c ? 'outline-2 outline-primary' : 'outline-2 outline-transparent'"
            :style="{ background: swatch(c) }"
            :aria-label="`${locale.floorColor} ${c}`"
            :aria-pressed="(area.color ?? 'secondary') === c"
            @click="upArea({ color: c })"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <MNumberField :model-value="Math.round(area.width)" :label="locale.floorWidth" variant="outlined" :min="10" @update:model-value="upArea({ width: $event ?? area.width })" />
        <MNumberField :model-value="Math.round(area.height)" :label="locale.floorHeight" variant="outlined" :min="10" @update:model-value="upArea({ height: $event ?? area.height })" />
      </div>
      <slot name="area" :area="area" :update="upArea" />
      <div class="flex flex-wrap gap-2">
        <MButton variant="text" icon="content_copy" @click="ctx.duplicate()">{{ locale.floorDuplicate }}</MButton>
        <MButton variant="text" color="error" icon="delete" @click="ctx.removeSelected()">{{ locale.floorDelete }}</MButton>
      </div>
    </template>

    <!-- A wall -->
    <template v-else-if="wall">
      <div class="flex items-center gap-2 text-title-small"><MIcon name="timeline" :size="18" />{{ locale.floorWall }}</div>
      <div>
        <div class="text-label-medium text-on-surface-variant">{{ locale.floorThickness }} · {{ wall.thickness ?? 8 }}</div>
        <MSlider :model-value="wall.thickness ?? 8" :min="2" :max="30" :step="1" :label="locale.floorThickness" @update:model-value="upWall({ thickness: $event as number })" />
      </div>
      <slot name="wall" :wall="wall" :update="upWall" />
      <div class="flex flex-wrap gap-2">
        <MButton v-if="vertex !== undefined && wall.points.length > 2" variant="tonal" icon="remove" @click="deleteCorner">{{ locale.floorDeleteCorner }}</MButton>
        <MButton variant="text" color="error" icon="delete" @click="ctx.picked.value = { kind: 'wall', id: wall.id }; ctx.removeSelected()">{{ locale.floorDelete }}</MButton>
      </div>
    </template>

    <!-- Decor -->
    <template v-else-if="item">
      <div class="flex items-center gap-2 text-title-small"><MIcon :name="kind?.icon ?? 'category'" :size="18" />{{ floorDecorName(item.kind, ctx.kinds.value, locale) }}</div>
      <MTextField :model-value="item.label ?? ''" :label="locale.floorLabel" variant="outlined" @update:model-value="upDecor({ label: String($event) || undefined })" />
      <div class="grid grid-cols-2 gap-3">
        <MNumberField :model-value="Math.round(item.width ?? kind?.width ?? 40)" :label="locale.floorWidth" variant="outlined" :min="4" @update:model-value="upDecor({ width: $event ?? undefined })" />
        <MNumberField :model-value="Math.round(item.height ?? kind?.height ?? 40)" :label="locale.floorHeight" variant="outlined" :min="4" @update:model-value="upDecor({ height: $event ?? undefined })" />
      </div>
      <div>
        <div class="text-label-medium text-on-surface-variant">{{ locale.floorAngle }} · {{ item.rotation ?? 0 }}°</div>
        <MSlider :model-value="item.rotation ?? 0" :min="0" :max="345" :step="15" :label="locale.floorAngle" @update:model-value="upDecor({ rotation: $event as number })" />
      </div>
      <slot name="decor" :item="item" :kind="kind" :update="upDecor" />
      <div class="flex flex-wrap gap-2">
        <MButton variant="text" icon="content_copy" @click="ctx.duplicate()">{{ locale.floorDuplicate }}</MButton>
        <MButton variant="text" color="error" icon="delete" @click="ctx.removeSelected()">{{ locale.floorDelete }}</MButton>
      </div>
    </template>

    <slot v-else name="empty">
      <p class="text-body-small text-on-surface-variant">{{ locale.floorNothingPicked }}</p>
    </slot>
  </div>
</template>
