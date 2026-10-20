<script setup lang="ts">
/**
 * Hover info for an `MMap` with an `adapter`: while on (v-model), the layers with `hover` fields show them for the
 * feature under the pointer, in a small popup that follows it. With `control` (on by default) it adds its own on/off
 * button to the map's controls. Pointer devices only: touch has no hover. Available from the `/map` entry point.
 *
 * @event update:modelValue Turned on or off with its button
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MIcon from './MIcon.vue'
import MMapControl from './MMapControl.vue'
import MMapPopup from './MMapPopup.vue'
import { useLocale } from '../composables/useLocale'
import { useMap } from '../composables/useMap'
import { useMapLayers } from '../composables/useMapLayers'
import { formatFieldValue, fieldLabel, type MapLayerInfo } from '../composables/mapAdapters'
import type { MapControlPosition } from './MMap.vue'

const props = withDefaults(
  defineProps<{
    /** On (v-model) */
    modelValue?: boolean
    /** Its on/off button: `false`, or a corner (`true` is top-right) */
    control?: boolean | MapControlPosition
  }>(),
  { modelValue: false, control: true },
)

const emit = defineEmits<{ 'update:modelValue': [on: boolean] }>()

const t = useLocale()
const { onReady } = useMap()
const { model } = useMapLayers()

const hoverLayers = computed(() => (model.value?.layers ?? []).filter((l) => l.hover && l.hover.fields.length))
const shown = shallowRef<{ layer: MapLayerInfo; fields: { key: string; label: string; value: string }[] } | null>(null)
const lngLat = ref<[number, number]>([0, 0])
const open = ref(false)

let map: Maplibre.Map | undefined
let bound: string[] = []

function move(e: Maplibre.MapLayerMouseEvent) {
  const feature = e.features?.[0]
  const layer = hoverLayers.value.find((l) => l.id === feature?.layer.id)
  if (!feature || !layer || !layer.hover) return
  const props = feature.properties ?? {}
  shown.value = {
    layer,
    fields: layer.hover.fields
      .map((f) => ({ key: f.key, label: fieldLabel(f.key, f), value: formatFieldValue(props[f.key], f) }))
      .filter((f) => f.value),
  }
  lngLat.value = [e.lngLat.lng, e.lngLat.lat]
  open.value = true
}
function leave() {
  open.value = false
}

function bind() {
  if (!map) return
  for (const id of bound) {
    map.off('mousemove', id, move)
    map.off('mouseleave', id, leave)
  }
  bound = props.modelValue ? hoverLayers.value.map((l) => l.id) : []
  for (const id of bound) {
    map.on('mousemove', id, move)
    map.on('mouseleave', id, leave)
  }
  if (!props.modelValue) open.value = false
}

onReady((m) => {
  map = m
  bind()
})
watch([() => props.modelValue, hoverLayers], bind)
onBeforeUnmount(() => {
  for (const id of bound) {
    map?.off('mousemove', id, move)
    map?.off('mouseleave', id, leave)
  }
})

const corner = computed(() => (props.control === true ? 'top-right' : props.control || 'top-right'))
</script>

<template>
  <div class="hidden">
    <MMapControl v-if="control && hoverLayers.length" :position="corner">
      <button
        type="button"
        class="grid place-items-center"
        :title="t.mapHoverInfo"
        :aria-label="t.mapHoverInfo"
        :aria-pressed="modelValue"
        @click="emit('update:modelValue', !modelValue)"
      >
        <MIcon name="ads_click" :size="20" />
      </button>
    </MMapControl>
    <MMapPopup
      v-if="shown"
      v-model:open="open"
      :lng-lat="lngLat"
      :close-button="false"
      :close-on-click="false"
      :offset="12"
      max-width="280px"
      class="m3-map-hover"
    >
      <p class="-mx-4 -mt-3 mb-1 bg-primary-container px-3 py-1.5 text-label-medium text-on-primary-container">{{ shown.layer.title }}</p>
      <dl class="flex flex-col">
        <div v-for="field in shown.fields" :key="field.key" class="border-b border-outline-variant py-1 last:border-b-0">
          <dt class="text-label-small text-on-surface-variant">{{ field.label }}</dt>
          <dd class="text-body-small text-on-surface">{{ field.value }}</dd>
        </div>
      </dl>
    </MMapPopup>
  </div>
</template>

<style>
/* The hover popup ignores the pointer, so it never steals the mousemove that keeps it open */
.maplibregl-popup:has(.m3-map-hover) {
  pointer-events: none;
}
</style>
