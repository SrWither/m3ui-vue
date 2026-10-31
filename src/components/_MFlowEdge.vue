<script setup lang="ts">
// One edge on MFlow's canvas, inside its shared <svg>: a wide invisible stroke to hit, the path (or an
// `#edge-<type>` slot), arrowheads, and once selected the ends to drag elsewhere. Gestures are MFlow's, found
// through `data-flow-edge` / `data-flow-reconnect`.
import { computed, inject, type Slot } from 'vue'
import { FLOW_KEY, type FlowEdge, type FlowMarker } from '../composables/useFlow'
import { arrowPath } from '../composables/flowPaths'
import { SlotOutlet } from '../composables/_flowSlot'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{ edge: FlowEdge; render?: Slot }>()

const flow = inject(FLOW_KEY)!
const locale = useLocale()
const geo = computed(() => flow.edgeGeometry(props.edge))
const selected = computed(() => flow.selectedEdges.value.has(props.edge.id))
// A dragged node would splice into it if dropped now
const highlighted = computed(() => flow.insertEdge.value === props.edge.id)
const selectable = computed(() => props.edge.selectable !== false && !flow.locked.value)
const reconnectable = computed(() => selected.value && flow.isReconnectable(props.edge))

function marker(kind: FlowMarker | undefined, x: number, y: number, angle: number, inset: number) {
  if (!kind || kind === 'none') return ''
  return arrowPath(x - inset * Math.cos(angle), y - inset * Math.sin(angle), angle, 9, kind === 'arrow-closed')
}
const markerEnd = computed(() => {
  const g = geo.value
  return g ? marker(props.edge.markerEnd ?? 'arrow-closed', g.targetX, g.targetY, g.targetAngle, g.targetInset) : ''
})
const markerStart = computed(() => {
  const g = geo.value
  return g ? marker(props.edge.markerStart, g.sourceX, g.sourceY, g.sourceAngle + Math.PI, g.sourceInset) : ''
})
const label = computed(() => {
  const name = (id: string) => String((flow.getNode(id)?.data as { label?: unknown } | undefined)?.label ?? id)
  return locale.flowEdge.replace('{source}', name(props.edge.source)).replace('{target}', name(props.edge.target))
})
const scope = computed(() => ({ edge: props.edge, selected: selected.value, highlighted: highlighted.value, ...geo.value }))
</script>

<template>
  <g
    v-if="geo"
    class="m3-flow-edge outline-none"
    :class="[edge.class, selected && 'm3-flow-edge-selected']"
    :data-flow-edge="edge.id"
    :tabindex="selectable ? 0 : undefined"
    :aria-label="label"
    role="img"
    @keydown="flow.onEdgeKey($event, edge.id)"
  >
    <path :d="geo.path" fill="none" stroke="transparent" stroke-width="16" :style="{ pointerEvents: 'stroke' }" :class="selectable && 'cursor-pointer'" />
    <SlotOutlet v-if="render" :fn="render" :scope="scope" />
    <template v-else>
      <path
        :d="geo.path"
        fill="none"
        :stroke-width="highlighted ? 4 : 2"
        stroke-linecap="round"
        class="transition-[stroke] duration-150"
        :class="[selected || highlighted ? 'stroke-primary' : 'stroke-outline', edge.animated && 'm3-flow-edge-animated']"
      />
      <path
        v-for="(m, i) in [markerEnd, markerStart]"
        v-show="m"
        :key="i"
        :d="m"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        class="transition-[stroke,fill] duration-150"
        :class="[selected || highlighted ? 'stroke-primary' : 'stroke-outline', (i === 0 ? edge.markerEnd ?? 'arrow-closed' : edge.markerStart) === 'arrow-closed' ? (selected || highlighted ? 'fill-primary' : 'fill-outline') : 'fill-none']"
      />
    </template>
    <template v-if="reconnectable">
      <circle
        v-for="end in (['source', 'target'] as const)"
        :key="end"
        :data-flow-reconnect="end"
        :cx="end === 'source' ? geo.sourceX : geo.targetX"
        :cy="end === 'source' ? geo.sourceY : geo.targetY"
        r="6"
        stroke-width="2"
        class="cursor-move fill-surface stroke-primary"
        :style="{ pointerEvents: 'all' }"
      />
    </template>
  </g>
</template>
