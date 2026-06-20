<script setup lang="ts">
import { computed, ref, useSlots, watch, onMounted } from 'vue'
import MCheckbox from './MCheckbox.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MPagination from './MPagination.vue'
import MChip from './MChip.vue'

export interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  resizable?: boolean
  width?: string
  minWidth?: string
  align?: 'left' | 'center' | 'right'
  pinned?: 'left' | 'right'
  hidden?: boolean
}

export interface DataTableGroup {
  key: string
  label: string
}

const SKEL = [65, 80, 50, 75, 90, 55, 70, 85, 60, 78]

const props = withDefaults(defineProps<{
  columns: DataTableColumn[]
  rows: Record<string, any>[]
  loading?: boolean
  emptyText?: string
  rowKey?: string
  selectable?: boolean
  modelValue?: Record<string, any>[]
  perPage?: number
  searchable?: boolean
  expandable?: boolean
  striped?: boolean
  dense?: boolean
  stickyHeader?: boolean
  groupBy?: string
  columnToggle?: boolean
  exportable?: boolean
  serverSide?: boolean
  total?: number
  page?: number
}>(), {
  loading: false,
  emptyText: 'Sin resultados',
  rowKey: 'id',
  selectable: false,
  modelValue: () => [],
  perPage: 10,
  searchable: true,
  expandable: false,
  striped: false,
  dense: false,
  stickyHeader: false,
  columnToggle: false,
  exportable: false,
  serverSide: false,
  total: 0,
  page: 1,
})

export interface DataTableFetchParams {
  page: number
  perPage: number
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc' | ''
}

const emit = defineEmits<{
  'update:modelValue': [Record<string, any>[]]
  'update:page': [number]
  rowClick: [Record<string, any>]
  fetch: [DataTableFetchParams]
}>()

const slots = useSlots()
const hasActions = computed(() => !!slots['row-actions'])
const hasExpand = computed(() => props.expandable && !!slots['row-expand'])

const search = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc' | ''>('')
const internalPage = ref(1)
const expanded = ref<Set<any>>(new Set())
const hiddenCols = ref<Set<string>>(new Set())
const colWidths = ref<Record<string, number>>({})
const showColMenu = ref(false)

const visibleColumns = computed(() =>
  props.columns.filter(c => !c.hidden && !hiddenCols.value.has(c.key))
)

function toggleSort(key: string) {
  if (sortKey.value !== key) { sortKey.value = key; sortDir.value = 'asc' }
  else if (sortDir.value === 'asc') sortDir.value = 'desc'
  else { sortKey.value = ''; sortDir.value = '' }
}

const currentPage = computed({
  get: () => props.serverSide ? (props.page ?? 1) : internalPage.value,
  set: (val: number) => {
    if (props.serverSide) emit('update:page', val)
    else internalPage.value = val
  },
})

const processedRows = computed(() => {
  if (props.serverSide) return props.rows
  let result = props.rows
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(row =>
      visibleColumns.value.some(col => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      })
    )
  }
  if (sortKey.value && sortDir.value) {
    const key = sortKey.value, dir = sortDir.value
    result = [...result].sort((a, b) => {
      const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      return dir === 'asc' ? cmp : -cmp
    })
  }
  return result
})

const groupedRows = computed(() => {
  if (!props.groupBy) return null
  const map = new Map<string, Record<string, any>[]>()
  for (const row of processedRows.value) {
    const key = String(row[props.groupBy] ?? 'Sin grupo')
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return map
})

const totalCount = computed(() => props.serverSide ? (props.total ?? 0) : processedRows.value.length)
const visibleRows = computed(() => {
  if (props.serverSide) return props.rows
  const start = (currentPage.value - 1) * props.perPage
  return processedRows.value.slice(start, start + props.perPage)
})

watch([search, sortKey, sortDir], () => {
  if (!props.serverSide) internalPage.value = 1
})

function emitFetch() {
  emit('fetch', {
    page: currentPage.value,
    perPage: props.perPage,
    search: search.value,
    sortKey: sortKey.value,
    sortDir: sortDir.value,
  })
}

const mounted = ref(false)
onMounted(() => {
  mounted.value = true
  if (props.serverSide) emitFetch()
})

watch([search, sortKey, sortDir], () => {
  if (!props.serverSide || !mounted.value) return
  internalPage.value = 1
  emitFetch()
})

watch(currentPage, () => {
  if (!props.serverSide || !mounted.value) return
  emitFetch()
})

const selected = computed({
  get: () => props.modelValue ?? [],
  set: (val) => emit('update:modelValue', val),
})
function rowId(row: Record<string, any>) { return row[props.rowKey] }
function isSelected(row: Record<string, any>) { return selected.value.some(r => rowId(r) === rowId(row)) }
function toggleRow(row: Record<string, any>) {
  if (isSelected(row)) selected.value = selected.value.filter(r => rowId(r) !== rowId(row))
  else selected.value = [...selected.value, row]
}
const allOnPageSelected = computed(() => visibleRows.value.length > 0 && visibleRows.value.every(r => isSelected(r)))
const someOnPageSelected = computed(() => visibleRows.value.some(r => isSelected(r)) && !allOnPageSelected.value)
function toggleAll() {
  if (allOnPageSelected.value) selected.value = selected.value.filter(r => !visibleRows.value.some(v => rowId(v) === rowId(r)))
  else selected.value = [...selected.value, ...visibleRows.value.filter(r => !isSelected(r))]
}

function toggleExpand(row: Record<string, any>) {
  const id = rowId(row)
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}
function isExpanded(row: Record<string, any>) { return expanded.value.has(rowId(row)) }

const extraCols = computed(() =>
  (props.selectable ? 1 : 0) + (hasActions.value ? 1 : 0) + (hasExpand.value ? 1 : 0)
)
function alignClass(a?: string) { return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left' }
function skelWidth(ri: number, ci: number) { return `${SKEL[(ri * 3 + ci) % SKEL.length]}%` }

let resizeCol: string | null = null
let resizeStart = 0
let resizeInitial = 0

function onResizeDown(e: PointerEvent, col: DataTableColumn) {
  e.preventDefault()
  resizeCol = col.key
  resizeStart = e.clientX
  resizeInitial = colWidths.value[col.key] ?? 150
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp)
}
function onResizeMove(e: PointerEvent) {
  if (!resizeCol) return
  const w = Math.max(60, resizeInitial + e.clientX - resizeStart)
  colWidths.value = { ...colWidths.value, [resizeCol]: w }
}
function onResizeUp() {
  resizeCol = null
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
}

function exportCSV() {
  const cols = visibleColumns.value
  const header = cols.map(c => c.label).join(',')
  const body = processedRows.value.map(row =>
    cols.map(c => {
      const v = String(row[c.key] ?? '')
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(',')
  ).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'data.csv'; a.click()
  URL.revokeObjectURL(url)
}

function colStyle(col: DataTableColumn) {
  const w = colWidths.value[col.key]
  if (w) return { width: `${w}px`, minWidth: col.minWidth }
  return { width: col.width, minWidth: col.minWidth }
}
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-sm border border-outline-variant">

    <!-- Toolbar -->
    <div
      v-if="searchable || columnToggle || exportable || $slots.toolbar"
      class="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-2.5"
    >
      <div v-if="searchable" class="flex min-w-48 flex-1 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
        <MIcon name="search" :size="16" class="shrink-0 text-on-surface-variant" />
        <input v-model="search" type="text" placeholder="Buscar..." class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant" />
        <button v-if="search" class="text-on-surface-variant transition-colors hover:text-on-surface" @click="search = ''">
          <MIcon name="close" :size="14" />
        </button>
      </div>

      <slot name="toolbar" />

      <Transition enter-active-class="transition-[opacity,transform] duration-150" enter-from-class="opacity-0 scale-90" leave-active-class="transition-[opacity,transform] duration-100" leave-to-class="opacity-0 scale-90">
        <span v-if="selectable && selected.length > 0" class="rounded-full bg-primary/12 px-3 py-1 text-label-small font-medium text-primary">
          {{ selected.length }} seleccionado{{ selected.length !== 1 ? 's' : '' }}
        </span>
      </Transition>

      <!-- Column toggle -->
      <div v-if="columnToggle" class="relative">
        <MIconButton icon="view_column" label="Columnas" :size="36" @click="showColMenu = !showColMenu" />
        <div v-if="showColMenu" class="absolute right-0 top-full z-10 mt-1 min-w-40 rounded-lg bg-surface-container py-2 shadow-elevation-3">
          <label v-for="col in columns" :key="col.key" class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-on-surface/4">
            <MCheckbox
              :model-value="!hiddenCols.has(col.key)"
              @update:model-value="hiddenCols.has(col.key) ? hiddenCols.delete(col.key) : hiddenCols.add(col.key)"
            />
            <span class="text-body-small text-on-surface">{{ col.label }}</span>
          </label>
        </div>
      </div>

      <MIconButton v-if="exportable" icon="download" label="Exportar CSV" :size="36" @click="exportCSV" />
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead :class="stickyHeader ? 'sticky top-0 z-1' : ''">
          <tr class="bg-surface-container-high">
            <th v-if="hasExpand" class="w-10 px-2" :class="dense ? 'py-2' : 'py-3'" />
            <th v-if="selectable" class="w-12 px-4" :class="dense ? 'py-2' : 'py-3'">
              <MCheckbox :model-value="allOnPageSelected" :indeterminate="someOnPageSelected" @update:model-value="toggleAll" />
            </th>
            <th
              v-for="col in visibleColumns"
              :key="col.key"
              :style="colStyle(col)"
              :class="[
                'relative whitespace-nowrap text-label-medium font-medium text-on-surface-variant',
                dense ? 'px-3 py-2' : 'px-4 py-3',
                alignClass(col.align),
                col.sortable ? 'cursor-pointer select-none hover:text-on-surface transition-colors duration-100' : '',
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
              <!-- Resize handle -->
              <div
                v-if="col.resizable"
                class="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
                @pointerdown="onResizeDown($event, col)"
              />
            </th>
            <th v-if="hasActions" class="w-1 px-4" :class="dense ? 'py-2' : 'py-3'" />
          </tr>
        </thead>

        <tbody>
          <!-- Loading -->
          <template v-if="loading">
            <tr v-for="ri in perPage" :key="`sk-${ri}`" class="border-t border-outline-variant">
              <td v-if="hasExpand" :class="dense ? 'px-2 py-2' : 'px-2 py-3'" />
              <td v-if="selectable" :class="dense ? 'px-4 py-2' : 'px-4 py-3.5'">
                <div class="h-4 w-4 animate-pulse rounded bg-on-surface/10" />
              </td>
              <td v-for="(col, ci) in visibleColumns" :key="col.key" :class="dense ? 'px-3 py-2' : 'px-4 py-3.5'">
                <div class="h-4 animate-pulse rounded-full bg-on-surface/10" :style="{ width: skelWidth(ri, ci) }" />
              </td>
              <td v-if="hasActions" :class="dense ? 'px-4 py-2' : 'px-4 py-3.5'">
                <div class="ml-auto h-4 w-16 animate-pulse rounded-full bg-on-surface/10" />
              </td>
            </tr>
          </template>

          <!-- Empty -->
          <template v-else-if="visibleRows.length === 0">
            <tr>
              <td :colspan="visibleColumns.length + extraCols" class="border-t border-outline-variant px-4 py-14 text-center">
                <slot name="empty">
                  <MIcon name="search_off" :size="36" class="mb-2 text-on-surface-variant opacity-30" />
                  <p class="text-body-medium text-on-surface-variant">{{ emptyText }}</p>
                </slot>
              </td>
            </tr>
          </template>

          <!-- Data rows -->
          <template v-else>
            <template v-for="row in visibleRows" :key="rowId(row)">
              <tr
                :class="[
                  'border-t border-outline-variant transition-colors duration-100',
                  'hover:bg-on-surface/4',
                  selectable && isSelected(row) ? 'bg-primary/6' : '',
                  striped ? 'even:bg-surface-container-lowest' : '',
                  selectable ? 'cursor-pointer' : '',
                ]"
                @click="selectable ? toggleRow(row) : emit('rowClick', row)"
              >
                <td v-if="hasExpand" class="px-2" :class="dense ? 'py-1' : 'py-2'" @click.stop>
                  <MIconButton
                    icon="expand_more"
                    label="Expandir"
                    :size="28"
                    :class="isExpanded(row) ? 'rotate-180' : ''"
                    class="transition-transform duration-200"
                    @click="toggleExpand(row)"
                  />
                </td>
                <td v-if="selectable" :class="dense ? 'px-4 py-1' : 'px-4 py-3'" @click.stop="toggleRow(row)">
                  <MCheckbox :model-value="isSelected(row)" @update:model-value="toggleRow(row)" />
                </td>
                <td
                  v-for="col in visibleColumns"
                  :key="col.key"
                  :class="['text-body-medium text-on-surface', alignClass(col.align), dense ? 'px-3 py-1.5' : 'px-4 py-3']"
                >
                  <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :col="col">
                    {{ row[col.key] ?? '—' }}
                  </slot>
                </td>
                <td v-if="hasActions" class="text-right" :class="dense ? 'px-4 py-1' : 'px-4 py-3'" @click.stop>
                  <slot name="row-actions" :row="row" />
                </td>
              </tr>
              <!-- Expanded content -->
              <tr v-if="hasExpand">
                <td :colspan="visibleColumns.length + extraCols" class="border-t border-outline-variant/50 bg-surface-container-lowest p-0">
                  <div class="dt-expand-grid" :class="isExpanded(row) ? 'dt-expand-open' : ''">
                    <div class="dt-expand-body">
                      <div class="px-6 py-4">
                        <slot name="row-expand" :row="row" />
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between gap-4 border-t border-outline-variant bg-surface-container-lowest px-4 py-2">
      <span class="text-label-small text-on-surface-variant">
        {{ totalCount }} registro{{ totalCount !== 1 ? 's' : '' }}
      </span>
      <MPagination :page="currentPage" :per-page="perPage" :total="totalCount" @update:page="currentPage = $event" />
    </div>
  </div>
</template>

<style scoped>
.dt-expand-grid {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms cubic-bezier(0.2, 0, 0, 1);
}
.dt-expand-grid.dt-expand-open {
  grid-template-rows: 1fr;
}
.dt-expand-body {
  min-height: 0;
  overflow: hidden;
}
</style>
