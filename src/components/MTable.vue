<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import MCheckbox from './MCheckbox.vue'
import MIcon from './MIcon.vue'
import MPagination from './MPagination.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface TableFetchParams {
  page: number
  perPage: number
  search: string
  sortKey: string
  sortDir: 'asc' | 'desc' | ''
}

// Static widths so skeleton markup is stable across re-renders
const SKEL = [65, 80, 50, 75, 90, 55, 70, 85, 60, 78, 88, 52, 70, 83, 58]

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: Record<string, any>[]
    loading?: boolean
    emptyText?: string
    rowKey?: string
    selectable?: boolean
    modelValue?: Record<string, any>[]
    perPage?: number
    searchable?: boolean
    /** Emit `fetch` instead of filtering locally. Requires :total. */
    serverSide?: boolean
    total?: number
    page?: number
    searchPlaceholder?: string
    selectedText?: string
  }>(),
  {
    loading: false,
    rowKey: 'id',
    selectable: false,
    modelValue: () => [],
    perPage: 10,
    searchable: true,
    serverSide: false,
    total: 0,
    page: 1,
  },
)

const emit = defineEmits<{
  'update:modelValue': [Record<string, any>[]]
  'update:page': [number]
  fetch: [TableFetchParams]
}>()

// ── Search ─────────────────────────────────────────────────────────────────
const search = ref('')

// ── Sort ───────────────────────────────────────────────────────────────────
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc' | ''>('')

function toggleSort(key: string) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc'
  } else {
    sortKey.value = ''
    sortDir.value = ''
  }
}

// ── Pagination ─────────────────────────────────────────────────────────────
const internalPage = ref(1)

const currentPage = computed({
  get: () => (props.serverSide ? (props.page ?? 1) : internalPage.value),
  set: (val: number) => {
    if (props.serverSide) emit('update:page', val)
    else internalPage.value = val
  },
})

// ── Client-side data processing ────────────────────────────────────────────
const processedRows = computed(() => {
  if (props.serverSide) return props.rows

  let result = props.rows

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter((row) =>
      props.columns.some((col) => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      }),
    )
  }

  if (sortKey.value && sortDir.value) {
    const key = sortKey.value
    const dir = sortDir.value
    result = [...result].sort((a, b) => {
      const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return dir === 'asc' ? cmp : -cmp
    })
  }

  return result
})

const totalCount = computed(() =>
  props.serverSide ? (props.total ?? 0) : processedRows.value.length,
)

const visibleRows = computed(() => {
  if (props.serverSide) return props.rows
  const start = (currentPage.value - 1) * props.perPage
  return processedRows.value.slice(start, start + props.perPage)
})

watch([search, sortKey, sortDir], () => {
  if (!props.serverSide) internalPage.value = 1
})

// ── Server-side fetch ──────────────────────────────────────────────────────
const mounted = ref(false)

function emitFetch() {
  emit('fetch', {
    page: currentPage.value,
    perPage: props.perPage,
    search: search.value,
    sortKey: sortKey.value,
    sortDir: sortDir.value,
  })
}

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

// ── Row selection ──────────────────────────────────────────────────────────
const selected = computed({
  get: () => props.modelValue ?? [],
  set: (val) => emit('update:modelValue', val),
})

function rowId(row: Record<string, any>) {
  return row[props.rowKey]
}
function isSelected(row: Record<string, any>) {
  return selected.value.some((r) => rowId(r) === rowId(row))
}
function toggleRow(row: Record<string, any>) {
  if (isSelected(row)) selected.value = selected.value.filter((r) => rowId(r) !== rowId(row))
  else selected.value = [...selected.value, row]
}

const allOnPageSelected = computed(
  () => visibleRows.value.length > 0 && visibleRows.value.every((r) => isSelected(r)),
)
const someOnPageSelected = computed(
  () => visibleRows.value.some((r) => isSelected(r)) && !allOnPageSelected.value,
)

function toggleAll() {
  if (allOnPageSelected.value) {
    selected.value = selected.value.filter(
      (r) => !visibleRows.value.some((v) => rowId(v) === rowId(r)),
    )
  } else {
    selected.value = [...selected.value, ...visibleRows.value.filter((r) => !isSelected(r))]
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const extraCols = computed(
  () => (props.selectable ? 1 : 0) + (useSlots()['row-actions'] ? 1 : 0),
)

function alignClass(align?: string) {
  return align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
}
function skelWidth(ri: number, ci: number) {
  return `${SKEL[(ri * 3 + ci) % SKEL.length]}%`
}

import { useSlots } from 'vue'
const slots = useSlots()
const hasActions = computed(() => !!slots['row-actions'])
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-sm border border-outline-variant">

    <!-- ── Toolbar ───────────────────────────────────────────────────────── -->
    <div
      v-if="searchable || $slots.toolbar"
      class="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-2.5"
    >
      <!-- Search -->
      <div v-if="searchable" class="flex min-w-48 flex-1 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-[border-color,box-shadow] duration-150">
        <MIcon name="search" :size="16" class="shrink-0 text-on-surface-variant" />
        <input
          v-model="search"
          type="text"
          :placeholder="searchPlaceholder ?? locale.search"
          class="w-full bg-transparent text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        <button
          v-if="search"
          class="text-on-surface-variant transition-colors hover:text-on-surface"
          @click="search = ''"
        >
          <MIcon name="close" :size="14" />
        </button>
      </div>

      <!-- Extra toolbar content (filters, buttons, etc.) -->
      <slot name="toolbar" />

      <!-- Selection count pill -->
      <Transition
        enter-active-class="transition-[opacity,transform] duration-150"
        enter-from-class="opacity-0 scale-90"
        leave-active-class="transition-[opacity,transform] duration-100"
        leave-to-class="opacity-0 scale-90"
      >
        <span
          v-if="selectable && selected.length > 0"
          class="rounded-full bg-primary/12 px-3 py-1 text-label-small font-medium text-primary"
        >
          {{ selected.length }} {{ selectedText ?? locale.selectedCount }}{{ selected.length !== 1 ? 's' : '' }}
        </span>
      </Transition>
    </div>

    <!-- ── Table ─────────────────────────────────────────────────────────── -->
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">

        <!-- Header -->
        <thead>
          <tr class="bg-surface-container-high">
            <th v-if="selectable" class="w-12 px-4 py-3">
              <MCheckbox
                :model-value="allOnPageSelected"
                :indeterminate="someOnPageSelected"
                @update:model-value="toggleAll"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="col.width ? { width: col.width } : undefined"
              :class="[
                'px-4 py-3 text-label-medium font-medium text-on-surface-variant whitespace-nowrap',
                alignClass(col.align),
                col.sortable
                  ? 'cursor-pointer select-none hover:text-on-surface transition-colors duration-100'
                  : '',
              ]"
              @click="col.sortable ? toggleSort(col.key) : undefined"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <span v-if="col.sortable" class="inline-flex">
                  <MIcon
                    v-if="sortKey === col.key && sortDir === 'asc'"
                    name="arrow_upward"
                    :size="14"
                    class="text-primary"
                  />
                  <MIcon
                    v-else-if="sortKey === col.key && sortDir === 'desc'"
                    name="arrow_downward"
                    :size="14"
                    class="text-primary"
                  />
                  <MIcon v-else name="unfold_more" :size="14" class="opacity-30" />
                </span>
              </span>
            </th>
            <th v-if="hasActions" class="w-1 px-4 py-3" />
          </tr>
        </thead>

        <!-- Body -->
        <tbody>
          <!-- Loading skeleton -->
          <template v-if="loading">
            <tr
              v-for="ri in perPage"
              :key="`sk-${ri}`"
              class="border-t border-outline-variant"
            >
              <td v-if="selectable" class="px-4 py-3.5">
                <div class="h-4 w-4 animate-pulse rounded bg-on-surface/10" />
              </td>
              <td
                v-for="(col, ci) in columns"
                :key="col.key"
                class="px-4 py-3.5"
              >
                <div
                  class="h-4 animate-pulse rounded-full bg-on-surface/10"
                  :style="{ width: skelWidth(ri, ci) }"
                />
              </td>
              <td v-if="hasActions" class="px-4 py-3.5">
                <div class="ml-auto h-4 w-16 animate-pulse rounded-full bg-on-surface/10" />
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <template v-else-if="visibleRows.length === 0">
            <tr>
              <td
                :colspan="columns.length + extraCols"
                class="border-t border-outline-variant px-4 py-14 text-center"
              >
                <slot name="empty">
                  <MIcon name="search_off" :size="36" class="mb-2 text-on-surface-variant opacity-30" />
                  <p class="text-body-medium text-on-surface-variant">{{ emptyText ?? locale.noResults }}</p>
                </slot>
              </td>
            </tr>
          </template>

          <!-- Data rows -->
          <template v-else>
            <tr
              v-for="row in visibleRows"
              :key="rowId(row)"
              :class="[
                'border-t border-outline-variant transition-colors duration-100',
                'hover:bg-on-surface/4',
                selectable && isSelected(row) ? 'bg-primary/6' : '',
                selectable ? 'cursor-pointer' : '',
              ]"
              @click="selectable ? toggleRow(row) : undefined"
            >
              <td v-if="selectable" class="px-4 py-3" @click.stop="toggleRow(row)">
                <MCheckbox
                  :model-value="isSelected(row)"
                  @update:model-value="toggleRow(row)"
                />
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                :class="['px-4 py-3 text-body-medium text-on-surface', alignClass(col.align)]"
              >
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :col="col">
                  {{ row[col.key] ?? '—' }}
                </slot>
              </td>
              <td v-if="hasActions" class="px-4 py-3 text-right" @click.stop>
                <slot name="row-actions" :row="row" />
              </td>
            </tr>
          </template>
        </tbody>

      </table>
    </div>

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <div class="border-t border-outline-variant bg-surface-container-lowest px-4 py-2">
      <MPagination
        :page="currentPage"
        :per-page="perPage"
        :total="totalCount"
        @update:page="currentPage = $event"
      />
    </div>

  </div>
</template>
