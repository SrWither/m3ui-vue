<script setup lang="ts">
/**
 * A simple filter for one layer of an `MMap`: chips for the values of one of its properties; the layer shows only the
 * features with the selected ones (all of them with none selected). The values are `values`, or else the distinct
 * ones among the layer's features loaded in the map. The style's own filter on the layer stays. For anything more
 * involved, build your own on `useMapFilter()`. Inside the `MMap`, or anywhere else with `map`. Available from the `/map`
 * entry point.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MChip from './MChip.vue'
import { useMap, type MapSource } from '../composables/useMap'
import { useMapFilter } from '../composables/useMapFilter'

const props = defineProps<{
  /** The layer's id */
  layer: string
  /** The property to filter by */
  property: string
  /** The values to offer (labels in `labels`); by default the ones found in the layer's loaded features */
  values?: (string | number)[]
  /** Labels for the values, by value */
  labels?: Record<string, string>
  /** The selected values (v-model) */
  modelValue?: (string | number)[]
  /** The map, when this is outside it (a side panel): the `MMap`'s template ref */
  map?: MapSource
}>()

const emit = defineEmits<{ 'update:modelValue': [values: (string | number)[]] }>()

const { onReady, styleVersion } = useMap(() => props.map)
const { setFilter, valuesOf } = useMapFilter(() => props.map)

const found = ref<(string | number)[]>([])
const options = computed(() => props.values ?? found.value)
const local = ref<(string | number)[]>([])
const selected = computed(() => props.modelValue ?? local.value)

function apply() {
  const values = selected.value
  setFilter(props.layer, values.length ? ['in', ['get', props.property], ['literal', values]] : null)
}

function toggle(value: string | number) {
  const next = selected.value.includes(value) ? selected.value.filter((v) => v !== value) : [...selected.value, value]
  local.value = next
  emit('update:modelValue', next)
}

function refreshValues(map: { once: (type: 'idle', fn: () => void) => unknown }) {
  const read = () => { if (!props.values) found.value = valuesOf(props.layer, props.property) }
  read()
  // And once the layer's data is in, if it wasn't yet (tiles load after the style)
  map.once('idle', read)
}

onReady((map) => {
  refreshValues(map)
  apply()
})
watch(selected, apply, { deep: true })
watch(styleVersion, () => apply())
watch(() => [props.layer, props.property], ([layer], [old]) => {
  if (layer !== old) setFilter(old as string, null)
  apply()
})
onBeforeUnmount(() => setFilter(props.layer, null))
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <MChip
      v-for="value in options"
      :key="value"
      type="filter"
      clickable
      :selected="selected.includes(value)"
      @click="toggle(value)"
    >
      {{ labels?.[String(value)] ?? value }}
    </MChip>
  </div>
</template>
