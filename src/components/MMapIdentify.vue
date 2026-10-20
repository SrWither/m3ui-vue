<script setup lang="ts">
/**
 * Click-to-identify for an `MMap` with an `adapter`: a click on the map lists the features of the layers marked to
 * identify under it (with their formatted properties) in a popup, with a marker where the user clicked. The pointer
 * turns into a hand over those layers. The `identify` event carries the results, to show them in a panel of your own
 * instead (`:popup="false"`, then `MMapFeatureInfo` in an `MWindow`). Available from the `/map` entry point.
 *
 * @slot default The popup's content instead of `MMapFeatureInfo` (scope: `{ results, lngLat, close }`)
 * @event identify The user clicked the map: what was found there (empty when nothing) and where (`[lng, lat]`)
 */
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MMapPopup from './MMapPopup.vue'
import MMapMarker from './MMapMarker.vue'
import MMapFeatureInfo from './MMapFeatureInfo.vue'
import { useMap } from '../composables/useMap'
import { useMapLayers } from '../composables/useMapLayers'
import { identifyFeatures, type MapIdentifyResult } from '../composables/mapAdapters'

// Attributes (class, style…) go on the popup's content
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Listen to clicks (pause it while another tool uses them, e.g. measuring) */
    enabled?: boolean
    /** Show the results in a popup at the click */
    popup?: boolean
    /** Mark where the user clicked while there are results */
    marker?: boolean
  }>(),
  { enabled: true, popup: true, marker: true },
)

const emit = defineEmits<{ identify: [results: MapIdentifyResult[], lngLat: [number, number]] }>()

const { on, onReady } = useMap()
const { model } = useMapLayers()

const results = shallowRef<MapIdentifyResult[]>([])
const lngLat = ref<[number, number]>([0, 0])
const open = ref(false)

on('click', (e) => {
  if (!props.enabled) return
  const map = e.target as Maplibre.Map
  results.value = identifyFeatures(map, e.point, model.value)
  lngLat.value = [e.lngLat.lng, e.lngLat.lat]
  open.value = results.value.length > 0
  emit('identify', results.value, lngLat.value)
})

function close() {
  open.value = false
}
watch(() => props.enabled, (enabled) => { if (!enabled) close() })

// A hand over the layers that answer to a click
let map: Maplibre.Map | undefined
let hovered: string[] = []
const enter = () => { if (props.enabled && map) map.getCanvas().style.cursor = 'pointer' }
const leave = () => { if (map) map.getCanvas().style.cursor = '' }
function bindCursor() {
  if (!map) return
  for (const id of hovered) {
    map.off('mouseenter', id, enter)
    map.off('mouseleave', id, leave)
  }
  hovered = (model.value?.layers ?? []).filter((l) => l.identify).map((l) => l.id)
  for (const id of hovered) {
    map.on('mouseenter', id, enter)
    map.on('mouseleave', id, leave)
  }
}
onReady((m) => {
  map = m
  bindCursor()
})
watch(model, bindCursor)
onBeforeUnmount(() => {
  hovered.forEach((id) => {
    map?.off('mouseenter', id, enter)
    map?.off('mouseleave', id, leave)
  })
})

defineExpose({ close })
</script>

<template>
  <!-- One root (the marker and the popup move their content into the map) -->
  <div class="hidden">
    <MMapMarker v-if="marker && open" :lng-lat="lngLat" />
    <MMapPopup v-if="popup && results.length" v-model:open="open" :lng-lat="lngLat" max-width="360px" :offset="marker ? 40 : 8">
      <div class="max-h-80 overflow-y-auto" v-bind="$attrs">
        <slot :results="results" :lng-lat="lngLat" :close="close">
          <MMapFeatureInfo :results="results" />
        </slot>
      </div>
    </MMapPopup>
  </div>
</template>
