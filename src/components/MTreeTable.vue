<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

export interface TreeTableColumn {
  key: string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface TreeTableRow {
  [key: string]: any
  children?: TreeTableRow[]
}

const props = withDefaults(defineProps<{
  columns: TreeTableColumn[]
  rows: TreeTableRow[]
  rowKey?: string
  defaultExpanded?: boolean
  indent?: number
  dense?: boolean
}>(), {
  rowKey: 'id',
  defaultExpanded: false,
  indent: 24,
  dense: false,
})

const emit = defineEmits<{ rowClick: [TreeTableRow] }>()

const expanded = ref<Set<any>>(new Set(
  props.defaultExpanded ? collectIds(props.rows) : []
))

function collectIds(rows: TreeTableRow[]): any[] {
  const ids: any[] = []
  for (const r of rows) {
    if (r.children?.length) {
      ids.push(r[props.rowKey])
      ids.push(...collectIds(r.children))
    }
  }
  return ids
}

function toggleExpand(row: TreeTableRow) {
  const id = row[props.rowKey]
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

function isExpanded(row: TreeTableRow) { return expanded.value.has(row[props.rowKey]) }

interface FlatRow {
  row: TreeTableRow
  depth: number
  hasChildren: boolean
  isExpanded: boolean
}

const flatRows = computed(() => {
  const result: FlatRow[] = []
  function walk(rows: TreeTableRow[], depth: number) {
    for (const row of rows) {
      const hasChildren = !!row.children?.length
      const exp = isExpanded(row)
      result.push({ row, depth, hasChildren, isExpanded: exp })
      if (hasChildren && exp) walk(row.children!, depth + 1)
    }
  }
  walk(props.rows, 0)
  return result
})

function expandAll() {
  expanded.value = new Set(collectIds(props.rows))
}
function collapseAll() {
  expanded.value = new Set()
}

function alignClass(a?: string) { return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left' }
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-sm border border-outline-variant">
    <!-- Toolbar -->
    <div v-if="$slots.toolbar" class="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2">
      <slot name="toolbar" :expand-all="expandAll" :collapse-all="collapseAll" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-surface-container-high">
            <th
              v-for="(col, ci) in columns"
              :key="col.key"
              :style="col.width ? { width: col.width } : undefined"
              :class="[
                'whitespace-nowrap text-label-medium font-medium text-on-surface-variant',
                dense ? 'px-3 py-2' : 'px-4 py-3',
                alignClass(col.align),
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, i) in flatRows"
            :key="item.row[rowKey] ?? i"
            class="border-t border-outline-variant transition-colors duration-100 hover:bg-on-surface/[0.04]"
            :class="item.depth > 0 ? 'bg-surface-container-lowest/50' : ''"
            @click="emit('rowClick', item.row)"
          >
            <td
              v-for="(col, ci) in columns"
              :key="col.key"
              :class="['text-body-medium text-on-surface', alignClass(col.align), dense ? 'px-3 py-1.5' : 'px-4 py-3']"
            >
              <!-- First column gets indent + expand icon -->
              <div v-if="ci === 0" class="flex items-center gap-1" :style="{ paddingLeft: `${item.depth * indent}px` }">
                <button
                  v-if="item.hasChildren"
                  type="button"
                  class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-transform duration-200 hover:bg-on-surface/8"
                  :class="item.isExpanded ? 'rotate-90' : ''"
                  @click.stop="toggleExpand(item.row)"
                >
                  <MIcon name="chevron_right" :size="18" />
                </button>
                <span v-else class="w-6 shrink-0" />
                <slot :name="`cell-${col.key}`" :row="item.row" :value="item.row[col.key]" :depth="item.depth">
                  <span :class="item.hasChildren ? 'font-medium' : ''">{{ item.row[col.key] ?? '—' }}</span>
                </slot>
              </div>
              <template v-else>
                <slot :name="`cell-${col.key}`" :row="item.row" :value="item.row[col.key]" :depth="item.depth">
                  {{ item.row[col.key] ?? '—' }}
                </slot>
              </template>
            </td>
          </tr>
          <tr v-if="!flatRows.length">
            <td :colspan="columns.length" class="border-t border-outline-variant px-4 py-10 text-center">
              <MIcon name="account_tree" :size="36" class="mb-2 text-on-surface-variant opacity-30" />
              <p class="text-body-medium text-on-surface-variant">Sin datos</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
