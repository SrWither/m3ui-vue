<script setup lang="ts">
import { ref, computed } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    data: unknown
    rootName?: string
    expandDepth?: number
    /** @internal — used by recursive instances */
    _depth?: number
  }>(),
  { rootName: 'root', expandDepth: 2, _depth: 0 },
)

const expanded = ref(props._depth < props.expandDepth)

const dataType = computed(() => {
  if (props.data === null) return 'null'
  if (Array.isArray(props.data)) return 'array'
  return typeof props.data
})

const isExpandable = computed(() => dataType.value === 'object' || dataType.value === 'array')

const entries = computed(() => {
  if (dataType.value === 'array') {
    return (props.data as unknown[]).map((v, i) => ({ key: String(i), value: v }))
  }
  if (dataType.value === 'object' && props.data) {
    return Object.entries(props.data as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }))
  }
  return []
})

const childCount = computed(() => entries.value.length)

const bracketOpen = computed(() => (dataType.value === 'array' ? '[' : '{'))
const bracketClose = computed(() => (dataType.value === 'array' ? ']' : '}'))

function valueClass(val: unknown) {
  if (val === null) return 'text-on-surface-variant italic'
  switch (typeof val) {
    case 'string': return 'text-success'
    case 'number': return 'text-primary'
    case 'boolean': return 'text-tertiary'
    default: return 'text-on-surface'
  }
}

function formatValue(val: unknown) {
  if (typeof val === 'string') return `"${val}"`
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  return String(val)
}
</script>

<template>
  <div class="font-mono text-body-small leading-relaxed" :class="{ 'rounded-lg border border-outline-variant bg-surface-container-lowest p-3': _depth === 0 }">
    <!-- Expandable node -->
    <template v-if="isExpandable">
      <button
        type="button"
        class="group inline-flex cursor-pointer items-center gap-0.5 rounded px-0.5 hover:bg-on-surface/[0.06]"
        @click="expanded = !expanded"
      >
        <MIcon
          :name="expanded ? 'expand_more' : 'chevron_right'"
          :size="16"
          class="text-on-surface-variant transition-transform duration-100"
        />
        <span v-if="_depth === 0 || rootName" class="text-tertiary">{{ _depth === 0 ? rootName : '' }}</span>
        <span class="text-on-surface-variant">{{ bracketOpen }}</span>
        <span v-if="!expanded" class="text-on-surface-variant/60">
          {{ childCount }} {{ dataType === 'array' ? 'elementos' : 'campos' }}
        </span>
        <span v-if="!expanded" class="text-on-surface-variant">{{ bracketClose }}</span>
      </button>

      <div v-if="expanded" class="ml-5 border-l border-outline-variant/40 pl-2">
        <div v-for="entry in entries" :key="entry.key" class="flex items-start">
          <span class="shrink-0 text-primary">{{ dataType === 'array' ? '' : `"${entry.key}"` }}</span>
          <span v-if="dataType !== 'array'" class="shrink-0 text-on-surface-variant mr-1">:</span>

          <!-- Recursive child -->
          <MJsonViewer
            v-if="entry.value !== null && (typeof entry.value === 'object')"
            :data="entry.value"
            :root-name="entry.key"
            :expand-depth="expandDepth"
            :_depth="_depth + 1"
          />
          <!-- Primitive value -->
          <span v-else :class="valueClass(entry.value)">{{ formatValue(entry.value) }}</span>
        </div>
      </div>
      <span v-if="expanded" class="ml-5 text-on-surface-variant">{{ bracketClose }}</span>
    </template>

    <!-- Primitive root -->
    <template v-else>
      <span :class="valueClass(data)">{{ formatValue(data) }}</span>
    </template>
  </div>
</template>
