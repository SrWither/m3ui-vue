<script lang="ts">
import type { FlowEdge, FlowNode, FlowSelection } from '../composables/useFlow'

// Copied nodes and edges, shared by every MFlow on the page (copy in one, paste in another)
let clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null = null
let pasteCount = 0

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`
const emptySelection = (): FlowSelection => ({ nodes: [], edges: [] })
</script>

<script setup lang="ts">
/**
 * A node editor (not an M3 spec component): nodes you drag around on a canvas that pans and zooms, joined by edges
 * drawn from handle to handle. Built from M3 pieces (nodes are cards, the controls a floating toolbar) with the
 * API shape of Vue Flow / React Flow. Nodes and edges are `v-model`s of plain objects; the view, the selection
 * and the lock are too. Pan by dragging the background (or the wheel, or two fingers), zoom with Ctrl + wheel, a
 * trackpad or touch pinch, or a double click. Shift + drag (or `selectionOnDrag`; on touch, a long press on the
 * background) draws a selection box; Delete
 * removes what's selected, Ctrl+Z/Ctrl+Shift+Z undo and redo, Ctrl+C/X/V/A copy, cut, paste and select all, and
 * the arrows move the selected nodes. A drag from a handle to another connects them; dropped on nothing it fires
 * `connect-end` with the spot, to offer a new node there. To disconnect: the × on a selected edge, Delete, dragging
 * an edge's end (or a connected input) away and dropping it on nothing. Alignment guides show while dragging one node.
 *
 * Nodes are drawn by type: `default`/`input`/`output` (an MFlowNode), `circle` (a vertex: `data.label`, `color`,
 * `badge`, `ring`, `size`; its edges run center to center in any direction), `group` (a box its children move with), or
 * a `#node-<type>` slot of your own with MFlowHandles in it; edges are `bezier`, `smoothstep`, `step`, `straight`
 * or a `#edge-<type>` slot (with `getBezierPath` and friends); `color`, `width`, `dashed`, `animated` and
 * `labelTone` restyle one without a slot, with a transition. `layout` lays them out (`'tree'`, `'layered'` or a
 * function, e.g. one calling dagre) whenever the graph's shape changes. Put `MFlowControls`, `MFlowMinimap` or
 * anything of yours in the default slot: it's drawn over the canvas, the canvas's gestures and wheel leave it alone,
 * and `useFlow()` works inside it. Inside a node, controls (buttons, inputs, links) never start a drag; mark anything
 * else that shouldn't with `data-flow-nodrag`, and an area that scrolls on its own with `data-flow-nowheel`.
 * `startDrag(id, event)` hands a pointer that's already down to a node, to drag something in from outside (a palette).
 *
 * Positions spring to their new place when they change from outside (a layout, an undo); the view springs on
 * `fitView()`/zoom buttons. Nodes are rendered by small components of their own so moving one only redraws it
 * and its edges.
 *
 * @slot default Drawn over the canvas: MFlowControls, MFlowMinimap, panels of yours. Props: `{ flow }`
 * @slot node-<type> A node of that type. Props: `{ node, data, selected, dragging }`
 * @slot edge-<type> An edge of that type, SVG inside a `<g>`. Props: `{ edge, path, labelX, labelY, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, targetAngle, targetInset, selected, highlighted }` (`highlighted`: a dragged node would splice into it)
 * @slot edge-label An edge's label, instead of the default chip. Props: `{ edge, selected }`
 * @slot empty Shown while there are no nodes
 * @event connect A connection was made (it's also added to `edges` with `autoConnect`)
 * @event connect-start A connection drag started from a handle
 * @event connect-end A connection drag ended: `{ connection }` when it connected, else the flow `position` it was dropped at and where it came from
 * @event reconnect An edge's end was moved to another handle: `{ edge, connection }`
 * @event insert A lone node was dropped onto an edge and spliced in: `{ node, edge, connections }` (with `autoConnect`
 *   the edge is replaced by the two connections, keeping its type and look)
 * @event node-click / node-dblclick / node-contextmenu `(node, event)`
 * @event node-drag-start / node-drag `(nodes, event)`
 * @event node-drag-stop `{ nodes, intersecting, event }`: `intersecting` are the nodes under the dragged one
 * @event edge-click / edge-dblclick / edge-contextmenu `(edge, event)`
 * @event pane-click / pane-dblclick / pane-contextmenu `(position, event)` with the flow position (turn
 *   `zoomOnDoubleClick` off to use the double click yourself, e.g. to add a node there)
 * @event delete Nodes and edges were deleted: `{ nodes, edges }`
 * @event init The canvas measured its nodes (and laid out / fitted them): the flow context
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowReactive, shallowRef, toRaw, useSlots, watch } from 'vue'
import {
  FLOW_KEY,
  type FlowConnection,
  type FlowContext,
  type FlowEdgeGeometry as EdgeGeometry,
  type FlowFitOptions,
  type FlowHandleBounds,
  type FlowInternals,
  type FlowPosition,
  type FlowViewport,
  type FlowXY,
} from '../composables/useFlow'
import { layoutLayered, layoutTree, type FlowLayout, type FlowLayoutDirection, type FlowLayoutOptions } from '../composables/flowLayout'
import { distanceToPoints, edgePathPoints, getBezierPath, getSmoothStepPath, getStepPath, getStraightPath, type FlowEdgePath } from '../composables/flowPaths'
import { DEFAULT_SPATIAL } from '../composables/_useSpring'
import { prefersReducedMotion } from '../composables/_springAnimation'
import { useLocale } from '../composables/useLocale'
import NodeShell from './_MFlowNodeShell.vue'
import EdgeView from './_MFlowEdge.vue'
import EdgeLabel from './_MFlowEdgeLabel.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  nodes?: FlowNode[]
  edges?: FlowEdge[]
  /** The view (v-model) */
  viewport?: FlowViewport
  /** Selected node and edge ids (v-model) */
  selection?: FlowSelection
  /** Switches off moving, connecting, selecting and deleting; the view still pans and zooms (v-model) */
  locked?: boolean
  /** Which way edges run by default: where the default node's handles go and the layout's direction */
  direction?: 'horizontal' | 'vertical'
  background?: 'dots' | 'grid' | 'none'
  /** The background's spacing, and the grid nodes snap to, px */
  gridSize?: number
  snapToGrid?: boolean
  minZoom?: number
  maxZoom?: number
  /** Fits the nodes in view once they're measured, and again after each automatic `layout` */
  fitView?: boolean
  /** What the plain wheel does (Ctrl + wheel always zooms) */
  wheel?: 'pan' | 'zoom'
  /** A double click on the background zooms in */
  zoomOnDoubleClick?: boolean
  /** Dragging the background pans; off, it draws a selection box */
  panOnDrag?: boolean
  /** Dragging the background draws a selection box (Shift + drag always does) */
  selectionOnDrag?: boolean
  nodesDraggable?: boolean
  nodesConnectable?: boolean
  elementsSelectable?: boolean
  edgesReconnectable?: boolean
  /** Merged into edges made by connecting (`type`, `animated`, `markerEnd`…) */
  defaultEdgeOptions?: Partial<FlowEdge>
  /** Adds an edge to `edges` when a connection is made; off, only `connect` fires */
  autoConnect?: boolean
  /** Whether a connection may be made (no duplicates or same-node loops are offered either way) */
  isValidConnection?: (c: FlowConnection) => boolean
  /** How close to a handle a connection snaps to it, px */
  connectionRadius?: number
  /**
   * Asked before anything is deleted (the keyboard, an edge's ×, an edge dropped on nothing, `remove()`), with what
   * would go: return false to keep it, or a Promise (a confirm dialog) that resolves to whether to delete
   */
  beforeDelete?: (items: { nodes: FlowNode[]; edges: FlowEdge[] }) => boolean | Promise<boolean>
  /** Keys that delete the selection; `null` turns deleting off */
  deleteKeys?: string[] | null
  /** Undo and redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y), over every change to nodes and edges */
  history?: boolean
  historySize?: number
  /** Alignment guides while dragging one node */
  guides?: boolean
  /** Lays the nodes out when the graph's shape changes (nodes or edges added, removed, hidden) */
  layout?: 'tree' | 'layered' | FlowLayout | null
  layoutOptions?: FlowLayoutOptions
  /**
   * A node with no connections dropped onto an edge splices into it: A → C becomes A → B → C (the edge lights up
   * while it's over one). Only when both new connections are valid. Without room between A and C, the node moves
   * to sit after A and C moves on (with everything after it) along the flow's `direction`
   */
  insertOnEdge?: boolean
  /** Nodes dropped onto a `group` join it (and leave it when dropped outside) */
  dropIntoGroups?: boolean
  /** Positions spring to their new place when they change from outside */
  animate?: boolean
  /** Makes ids for pasted nodes and new edges */
  getId?: (kind: 'node' | 'edge') => string
  /**
   * A drag that starts on an edge draws a new edge from the same source, a branch, as in a circuit editor (the
   * preview leaves from where you grabbed it). A click still selects the edge; with a finger, only a selected edge
   * branches, so a swipe across one still pans
   */
  edgeBranching?: boolean
  /** The canvas's accessible name */
  label?: string
}>(), {
  nodes: () => [],
  edges: () => [],
  viewport: undefined,
  selection: undefined,
  locked: false,
  direction: 'horizontal',
  background: 'dots',
  gridSize: 20,
  snapToGrid: false,
  minZoom: 0.2,
  maxZoom: 4,
  fitView: false,
  wheel: 'pan',
  zoomOnDoubleClick: true,
  panOnDrag: true,
  selectionOnDrag: false,
  nodesDraggable: true,
  nodesConnectable: true,
  elementsSelectable: true,
  edgesReconnectable: true,
  autoConnect: true,
  connectionRadius: 24,
  deleteKeys: () => ['Delete', 'Backspace'],
  history: true,
  historySize: 100,
  guides: true,
  layout: null,
  dropIntoGroups: false,
  insertOnEdge: true,
  edgeBranching: false,
  animate: true,
})

const emit = defineEmits<{
  'update:nodes': [FlowNode[]]
  'update:edges': [FlowEdge[]]
  'update:viewport': [FlowViewport]
  'update:selection': [FlowSelection]
  'update:locked': [boolean]
  connect: [FlowConnection]
  'connect-start': [{ nodeId: string; handleId: string | null; type: 'source' | 'target' }]
  'connect-end': [{ connection: FlowConnection | null; position: FlowXY; from: { nodeId: string; handleId: string | null; type: 'source' | 'target' } }]
  reconnect: [{ edge: FlowEdge; connection: FlowConnection }]
  insert: [{ node: FlowNode; edge: FlowEdge; connections: [FlowConnection, FlowConnection] }]
  'node-click': [FlowNode, MouseEvent]
  'node-dblclick': [FlowNode, MouseEvent]
  'node-contextmenu': [FlowNode, MouseEvent]
  'node-drag-start': [FlowNode[], PointerEvent]
  'node-drag': [FlowNode[], PointerEvent]
  'node-drag-stop': [{ nodes: FlowNode[]; intersecting: FlowNode[]; event: PointerEvent }]
  'edge-click': [FlowEdge, MouseEvent]
  'edge-dblclick': [FlowEdge, MouseEvent]
  'edge-contextmenu': [FlowEdge, MouseEvent]
  'pane-click': [FlowXY, MouseEvent]
  'pane-contextmenu': [FlowXY, MouseEvent]
  'pane-dblclick': [FlowXY, MouseEvent]
  delete: [{ nodes: FlowNode[]; edges: FlowEdge[] }]
  init: [FlowContext]
}>()

const slots = useSlots()
const locale = useLocale()
const root = ref<HTMLElement>()
const layer = ref<HTMLElement>()
// What's in the default slot (controls, a minimap, panels of yours) sits over the canvas: the canvas's gestures and
// wheel leave it alone, so it needs no marking
const onOverlay = (t: EventTarget | null) => !!t && t !== root.value && !layer.value?.contains(t as Node)
const size = ref({ width: 0, height: 0 })
const ready = ref(false)
const announcement = ref('')
const announce = (m: string) => {
  announcement.value = ''
  nextTick(() => (announcement.value = m))
}
const makeId = (kind: 'node' | 'edge') => props.getId?.(kind) ?? randomId(kind === 'node' ? 'n' : 'e')

// ── Nodes, edges, selection, lock: local copies of the v-models (they work unbound too) ──────────────────
const nodesLocal = shallowRef<FlowNode[]>(props.nodes)
const edgesLocal = shallowRef<FlowEdge[]>(props.edges)
const selLocal = shallowRef<FlowSelection>(props.selection ?? emptySelection())
const lockedLocal = ref(props.locked)
watch(() => props.selection, (s) => { if (s && !same(s, selLocal.value)) selLocal.value = s })
watch(() => props.locked, (l) => { lockedLocal.value = l })
const locked = computed({
  get: () => lockedLocal.value,
  set: (v: boolean) => {
    lockedLocal.value = v
    emit('update:locked', v)
  },
})

const nodeById = computed(() => new Map(nodesLocal.value.map((n) => [n.id, n])))
const edgeById = computed(() => new Map(edgesLocal.value.map((e) => [e.id, e])))
const getNode = (id: string) => nodeById.value.get(id)
const parentOf = (id: string) => {
  const p = nodeById.value.get(id)?.parentId
  return p && nodeById.value.has(p) ? p : undefined
}
function ancestors(id: string): string[] {
  const out: string[] = []
  for (let p = parentOf(id); p && out.length < 50; p = parentOf(p)) out.push(p)
  return out
}
const depthOf = (id: string) => ancestors(id).length
function isHidden(id: string) {
  const n = nodeById.value.get(id)
  return !n || !!n.hidden || ancestors(id).some((a) => nodeById.value.get(a)?.hidden)
}
const childrenOf = computed(() => {
  const m = new Map<string, string[]>()
  for (const n of nodesLocal.value) if (n.parentId && nodeById.value.has(n.parentId)) (m.get(n.parentId) ?? m.set(n.parentId, []).get(n.parentId)!).push(n.id)
  return m
})
function descendants(id: string): string[] {
  const out: string[] = []
  const walk = (i: string) => (childrenOf.value.get(i) ?? []).forEach((c) => { out.push(c); walk(c) })
  walk(id)
  return out
}

const selectedNodes = computed(() => new Set(selLocal.value.nodes))
const selectedEdges = computed(() => new Set(selLocal.value.edges))
// Edges branch when dragged (edgeBranching)
const branching = computed(() => props.edgeBranching && nodesConnectable.value && !locked.value)
function setSelection(s: Partial<FlowSelection>) {
  const next = { nodes: s.nodes ?? selLocal.value.nodes, edges: s.edges ?? selLocal.value.edges }
  if (sameIds(next.nodes, selLocal.value.nodes) && sameIds(next.edges, selLocal.value.edges)) return
  selLocal.value = next
  emit('update:selection', next)
}
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
const canSelect = computed(() => props.elementsSelectable && !locked.value)
const canDrag = computed(() => props.nodesDraggable && !locked.value)
const nodesConnectable = computed(() => props.nodesConnectable && !locked.value)

// ── History: every change to nodes/edges, ours or the parent's, is a step ────────────────────────────────
type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] }
const past = shallowRef<Snapshot[]>([])
const future = shallowRef<Snapshot[]>([])
let lastCoalesce: { key: string; at: number } | null = null
const snapshot = (): Snapshot => ({ nodes: nodesLocal.value, edges: edgesLocal.value })
function pushHistory(s: Snapshot, coalesce?: string) {
  if (!props.history) return
  const now = performance.now()
  // Repeated steps of one gesture (arrow-key nudges) make one undo step
  if (coalesce && lastCoalesce?.key === coalesce && now - lastCoalesce.at < 800) {
    lastCoalesce.at = now
    future.value = []
    return
  }
  lastCoalesce = coalesce ? { key: coalesce, at: now } : null
  past.value = [...past.value, s].slice(-props.historySize)
  future.value = []
}
let pendingExternal: Snapshot | null = null
// What the parent hands back in the same tick as an emit of ours is that change coming back (maybe copied or
// normalized), not a new step
let echo = false
function externalChange() {
  if (echo || pendingExternal) return
  pendingExternal = snapshot()
  queueMicrotask(() => {
    if (pendingExternal) pushHistory(pendingExternal)
    pendingExternal = null
  })
}
// What comes back through v-model is often our own array behind a reactive proxy (a parent's `ref([])`)
const same = (a: unknown, b: unknown) => toRaw(a) === toRaw(b)
watch(() => props.nodes, (n) => {
  if (same(n, nodesLocal.value)) return
  externalChange()
  nodesLocal.value = n
})
watch(() => props.edges, (e) => {
  if (same(e, edgesLocal.value)) return
  externalChange()
  edgesLocal.value = e
})

function commit(next: Partial<Snapshot>, opts: { history?: boolean; coalesce?: string } = {}) {
  if (opts.history !== false) pushHistory(snapshot(), opts.coalesce)
  if (!echo) {
    echo = true
    nextTick(() => (echo = false))
  }
  if (next.nodes && !same(next.nodes, nodesLocal.value)) {
    nodesLocal.value = next.nodes
    emit('update:nodes', next.nodes)
  }
  if (next.edges && !same(next.edges, edgesLocal.value)) {
    edgesLocal.value = next.edges
    emit('update:edges', next.edges)
  }
}
function applySnapshot(s: Snapshot) {
  commit(s, { history: false })
  const ids = new Set(s.nodes.map((n) => n.id))
  const eids = new Set(s.edges.map((e) => e.id))
  setSelection({ nodes: selLocal.value.nodes.filter((i) => ids.has(i)), edges: selLocal.value.edges.filter((i) => eids.has(i)) })
}
function undo() {
  const s = past.value[past.value.length - 1]
  if (!s) return
  future.value = [...future.value, snapshot()]
  past.value = past.value.slice(0, -1)
  lastCoalesce = null
  applySnapshot(s)
}
function redo() {
  const s = future.value[future.value.length - 1]
  if (!s) return
  past.value = [...past.value, snapshot()]
  future.value = future.value.slice(0, -1)
  lastCoalesce = null
  applySnapshot(s)
}
const canUndo = computed(() => past.value.length > 0)
const canRedo = computed(() => future.value.length > 0)

// ── Where nodes are drawn: their position, sprung when it changes from outside ──────────────────────────
// `disp` is reactive (edges and slots read it); the springs are plain and step in one rAF loop that writes
// each moving node's `disp` once per frame (the library's spring convention, see CLAUDE.md)
type Spring2 = { x: number; y: number; vx: number; vy: number; tx: number; ty: number }
const disp = shallowReactive(new Map<string, { x: number; y: number }>())
const springs = new Map<string, Spring2>()
const dragging = shallowRef(new Set<string>())
let instantNext = false

// Nodes hidden last time: one that shows again appears at its position instead of sliding in from where it was hidden
let wasHidden = new Set<string>()
function syncPositions() {
  const seen = new Set<string>()
  const hiddenNow = new Set<string>()
  const animate = props.animate && ready.value && !instantNext && !prefersReducedMotion()
  for (const n of nodesLocal.value) {
    seen.add(n.id)
    if (isHidden(n.id)) hiddenNow.add(n.id)
    const reappears = wasHidden.has(n.id) && !hiddenNow.has(n.id)
    const d = disp.get(n.id)
    const { x, y } = n.position
    if (!d) {
      disp.set(n.id, reactive({ x, y }))
      springs.set(n.id, { x, y, vx: 0, vy: 0, tx: x, ty: y })
      continue
    }
    const s = springs.get(n.id)!
    if (s.tx === x && s.ty === y && !reappears) continue
    s.tx = x
    s.ty = y
    if (!animate || reappears || dragging.value.has(n.id)) {
      s.x = x
      s.y = y
      s.vx = s.vy = 0
      d.x = x
      d.y = y
    } else kick()
  }
  for (const id of [...disp.keys()]) if (!seen.has(id)) { disp.delete(id); springs.delete(id) }
  wasHidden = hiddenNow
  instantNext = false
}
watch(nodesLocal, syncPositions, { immediate: true })

const STIFF = DEFAULT_SPATIAL.stiffness
const DAMP = 2 * DEFAULT_SPATIAL.dampingRatio * Math.sqrt(STIFF)
const SUBSTEP = 0.004
let raf = 0
let last = 0
function kick() {
  if (raf || typeof requestAnimationFrame === 'undefined') return
  last = performance.now()
  raf = requestAnimationFrame(frame)
}
function frame(now: number) {
  raf = 0
  const dt = Math.min((now - last) / 1000, 1 / 20)
  last = now
  let moving = false
  for (const [id, s] of springs) {
    if (s.x === s.tx && s.y === s.ty && !s.vx && !s.vy) continue
    for (let t = 0; t < dt; t += SUBSTEP) {
      const h = Math.min(SUBSTEP, dt - t)
      s.vx += (-STIFF * (s.x - s.tx) - DAMP * s.vx) * h
      s.vy += (-STIFF * (s.y - s.ty) - DAMP * s.vy) * h
      s.x += s.vx * h
      s.y += s.vy * h
    }
    if (Math.abs(s.x - s.tx) < 0.1 && Math.abs(s.y - s.ty) < 0.1 && Math.abs(s.vx) < 2 && Math.abs(s.vy) < 2) {
      s.x = s.tx
      s.y = s.ty
      s.vx = s.vy = 0
    } else moving = true
    const d = disp.get(id)
    if (d) { d.x = s.x; d.y = s.y }
  }
  if (stepViewport(dt)) moving = true
  if (autoPan(dt)) moving = true
  if (moving) raf = requestAnimationFrame(frame)
}

function getAbsolutePosition(id: string): FlowXY {
  let x = 0
  let y = 0
  let cur: string | undefined = id
  for (let i = 0; cur && i < 50; i++) {
    const d = disp.get(cur)
    const n = nodeById.value.get(cur)
    x += d?.x ?? n?.position.x ?? 0
    y += d?.y ?? n?.position.y ?? 0
    cur = parentOf(cur)
  }
  return { x, y }
}

// ── Sizes and handles, measured by the node shells ───────────────────────────────────────────────────────
const dims = shallowReactive(new Map<string, { width: number; height: number }>())
const handles = shallowReactive(new Map<string, FlowHandleBounds[]>())
const nodeEls = new Map<string, HTMLElement>()
type HandleReg = { el: HTMLElement; info: () => Omit<FlowHandleBounds, 'x' | 'y'> }
const handleRegs = new Map<string, Set<HandleReg>>()

const GROUP_PAD = 24
const GROUP_HEAD = 36
// Groups around nodes being dragged keep their size until the drop: growing after the child would never let it
// leave (the pointer would always be inside)
const frozenGroups = shallowReactive(new Map<string, { width: number; height: number }>())
function getSize(id: string): { width: number; height: number } {
  const n = nodeById.value.get(id)
  if (!n) return { width: 0, height: 0 }
  if (n.width && n.height) return { width: n.width, height: n.height }
  if (n.type === 'group' && !n.width) {
    const frozen = frozenGroups.get(id)
    if (frozen) return frozen
    // A group without a size wraps its children
    let w = 200
    let h = 120
    for (const c of childrenOf.value.get(id) ?? []) {
      if (isHidden(c)) continue
      const d = disp.get(c)
      const s = getSize(c)
      w = Math.max(w, (d?.x ?? 0) + s.width + GROUP_PAD)
      h = Math.max(h, (d?.y ?? 0) + s.height + GROUP_PAD)
    }
    return { width: n.width ?? w, height: n.height ?? Math.max(h, GROUP_HEAD + GROUP_PAD) }
  }
  const m = dims.get(id)
  return { width: n.width ?? m?.width ?? 0, height: n.height ?? m?.height ?? 0 }
}

function measureNode(id: string) {
  const el = nodeEls.get(id)
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const prev = dims.get(id)
  if (!prev || prev.width !== w || prev.height !== h) dims.set(id, { width: w, height: h })
  const regs = handleRegs.get(id)
  if (!regs?.size) {
    if (handles.has(id)) handles.delete(id)
    return
  }
  // Handle centers relative to the node's corner, back in flow units (the layer is scaled by the zoom)
  const r = el.getBoundingClientRect()
  const z = vp.value.zoom || 1
  const list: FlowHandleBounds[] = []
  for (const reg of regs) {
    const hr = reg.el.getBoundingClientRect()
    list.push({ ...reg.info(), x: (hr.left + hr.width / 2 - r.left) / z, y: (hr.top + hr.height / 2 - r.top) / z })
  }
  handles.set(id, list)
}
let measureQueued = new Set<string>()
function queueMeasure(id: string) {
  measureQueued.add(id)
  if (measureQueued.size > 1) return
  nextTick(() => {
    const ids = measureQueued
    measureQueued = new Set()
    ids.forEach(measureNode)
  })
}
function registerHandle(nodeId: string, el: HTMLElement, info: HandleReg['info']) {
  const reg = { el, info }
  ;(handleRegs.get(nodeId) ?? handleRegs.set(nodeId, new Set()).get(nodeId)!).add(reg)
  queueMeasure(nodeId)
  return () => {
    handleRegs.get(nodeId)?.delete(reg)
    queueMeasure(nodeId)
  }
}
function registerNodeEl(id: string, el: HTMLElement | null) {
  if (el) {
    nodeEls.set(id, el)
    measureNode(id)
    ro?.observe(el)
  } else {
    const old = nodeEls.get(id)
    if (old) ro?.unobserve(old)
    nodeEls.delete(id)
    dims.delete(id)
    handles.delete(id)
  }
}

// Where an edge's ends are: its handles, else the middle of the node's side
const sidePositions = (n: FlowNode) => {
  const v = props.direction === 'vertical'
  return {
    source: n.sourcePosition ?? (v ? 'bottom' : 'right') as FlowPosition,
    target: n.targetPosition ?? (v ? 'top' : 'left') as FlowPosition,
  }
}
function sidePoint(id: string, pos: FlowPosition): FlowXY {
  const a = getAbsolutePosition(id)
  const s = getSize(id)
  switch (pos) {
    case 'top': return { x: a.x + s.width / 2, y: a.y }
    case 'bottom': return { x: a.x + s.width / 2, y: a.y + s.height }
    case 'left': return { x: a.x, y: a.y + s.height / 2 }
    default: return { x: a.x + s.width, y: a.y + s.height / 2 }
  }
}
function handlePoint(nodeId: string, type: 'source' | 'target', handleId?: string | null): { x: number; y: number; position: FlowPosition; inset: number } | null {
  const n = nodeById.value.get(nodeId)
  if (!n) return null
  const list = handles.get(nodeId)?.filter((h) => h.type === type)
  const h = list?.length ? (handleId != null ? list.find((x) => x.id === handleId) : list[0]) ?? list[0] : undefined
  if (h) {
    const a = getAbsolutePosition(nodeId)
    return { x: a.x + h.x, y: a.y + h.y, position: h.position, inset: HANDLE_RADIUS }
  }
  const position = sidePositions(n)[type]
  return { ...sidePoint(nodeId, position), position, inset: 0 }
}
// Arrowheads stop at a handle's rim instead of under it
const HANDLE_RADIUS = 5

function pathFor(type: string | undefined, p: Omit<EdgeGeometry, keyof FlowEdgePath | 'sourceInset' | 'targetInset'>): FlowEdgePath {
  switch (type) {
    case 'smoothstep': return getSmoothStepPath(p)
    case 'step': return getStepPath(p)
    case 'straight': return getStraightPath(p)
    default: return getBezierPath(p)
  }
}
const edgeType = (e: FlowEdge) => e.type ?? props.defaultEdgeOptions?.type ?? 'bezier'
// How it's routed: its own type, or for an `#edge-<type>` slot its `pathType` (default bezier)
const edgeRoute = (e: Partial<FlowEdge>) => e.pathType ?? props.defaultEdgeOptions?.pathType ?? edgeType(e as FlowEdge)
// Opposite edges between two circles sit side by side
const pairKeys = computed(() => new Set(edgesLocal.value.map((e) => `${e.source}>${e.target}`)))
function circleOf(id: string) {
  const a = getAbsolutePosition(id)
  const s = getSize(id)
  return { x: a.x + s.width / 2, y: a.y + s.height / 2, r: Math.min(s.width, s.height) / 2 }
}
// An edge touching a circle runs between the centers (a straight line unless it has a type), cut at the rims
function circleGeometry(e: FlowEdge): EdgeGeometry | null {
  const sc = nodeById.value.get(e.source)?.type === 'circle'
  const tc = nodeById.value.get(e.target)?.type === 'circle'
  const s = sc ? circleOf(e.source) : handlePoint(e.source, 'source', e.sourceHandle)
  const t = tc ? circleOf(e.target) : handlePoint(e.target, 'target', e.targetHandle)
  if (!s || !t) return null
  const dx = t.x - s.x
  const dy = t.y - s.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const off = pairKeys.value.has(`${e.target}>${e.source}`) ? 6 : 0
  const ox = -uy * off
  const oy = ux * off
  const rs = sc ? (s as { r: number }).r : 0
  const rt = tc ? (t as { r: number }).r + 2 : 0
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const ends = {
    sourceX: s.x + ux * rs + ox,
    sourceY: s.y + uy * rs + oy,
    sourcePosition: (horizontal ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top') as FlowPosition,
    targetX: t.x - ux * rt + ox,
    targetY: t.y - uy * rt + oy,
    targetPosition: (horizontal ? (dx >= 0 ? 'left' : 'right') : dy >= 0 ? 'top' : 'bottom') as FlowPosition,
  }
  return { ...ends, ...pathFor(e.type ?? props.defaultEdgeOptions?.type ?? 'straight', ends), sourceInset: 0, targetInset: 0 }
}
function edgeGeometry(e: FlowEdge): EdgeGeometry | null {
  if (nodeById.value.get(e.source)?.type === 'circle' || nodeById.value.get(e.target)?.type === 'circle') return circleGeometry(e)
  const s = handlePoint(e.source, 'source', e.sourceHandle)
  const t = handlePoint(e.target, 'target', e.targetHandle)
  if (!s || !t) return null
  const ends = { sourceX: s.x, sourceY: s.y, sourcePosition: s.position, targetX: t.x, targetY: t.y, targetPosition: t.position }
  return { ...ends, ...pathFor(edgeRoute(e), ends), sourceInset: s.inset, targetInset: t.inset }
}

// What's drawn: groups under the edges, other nodes over them; children over their parents
const visibleNodes = computed(() => nodesLocal.value.filter((n) => !isHidden(n.id)))
const groupNodes = computed(() => visibleNodes.value.filter((n) => n.type === 'group').sort((a, b) => depthOf(a.id) - depthOf(b.id)))
const plainNodes = computed(() => visibleNodes.value.filter((n) => n.type !== 'group'))
const visibleEdges = computed(() => edgesLocal.value.filter((e) => !e.hidden && !isHidden(e.source) && !isHidden(e.target)))
const isLifted = (id: string) => dragging.value.has(id) || ancestors(id).some((a) => dragging.value.has(a))
const zIndexOf = (id: string) => (isLifted(id) ? 1000 : 0) + depthOf(id) * 10 + (selectedNodes.value.has(id) ? 3 : 0)
const nodeRenderer = (n: FlowNode) => slots[`node-${n.type ?? 'default'}`]
const edgeRenderer = (e: FlowEdge) => slots[`edge-${edgeType(e)}`]
const isReconnectable = (e: FlowEdge) => !locked.value && (e.reconnectable ?? props.edgesReconnectable)

// ── The view ──────────────────────────────────────────────────────────────────────────────────────────────
const vp = ref<FlowViewport>({ x: 0, y: 0, zoom: 1, ...props.viewport })
watch(() => props.viewport, (v) => {
  if (!v || (v.x === vp.value.x && v.y === vp.value.y && v.zoom === vp.value.zoom)) return
  vpAnim = null
  vp.value = { ...v }
})
const clampZoom = (z: number) => Math.min(props.maxZoom, Math.max(props.minZoom, z))
function writeViewport(v: FlowViewport) {
  if (v.x === vp.value.x && v.y === vp.value.y && v.zoom === vp.value.zoom) return
  vp.value = v
  emit('update:viewport', v)
}
type Spring1 = { p: number; v: number; t: number }
let vpAnim: { x: Spring1; y: Spring1; z: Spring1 } | null = null
function setViewport(v: Partial<FlowViewport>, opts: { animate?: boolean } = {}) {
  const target = { x: v.x ?? vp.value.x, y: v.y ?? vp.value.y, zoom: clampZoom(v.zoom ?? vp.value.zoom) }
  if (opts.animate === false || !ready.value || prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
    vpAnim = null
    writeViewport(target)
    return
  }
  const cur = vpAnim
  vpAnim = {
    x: { p: vp.value.x, v: cur?.x.v ?? 0, t: target.x },
    y: { p: vp.value.y, v: cur?.y.v ?? 0, t: target.y },
    z: { p: vp.value.zoom, v: cur?.z.v ?? 0, t: target.zoom },
  }
  kick()
}
function stepViewport(dt: number) {
  const a = vpAnim
  if (!a) return false
  let done = true
  for (const s of [a.x, a.y, a.z]) {
    for (let t = 0; t < dt; t += SUBSTEP) {
      const h = Math.min(SUBSTEP, dt - t)
      s.v += (-STIFF * (s.p - s.t) - DAMP * s.v) * h
      s.p += s.v * h
    }
    const eps = s === a.z ? 0.0005 : 0.1
    if (Math.abs(s.p - s.t) < eps && Math.abs(s.v) < eps * 10) { s.p = s.t; s.v = 0 } else done = false
  }
  writeViewport({ x: a.x.p, y: a.y.p, zoom: a.z.p })
  if (done) vpAnim = null
  return !done
}

function rootRect() {
  return root.value?.getBoundingClientRect() ?? ({ left: 0, top: 0, width: size.value.width, height: size.value.height } as DOMRect)
}
function screenToFlow(p: { x: number; y: number }): FlowXY {
  const r = rootRect()
  return { x: (p.x - r.left - vp.value.x) / vp.value.zoom, y: (p.y - r.top - vp.value.y) / vp.value.zoom }
}
function flowToScreen(p: FlowXY) {
  const r = rootRect()
  return { x: p.x * vp.value.zoom + vp.value.x + r.left, y: p.y * vp.value.zoom + vp.value.y + r.top }
}
/** Zoom to `zoom` keeping the canvas point (px from its corner) still */
function zoomAt(zoom: number, px: number, py: number, animate = false) {
  const z = clampZoom(zoom)
  const base = vpAnim && animate ? { x: vpAnim.x.t, y: vpAnim.y.t, zoom: vpAnim.z.t } : vp.value
  const fx = (px - base.x) / base.zoom
  const fy = (py - base.y) / base.zoom
  setViewport({ x: px - fx * z, y: py - fy * z, zoom: z }, { animate })
}
const targetZoom = () => vpAnim?.z.t ?? vp.value.zoom
const zoomIn = () => zoomAt(targetZoom() * 1.25, size.value.width / 2, size.value.height / 2, true)
const zoomOut = () => zoomAt(targetZoom() / 1.25, size.value.width / 2, size.value.height / 2, true)
const zoomTo = (z: number, opts: { animate?: boolean } = {}) => zoomAt(z, size.value.width / 2, size.value.height / 2, opts.animate ?? true)
function setCenter(x: number, y: number, opts: { zoom?: number; animate?: boolean } = {}) {
  const z = clampZoom(opts.zoom ?? targetZoom())
  setViewport({ x: size.value.width / 2 - x * z, y: size.value.height / 2 - y * z, zoom: z }, { animate: opts.animate ?? true })
}
function boundsOf(ids: string[]) {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const id of ids) {
    if (isHidden(id)) continue
    const a = getAbsolutePosition(id)
    const s = getSize(id)
    x1 = Math.min(x1, a.x)
    y1 = Math.min(y1, a.y)
    x2 = Math.max(x2, a.x + s.width)
    y2 = Math.max(y2, a.y + s.height)
  }
  return Number.isFinite(x1) ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null
}
function fitView(opts: FlowFitOptions = {}) {
  // Fit where the nodes are going, not where a spring has them right now
  const ids = opts.nodes ?? nodesLocal.value.map((n) => n.id)
  const saved = new Map<string, { x: number; y: number }>()
  for (const [id, s] of springs) {
    const d = disp.get(id)
    if (d && (d.x !== s.tx || d.y !== s.ty)) { saved.set(id, { x: d.x, y: d.y }); d.x = s.tx; d.y = s.ty }
  }
  const b = boundsOf(ids)
  for (const [id, p] of saved) { const d = disp.get(id)!; d.x = p.x; d.y = p.y }
  if (!b || !size.value.width || !size.value.height) return
  const pad = opts.padding ?? 0.1
  const w = size.value.width * (1 - 2 * pad)
  const h = size.value.height * (1 - 2 * pad)
  const z = Math.min(opts.maxZoom ?? 1.5, Math.max(opts.minZoom ?? props.minZoom, Math.min(w / Math.max(1, b.width), h / Math.max(1, b.height))))
  setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: clampZoom(z), animate: opts.animate ?? true })
}

// ── Editing API ───────────────────────────────────────────────────────────────────────────────────────────
const asArray = <T,>(x: T | T[]) => (Array.isArray(x) ? x : [x])
function addNodes(ns: FlowNode | FlowNode[]) {
  commit({ nodes: [...nodesLocal.value, ...asArray(ns)] })
}
function addEdges(es: FlowEdge | FlowEdge[]) {
  commit({ edges: [...edgesLocal.value, ...asArray(es)] })
}
function updateNode(id: string, patch: Partial<FlowNode> | ((n: FlowNode) => FlowNode)) {
  commit({ nodes: nodesLocal.value.map((n) => (n.id !== id ? n : typeof patch === 'function' ? patch(n) : { ...n, ...patch })) })
}
function updateEdge(id: string, patch: Partial<FlowEdge> | ((e: FlowEdge) => FlowEdge)) {
  commit({ edges: edgesLocal.value.map((e) => (e.id !== id ? e : typeof patch === 'function' ? patch(e) : { ...e, ...patch })) })
}
function remove(ids: { nodes?: string[]; edges?: string[] }) {
  const goneNodes = new Set<string>()
  for (const id of ids.nodes ?? []) {
    if (!nodeById.value.has(id)) continue
    goneNodes.add(id)
    descendants(id).forEach((d) => goneNodes.add(d))
  }
  const goneEdgeIds = new Set(ids.edges ?? [])
  const nodes = nodesLocal.value.filter((n) => goneNodes.has(n.id))
  const edges = edgesLocal.value.filter((e) => goneEdgeIds.has(e.id) || goneNodes.has(e.source) || goneNodes.has(e.target))
  if (!nodes.length && !edges.length) return
  if (props.beforeDelete) {
    const ok = props.beforeDelete({ nodes, edges })
    if (ok instanceof Promise) {
      // Applied once confirmed, against whatever the nodes and edges are by then
      ok.then((yes) => { if (yes) applyRemove(goneNodes, new Set(edges.map((e) => e.id))) })
      return
    }
    if (!ok) return
  }
  applyRemove(goneNodes, new Set(edges.map((e) => e.id)))
}
function applyRemove(goneNodes: Set<string>, goneEdgeIds: Set<string>) {
  const nodes = nodesLocal.value.filter((n) => goneNodes.has(n.id))
  const edges = edgesLocal.value.filter((e) => goneEdgeIds.has(e.id) || goneNodes.has(e.source) || goneNodes.has(e.target))
  if (!nodes.length && !edges.length) return
  const goneEdges = new Set(edges)
  commit({
    nodes: nodes.length ? nodesLocal.value.filter((n) => !goneNodes.has(n.id)) : undefined,
    edges: edges.length ? edgesLocal.value.filter((e) => !goneEdges.has(e)) : undefined,
  })
  setSelection({ nodes: selLocal.value.nodes.filter((i) => !goneNodes.has(i)), edges: selLocal.value.edges.filter((i) => !goneEdges.has(edgeById.value.get(i)!)) })
  emit('delete', { nodes, edges })
  announce(locale.flowDeleted.replace('{count}', String(nodes.length + edges.length)))
}
function deleteSelection() {
  if (locked.value) return
  const nodes = selLocal.value.nodes.filter((id) => nodeById.value.get(id)?.deletable !== false)
  const edges = selLocal.value.edges.filter((id) => edgeById.value.get(id)?.deletable !== false)
  remove({ nodes, edges })
}
function selectAll() {
  if (!canSelect.value) return
  setSelection({
    nodes: visibleNodes.value.filter((n) => n.selectable !== false).map((n) => n.id),
    edges: visibleEdges.value.filter((e) => e.selectable !== false).map((e) => e.id),
  })
}

function copy() {
  const ids = new Set(selLocal.value.nodes)
  for (const id of [...ids]) descendants(id).forEach((d) => ids.add(d))
  if (!ids.size) return
  clipboard = {
    nodes: nodesLocal.value.filter((n) => ids.has(n.id)).map((n) => {
      // A node copied without its group keeps its place on the canvas
      if (n.parentId && !ids.has(n.parentId)) {
        const { parentId: _p, extent: _e, ...rest } = n
        return { ...rest, position: getAbsolutePosition(n.id) }
      }
      return n
    }),
    edges: edgesLocal.value.filter((e) => ids.has(e.source) && ids.has(e.target)),
  }
  pasteCount = 0
}
function cut() {
  if (locked.value) return
  copy()
  deleteSelection()
}
function paste(at?: FlowXY) {
  if (!clipboard?.nodes.length || locked.value) return
  pasteCount++
  const tops = clipboard.nodes.filter((n) => !n.parentId || !clipboard!.nodes.some((m) => m.id === n.parentId))
  const minX = Math.min(...tops.map((n) => n.position.x))
  const minY = Math.min(...tops.map((n) => n.position.y))
  const step = props.gridSize * 2 * pasteCount
  const dx = at ? at.x - minX : step
  const dy = at ? at.y - minY : step
  const idMap = new Map(clipboard.nodes.map((n) => [n.id, makeId('node')]))
  const topIds = new Set(tops.map((n) => n.id))
  const nodes = clipboard.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    parentId: n.parentId ? idMap.get(n.parentId) ?? n.parentId : undefined,
    position: topIds.has(n.id) ? { x: n.position.x + dx, y: n.position.y + dy } : n.position,
  }))
  const edges = clipboard.edges.map((e) => ({ ...e, id: makeId('edge'), source: idMap.get(e.source)!, target: idMap.get(e.target)! }))
  instantNext = true
  commit({ nodes: [...nodesLocal.value, ...nodes], edges: edges.length ? [...edgesLocal.value, ...edges] : undefined })
  setSelection({ nodes: nodes.map((n) => n.id), edges: edges.map((e) => e.id) })
}

// ── Layout ────────────────────────────────────────────────────────────────────────────────────────────────
const layoutDirection = (): FlowLayoutDirection => props.layoutOptions?.direction ?? (props.direction === 'vertical' ? 'TB' : 'LR')
async function runLayout(fn?: 'tree' | 'layered' | FlowLayout | null, options?: FlowLayoutOptions, opts: { history?: boolean } = {}) {
  const f = fn ?? props.layout ?? 'tree'
  const impl: FlowLayout = f === 'tree' ? layoutTree : f === 'layered' ? layoutLayered : f
  const sizes = new Map(nodesLocal.value.filter((n) => !n.parentId).map((n) => [n.id, getSize(n.id)]))
  const o = { ...props.layoutOptions, ...options }
  const result = await impl(nodesLocal.value, edgesLocal.value, { ...o, sizes, direction: o.direction ?? layoutDirection() })
  let changed = false
  const nodes = nodesLocal.value.map((n) => {
    const p = result[n.id]
    if (!p || (Math.abs(p.x - n.position.x) < 0.5 && Math.abs(p.y - n.position.y) < 0.5)) return n
    changed = true
    return { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } }
  })
  if (changed) commit({ nodes }, { history: opts.history })
}
// The graph's shape: which nodes show and how they're joined (not where they are)
const structureKey = computed(() =>
  visibleNodes.value.map((n) => n.id).join(',') + '|' + visibleEdges.value.map((e) => `${e.source}>${e.target}`).join(','))
watch([structureKey, () => props.direction, () => JSON.stringify(props.layoutOptions ?? {})], () => {
  if (!props.layout || !ready.value) return
  // After the new nodes mount and measure; with fitView the view follows the graph as it grows
  nextTick(async () => {
    await runLayout(null, undefined, { history: false })
    if (props.fitView) fitView()
  })
})

// ── Pointer gestures, all dispatched from the canvas ──────────────────────────────────────────────────────
const DRAG_SLOP_MOUSE = 4
const DRAG_SLOP_TOUCH = 6
const NO_DRAG = 'input, textarea, select, button, a, label, [contenteditable], [data-flow-nodrag]'

type Gesture =
  | { kind: 'pan'; id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean; target: 'pane'; touch?: boolean; branch?: FlowEdge }
  | { kind: 'marquee'; id: number; sx: number; sy: number; x: number; y: number; additive: string[]; moved: boolean }
  | { kind: 'node'; id: number; nodeId: string; sx: number; sy: number; touch: boolean; active: boolean; starts: Map<string, FlowXY>; moved: boolean; reselect: boolean }
  | { kind: 'connect'; id: number; from: { nodeId: string; handleId: string | null; type: 'source' | 'target' }; reconnect?: { edge: FlowEdge; end: 'source' | 'target' }; moved: boolean }
  | { kind: 'pinch' }
let gesture: Gesture | null = null
// What the gesture's pointerdown landed on: a click is resolved against it, not the pointerup's target
let downTarget: HTMLElement | null = null
const touches = new Map<number, { x: number; y: number }>()
let pinch: { dist: number; cx: number; cy: number; zoom: number; fx: number; fy: number } | null = null
const pointer = { x: 0, y: 0, inside: false }

const marquee = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const connection = shallowRef<{ from: { x: number; y: number; position: FlowPosition }; to: FlowXY; toPosition: FlowPosition | null; type: 'source' | 'target'; edgeType: string } | null>(null)
const connectionTarget = ref<{ key: string; valid: boolean } | null>(null)
const connecting = computed(() => !!connection.value)
const guideLines = shallowRef<{ x?: number; y?: number; from: number; to: number }[]>([])
const panning = ref(false)

function addWindowListeners() {
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', onWindowUp)
  window.addEventListener('pointercancel', onWindowCancel)
}
function removeWindowListeners() {
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', onWindowUp)
  window.removeEventListener('pointercancel', onWindowCancel)
  unblockTouchScroll()
}

// A touch handed over by startDrag began outside the canvas (a palette, a sheet), so its touch-action is that
// element's and the browser would scroll or cancel it. Its touchmoves go to where it began, even once that's
// gone from the page, so they're cancelled there (and on window) until the drag ends
let touchBlocked: EventTarget[] = []
function preventTouch(e: TouchEvent) {
  if (e.cancelable) e.preventDefault()
}
function blockTouchScroll(target: EventTarget | null) {
  unblockTouchScroll()
  touchBlocked = target && target !== window ? [target, window] : [window]
  for (const t of touchBlocked) t.addEventListener('touchmove', preventTouch as EventListener, { passive: false })
}
function unblockTouchScroll() {
  for (const t of touchBlocked) t.removeEventListener('touchmove', preventTouch as EventListener)
  touchBlocked = []
}

function onPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement
  if (onOverlay(t)) return
  if (e.pointerType === 'touch') {
    // With no gesture running nothing listens for fingers lifting: whatever is left in the map is stale
    if (!gesture) touches.clear()
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.size === 2) {
      // A second finger: whatever the first one started becomes a pinch
      cancelGesture()
      startPinch()
      return
    }
    if (touches.size > 2) return
  }
  if (gesture) return
  if (e.button === 2) return
  downTarget = t
  root.value?.focus({ preventScroll: true })

  const handle = t.closest<HTMLElement>('[data-flow-handle]')
  const reconnect = t.closest<HTMLElement>('[data-flow-reconnect]')
  const nodeEl = t.closest<HTMLElement>('[data-flow-node]')
  const edgeEl = t.closest<HTMLElement>('[data-flow-edge]')
  if (e.button === 1) return startPan(e)

  const deleteButton = t.closest<HTMLElement>('[data-flow-edge-delete]')
  if (deleteButton) {
    e.preventDefault()
    remove({ edges: [deleteButton.dataset.flowEdgeDelete!] })
    return
  }
  if (reconnect && edgeEl) {
    const edge = edgeById.value.get(edgeEl.dataset.flowEdge!)
    if (edge && isReconnectable(edge)) {
      e.preventDefault()
      return startReconnect(e, edge, reconnect.dataset.flowReconnect as 'source' | 'target')
    }
  }
  if (handle && nodeEl && handle.dataset.flowConnectable === 'true' && nodesConnectable.value) {
    e.preventDefault()
    e.stopPropagation()
    // A connected input pulls its (last) edge off instead: drop it on another node, or on nothing to disconnect
    if (handle.dataset.flowHandle === 'target') {
      const nodeId = nodeEl.dataset.flowNode!
      const hid = handle.dataset.handleId || null
      const attached = visibleEdges.value.filter((ed) => ed.target === nodeId && (ed.targetHandle ?? null) === hid && isReconnectable(ed))
      const edge = attached[attached.length - 1]
      if (edge) return startReconnect(e, edge, 'target')
    }
    return startConnection(e, nodeEl.dataset.flowNode!, handle.dataset.handleId || null, handle.dataset.flowHandle as 'source' | 'target')
  }
  if (nodeEl) {
    if (t.closest(NO_DRAG) && t.closest(NO_DRAG) !== nodeEl) return
    return startNode(e, nodeEl.dataset.flowNode!)
  }
  if (edgeEl) {
    // Edges select on the click (pointerup) so a drag across them still pans, or branches (edgeBranching)
    const touch = e.pointerType === 'touch'
    const edge = edgeById.value.get(edgeEl.dataset.flowEdge!)
    const branch = edge && branching.value && (!touch || selectedEdges.value.has(edge.id)) ? edge : undefined
    if (branch) e.preventDefault()
    gesture = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: vp.value.x, vy: vp.value.y, moved: false, target: 'pane', touch, branch }
    addWindowListeners()
    return
  }
  if (e.shiftKey || (props.selectionOnDrag && e.pointerType !== 'touch') || !props.panOnDrag) {
    if (canSelect.value) return startMarquee(e)
  }
  startPan(e)
}

// On touch there's no Shift: holding a finger still on the background starts a selection box instead
const LONG_PRESS = 450
let longPress: ReturnType<typeof setTimeout> | undefined
function startPan(e: PointerEvent) {
  const touch = e.pointerType === 'touch'
  const g: Gesture = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: vp.value.x, vy: vp.value.y, moved: false, target: 'pane', touch }
  gesture = g
  vpAnim = null
  addWindowListeners()
  clearTimeout(longPress)
  if (touch && canSelect.value) {
    longPress = setTimeout(() => {
      if (gesture !== g || g.moved) return
      const r = rootRect()
      const x = g.sx - r.left
      const y = g.sy - r.top
      gesture = { kind: 'marquee', id: g.id, sx: x, sy: y, x, y, additive: [...selLocal.value.nodes], moved: true }
      marquee.value = { x, y, width: 0, height: 0 }
      navigator.vibrate?.(10)
    }, LONG_PRESS)
  }
}
function startMarquee(e: PointerEvent) {
  const r = rootRect()
  gesture = { kind: 'marquee', id: e.pointerId, sx: e.clientX - r.left, sy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top, additive: e.shiftKey ? [...selLocal.value.nodes] : [], moved: false }
  addWindowListeners()
}
function startNode(e: PointerEvent, nodeId: string) {
  const n = nodeById.value.get(nodeId)
  if (!n) return
  let reselect = false
  if (canSelect.value && n.selectable !== false) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const has = selectedNodes.value.has(nodeId)
      setSelection({ nodes: has ? selLocal.value.nodes.filter((i) => i !== nodeId) : [...selLocal.value.nodes, nodeId] })
      if (has) return
    } else if (!selectedNodes.value.has(nodeId)) {
      setSelection({ nodes: [nodeId], edges: [] })
    } else reselect = true
  }
  gesture = { kind: 'node', id: e.pointerId, nodeId, sx: e.clientX, sy: e.clientY, touch: e.pointerType === 'touch', active: false, starts: new Map(), moved: false, reselect }
  addWindowListeners()
}

function onWindowMove(e: PointerEvent) {
  pointer.x = e.clientX
  pointer.y = e.clientY
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch) return movePinch()
  }
  const g = gesture
  if (!g || g.kind === 'pinch' || g.id !== e.pointerId) return
  if (g.kind === 'pan') {
    const dx = e.clientX - g.sx
    const dy = e.clientY - g.sy
    if (!g.moved && Math.hypot(dx, dy) < (g.touch ? DRAG_SLOP_TOUCH : DRAG_SLOP_MOUSE)) return
    if (g.branch && !g.moved) return startBranch(g, g.branch, e)
    g.moved = true
    clearTimeout(longPress)
    panning.value = true
    writeViewport({ x: g.vx + dx, y: g.vy + dy, zoom: vp.value.zoom })
  } else if (g.kind === 'marquee') {
    const r = rootRect()
    g.x = e.clientX - r.left
    g.y = e.clientY - r.top
    if (!g.moved && Math.hypot(g.x - g.sx, g.y - g.sy) < DRAG_SLOP_MOUSE) return
    g.moved = true
    updateMarquee(g)
  } else if (g.kind === 'node') {
    if (!g.active) {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < (g.touch ? DRAG_SLOP_TOUCH : DRAG_SLOP_MOUSE)) return
      if (!canDrag.value || !beginNodeDrag(g, e)) {
        // Not draggable: the gesture pans instead
        gesture = { kind: 'pan', id: g.id, sx: e.clientX, sy: e.clientY, vx: vp.value.x, vy: vp.value.y, moved: true, target: 'pane' }
        return
      }
    }
    g.moved = true
    moveNodes(g, e.clientX, e.clientY)
    updateInsertTarget(g)
    emit('node-drag', [...g.starts.keys()].map((id) => nodeById.value.get(id)!), e)
    kick()
  } else if (g.kind === 'connect') {
    g.moved = true
    moveConnection(g, e.clientX, e.clientY)
    kick()
  }
}

function onWindowUp(e: PointerEvent) {
  touches.delete(e.pointerId)
  if (pinch) {
    if (touches.size < 2) endPinch()
    return
  }
  const g = gesture
  if (!g || g.kind === 'pinch' || g.id !== e.pointerId) return
  gesture = null
  clearTimeout(longPress)
  removeWindowListeners()
  panning.value = false
  if (g.kind === 'pan') {
    if (!g.moved) clickAt(e)
  } else if (g.kind === 'marquee') {
    marquee.value = null
    if (!g.moved) clickAt(e)
  } else if (g.kind === 'node') {
    if (g.active) endNodeDrag(g, e)
    else {
      if (g.reselect && !e.shiftKey) setSelection({ nodes: [g.nodeId], edges: [] })
      const n = nodeById.value.get(g.nodeId)
      if (n) emit('node-click', n, e)
    }
  } else if (g.kind === 'connect') {
    endConnection(g, e)
  }
}
function onWindowCancel(e: PointerEvent) {
  clearTimeout(longPress)
  touches.delete(e.pointerId)
  if (pinch) {
    if (touches.size < 2) endPinch()
    return
  }
  cancelGesture()
}
function cancelGesture() {
  const g = gesture
  gesture = null
  removeWindowListeners()
  panning.value = false
  marquee.value = null
  if (g?.kind === 'node' && g.active) {
    // Back where they were
    for (const [id, p] of g.starts) {
      const s = springs.get(id)
      if (s) { s.tx = p.x; s.ty = p.y }
    }
    dragging.value = new Set()
    frozenGroups.clear()
    guideLines.value = []
    insertEdge.value = null
    insertPlan = null
    kick()
  }
  if (g?.kind === 'connect') {
    connection.value = null
    connectionTarget.value = null
  }
}

// What the click (a pointerup that didn't move) landed on
function clickAt(e: PointerEvent) {
  const t = downTarget ?? (e.target as HTMLElement)
  const edgeEl = t.closest<HTMLElement>('[data-flow-edge]')
  const edge = edgeEl ? edgeById.value.get(edgeEl.dataset.flowEdge!) : undefined
  if (edge) {
    if (canSelect.value && edge.selectable !== false) {
      if (e.shiftKey) {
        const has = selectedEdges.value.has(edge.id)
        setSelection({ edges: has ? selLocal.value.edges.filter((i) => i !== edge.id) : [...selLocal.value.edges, edge.id] })
      } else setSelection({ nodes: [], edges: [edge.id] })
    }
    emit('edge-click', edge, e)
    return
  }
  if (!e.shiftKey) setSelection(emptySelection())
  emit('pane-click', screenToFlow({ x: e.clientX, y: e.clientY }), e)
}

// ── Pinch (two fingers on touch) ──────────────────────────────────────────────────────────────────────────
function pinchInfo() {
  const [a, b] = [...touches.values()]
  const r = rootRect()
  return { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, cx: (a!.x + b!.x) / 2 - r.left, cy: (a!.y + b!.y) / 2 - r.top }
}
function startPinch() {
  clearTimeout(longPress)
  const p = pinchInfo()
  vpAnim = null
  gesture = { kind: 'pinch' }
  pinch = { ...p, zoom: vp.value.zoom, fx: (p.cx - vp.value.x) / vp.value.zoom, fy: (p.cy - vp.value.y) / vp.value.zoom }
  addWindowListeners()
}
// One finger lifted: the one left on keeps panning (and its pointerup still ends the gesture)
function endPinch() {
  pinch = null
  const rest = [...touches][0]
  if (!rest) { gesture = null; removeWindowListeners(); return }
  const [id, p] = rest
  gesture = { kind: 'pan', id, sx: p.x, sy: p.y, vx: vp.value.x, vy: vp.value.y, moved: true, target: 'pane', touch: true }
}
function movePinch() {
  if (!pinch || touches.size < 2) return
  const p = pinchInfo()
  const z = clampZoom((pinch.zoom * p.dist) / pinch.dist)
  // The flow point first under the fingers' middle stays under it, wherever the fingers go
  writeViewport({ x: p.cx - pinch.fx * z, y: p.cy - pinch.fy * z, zoom: z })
}

// ── Wheel and double click ────────────────────────────────────────────────────────────────────────────────
function onWheel(e: WheelEvent) {
  const t = e.target as HTMLElement
  // Over a panel, or content inside a node marked to scroll on its own: the wheel is theirs
  if (onOverlay(t) || t.closest('[data-flow-nowheel]')) return
  e.preventDefault()
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.value.height : 1
  const r = rootRect()
  if (e.ctrlKey || e.metaKey || props.wheel === 'zoom') {
    const d = Math.max(-50, Math.min(50, e.deltaY * unit))
    zoomAt(vp.value.zoom * Math.exp(-d * 0.01), e.clientX - r.left, e.clientY - r.top)
    vpAnim = null
    return
  }
  const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit
  const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit
  vpAnim = null
  writeViewport({ x: vp.value.x - dx, y: vp.value.y - dy, zoom: vp.value.zoom })
}
function onDblClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (onOverlay(t)) return
  const nodeEl = t.closest<HTMLElement>('[data-flow-node]')
  const edgeEl = t.closest<HTMLElement>('[data-flow-edge]')
  if (nodeEl) {
    const n = nodeById.value.get(nodeEl.dataset.flowNode!)
    if (n) emit('node-dblclick', n, e)
  } else if (edgeEl) {
    const ed = edgeById.value.get(edgeEl.dataset.flowEdge!)
    if (ed) emit('edge-dblclick', ed, e)
  } else {
    emit('pane-dblclick', screenToFlow({ x: e.clientX, y: e.clientY }), e)
    if (props.zoomOnDoubleClick) {
      const r = rootRect()
      zoomAt(targetZoom() * 2, e.clientX - r.left, e.clientY - r.top, true)
    }
  }
}
function onContextMenu(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (onOverlay(t)) return
  const nodeEl = t.closest<HTMLElement>('[data-flow-node]')
  const edgeEl = t.closest<HTMLElement>('[data-flow-edge]')
  const n = nodeEl ? nodeById.value.get(nodeEl.dataset.flowNode!) : undefined
  const ed = edgeEl ? edgeById.value.get(edgeEl.dataset.flowEdge!) : undefined
  if (n) emit('node-contextmenu', n, e)
  else if (ed) emit('edge-contextmenu', ed, e)
  else emit('pane-contextmenu', screenToFlow({ x: e.clientX, y: e.clientY }), e)
}

// ── Selection box ─────────────────────────────────────────────────────────────────────────────────────────
function updateMarquee(g: Extract<Gesture, { kind: 'marquee' }>) {
  const x = Math.min(g.sx, g.x)
  const y = Math.min(g.sy, g.y)
  const w = Math.abs(g.x - g.sx)
  const h = Math.abs(g.y - g.sy)
  marquee.value = { x, y, width: w, height: h }
  const z = vp.value.zoom
  const fx1 = (x - vp.value.x) / z
  const fy1 = (y - vp.value.y) / z
  const fx2 = fx1 + w / z
  const fy2 = fy1 + h / z
  const inside = visibleNodes.value.filter((n) => {
    if (n.selectable === false) return false
    const a = getAbsolutePosition(n.id)
    const s = getSize(n.id)
    return a.x < fx2 && a.x + s.width > fx1 && a.y < fy2 && a.y + s.height > fy1
  }).map((n) => n.id)
  const nodes = [...new Set([...g.additive, ...inside])]
  const set = new Set(nodes)
  setSelection({ nodes, edges: visibleEdges.value.filter((e) => e.selectable !== false && set.has(e.source) && set.has(e.target)).map((e) => e.id) })
}

// ── Dragging nodes ────────────────────────────────────────────────────────────────────────────────────────
function beginNodeDrag(g: Extract<Gesture, { kind: 'node' }>, e: PointerEvent) {
  const sel = selectedNodes.value.has(g.nodeId) ? selLocal.value.nodes : [g.nodeId]
  // A node whose group moves too comes along by itself
  const ids = sel.filter((id) => {
    const n = nodeById.value.get(id)
    return n && n.draggable !== false && !isHidden(id) && !ancestors(id).some((a) => sel.includes(a))
  })
  if (!ids.includes(g.nodeId) && nodeById.value.get(g.nodeId)?.draggable === false) return false
  if (!ids.length) return false
  for (const id of ids) {
    const s = springs.get(id)!
    g.starts.set(id, { x: s.tx, y: s.ty })
  }
  g.active = true
  for (const id of ids) for (const a of ancestors(id)) if (!frozenGroups.has(a)) frozenGroups.set(a, getSize(a))
  dragging.value = new Set(ids)
  document.body.style.userSelect = 'none'
  emit('node-drag-start', ids.map((id) => nodeById.value.get(id)!), e)
  return true
}

/**
 * Drags a node with a pointer that's already down (from a palette outside the canvas: add the node under the
 * pointer, then hand it the event). It follows the pointer from there, with the guides and splicing into edges
 */
function startDrag(id: string, e: PointerEvent) {
  if (!nodeById.value.has(id) || locked.value) return
  if (gesture) cancelGesture()
  // A node added this tick has no spring yet
  if (!springs.has(id)) syncPositions()
  if (canSelect.value) setSelection({ nodes: [id], edges: [] })
  const g: Extract<Gesture, { kind: 'node' }> = { kind: 'node', id: e.pointerId, nodeId: id, sx: e.clientX, sy: e.clientY, touch: e.pointerType === 'touch', active: false, starts: new Map(), moved: true, reselect: false }
  gesture = g
  pointer.x = e.clientX
  pointer.y = e.clientY
  addWindowListeners()
  if (g.touch) blockTouchScroll(e.target)
  if (!beginNodeDrag(g, e)) {
    gesture = null
    removeWindowListeners()
  }
}

const GUIDE_SNAP = 6
function moveNodes(g: Extract<Gesture, { kind: 'node' }>, cx: number, cy: number) {
  const z = vp.value.zoom
  let dx = (cx - g.sx) / z
  let dy = (cy - g.sy) / z
  const lead = g.starts.get(g.nodeId) ?? [...g.starts.values()][0]!
  const leadId = g.starts.has(g.nodeId) ? g.nodeId : [...g.starts.keys()][0]!
  if (props.snapToGrid) {
    const gs = props.gridSize
    dx = Math.round((lead.x + dx) / gs) * gs - lead.x
    dy = Math.round((lead.y + dy) / gs) * gs - lead.y
    guideLines.value = []
  } else if (props.guides && g.starts.size === 1) {
    const snapped = snapToGuides(leadId, lead, dx, dy)
    dx = snapped.dx
    dy = snapped.dy
  }
  for (const [id, p] of g.starts) {
    let x = p.x + dx
    let y = p.y + dy
    const n = nodeById.value.get(id)!
    const parent = parentOf(id)
    if (n.extent === 'parent' && parent) {
      const ps = getSize(parent)
      const s = getSize(id)
      x = Math.max(0, Math.min(ps.width - s.width, x))
      y = Math.max(0, Math.min(ps.height - s.height, y))
    }
    const s = springs.get(id)!
    s.x = s.tx = x
    s.y = s.ty = y
    s.vx = s.vy = 0
    const d = disp.get(id)!
    d.x = x
    d.y = y
  }
}
// Snaps the dragged node's edges and center to other nodes' within a few px, and draws the lines it lines up on
function snapToGuides(id: string, start: FlowXY, dx: number, dy: number) {
  const parentAbs = parentOf(id) ? getAbsolutePosition(parentOf(id)!) : { x: 0, y: 0 }
  const s = getSize(id)
  const ax = parentAbs.x + start.x + dx
  const ay = parentAbs.y + start.y + dy
  const xs = [ax, ax + s.width / 2, ax + s.width]
  const ys = [ay, ay + s.height / 2, ay + s.height]
  const tol = GUIDE_SNAP / vp.value.zoom
  let bestX: { d: number; to: number; box: { y1: number; y2: number } } | null = null
  let bestY: { d: number; to: number; box: { x1: number; x2: number } } | null = null
  const skip = new Set([id, ...descendants(id), ...ancestors(id)])
  for (const n of visibleNodes.value) {
    if (skip.has(n.id)) continue
    const a = getAbsolutePosition(n.id)
    const ns = getSize(n.id)
    const oxs = [a.x, a.x + ns.width / 2, a.x + ns.width]
    const oys = [a.y, a.y + ns.height / 2, a.y + ns.height]
    for (const x of xs) for (const o of oxs) {
      const d = o - x
      if (Math.abs(d) <= tol && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, to: o, box: { y1: a.y, y2: a.y + ns.height } }
    }
    for (const y of ys) for (const o of oys) {
      const d = o - y
      if (Math.abs(d) <= tol && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, to: o, box: { x1: a.x, x2: a.x + ns.width } }
    }
  }
  const lines: { x?: number; y?: number; from: number; to: number }[] = []
  if (bestX) {
    dx += bestX.d
    lines.push({ x: bestX.to, from: Math.min(ay, bestX.box.y1), to: Math.max(ay + s.height, bestX.box.y2) })
  }
  if (bestY) {
    dy += bestY.d
    const nx = parentAbs.x + start.x + dx
    lines.push({ y: bestY.to, from: Math.min(nx, bestY.box.x1), to: Math.max(nx + s.width, bestY.box.x2) })
  }
  guideLines.value = lines
  return { dx, dy }
}

function getIntersectingNodes(target: string | { x: number; y: number; width: number; height: number }) {
  let box: { x: number; y: number; width: number; height: number }
  const skip = new Set<string>()
  if (typeof target === 'string') {
    box = { ...getAbsolutePosition(target), ...getSize(target) }
    skip.add(target)
    descendants(target).forEach((d) => skip.add(d))
    ancestors(target).forEach((a) => skip.add(a))
  } else box = target
  return visibleNodes.value.filter((n) => {
    if (skip.has(n.id) || n.type === 'group') return false
    const a = getAbsolutePosition(n.id)
    const s = getSize(n.id)
    return a.x < box.x + box.width && a.x + s.width > box.x && a.y < box.y + box.height && a.y + s.height > box.y
  })
}

// ── A lone node dropped onto an edge splices into it ─────────────────────────────────────────────────────
const insertEdge = ref<string | null>(null)
let insertPlan: { node: string; edge: FlowEdge; connections: [FlowConnection, FlowConnection] } | null = null
function updateInsertTarget(g: Extract<Gesture, { kind: 'node' }>) {
  insertPlan = null
  const found = findInsert(g)
  insertPlan = found
  insertEdge.value = found?.edge.id ?? null
}
function findInsert(g: Extract<Gesture, { kind: 'node' }>): typeof insertPlan {
  if (!props.insertOnEdge || g.starts.size !== 1 || !nodesConnectable.value) return null
  const id = [...g.starts.keys()][0]!
  const n = nodeById.value.get(id)
  if (!n || n.type === 'group' || n.connectable === false || n.insertable === false) return null
  if (edgesLocal.value.some((e) => e.source === id || e.target === id)) return null
  // It needs a way in and a way out (or no handles at all: then edges meet its sides; a circle's meet the circle)
  let target: string | null = null
  let source: string | null = null
  const list = handles.get(id)
  if (list?.length) {
    const t = list.find((h) => h.type === 'target' && h.connectable)
    const s = list.find((h) => h.type === 'source' && h.connectable)
    if ((!t && n.type !== 'circle') || (!s && n.type !== 'circle')) return null
    target = t?.id ?? null
    source = s?.id ?? null
  }
  // The node's center over the edge, within half its height
  const a = getAbsolutePosition(id)
  const size = getSize(id)
  const cx = a.x + size.width / 2
  const cy = a.y + size.height / 2
  const reach = Math.max(8 / vp.value.zoom, Math.min(size.width, size.height) / 2)
  let best: { edge: FlowEdge; d: number } | null = null
  for (const e of visibleEdges.value) {
    if (e.deletable === false) continue
    const geo = edgeGeometry(e)
    if (!geo) continue
    const d = distanceToPoints(cx, cy, edgePathPoints(edgeType(e), geo))
    if (d <= reach && (!best || d < best.d)) best = { edge: e, d }
  }
  if (!best) return null
  const e = best.edge
  const c1: FlowConnection = { source: e.source, sourceHandle: e.sourceHandle ?? null, target: id, targetHandle: target }
  const c2: FlowConnection = { source: id, sourceHandle: source, target: e.target, targetHandle: e.targetHandle ?? null }
  if (!isValid(c1) || !isValid(c2)) return null
  return { node: id, edge: e, connections: [c1, c2] }
}

// Room between spliced-in nodes, along the flow's direction
const SPLICE_GAP = 48
function makeRoom(nodes: FlowNode[], plan: NonNullable<typeof insertPlan>): FlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const a = byId.get(plan.edge.source)
  const b = byId.get(plan.node)
  const c = byId.get(plan.edge.target)
  // Only among siblings: positions are relative to the same parent
  if (!a || !b || !c || a.parentId !== b.parentId || b.parentId !== c.parentId) return nodes
  const horizontal = props.direction !== 'vertical'
  const k = horizontal ? 'x' : 'y'
  const len = (id: string) => (horizontal ? getSize(id).width : getSize(id).height)
  const aEnd = a.position[k] + len(a.id)
  // C must come after A for "after" to mean anything (a loop back or a sideways edge is left alone)
  if (c.position[k] < aEnd) return nodes
  const bStart = Math.max(b.position[k], aEnd + SPLICE_GAP)
  const push = Math.max(0, bStart + len(b.id) + SPLICE_GAP - c.position[k])
  // C and everything downstream of it (A, B and A's own ancestors stay put)
  const moving = new Set<string>()
  if (push > 0) {
    const out = new Map<string, string[]>()
    for (const e of edgesLocal.value) if (e !== plan.edge) (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e.target)
    const queue = [c.id]
    while (queue.length) {
      const id = queue.shift()!
      if (moving.has(id) || id === a.id || id === b.id) continue
      const n = byId.get(id)
      if (!n || n.parentId !== c.parentId) continue
      moving.add(id)
      queue.push(...(out.get(id) ?? []))
    }
  }
  if (bStart === b.position[k] && !moving.size) return nodes
  return nodes.map((n) => {
    if (n.id === b.id) return { ...n, position: { ...n.position, [k]: bStart } }
    if (moving.has(n.id)) return { ...n, position: { ...n.position, [k]: n.position[k] + push } }
    return n
  })
}

function endNodeDrag(g: Extract<Gesture, { kind: 'node' }>, e: PointerEvent) {
  document.body.style.userSelect = ''
  const plan = insertPlan
  insertPlan = null
  insertEdge.value = null
  // The two edges that take the old one's place, with its look (not its label)
  let spliced: FlowEdge[] | undefined
  if (plan && props.autoConnect) {
    const { id: _id, label: _label, source: _s, target: _t, sourceHandle: _sh, targetHandle: _th, ...look } = plan.edge
    spliced = plan.connections.map((c) => ({ ...look, id: makeId('edge'), ...c }))
  }
  guideLines.value = []
  const moved = [...g.starts.keys()].filter((id) => {
    const s = springs.get(id)!
    const p = g.starts.get(id)!
    return s.tx !== p.x || s.ty !== p.y
  })
  // Reparent into the group under the pointer
  const reparent = new Map<string, string | undefined>()
  if (props.dropIntoGroups) {
    const at = screenToFlow({ x: e.clientX, y: e.clientY })
    for (const id of g.starts.keys()) {
      const n = nodeById.value.get(id)!
      if (n.type === 'group') continue
      const skip = new Set([id, ...descendants(id)])
      const group = groupNodes.value
        .filter((gn) => !skip.has(gn.id))
        .filter((gn) => {
          const a = getAbsolutePosition(gn.id)
          const s = getSize(gn.id)
          return at.x >= a.x && at.x <= a.x + s.width && at.y >= a.y && at.y <= a.y + s.height
        })
        .sort((a, b) => depthOf(b.id) - depthOf(a.id))[0]
      if ((group?.id ?? undefined) !== (n.parentId ?? undefined)) reparent.set(id, group?.id)
    }
  }
  if (moved.length || reparent.size) {
    const movedSet = new Set(moved)
    const nodes = nodesLocal.value.map((n) => {
      if (!movedSet.has(n.id) && !reparent.has(n.id)) return n
      const s = springs.get(n.id)!
      let position = { x: s.tx, y: s.ty }
      let parentId = n.parentId
      if (reparent.has(n.id)) {
        const abs = getAbsolutePosition(n.id)
        parentId = reparent.get(n.id)
        const pa = parentId ? getAbsolutePosition(parentId) : { x: 0, y: 0 }
        position = { x: abs.x - pa.x, y: abs.y - pa.y }
        const sp = springs.get(n.id)!
        sp.x = sp.tx = position.x
        sp.y = sp.ty = position.y
        const d = disp.get(n.id)!
        d.x = position.x
        d.y = position.y
      }
      const out: FlowNode = { ...n, position }
      if (parentId) out.parentId = parentId
      else delete out.parentId
      return out
    })
    // Spliced in without room: it moves to sit after A, and C with everything after it moves on to make room
    const placed = spliced && plan ? makeRoom(nodes, plan) : nodes
    // Let go first, so the spliced node springs to its place too
    if (spliced) dragging.value = new Set()
    commit({ nodes: placed, edges: spliced ? [...edgesLocal.value.filter((x) => x !== plan!.edge), ...spliced] : undefined })
    const first = nodeById.value.get(g.nodeId)
    if (first) announce(locale.flowMoved.replace('{label}', nodeLabel(first)))
  }
  dragging.value = new Set()
  frozenGroups.clear()
  const draggedNodes = [...g.starts.keys()].map((id) => nodeById.value.get(id)!).filter(Boolean)
  if (plan) emit('insert', { node: nodeById.value.get(plan.node)!, edge: plan.edge, connections: plan.connections })
  emit('node-drag-stop', { nodes: draggedNodes, intersecting: getIntersectingNodes(g.nodeId), event: e })
}

// Near the edges while dragging, the view scrolls (and what's dragged comes along)
const EDGE_ZONE = 40
function autoPan(dt: number) {
  const g = gesture
  if (!g || (g.kind !== 'node' && g.kind !== 'connect') || !g.moved) return false
  const r = rootRect()
  const px = pointer.x - r.left
  const py = pointer.y - r.top
  const speed = 600
  const vx = px < EDGE_ZONE ? 1 - px / EDGE_ZONE : px > r.width - EDGE_ZONE ? -(1 - (r.width - px) / EDGE_ZONE) : 0
  const vy = py < EDGE_ZONE ? 1 - py / EDGE_ZONE : py > r.height - EDGE_ZONE ? -(1 - (r.height - py) / EDGE_ZONE) : 0
  if (!vx && !vy) return false
  const mx = Math.max(-1, Math.min(1, vx)) * speed * dt
  const my = Math.max(-1, Math.min(1, vy)) * speed * dt
  writeViewport({ x: vp.value.x + mx, y: vp.value.y + my, zoom: vp.value.zoom })
  if (g.kind === 'node') {
    // The drag's start shifts with the view so the nodes stay under the pointer
    g.sx += mx
    g.sy += my
    moveNodes(g, pointer.x, pointer.y)
  } else moveConnection(g, pointer.x, pointer.y)
  return true
}

// ── Connecting ────────────────────────────────────────────────────────────────────────────────────────────
function startConnection(e: PointerEvent, nodeId: string, handleId: string | null, type: 'source' | 'target') {
  const from = handlePoint(nodeId, type, handleId)
  if (!from) return
  gesture = { kind: 'connect', id: e.pointerId, from: { nodeId, handleId, type }, moved: false }
  connection.value = { from, to: { x: from.x, y: from.y }, toPosition: null, type, edgeType: edgeRoute({ ...props.defaultEdgeOptions }) }
  pointer.x = e.clientX
  pointer.y = e.clientY
  emit('connect-start', { nodeId, handleId, type })
  addWindowListeners()
}
// A branch: a new connection from the edge's source, its preview leaving from where the edge was grabbed
function startBranch(pan: { id: number; sx: number; sy: number }, edge: FlowEdge, e: PointerEvent) {
  const src = handlePoint(edge.source, 'source', edge.sourceHandle)
  if (!src) return
  const handleId = edge.sourceHandle ?? null
  const g: Gesture = { kind: 'connect', id: pan.id, from: { nodeId: edge.source, handleId, type: 'source' }, moved: true }
  gesture = g
  const at = screenToFlow({ x: pan.sx, y: pan.sy })
  connection.value = { from: { x: at.x, y: at.y, position: src.position }, to: at, toPosition: null, type: 'source', edgeType: edgeRoute(edge) }
  emit('connect-start', { nodeId: edge.source, handleId, type: 'source' })
  moveConnection(g, e.clientX, e.clientY)
  kick()
}
function startReconnect(e: PointerEvent, edge: FlowEdge, end: 'source' | 'target') {
  // Dragging the target end: the connection runs from the source, and the other way round
  const fixed = end === 'target' ? { nodeId: edge.source, handleId: edge.sourceHandle ?? null, type: 'source' as const } : { nodeId: edge.target, handleId: edge.targetHandle ?? null, type: 'target' as const }
  const from = handlePoint(fixed.nodeId, fixed.type, fixed.handleId)
  if (!from) return
  gesture = { kind: 'connect', id: e.pointerId, from: fixed, reconnect: { edge, end }, moved: false }
  const to = screenToFlow({ x: e.clientX, y: e.clientY })
  connection.value = { from, to, toPosition: null, type: fixed.type, edgeType: edgeRoute(edge) }
  pointer.x = e.clientX
  pointer.y = e.clientY
  addWindowListeners()
}
const handleKey = (nodeId: string, h: { id: string | null; type: string }) => `${nodeId}:${h.id ?? ''}:${h.type}`
function connectionFor(from: { nodeId: string; handleId: string | null; type: 'source' | 'target' }, nodeId: string, handleId: string | null): FlowConnection {
  return from.type === 'source'
    ? { source: from.nodeId, sourceHandle: from.handleId, target: nodeId, targetHandle: handleId }
    : { source: nodeId, sourceHandle: handleId, target: from.nodeId, targetHandle: from.handleId }
}
function isValid(c: FlowConnection, ignore?: FlowEdge) {
  if (c.source === c.target) return false
  const dup = edgesLocal.value.some((e) => e !== ignore && e.source === c.source && e.target === c.target && (e.sourceHandle ?? null) === c.sourceHandle && (e.targetHandle ?? null) === c.targetHandle)
  if (dup) return false
  return props.isValidConnection ? props.isValidConnection(c) : true
}
let connectionCandidate: { nodeId: string; handleId: string | null; valid: boolean } | null = null
function moveConnection(g: Extract<Gesture, { kind: 'connect' }>, cx: number, cy: number) {
  const p = screenToFlow({ x: cx, y: cy })
  const want = g.from.type === 'source' ? 'target' : 'source'
  const radius = props.connectionRadius / vp.value.zoom
  let best: { nodeId: string; h: FlowHandleBounds | null; d: number; x: number; y: number; position: FlowPosition } | null = null
  for (const n of visibleNodes.value) {
    if (n.connectable === false) continue
    const a = getAbsolutePosition(n.id)
    const s = getSize(n.id)
    const over = p.x >= a.x && p.x <= a.x + s.width && p.y >= a.y && p.y <= a.y + s.height
    const list = (handles.get(n.id) ?? []).filter((h) => h.type === want && h.connectable)
    if (list.length) {
      for (const h of list) {
        const x = a.x + h.x
        const y = a.y + h.y
        const d = Math.hypot(x - p.x, y - p.y)
        // Over the node's body, its nearest handle counts too (easier on touch)
        if ((d <= radius || over) && (!best || d < best.d)) best = { nodeId: n.id, h, d: over && d > radius ? d + radius : d, x, y, position: h.position }
      }
    } else if (over) {
      // A node without a handle of that kind connects at its side (a circle, at its center)
      const position = sidePositions(n)[want]
      const sp = sidePoint(n.id, position)
      const d = Math.hypot(sp.x - p.x, sp.y - p.y)
      if (!best || d < best.d) best = { nodeId: n.id, h: null, d, x: sp.x, y: sp.y, position }
    }
  }
  if (best && best.nodeId === g.from.nodeId) best = null
  const cur = connection.value!
  if (best) {
    const c = connectionFor(g.from, best.nodeId, best.h?.id ?? null)
    const valid = isValid(c, g.reconnect?.edge)
    connectionCandidate = { nodeId: best.nodeId, handleId: best.h?.id ?? null, valid }
    connectionTarget.value = { key: handleKey(best.nodeId, { id: best.h?.id ?? null, type: want }), valid }
    connection.value = { ...cur, to: valid ? { x: best.x, y: best.y } : p, toPosition: valid ? best.position : null }
  } else {
    connectionCandidate = null
    connectionTarget.value = null
    connection.value = { ...cur, to: p, toPosition: null }
  }
}
function endConnection(g: Extract<Gesture, { kind: 'connect' }>, e: PointerEvent) {
  const cand = connectionCandidate
  connectionCandidate = null
  connection.value = null
  connectionTarget.value = null
  const position = screenToFlow({ x: e.clientX, y: e.clientY })
  const c = cand?.valid ? connectionFor(g.from, cand.nodeId, cand.handleId) : null
  if (g.reconnect) {
    const edge = g.reconnect.edge
    if (c) {
      emit('reconnect', { edge, connection: c })
      if (props.autoConnect) updateEdge(edge.id, { source: c.source, target: c.target, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle })
    } else if (g.moved && !cand && edge.deletable !== false) {
      // Pulled off and dropped on nothing: disconnected (dropped on a handle it can't join, it stays)
      remove({ edges: [edge.id] })
    }
    return
  }
  if (c) {
    emit('connect', c)
    if (props.autoConnect) {
      addEdges({ ...props.defaultEdgeOptions, id: makeId('edge'), ...c })
      const s = nodeById.value.get(c.source)
      const t = nodeById.value.get(c.target)
      if (s && t) announce(locale.flowConnected.replace('{source}', nodeLabel(s)).replace('{target}', nodeLabel(t)))
    }
  }
  emit('connect-end', { connection: c, position, from: g.from })
}
const connectionPath = computed(() => {
  const c = connection.value
  if (!c) return ''
  const flip = c.type === 'target'
  const opposite: Record<FlowPosition, FlowPosition> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
  const toPos = c.toPosition ?? opposite[c.from.position]
  const ends = flip
    ? { sourceX: c.to.x, sourceY: c.to.y, sourcePosition: toPos, targetX: c.from.x, targetY: c.from.y, targetPosition: c.from.position }
    : { sourceX: c.from.x, sourceY: c.from.y, sourcePosition: c.from.position, targetX: c.to.x, targetY: c.to.y, targetPosition: toPos }
  return pathFor(c.edgeType, ends).path
})

// ── Keyboard ──────────────────────────────────────────────────────────────────────────────────────────────
const nodeLabel = (n: FlowNode) => String((n.data as { label?: unknown } | undefined)?.label ?? n.id)
function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
}
function onKeyDown(e: KeyboardEvent) {
  if (isTyping(e.target)) return
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (e.key === 'Escape') {
    if (gesture) cancelGesture()
    else if (selLocal.value.nodes.length || selLocal.value.edges.length) setSelection(emptySelection())
    else return
    e.preventDefault()
    e.stopPropagation()
    return
  }
  if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
  if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) { e.preventDefault(); redo(); return }
  if (mod && key === 'a') { e.preventDefault(); selectAll(); return }
  if (mod && key === 'c') { copy(); return }
  if (mod && key === 'x') { e.preventDefault(); cut(); return }
  if (mod && key === 'v') {
    e.preventDefault()
    paste(pointer.inside ? screenToFlow(pointer) : undefined)
    return
  }
  if (props.deleteKeys?.includes(e.key)) { e.preventDefault(); deleteSelection(); return }
  if (!mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomIn(); return }
  if (!mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomOut(); return }
  if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) { e.preventDefault(); fitView(); return }
  const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const dir = arrows[e.key]
  if (dir && selLocal.value.nodes.length && canDrag.value) {
    e.preventDefault()
    const step = props.snapToGrid ? props.gridSize : e.shiftKey ? 50 : 10
    const sel = selLocal.value.nodes
    const ids = new Set(sel.filter((id) => nodeById.value.get(id)?.draggable !== false && !ancestors(id).some((a) => sel.includes(a))))
    if (!ids.size) return
    instantNext = true
    commit({ nodes: nodesLocal.value.map((n) => (ids.has(n.id) ? { ...n, position: { x: n.position.x + dir[0] * step, y: n.position.y + dir[1] * step } } : n)) }, { coalesce: `move:${[...ids].join(',')}` })
    const first = nodeById.value.get([...ids][0]!)
    if (first) announce(locale.flowMoved.replace('{label}', nodeLabel(first)))
  } else if (dir && !selLocal.value.nodes.length) {
    e.preventDefault()
    writeViewport({ x: vp.value.x - dir[0] * 40, y: vp.value.y - dir[1] * 40, zoom: vp.value.zoom })
  }
}
// Focusing a node (Tab) and Enter/Space on it select it
function onNodeKey(e: KeyboardEvent, id: string) {
  if (isTyping(e.target) || (e.target as HTMLElement).dataset.flowNode !== id) return
  if ((e.key === 'Enter' || e.key === ' ') && canSelect.value) {
    e.preventDefault()
    if (e.shiftKey) setSelection({ nodes: selectedNodes.value.has(id) ? selLocal.value.nodes.filter((i) => i !== id) : [...selLocal.value.nodes, id] })
    else setSelection({ nodes: [id], edges: [] })
  }
}
function onEdgeKey(e: KeyboardEvent, id: string) {
  if ((e.key === 'Enter' || e.key === ' ') && canSelect.value) {
    e.preventDefault()
    setSelection({ nodes: [], edges: [id] })
  }
}

// ── Background ────────────────────────────────────────────────────────────────────────────────────────────
const patternId = `m3-flow-bg-${Math.random().toString(36).slice(2, 8)}`
const pattern = computed(() => {
  let gap = props.gridSize * vp.value.zoom
  // Coarser when zoomed out, so the dots don't turn into a gray haze
  while (gap < 10) gap *= 2
  return { gap, x: ((vp.value.x % gap) + gap) % gap, y: ((vp.value.y % gap) + gap) % gap, r: Math.max(0.6, Math.min(1.4, vp.value.zoom)) }
})

// ── Context ───────────────────────────────────────────────────────────────────────────────────────────────
const context: FlowInternals = {
  nodes: computed(() => nodesLocal.value),
  edges: computed(() => edgesLocal.value),
  viewport: vp,
  minZoom: computed(() => props.minZoom),
  maxZoom: computed(() => props.maxZoom),
  selection: computed(() => selLocal.value),
  size,
  locked,
  getNode,
  getAbsolutePosition,
  getSize,
  getIntersectingNodes,
  screenToFlow,
  flowToScreen,
  setViewport,
  fitView,
  setCenter,
  zoomIn,
  zoomOut,
  zoomTo,
  addNodes,
  addEdges,
  updateNode,
  updateEdge,
  remove,
  setSelection,
  layout: (fn, options) => runLayout(fn, options),
  undo,
  redo,
  canUndo,
  canRedo,
  copy,
  cut,
  paste,
  startDrag,
  registerHandle,
  measureNode: queueMeasure,
  startConnection,
  connectionTarget,
  connecting,
  insertEdge,
  branching,
  nodesConnectable,
  direction: computed(() => props.direction),
  // For the internal node shells and edges
  registerNodeEl,
  selectedNodes,
  selectedEdges,
  dragging,
  isLifted,
  zIndexOf,
  edgeGeometry,
  isReconnectable,
  sidePositions,
  onNodeKey,
  onEdgeKey,
}
provide(FLOW_KEY, context)

// ── Mount ─────────────────────────────────────────────────────────────────────────────────────────────────
let ro: ResizeObserver | undefined
onMounted(async () => {
  const el = root.value!
  el.addEventListener('wheel', onWheel, { passive: false })
  const sizeRo = new ResizeObserver(() => { size.value = { width: el.clientWidth, height: el.clientHeight } })
  sizeRo.observe(el)
  onBeforeUnmount(() => sizeRo.disconnect())
  size.value = { width: el.clientWidth, height: el.clientHeight }
  ro = new ResizeObserver((entries) => {
    for (const en of entries) {
      const id = (en.target as HTMLElement).dataset.flowNode
      if (id) measureNode(id)
    }
  })
  for (const [id, n] of nodeEls) { ro.observe(n); measureNode(id) }
  await nextTick()
  if (props.layout) await runLayout(null, undefined, { history: false })
  await nextTick()
  if (props.fitView) fitView({ animate: false })
  ready.value = true
  emit('init', context)
})
onBeforeUnmount(() => {
  root.value?.removeEventListener('wheel', onWheel)
  removeWindowListeners()
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(longPress)
  document.body.style.userSelect = ''
})

defineExpose(context as FlowContext)
</script>

<template>
  <div
    ref="root"
    v-bind="$attrs"
    class="m3-flow overflow-hidden bg-surface outline-none select-none"
    :class="[panning && 'cursor-grabbing', locked && 'm3-flow-locked']"
    tabindex="0"
    role="application"
    :aria-label="label ?? locale.flowCanvas"
    aria-roledescription="flow"
    @pointerdown="onPointerDown"
    @pointerenter="pointer.inside = true"
    @pointerleave="pointer.inside = false"
    @dblclick="onDblClick"
    @contextmenu="onContextMenu"
    @keydown="onKeyDown"
  >
    <svg v-if="background !== 'none'" class="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern :id="patternId" :x="pattern.x" :y="pattern.y" :width="pattern.gap" :height="pattern.gap" patternUnits="userSpaceOnUse">
          <circle v-if="background === 'dots'" :cx="pattern.r" :cy="pattern.r" :r="pattern.r" class="fill-outline-variant" />
          <path v-else :d="`M${pattern.gap} 0 L0 0 0 ${pattern.gap}`" fill="none" class="stroke-outline-variant" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" :fill="`url(#${patternId})`" />
    </svg>

    <div
      ref="layer"
      class="m3-flow-viewport absolute top-0 left-0 origin-top-left"
      :style="{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`, visibility: ready ? undefined : 'hidden' }"
    >
      <NodeShell v-for="n in groupNodes" :key="n.id" :node="n" :render="nodeRenderer(n)" />
      <svg class="m3-flow-edges pointer-events-none absolute top-0 left-0 size-px overflow-visible" aria-hidden="false">
        <EdgeView v-for="e in visibleEdges" :key="e.id" :edge="e" :render="edgeRenderer(e)" />
        <path
          v-if="connection"
          class="m3-flow-connection-line fill-none stroke-primary"
          :d="connectionPath"
          stroke-width="2"
          :stroke-dasharray="connectionTarget?.valid ? undefined : '6 4'"
        />
      </svg>
      <div class="m3-flow-edge-labels absolute top-0 left-0">
        <template v-for="e in visibleEdges" :key="e.id">
          <EdgeLabel v-if="e.label || $slots['edge-label'] || selectedEdges.has(e.id)" :edge="e" :render="$slots['edge-label']" />
        </template>
      </div>
      <NodeShell v-for="n in plainNodes" :key="n.id" :node="n" :render="nodeRenderer(n)" />
      <svg v-if="guideLines.length" class="pointer-events-none absolute top-0 left-0 size-px overflow-visible" aria-hidden="true">
        <line
          v-for="(g, i) in guideLines"
          :key="i"
          class="stroke-primary"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          :x1="g.x ?? g.from"
          :x2="g.x ?? g.to"
          :y1="g.y ?? g.from"
          :y2="g.y ?? g.to"
        />
      </svg>
    </div>

    <div
      v-if="marquee"
      class="m3-flow-marquee pointer-events-none absolute rounded-xs border border-primary bg-primary/8"
      :style="{ left: `${marquee.x}px`, top: `${marquee.y}px`, width: `${marquee.width}px`, height: `${marquee.height}px` }"
    />

    <div v-if="!nodesLocal.length && $slots.empty" class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div class="pointer-events-auto">
        <slot name="empty" />
      </div>
    </div>

    <slot :flow="context" />

    <div class="sr-only" aria-live="polite">{{ announcement }}</div>
  </div>
</template>

<style>
@layer base {
  .m3-flow {
    position: relative;
    display: block;
    touch-action: none;
  }
}
.m3-flow-circle {
  transition: background-color 250ms cubic-bezier(0.2, 0, 0, 1), color 250ms cubic-bezier(0.2, 0, 0, 1), border-color 200ms, box-shadow 250ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-flow-edge-line {
  transition: stroke 250ms cubic-bezier(0.2, 0, 0, 1), stroke-width 250ms cubic-bezier(0.2, 0, 0, 1), fill 250ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-flow-edge-animated {
  stroke-dasharray: 6 4;
  animation: m3-flow-dash 400ms linear infinite;
}
.m3-flow-edge-reverse {
  animation-direction: reverse;
}
.m3-flow-edge-dashed {
  stroke-dasharray: 6 4;
}
@keyframes m3-flow-dash {
  from { stroke-dashoffset: 10; }
  to { stroke-dashoffset: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .m3-flow-edge-animated { animation: none; }
  .m3-flow-edge-line { transition: none; }
}
</style>
