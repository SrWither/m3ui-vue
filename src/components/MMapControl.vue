<script setup lang="ts">
/**
 * Your own control in a corner of an `MMap`, stacked with MapLibre's (zoom, geolocate…) in that corner. With `group`
 * (the default) it's a control group like the zoom buttons: put `<button>`s with a Material Symbols icon in it and
 * they get the same M3 look. Without it, anything goes (an `MFab`, an `MSearchBar`, a card). Available from the
 * `/map` entry point.
 *
 * @slot default The control's content
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import type { MapControlPosition } from './MMap.vue'

// Attributes (class, style…) go on what's shown on the map, not on the hidden wrapper it's rendered in
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The corner */
    position?: MapControlPosition
    /** Draw it as a control group (a surface with dividers between buttons), like MapLibre's zoom buttons */
    group?: boolean
  }>(),
  { position: 'top-right', group: true },
)

const el = ref<HTMLElement>()
const { onReady } = useMap()

let map: Maplibre.Map | undefined
// MapLibre's IControl: the element it places in the corner
const control: Maplibre.IControl = {
  onAdd: () => el.value!,
  onRemove: () => el.value?.remove(),
}

onReady((m) => {
  map = m
  if (el.value) m.addControl(control, props.position)
})

watch(() => props.position, (position) => {
  if (!map || !el.value) return
  map.removeControl(control)
  map.addControl(control, position)
})

onBeforeUnmount(() => {
  if (map?.hasControl(control)) map.removeControl(control)
})
</script>

<template>
  <!-- Moved into the map's corner by MapLibre -->
  <div class="hidden">
    <div ref="el" class="maplibregl-ctrl" :class="group ? 'maplibregl-ctrl-group' : ''" v-bind="$attrs">
      <slot />
    </div>
  </div>
</template>
