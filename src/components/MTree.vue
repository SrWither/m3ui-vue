<script setup lang="ts">
import { computed, provide, ref, type Ref } from 'vue'
import MTreeNode from './_MTreeNode.vue'
import MIcon from './MIcon.vue'

// ── Public types ────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string | number
  label: string
  icon?: string
  children?: TreeNode[]
  disabled?: boolean
  [key: string]: unknown
}

/** Shape injected into every _MTreeNode via provide/inject. */
export interface TreeContext {
  selected: Ref<string | number | null>
  checkedSet: Ref<Set<string | number>>
  expandedIds: Ref<Set<string | number>>
  checkable: Ref<boolean>
  selectNode: (node: TreeNode) => void
  toggleExpand: (id: string | number) => void
  toggleCheck: (node: TreeNode) => void
  getDescendantIds: (node: TreeNode) => (string | number)[]
  getLeafIds: (node: TreeNode) => (string | number)[]
}

// ── Props & emits ───────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    nodes: TreeNode[]
    /** Currently selected node id (single-select). */
    selected?: string | number | null
    /** Checked node ids (checkable multi-select). */
    checked?: (string | number)[]
    /** Show checkboxes with cascade selection. */
    checkable?: boolean
    /**
     * Which nodes start expanded.
     * 'all' | 'none' | array of ids (default: 'none').
     */
    defaultExpanded?: (string | number)[] | 'all' | 'none'
    emptyText?: string
  }>(),
  {
    selected: null,
    checked: () => [],
    checkable: false,
    defaultExpanded: 'none',
    emptyText: 'Sin elementos',
  },
)

const emit = defineEmits<{
  'update:selected': [string | number | null]
  'update:checked': [(string | number)[]]
  'node-click': [TreeNode]
}>()

// ── Helpers ─────────────────────────────────────────────────────────────────

function getDescendantIds(node: TreeNode): (string | number)[] {
  return [node.id, ...(node.children ?? []).flatMap(getDescendantIds)]
}

function getLeafIds(node: TreeNode): (string | number)[] {
  if (!node.children?.length) return [node.id]
  return node.children.flatMap(getLeafIds)
}

function getAllIds(nodes: TreeNode[]): (string | number)[] {
  return nodes.flatMap((n) => getDescendantIds(n))
}

// ── Expand state ────────────────────────────────────────────────────────────

function buildInitialExpanded(): Set<string | number> {
  if (props.defaultExpanded === 'all') return new Set(getAllIds(props.nodes))
  if (props.defaultExpanded === 'none') return new Set()
  return new Set(props.defaultExpanded)
}

const expandedIds = ref<Set<string | number>>(buildInitialExpanded())

function toggleExpand(id: string | number) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

// ── Selection ───────────────────────────────────────────────────────────────

const selectedRef = computed(() => props.selected ?? null)

function selectNode(node: TreeNode) {
  emit('update:selected', selectedRef.value === node.id ? null : node.id)
  emit('node-click', node)
}

// ── Checkable ───────────────────────────────────────────────────────────────

const checkedSet = computed(() => new Set(props.checked))

function toggleCheck(node: TreeNode) {
  const leafIds = getLeafIds(node)
  const allLeafsChecked = leafIds.every((id) => checkedSet.value.has(id))
  const next = new Set(props.checked)
  if (allLeafsChecked) {
    // Remove leaf ids + clean up any stale branch ids
    getDescendantIds(node).forEach((id) => next.delete(id))
  } else {
    leafIds.forEach((id) => next.add(id))
  }
  emit('update:checked', [...next])
}

// ── Provide context ─────────────────────────────────────────────────────────

provide<TreeContext>('m-tree', {
  selected: selectedRef,
  checkedSet,
  expandedIds,
  checkable: computed(() => props.checkable),
  selectNode,
  toggleExpand,
  toggleCheck,
  getDescendantIds,
  getLeafIds,
})

// ── Expose expand/collapse utilities ────────────────────────────────────────

function expandAll() { expandedIds.value = new Set(getAllIds(props.nodes)) }
function collapseAll() { expandedIds.value = new Set() }

defineExpose({ expandAll, collapseAll })
</script>

<template>
  <div role="tree" class="flex flex-col">
    <template v-if="nodes.length">
      <MTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :depth="0"
      >
        <!-- Forward all slots down the recursive tree -->
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </MTreeNode>
    </template>

    <div v-else class="flex flex-col items-center gap-2 py-10 text-on-surface-variant">
      <MIcon name="account_tree" :size="32" class="opacity-30" />
      <p class="text-body-medium">{{ emptyText }}</p>
    </div>
  </div>
</template>
