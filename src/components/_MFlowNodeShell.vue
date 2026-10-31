<script setup lang="ts">
// One node on MFlow's canvas: positions it, reports its size, and draws it (a `#node-<type>` slot, a group box or
// an MFlowNode). Pointer gestures are MFlow's, found through `data-flow-node`.
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, type Slot } from 'vue'
import { FLOW_KEY, FLOW_NODE_KEY, type FlowNode } from '../composables/useFlow'
import { SlotOutlet } from '../composables/_flowSlot'
import { useLocale } from '../composables/useLocale'
import MFlowNode from './MFlowNode.vue'

const props = defineProps<{ node: FlowNode; render?: Slot }>()

const flow = inject(FLOW_KEY)!
const locale = useLocale()
const el = ref<HTMLElement>()
const id = props.node.id

const node = computed(() => props.node)
const selected = computed(() => flow.selectedNodes.value.has(id))
const dragging = computed(() => flow.isLifted(id))
provide(FLOW_NODE_KEY, { id, node, selected, dragging })

const isGroup = computed(() => props.node.type === 'group')
const data = computed(() => (props.node.data ?? {}) as { label?: string; subtitle?: string; icon?: string })
const pos = computed(() => flow.getAbsolutePosition(id))
const box = computed(() => {
  // A group without a size follows its children; other nodes take a size only when given one
  if (isGroup.value) return flow.getSize(id)
  return { width: props.node.width, height: props.node.height }
})
const handlesFor = computed(() => {
  switch (props.node.type) {
    case 'input': return 'source'
    case 'output': return 'target'
    default: return 'both'
  }
})
const draggable = computed(() => props.node.draggable !== false && !flow.locked.value)

onMounted(() => flow.registerNodeEl(id, el.value!))
onBeforeUnmount(() => flow.registerNodeEl(id, null))
</script>

<template>
  <div
    ref="el"
    class="m3-flow-node absolute top-0 left-0 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
    :class="[node.class, draggable && (dragging ? 'cursor-grabbing' : 'cursor-grab')]"
    :style="{
      transform: `translate(${pos.x}px, ${pos.y}px)`,
      zIndex: flow.zIndexOf(id),
      width: box.width ? `${box.width}px` : undefined,
      height: box.height ? `${box.height}px` : undefined,
    }"
    :data-flow-node="id"
    :data-selected="selected || undefined"
    :data-dragging="dragging || undefined"
    tabindex="0"
    role="group"
    :aria-roledescription="locale.flowNode"
    :aria-label="data.label ?? id"
    @keydown="flow.onNodeKey($event, id)"
  >
    <SlotOutlet v-if="render" :fn="render" :scope="{ node, data: node.data, selected, dragging }" />
    <div
      v-else-if="isGroup"
      class="size-full rounded-lg border bg-surface-container-low/70 transition-colors"
      :class="selected ? 'border-primary' : 'border-outline-variant'"
    >
      <div v-if="data.label" class="flex h-9 items-center gap-2 px-3 text-label-large text-on-surface-variant">
        <span v-if="data.icon" class="material-symbols-outlined text-[18px]">{{ data.icon }}</span>
        {{ data.label }}
      </div>
    </div>
    <MFlowNode v-else :label="data.label ?? id" :subtitle="data.subtitle" :icon="data.icon" :handles="handlesFor" />
  </div>
</template>
