<script setup lang="ts">
/**
 * A popup on an `MMap` at `lngLat`, shown while `open` (v-model): e.g. what the user clicked on. Its content is the
 * default slot, styled as an M3 surface. For a popup that opens from a marker, use `MMapMarker`'s `#popup` slot.
 * Available from the `/map` entry point.
 *
 * @slot default The popup's content
 * @event update:open Closed by its close button or a click on the map (`closeOnClick`)
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import { useMap } from '../composables/useMap'

// Attributes (class, style…) go on what's shown on the map, not on the hidden wrapper it's rendered in
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Position, `[lng, lat]` */
    lngLat: [number, number]
    /** Shown (v-model) */
    open?: boolean
    /** Show a close button */
    closeButton?: boolean
    /** Close it when the map is clicked */
    closeOnClick?: boolean
    /** Where the popup sits relative to `lngLat`. By default MapLibre picks the side with room */
    anchor?: Maplibre.PositionAnchor
    /** Offset in pixels from `lngLat` */
    offset?: number
    /** Maximum width (CSS) */
    maxWidth?: string
  }>(),
  { open: true, closeButton: true, closeOnClick: true, offset: 8, maxWidth: '320px' },
)

const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const content = ref<HTMLElement>()
const { onReady } = useMap()

let popup: Maplibre.Popup | undefined
let map: Maplibre.Map | undefined
// Closing it from `open` (rather than by the user) mustn't echo back as update:open
let closingFromProp = false

function show() {
  if (!popup || !map || popup.isOpen()) return
  popup.setLngLat(props.lngLat).addTo(map)
}

onReady((m, ml) => {
  map = m
  popup = new ml.Popup({
    closeButton: props.closeButton,
    closeOnClick: props.closeOnClick,
    closeOnMove: false,
    anchor: props.anchor,
    offset: props.offset,
    maxWidth: props.maxWidth,
    focusAfterOpen: false,
  })
  if (content.value) popup.setDOMContent(content.value)
  popup.on('close', () => {
    if (!closingFromProp) emit('update:open', false)
  })
  if (props.open) show()
})

watch(() => props.open, (open) => {
  if (open) show()
  else if (popup?.isOpen()) {
    closingFromProp = true
    popup.remove()
    closingFromProp = false
  }
})
watch(() => props.lngLat.join(','), () => popup?.setLngLat(props.lngLat))
watch(() => props.maxWidth, (w) => popup?.setMaxWidth(w))

onBeforeUnmount(() => {
  closingFromProp = true
  popup?.remove()
})

defineExpose({
  /** The MapLibre popup */
  popup: () => popup,
})
</script>

<template>
  <!-- Moved into the popup by MapLibre -->
  <div class="hidden">
    <div ref="content" v-bind="$attrs">
      <slot />
    </div>
  </div>
</template>
