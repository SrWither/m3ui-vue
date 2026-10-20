<script setup lang="ts">
/**
 * A place search on an `MMap`: a search card in a corner. Enter searches through `provider` (OpenStreetMap's
 * Nominatim by default, or any function returning places); picking a result flies there (or fits its extent) and
 * marks it. Available from the `/map` entry point.
 *
 * @event select A result was picked
 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type * as Maplibre from 'maplibre-gl'
import MCard from './MCard.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MList from './MList.vue'
import MListItem from './MListItem.vue'
import MSpinner from './MSpinner.vue'
import MMapControl from './MMapControl.vue'
import MMapMarker from './MMapMarker.vue'
import { useLocale } from '../composables/useLocale'
import { useMap } from '../composables/useMap'
import { nominatimProvider, type MapSearchProvider, type MapSearchResult } from '../composables/mapSearch'
import type { MapControlPosition } from './MMap.vue'

const props = withDefaults(
  defineProps<{
    /** Where to search: `nominatimProvider(options)` by default, or your own function */
    provider?: MapSearchProvider
    /** The corner */
    position?: MapControlPosition
    /** The field's placeholder (the locale's "Search places" by default) */
    placeholder?: string
    /** The zoom to fly to for a result without an extent */
    zoom?: number
    /** Mark the picked result */
    marker?: boolean
    /** Search while typing (debounced), for providers that allow it; Nominatim's public server doesn't */
    instant?: boolean
  }>(),
  { position: 'top-left', zoom: 17, marker: true, instant: false },
)

const emit = defineEmits<{ select: [result: MapSearchResult] }>()

const t = useLocale()
const { map } = useMap()
const provider = computed(() => props.provider ?? nominatimProvider())

const query = ref('')
const results = shallowRef<MapSearchResult[]>([])
const loading = ref(false)
const searched = ref(false)
const open = ref(false)
const picked = shallowRef<MapSearchResult | null>(null)
let controller: AbortController | undefined
let debounce: ReturnType<typeof setTimeout> | undefined

async function search() {
  const q = query.value.trim()
  if (!q) return
  controller?.abort()
  controller = new AbortController()
  const mine = controller
  loading.value = true
  open.value = true
  try {
    results.value = await provider.value(q, mine.signal)
  } catch {
    if (mine.signal.aborted) return
    results.value = []
  } finally {
    if (controller === mine) {
      loading.value = false
      searched.value = true
    }
  }
}

function onInput(value: string) {
  query.value = value
  if (!value) return clear()
  if (props.instant) {
    clearTimeout(debounce)
    debounce = setTimeout(search, 350)
  }
}

function select(result: MapSearchResult) {
  picked.value = result
  open.value = false
  const m = map.value as Maplibre.Map | undefined
  if (result.bbox && result.bbox[0] !== result.bbox[2]) m?.fitBounds([[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]], { padding: 48, maxZoom: props.zoom })
  else m?.flyTo({ center: result.lngLat, zoom: props.zoom })
  emit('select', result)
}

function clear() {
  controller?.abort()
  clearTimeout(debounce)
  query.value = ''
  results.value = []
  searched.value = false
  loading.value = false
  open.value = false
  picked.value = null
}

onBeforeUnmount(() => {
  controller?.abort()
  clearTimeout(debounce)
})

const ICONS: Record<string, string> = {
  city: 'location_city', town: 'location_city', village: 'holiday_village', hamlet: 'cottage', suburb: 'apartment',
  neighbourhood: 'maps_home_work', road: 'road', residential: 'home', house: 'home', building: 'domain',
  shop: 'storefront', park: 'park', water: 'water', river: 'water', lake: 'water', school: 'school',
  university: 'school', hospital: 'local_hospital', restaurant: 'restaurant', cafe: 'local_cafe', hotel: 'hotel',
  station: 'train', bus_stop: 'directions_bus', administrative: 'map', country: 'public', state: 'map',
}
const iconOf = (type?: string) => (type && ICONS[type]) || 'location_on'
</script>

<template>
  <div class="hidden">
    <MMapControl :position="position" :group="false">
      <MCard variant="elevated" class="w-80 max-w-[calc(100vw-5rem)] overflow-hidden">
        <form class="flex items-center gap-2 py-1 pr-1 pl-3" role="search" @submit.prevent="search">
          <MIcon name="search" :size="20" class="shrink-0 text-on-surface-variant" />
          <input
            :value="query"
            type="search"
            enterkeyhint="search"
            :placeholder="placeholder ?? t.mapSearchPlaces"
            :aria-label="placeholder ?? t.mapSearchPlaces"
            class="min-w-0 flex-1 bg-transparent py-2 text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant [&::-webkit-search-cancel-button]:hidden"
            @input="onInput(($event.target as HTMLInputElement).value)"
            @focus="open = searched && !picked"
          >
          <MSpinner v-if="loading" :size="20" class="mr-2 shrink-0" />
          <MIconButton v-else-if="query" icon="close" :label="t.clearSearch" size="sm" @click="clear" />
        </form>
        <div v-if="open && searched && !loading" class="border-t border-outline-variant">
          <MList v-if="results.length" class="max-h-72 overflow-y-auto">
            <MListItem
              v-for="(r, i) in results"
              :key="i"
              :title="r.label"
              :icon="iconOf(r.type)"
              leading="icon"
              clickable
              @click="select(r)"
            />
          </MList>
          <div v-else class="flex flex-col items-center gap-2 py-6">
            <MIcon name="search_off" :size="28" class="text-on-surface-variant" />
            <span class="text-body-small text-on-surface-variant">{{ t.noResults }}</span>
          </div>
        </div>
      </MCard>
    </MMapControl>
    <MMapMarker v-if="marker && picked" :lng-lat="picked.lngLat" />
  </div>
</template>
