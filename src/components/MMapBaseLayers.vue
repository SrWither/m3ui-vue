<script setup lang="ts">
/**
 * The base layer switcher of an `MMap` with an `adapter`: a round thumbnail per base layer (the adapter's `image`,
 * after `imageBase`), one shown at a time, plus "no base layer". Only the thumbnails: put them in an `MMapControl`
 * (`:group="false"`), an `MFab`'s `#content` or a panel, inside the `MMap` or anywhere else with `map`. Available
 * from the `/map` entry point.
 */
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'
import { useMapLayers } from '../composables/useMapLayers'
import type { MapSource } from '../composables/useMap'

const props = withDefaults(
  defineProps<{
    /** Prefix for the thumbnails' paths (e.g. `/images/`); full URLs are used as they are */
    imageBase?: string
    /** Offer "no base layer" */
    none?: boolean
    /** Lay them out in a column */
    vertical?: boolean
    /** The map, when this is outside it (a side panel): the `MMap`'s template ref */
    map?: MapSource
  }>(),
  { imageBase: '', none: true, vertical: false },
)

const t = useLocale()
const { baseLayers, baseLayer, setBaseLayer } = useMapLayers(() => props.map)

const src = (image: string, base: string) => (/^(https?:|data:|\/\/)/.test(image) ? image : `${base}${image}`)
</script>

<template>
  <div class="flex gap-2" :class="vertical ? 'flex-col' : 'flex-row flex-wrap'" role="radiogroup">
    <button
      v-for="layer in baseLayers"
      :key="layer.id"
      type="button"
      role="radio"
      class="m3-map-base grid size-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border-2 bg-surface-variant transition-[border-color,transform] duration-150 hover:scale-110"
      :class="baseLayer === layer.id ? 'm3-map-base--active border-primary' : 'border-transparent'"
      :title="layer.title"
      :aria-label="layer.title"
      :aria-checked="baseLayer === layer.id"
      @click="setBaseLayer(layer.id)"
    >
      <img v-if="layer.base?.image" :src="src(layer.base.image, imageBase)" alt="" class="size-full object-cover">
      <MIcon v-else name="map" :size="22" class="text-on-surface-variant" />
    </button>
    <button
      v-if="none"
      type="button"
      role="radio"
      class="m3-map-base grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border-2 bg-surface-variant transition-[border-color,transform] duration-150 hover:scale-110"
      :class="baseLayer === null ? 'm3-map-base--active border-primary' : 'border-transparent'"
      :title="t.mapNoBaseLayer"
      :aria-label="t.mapNoBaseLayer"
      :aria-checked="baseLayer === null"
      @click="setBaseLayer(null)"
    >
      <MIcon name="layers_clear" :size="22" class="text-on-surface-variant" />
    </button>
  </div>
</template>

<style>
/* Inactive thumbnails in gray, the active one in color */
.m3-map-base:not(.m3-map-base--active) img {
  filter: grayscale(1) opacity(0.6);
}
</style>
