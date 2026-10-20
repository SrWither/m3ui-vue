<script setup lang="ts">
/**
 * A marker on an `MMap`, at `lngLat`: MapLibre's pin in the theme's primary (or `color`), or your own content from the
 * default slot. With `draggable`, `lngLat` is a v-model. Content in `#popup` opens in a popup when the marker is
 * clicked. Available from the `/map` entry point.
 *
 * @slot default The marker itself, instead of the pin (any element, anchored by `anchor`)
 * @slot popup Content of a popup that opens when the marker is clicked
 * @event update:lngLat Dragged to a new position (`draggable`): `[lng, lat]`
 * @event click The marker was clicked
 */
import { onBeforeUnmount, ref, useSlots, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useMap } from '../composables/useMap'
import { PIN_OFFSET } from '../composables/_mapPin'

// Attributes (class, style…) go on what's shown on the map, not on the hidden wrapper it's rendered in
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Position, `[lng, lat]` (v-model with `draggable`) */
    lngLat: [number, number]
    /** The pin's color (any CSS color). Defaults to the theme's primary; ignored with custom content */
    color?: string
    /** Let the user drag it */
    draggable?: boolean
    /**
     * Which part of the marker sits on `lngLat`. By default the pin's tip (MapLibre's placement: its center, offset
     * `[0, -14]`), and the center of custom content
     */
    anchor?: Maplibre.PositionAnchor
    /** Offset in pixels, `[x, y]`. The pin's default is MapLibre's `[0, -14]`, which puts its tip on `lngLat` */
    offset?: [number, number]
    /** Rotation in degrees */
    rotation?: number
  }>(),
  { draggable: false, rotation: 0 },
)

const emit = defineEmits<{
  'update:lngLat': [lngLat: [number, number]]
  click: [event: MouseEvent]
}>()

const slots = useSlots()
const content = ref<HTMLElement>()
const popupContent = ref<HTMLElement>()
const { onReady } = useMap()

let marker: Maplibre.Marker | undefined
let custom = false

onReady((map, ml) => {
  custom = !!slots.default && !!content.value
  marker = new ml.Marker({
    ...(custom ? { element: content.value } : { color: props.color ?? 'currentColor' }),
    draggable: props.draggable,
    // Left out for the pin unless given: MapLibre's own placement puts its tip on the point (see _mapPin.ts)
    ...(props.anchor ? { anchor: props.anchor } : custom ? { anchor: 'center' as const } : {}),
    ...(props.offset ? { offset: props.offset } : {}),
    rotation: props.rotation,
  })
  if (!custom && !props.color) marker.getElement().classList.add('m3-map-marker--default')
  marker.setLngLat(props.lngLat).addTo(map)
  marker.getElement().addEventListener('click', onClick)
  marker.on('dragend', () => {
    const { lng, lat } = marker!.getLngLat()
    emit('update:lngLat', [lng, lat])
  })
  if (slots.popup && popupContent.value) {
    // The pin's popup gets MapLibre's per-side offsets, which it only applies when `offset` isn't set at all
    marker.setPopup(new ml.Popup({ ...(custom ? { offset: 16 } : {}), maxWidth: '320px' }).setDOMContent(popupContent.value))
  }
})

function onClick(e: MouseEvent) {
  emit('click', e)
}

// Compared by value: an inline `:lng-lat="[lng, lat]"` is a new array on every parent render
watch(() => props.lngLat.join(','), () => marker?.setLngLat(props.lngLat))
watch(() => props.draggable, (draggable) => marker?.setDraggable(draggable))
watch(() => props.rotation, (rotation) => marker?.setRotation(rotation))
watch(() => props.offset?.join(','), () => marker?.setOffset(props.offset ?? (custom ? [0, 0] : PIN_OFFSET)))

onBeforeUnmount(() => {
  marker?.getElement().removeEventListener('click', onClick)
  marker?.getPopup()?.remove()
  marker?.remove()
})

defineExpose({
  /** The MapLibre marker */
  marker: () => marker,
})
</script>

<template>
  <!-- Rendered here, then moved into the map by MapLibre (the marker element and the popup's content) -->
  <div class="hidden">
    <div v-if="$slots.default" ref="content" class="m3-map-marker" v-bind="$attrs">
      <slot />
    </div>
    <div v-if="$slots.popup" ref="popupContent">
      <slot name="popup" />
    </div>
  </div>
</template>
