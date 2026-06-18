<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MIcon from './MIcon.vue'

export interface VTableColumn {
  key: string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
}

const props = withDefaults(defineProps<{
  columns: VTableColumn[]
  rows: Record<string, any>[]
  rowHeight?: number
  rowKey?: string
  overscan?: number
  maxHeight?: string
}>(), {
  rowHeight: 44,
  rowKey: 'id',
  overscan: 5,
  maxHeight: '500px',
})

const emit = defineEmits<{ rowClick: [Record<string, any>] }>()

const scrollEl = ref<HTMLElement>()
const scrollTop = ref(0)
const containerH = ref(400)

const sortKey = ref('')
const sortDir = ref<'asc' | 'desc' | ''>('')

function toggleSort(key: string) {
  if (sortKey.value !== key) { sortKey.value = key; sortDir.value = 'asc' }
  else if (sortDir.value === 'asc') sortDir.value = 'desc'
  else { sortKey.value = ''; sortDir.value = '' }
}

const sortedRows = computed(() => {
  if (!sortKey.value || !sortDir.value) return props.rows
  const key = sortKey.value, dir = sortDir.value
  return [...props.rows].sort((a, b) => {
    const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { numeric: true, sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  })
})

const totalHeight = computed(() => sortedRows.value.length * props.rowHeight)

const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - props.overscan)
  const end = Math.min(
    sortedRows.value.length,
    Math.ceil((scrollTop.value + containerH.value) / props.rowHeight) + props.overscan
  )
  return { start, end }
})

const visibleRows = computed(() =>
  sortedRows.value.slice(visibleRange.value.start, visibleRange.value.end).map((row, i) => ({
    row,
    index: visibleRange.value.start + i,
    top: (visibleRange.value.start + i) * props.rowHeight,
  }))
)

function onScroll() {
  if (!scrollEl.value) return
  scrollTop.value = scrollEl.value.scrollTop
}

let ro: ResizeObserver | null = null
onMounted(() => {
  if (scrollEl.value) {
    containerH.value = scrollEl.value.clientHeight
    ro = new ResizeObserver((entries) => { containerH.value = entries[0]!.contentRect.height })
    ro.observe(scrollEl.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

function alignClass(a?: string) { return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left' }
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-sm border border-outline-variant">
    <!-- Header -->
    <div class="flex bg-surface-container-high">
      <div
        v-for="col in columns"
        :key="col.key"
        :style="{ width: col.width || 'auto', flex: col.width ? 'none' : '1' }"
        :class="[
          'px-4 py-3 text-label-medium font-medium text-on-surface-variant whitespace-nowrap',
          alignClass(col.align),
          col.sortable ? 'cursor-pointer select-none hover:text-on-surface transition-colors' : '',
        ]"
        @click="col.sortable ? toggleSort(col.key) : undefined"
      >
        <span class="inline-flex items-center gap-1">
          {{ col.label }}
          <span v-if="col.sortable" class="inline-flex">
            <MIcon v-if="sortKey === col.key && sortDir === 'asc'" name="arrow_upward" :size="14" class="text-primary" />
            <MIcon v-else-if="sortKey === col.key && sortDir === 'desc'" name="arrow_downward" :size="14" class="text-primary" />
            <MIcon v-else name="unfold_more" :size="14" class="opacity-30" />
          </span>
        </span>
      </div>
    </div>

    <!-- Virtual scroll body -->
    <div
      ref="scrollEl"
      class="overflow-y-auto"
      :style="{ maxHeight }"
      @scroll="onScroll"
    >
      <div class="relative" :style="{ height: `${totalHeight}px` }">
        <div
          v-for="{ row, index, top } in visibleRows"
          :key="row[rowKey] ?? index"
          class="absolute left-0 right-0 flex border-t border-outline-variant transition-colors duration-75 hover:bg-on-surface/[0.04]"
          :class="index % 2 === 0 ? '' : 'bg-surface-container-lowest/50'"
          :style="{ top: `${top}px`, height: `${rowHeight}px` }"
          @click="emit('rowClick', row)"
        >
          <div
            v-for="col in columns"
            :key="col.key"
            class="flex items-center overflow-hidden px-4 text-body-medium text-on-surface"
            :style="{ width: col.width || 'auto', flex: col.width ? 'none' : '1' }"
            :class="alignClass(col.align)"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              <span class="truncate">{{ row[col.key] ?? '—' }}</span>
            </slot>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-outline-variant bg-surface-container-lowest px-4 py-2">
      <span class="text-label-small text-on-surface-variant">
        {{ sortedRows.length.toLocaleString() }} filas
        <template v-if="visibleRange.end - visibleRange.start < sortedRows.length">
          · mostrando {{ visibleRange.start + 1 }}–{{ visibleRange.end }}
        </template>
      </span>
    </div>
  </div>
</template>
