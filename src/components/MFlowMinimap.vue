<script setup lang="ts">
/**
 * A small overview of an MFlow (put it in MFlow's default slot): every node as a block, the part in view
 * outlined. Drag or click in it to move the view there; the wheel zooms. Not an M3 spec component.
 */
import { computed, ref } from 'vue'
import { useFlow, type FlowNode } from '../composables/useFlow'
import { panelPositionClass, type FlowPanelPosition } from '../composables/_flowPanel'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  position?: FlowPanelPosition
  width?: number
  height?: number
  /** A node's fill (any CSS color); default outline-variant, primary when selected */
  nodeColor?: (node: FlowNode) => string | undefined
  /** Drag and click move the view */
  pannable?: boolean
  /** The wheel zooms */
  zoomable?: boolean
}>(), {
  position: 'bottom-right',
  width: 200,
  height: 140,
  pannable: true,
  zoomable: true,
})

const flow = useFlow()
const locale = useLocale()
const svg = ref<SVGSVGElement>()

const blocks = computed(() => flow.nodes.value
  .filter((n) => !n.hidden)
  .map((n) => ({ node: n, ...flow.getAbsolutePosition(n.id), ...flow.getSize(n.id) }))
  .filter((b) => b.width > 0 && b.height > 0))
const view = computed(() => {
  const v = flow.viewport.value
  const s = flow.size.value
  return { x: -v.x / v.zoom, y: -v.y / v.zoom, width: s.width / v.zoom, height: s.height / v.zoom }
})
let frozen: { x: number; y: number; width: number; height: number } | null = null
const box = computed(() => {
  if (frozen) return frozen
  let x1 = view.value.x
  let y1 = view.value.y
  let x2 = x1 + view.value.width
  let y2 = y1 + view.value.height
  for (const b of blocks.value) {
    x1 = Math.min(x1, b.x)
    y1 = Math.min(y1, b.y)
    x2 = Math.max(x2, b.x + b.width)
    y2 = Math.max(y2, b.y + b.height)
  }
  // The minimap's own aspect, centered on everything, with a margin
  const w = Math.max(1, x2 - x1)
  const h = Math.max(1, y2 - y1)
  const scale = Math.max(w / props.width, h / props.height) * 1.1
  const vw = props.width * scale
  const vh = props.height * scale
  return { x: x1 + w / 2 - vw / 2, y: y1 + h / 2 - vh / 2, width: vw, height: vh }
})
const mask = computed(() => {
  const b = box.value
  const v = view.value
  return `M${b.x},${b.y}h${b.width}v${b.height}h${-b.width}Z M${v.x},${v.y}v${v.height}h${v.width}v${-v.height}Z`
})

function toFlow(e: PointerEvent | WheelEvent) {
  const r = svg.value!.getBoundingClientRect()
  const b = box.value
  return { x: b.x + ((e.clientX - r.left) / r.width) * b.width, y: b.y + ((e.clientY - r.top) / r.height) * b.height }
}
function onPointerDown(e: PointerEvent) {
  if (!props.pannable) return
  e.preventDefault()
  frozen = { ...box.value }
  svg.value!.setPointerCapture?.(e.pointerId)
  const p = toFlow(e)
  flow.setCenter(p.x, p.y, { animate: true })
}
function onPointerMove(e: PointerEvent) {
  if (!frozen) return
  const p = toFlow(e)
  flow.setCenter(p.x, p.y, { animate: false })
}
function onPointerUp() {
  frozen = null
}
function onWheel(e: WheelEvent) {
  if (!props.zoomable) return
  flow.zoomTo(flow.viewport.value.zoom * Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.01), { animate: false })
}
</script>

<template>
  <div
    data-flow-panel
    class="m3-flow-minimap absolute z-20 m-4 overflow-hidden rounded-lg bg-surface-container shadow-elevation-3"
    :class="panelPositionClass[position]"
    @wheel.stop.prevent="onWheel"
  >
    <svg
      ref="svg"
      :width="width"
      :height="height"
      :viewBox="`${box.x} ${box.y} ${box.width} ${box.height}`"
      class="block touch-none"
      :class="pannable && 'cursor-pointer'"
      role="img"
      :aria-label="locale.flowMinimap"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <rect
        v-for="b in blocks"
        :key="b.node.id"
        :x="b.x"
        :y="b.y"
        :width="b.width"
        :height="b.height"
        :rx="Math.min(b.width, b.height) * 0.1"
        :class="b.node.type === 'group'
          ? 'fill-none stroke-outline-variant'
          : !nodeColor?.(b.node) && (flow.selection.value.nodes.includes(b.node.id) ? 'fill-primary' : 'fill-outline-variant')"
        :style="b.node.type !== 'group' && nodeColor?.(b.node) ? { fill: nodeColor(b.node) } : undefined"
        vector-effect="non-scaling-stroke"
      />
      <path :d="mask" fill-rule="evenodd" class="fill-on-surface/8" />
      <rect :x="view.x" :y="view.y" :width="view.width" :height="view.height" fill="none" class="stroke-primary" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>
