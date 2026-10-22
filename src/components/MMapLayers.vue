<script setup lang="ts">
/**
 * The layer list of an `MMap` with an `adapter`: a search field, the style's groups (collapsible, with a visibility
 * toggle for the whole group and a count) and its layers, each with a visibility toggle and, expanded, its
 * description, an opacity slider, its legend and a download link. Only the content: put it in an `MWindow`, an
 * `MSideSheet`, an `MBottomSheet` or an `MMapControl`, inside the `MMap` or anywhere else with `map`. Available from the
 * `/map` entry point.
 *
 * @slot actions Extra actions in an expanded layer (scope: `{ layer, visible }`)
 */
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import MTextField from './MTextField.vue'
import MMapLayerItem from './_MMapLayerItem.vue'
import { useLocale } from '../composables/useLocale'
import { useMapLayers } from '../composables/useMapLayers'
import type { MapSource } from '../composables/useMap'
import type { MapLayerInfo } from '../composables/mapAdapters'

const props = withDefaults(
  defineProps<{
    /** Show the search field */
    search?: boolean
    /** Groups start collapsed */
    collapsed?: boolean
    /** The map, when this is outside it (a side panel): the `MMap`'s template ref */
    map?: MapSource
  }>(),
  { search: true, collapsed: false },
)

const t = useLocale()
const { model, layersOf, isVisible, groupState, setGroupVisible } = useMapLayers(() => props.map)

const query = ref('')
const matches = (layer: MapLayerInfo) => !query.value || layer.title.toLowerCase().includes(query.value.toLowerCase())

const groups = computed(() =>
  (model.value?.groups ?? [])
    .map((g) => ({ ...g, all: layersOf(g.name), layers: layersOf(g.name).filter(matches) }))
    .filter((g) => g.layers.length),
)
const ungrouped = computed(() => layersOf(null).filter(matches))

// Collapsed groups and expanded layers (by default the other way around, with `collapsed`)
const toggledGroups = ref(new Set<string>())
const isOpen = (group: string) => toggledGroups.value.has(group) === props.collapsed
function toggleGroup(group: string) {
  const next = new Set(toggledGroups.value)
  if (!next.delete(group)) next.add(group)
  toggledGroups.value = next
}
const expanded = ref(new Set<string>())
function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (!next.delete(id)) next.add(id)
  expanded.value = next
}

const visibleCount = (layers: MapLayerInfo[]) => layers.filter((l) => isVisible(l.id)).length
</script>

<template>
  <div class="flex flex-col gap-3">
    <MTextField v-if="search" v-model="query" :label="t.mapSearchLayers" leading-icon="search" variant="outlined" clearable />

    <section v-for="group in groups" :key="group.name" class="flex flex-col">
      <div class="m3-map-layers-row flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5" @click="toggleGroup(group.name)">
        <button
          type="button"
          class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200"
          :class="groupState(group.name) === 'visible' ? 'bg-primary-container text-on-primary-container'
            : groupState(group.name) === 'partial' ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-on-surface/8 text-on-surface-variant'"
          :aria-label="groupState(group.name) === 'hidden' ? t.mapShowLayer : t.mapHideLayer"
          :aria-pressed="groupState(group.name) !== 'hidden'"
          @click.stop="setGroupVisible(group.name, groupState(group.name) !== 'visible')"
        >
          <MIcon :name="groupState(group.name) === 'hidden' ? 'visibility_off' : 'visibility'" :size="18" />
        </button>
        <span class="flex-1 select-none truncate text-label-large text-on-surface">{{ group.title }}</span>
        <span class="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-small tabular-nums text-on-surface-variant">
          {{ visibleCount(group.all) }}/{{ group.all.length }}
        </span>
        <MIcon name="expand_more" :size="18" class="text-on-surface-variant transition-transform duration-300" :class="isOpen(group.name) ? 'rotate-180' : ''" />
      </div>
      <div class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)]" :style="{ gridTemplateRows: isOpen(group.name) ? '1fr' : '0fr' }">
        <div class="flex min-h-0 flex-col gap-1.5 overflow-hidden" :class="isOpen(group.name) ? 'pt-1.5' : ''">
          <MMapLayerItem v-for="layer in group.layers" :key="layer.id" :layer="layer" :expanded="expanded.has(layer.id)" @toggle-expanded="toggleExpanded(layer.id)">
            <template v-if="$slots.actions" #actions="scope"><slot name="actions" v-bind="scope" /></template>
          </MMapLayerItem>
        </div>
      </div>
    </section>

    <div v-if="ungrouped.length" class="flex flex-col gap-1.5">
      <MMapLayerItem v-for="layer in ungrouped" :key="layer.id" :layer="layer" :expanded="expanded.has(layer.id)" @toggle-expanded="toggleExpanded(layer.id)">
        <template v-if="$slots.actions" #actions="scope"><slot name="actions" v-bind="scope" /></template>
      </MMapLayerItem>
    </div>

    <div v-if="!groups.length && !ungrouped.length" class="flex flex-col items-center gap-3 py-8">
      <div class="grid size-14 place-items-center rounded-full bg-surface-container-highest">
        <MIcon name="layers_clear" :size="28" class="text-on-surface-variant" />
      </div>
      <p class="text-body-medium text-on-surface-variant">{{ t.mapNoLayers }}</p>
    </div>
  </div>
</template>

<style>
.m3-map-layers-row:hover {
  background-color: color-mix(in srgb, var(--color-on-surface) 6%, transparent);
}
</style>
