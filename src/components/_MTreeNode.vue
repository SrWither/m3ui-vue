<script setup lang="ts">
import { computed, inject } from 'vue'
import MTreeNode from './_MTreeNode.vue'
import MCheckbox from './MCheckbox.vue'
import MIcon from './MIcon.vue'
import type { TreeContext, TreeNode } from './MTree.vue'

const props = defineProps<{ node: TreeNode; depth: number }>()

const tree = inject<TreeContext>('m-tree')!

const hasChildren = computed(() => !!props.node.children?.length)
const isExpanded  = computed(() => tree.expandedIds.value.has(props.node.id))
const isSelected  = computed(() => tree.selected.value === props.node.id)

// Use only leaf ids for checkbox visual state (branch ids are never stored in checkedSet)
const leafIds = computed(() => tree.getLeafIds(props.node))
const checkedLeafCount = computed(() => leafIds.value.filter(id => tree.checkedSet.value.has(id)).length)
const isChecked       = computed(() => leafIds.value.length > 0 && checkedLeafCount.value === leafIds.value.length)
const isIndeterminate = computed(() => checkedLeafCount.value > 0 && !isChecked.value)

function onRowClick() {
  if (props.node.disabled) return
  tree.selectNode(props.node)
  if (hasChildren.value) tree.toggleExpand(props.node.id)
}

function onChevronClick(e: MouseEvent) {
  e.stopPropagation()
  if (props.node.disabled) return
  tree.toggleExpand(props.node.id)
}

function onCheck() {
  if (props.node.disabled) return
  tree.toggleCheck(props.node)
}

// ── Height transition hooks ────────────────────────────────────────────────
function onEnter(el: Element) {
  const e = el as HTMLElement
  e.style.height = '0'
  e.style.opacity = '0'
  e.style.overflow = 'hidden'
  e.offsetHeight // force reflow
  e.style.transition = 'height 200ms cubic-bezier(0.4,0,0.2,1), opacity 150ms ease'
  e.style.height = e.scrollHeight + 'px'
  e.style.opacity = '1'
}
function onAfterEnter(el: Element) {
  const e = el as HTMLElement
  e.style.height = ''
  e.style.overflow = ''
  e.style.transition = ''
  e.style.opacity = ''
}
function onLeave(el: Element) {
  const e = el as HTMLElement
  e.style.height = e.scrollHeight + 'px'
  e.style.overflow = 'hidden'
  e.offsetHeight // force reflow
  e.style.transition = 'height 180ms cubic-bezier(0.4,0,0.2,1), opacity 120ms ease'
  e.style.height = '0'
  e.style.opacity = '0'
}
function onAfterLeave(el: Element) {
  const e = el as HTMLElement
  e.style.height = ''
  e.style.overflow = ''
  e.style.transition = ''
  e.style.opacity = ''
}
</script>

<template>
  <div role="treeitem" :aria-expanded="hasChildren ? isExpanded : undefined" :aria-selected="isSelected">
    <!-- ── Row ─────────────────────────────────────────────────────────────── -->
    <div
      :class="[
        'flex items-center gap-1 rounded-sm py-1 pr-2 transition-colors duration-100 select-none',
        node.disabled
          ? 'cursor-not-allowed opacity-38'
          : 'cursor-pointer',
        !node.disabled && isSelected
          ? 'bg-primary/[0.10]'
          : !node.disabled
            ? 'hover:bg-on-surface/[0.04]'
            : '',
      ]"
      @click="onRowClick"
    >
      <!-- Indent spacer (no lines for depth 0, lines provided by parent's border-l) -->
      <div class="flex w-6 shrink-0 items-center justify-center">
        <!-- Chevron for branch nodes -->
        <button
          v-if="hasChildren"
          type="button"
          class="flex h-5 w-5 items-center justify-center rounded text-on-surface-variant transition-transform duration-200"
          :class="isExpanded ? 'rotate-90' : ''"
          :disabled="node.disabled || undefined"
          @click="onChevronClick"
        >
          <MIcon name="chevron_right" :size="16" />
        </button>
      </div>

      <!-- Checkbox (checkable mode) -->
      <div v-if="tree.checkable.value" class="shrink-0" @click.stop="onCheck">
        <MCheckbox
          :model-value="isChecked"
          :indeterminate="isIndeterminate"
          :disabled="node.disabled"
          @update:model-value="onCheck"
        />
      </div>

      <!-- Node icon -->
      <MIcon
        v-if="node.icon"
        :name="node.icon"
        :size="16"
        class="shrink-0 transition-colors"
        :class="isSelected ? 'text-primary' : 'text-on-surface-variant'"
      />

      <!-- Label -->
      <span
        class="min-w-0 flex-1 truncate text-body-medium transition-colors"
        :class="isSelected ? 'font-medium text-primary' : 'text-on-surface'"
      >
        <slot name="label" :node="node">{{ node.label }}</slot>
      </span>

      <!-- Check count badge (branch + checkable) -->
      <span
        v-if="hasChildren && tree.checkable.value"
        class="shrink-0 text-label-small tabular-nums text-on-surface-variant"
      >
        {{ checkedLeafCount }}/{{ leafIds.length }}
      </span>

      <!-- Optional trailing slot -->
      <slot name="trailing" :node="node" />
    </div>

    <!-- ── Children ───────────────────────────────────────────────────────── -->
    <Transition
      @enter="onEnter"
      @after-enter="onAfterEnter"
      @leave="onLeave"
      @after-leave="onAfterLeave"
    >
      <div
        v-if="isExpanded && hasChildren"
        class="ml-3 border-l border-outline-variant pl-2"
      >
        <MTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :depth="depth + 1"
        >
          <!-- @vue-ignore -->
          <template v-for="(_, name) in $slots" #[name]="sp">
            <slot :name="name" v-bind="sp ?? {}" />
          </template>
        </MTreeNode>
      </div>
    </Transition>
  </div>
</template>
