<script setup lang="ts">
/**
 * A connection point on a node in MFlow: drag from it to another node's handle to connect them. Sits centered on
 * its node's side (`position`); move it with your own classes or style (it's measured where it ends up). Give
 * each an `id` when a node has several of a type. Only inside a node (MFlowNode, or a `#node-<type>` slot).
 */
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { FLOW_KEY, FLOW_NODE_KEY, type FlowPosition } from '../composables/useFlow'

const props = withDefaults(defineProps<{
  /** `source`: edges leave from it; `target`: they arrive */
  type?: 'source' | 'target'
  /** Its side; `'auto'` sits in the node's middle (or where you put it) and each edge leaves or arrives on the side facing its other end */
  position?: FlowPosition | 'auto'
  id?: string
  connectable?: boolean
}>(), {
  type: 'source',
  position: undefined,
  id: undefined,
  connectable: true,
})

const flow = inject(FLOW_KEY, null)
const state = inject(FLOW_NODE_KEY, null)
const el = ref<HTMLElement>()
const side = computed<FlowPosition | 'auto'>(() => props.position ?? (props.type === 'source' ? (flow?.direction.value === 'vertical' ? 'bottom' : 'right') : (flow?.direction.value === 'vertical' ? 'top' : 'left')))
const canConnect = computed(() => props.connectable && !!flow?.nodesConnectable.value && state?.node.value.connectable !== false)
const key = computed(() => `${state?.id}:${props.id ?? ''}:${props.type}`)
const candidate = computed(() => flow?.connectionTarget.value?.key === key.value ? flow.connectionTarget.value : null)

const PLACE: Record<FlowPosition | 'auto', string> = {
  auto: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  right: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
  bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  left: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
}

let unregister: (() => void) | undefined
onMounted(() => {
  if (!flow || !state) return
  unregister = flow.registerHandle(state.id, el.value!, () => ({ id: props.id ?? null, type: props.type, position: side.value, connectable: canConnect.value }))
})
onBeforeUnmount(() => unregister?.())
</script>

<template>
  <div
    ref="el"
    class="m3-flow-handle absolute z-10 size-2.5 rounded-full border-2 transition-[background-color,border-color,scale,opacity] duration-150 before:absolute before:-inset-2.5 before:rounded-full"
    :class="[
      PLACE[side],
      candidate ? (candidate.valid ? 'scale-150 border-primary bg-primary' : 'scale-125 border-error bg-error-container') : 'border-outline bg-surface',
      canConnect ? 'cursor-crosshair hover:scale-125 hover:border-primary' : 'opacity-0',
    ]"
    :data-flow-handle="type"
    :data-handle-id="id"
    :data-flow-connectable="canConnect"
    aria-hidden="true"
  />
</template>
