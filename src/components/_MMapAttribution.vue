<script setup lang="ts">
/*
 * Internal (not exported): MMap's attribution, instead of MapLibre's AttributionControl. A round M3 icon button in a
 * corner (surface, elevation 2) that opens into a pill with the credits of the style's sources, its size springing
 * open and closed through MMapControl. The credits are collected like MapLibre's control does: the attribution of
 * every source a layer uses (from its TileJSON once loaded, else the style), without repeats or ones contained in
 * another. They're HTML from the style (links), as MapLibre renders them.
 */
import { computed, ref } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MIcon from './MIcon.vue'
import MMapControl from './MMapControl.vue'
import { useMap } from '../composables/useMap'
import { useLocale } from '../composables/useLocale'
import type { MapControlPosition } from './MMap.vue'

const props = defineProps<{ position: MapControlPosition }>()

const t = useLocale()
const { on, onReady } = useMap()

const credits = ref<string[]>([])
const open = ref(true)
// The text wraps against the map's width, not the control's while its size springs (it would reflow every frame)
const maxWidth = ref(0)
let map: Maplibre.Map | undefined

function collect() {
  if (!map) return
  const style = map.getStyle?.()
  if (!style?.sources) return
  const used = new Set(style.layers?.map((l) => (l as { source?: string }).source).filter(Boolean))
  const found: string[] = []
  for (const [id, spec] of Object.entries(style.sources)) {
    if (used.size && !used.has(id)) continue
    const text = (map.getSource(id) as { attribution?: string } | undefined)?.attribution ?? (spec as { attribution?: string }).attribution
    if (text && !found.includes(text)) found.push(text)
  }
  const next = found.filter((a) => !found.some((b) => b !== a && b.includes(a)))
  if (next.join('\n') !== credits.value.join('\n')) credits.value = next
  maxWidth.value = Math.max(0, map.getContainer().clientWidth - 20)
}

onReady((m) => {
  map = m
  collect()
})
on('styledata', collect)
on('sourcedata', collect)
on('resize', collect)
// Open when the map loads, folded away once it's dragged, as MapLibre's compact attribution
on('dragstart', () => { open.value = false })

const html = computed(() => credits.value.join(' '))
// The button sits at the corner's outer edge, the text inward
const end = computed(() => props.position.endsWith('right'))
</script>

<template>
  <MMapControl
    v-if="html"
    :position="position"
    :group="false"
    class="m3-map-attrib"
    :class="open ? 'm3-map-attrib-open' : ''"
  >
    <div class="m3-map-attrib-row" :class="end ? 'flex-row-reverse' : ''" :style="maxWidth ? { maxWidth: `${maxWidth}px` } : undefined">
      <button
        type="button"
        class="m3-map-attrib-button"
        :title="t.mapToggleAttribution"
        :aria-label="t.mapToggleAttribution"
        :aria-expanded="open"
        @click="open = !open"
      >
        <MIcon name="info" :size="20" />
      </button>
      <div v-if="open" class="m3-map-attrib-text" :class="end ? 'pl-3.5' : 'pr-3.5'" v-html="html" />
    </div>
  </MMapControl>
</template>
