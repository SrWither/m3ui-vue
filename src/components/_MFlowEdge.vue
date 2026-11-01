<script setup lang="ts">
// One edge on MFlow's canvas, inside its shared <svg>: a wide invisible stroke to hit, the path (or an
// `#edge-<type>` slot), arrowheads, and once selected the ends to drag elsewhere. Gestures are MFlow's, found
// through `data-flow-edge` / `data-flow-reconnect` / `data-flow-segment`.
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
// The label chip and delete button over the path's middle (see _MFlowEdgeLabel), as half sizes with their hit area
function labelBox() {
  const g = geo.value
  if (!g) return null
  const deletable = props.edge.deletable !== false && !flow.locked.value
  const chip = props.edge.label ? props.edge.label.length * 7 + 16 : 0
  const w = chip + (deletable ? 24 + (chip ? 4 : 0) : 0)
  if (!w) return null
  return { x: g.labelX, y: g.labelY, hw: w / 2 + (deletable ? 8 : 2), hh: deletable ? 20 : 12 }
}
// A selected orthogonal edge's segments, each with a grip to drag it sideways (edgesReroutable)
const segments = computed(() => {
  if (!selected.value || !flow.isReroutable(props.edge)) return []
  geo.value
  const pts = flow.edgeCorners(props.edge) ?? []
  const out: { i: number; x: number; y: number; horizontal: boolean }[] = []
  // The label and the delete button sit over the path's middle, in a layer above the edges: each grip slides along
  // its segment to the free spot nearest the segment's middle (the farthest one from them when there's none)
  const box = labelBox()
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!
    const [bx, by] = pts[i + 1]!
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 16) continue
    const horizontal = Math.abs(ay - by) < 0.01
    const ux = (bx - ax) / len
    const uy = (by - ay) / len
    const at = (d: number) => ({ x: ax + ux * d, y: ay + uy * d })
    // How far a grip at this point is from the label box (negative: overlapping)
    const clear = (p: { x: number; y: number }) => {
      if (!box) return Infinity
      const gw = horizontal ? 9 : 4
      const gh = horizontal ? 4 : 9
      return Math.max(Math.abs(p.x - box.x) - box.hw - gw, Math.abs(p.y - box.y) - box.hh - gh)
    }
    let best = at(len / 2)
    if (clear(best) < 6) {
      let bestClear = clear(best)
      for (let off = 4; off <= len / 2 - 8; off += 4) {
        const found = [at(len / 2 - off), at(len / 2 + off)].find((p) => clear(p) >= 6)
        if (found) {
          best = found
          bestClear = Infinity
          break
        }
        for (const p of [at(len / 2 - off), at(len / 2 + off)]) {
          const c = clear(p)
          if (c > bestClear) {
            bestClear = c
            best = p
          }
        }
      }
    }
    out.push({ i, x: best.x, y: best.y, horizontal })
  }
  return out
})

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
// Declarative look: an M3 role reads its token, anything else is a CSS color
const ROLE = /^(primary|secondary|tertiary|error|outline|outline-variant|on-surface|on-surface-variant|inverse-surface|inverse-primary)(-container)?$/
const stroke = computed(() => {
  if (selected.value || highlighted.value) return 'var(--color-primary)'
  const c = props.edge.color
  return c ? (ROLE.test(c) ? `var(--color-${c})` : c) : 'var(--color-outline)'
})
const width = computed(() => (props.edge.width ?? 2) + (highlighted.value ? 2 : 0))
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
    <path :d="geo.path" fill="none" stroke="transparent" stroke-width="16" :style="{ pointerEvents: 'stroke' }" :class="flow.branching.value ? 'cursor-crosshair' : selectable && 'cursor-pointer'" />
    <!-- A dragged node would splice in here: a halo around it -->
    <path v-if="highlighted" :d="geo.path" fill="none" stroke-width="14" stroke-linecap="round" class="m3-flow-edge-halo stroke-primary/25" />
    <SlotOutlet v-if="render" :fn="render" :scope="scope" />
    <template v-else>
      <path
        :d="geo.path"
        fill="none"
        :stroke-width="width"
        stroke-linecap="round"
        class="m3-flow-edge-line"
        :class="[edge.animated === 'reverse' ? 'm3-flow-edge-animated m3-flow-edge-reverse' : edge.animated && 'm3-flow-edge-animated', edge.dashed && !edge.animated && 'm3-flow-edge-dashed']"
        :style="{ stroke, strokeWidth: `${width}px` }"
      />
      <path
        v-for="(m, i) in [markerEnd, markerStart]"
        v-show="m"
        :key="i"
        :d="m"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        class="m3-flow-edge-line"
        :style="{ stroke, fill: (i === 0 ? edge.markerEnd ?? 'arrow-closed' : edge.markerStart) === 'arrow-closed' ? stroke : 'none' }"
      />
    </template>
    <rect
      v-for="sg in segments"
      :key="`s${sg.i}`"
      :data-flow-segment="sg.i"
      :x="sg.x - (sg.horizontal ? 9 : 4)"
      :y="sg.y - (sg.horizontal ? 4 : 9)"
      :width="sg.horizontal ? 18 : 8"
      :height="sg.horizontal ? 8 : 18"
      rx="4"
      stroke-width="2"
      class="fill-surface stroke-primary"
      :class="sg.horizontal ? 'cursor-row-resize' : 'cursor-col-resize'"
      :style="{ pointerEvents: 'all', touchAction: 'none' }"
    />
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
