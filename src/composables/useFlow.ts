import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { FlowEdgePath, FlowPosition } from './flowPaths'
import type { FlowLayout, FlowLayoutOptions } from './flowLayout'

export type { FlowPosition }

/** A point in flow coordinates */
export interface FlowXY { x: number; y: number }

/**
 * A node. Treat nodes as immutable: MFlow emits new arrays with new objects for whatever changed (`v-model:nodes`),
 * and the history (undo) keeps the old ones.
 */
export interface FlowNode<D = any> {
  id: string
  /**
   * How it's drawn: `default` (an MFlowNode with a handle each side), `input` (only a source), `output` (only a
   * target), `circle` (a round vertex, see `FlowCircleData`), `group` (a container for nodes whose `parentId` is this
   * one), or any name you give a `#node-<type>` slot
   */
  type?: string
  /** Its top left corner, in flow coordinates (relative to the parent's corner when it has a `parentId`) */
  position: FlowXY
  /** Anything; the default node shows `label`, `subtitle` and `icon` */
  data?: D
  /** A fixed size; otherwise it's measured. A `group` without one wraps its children */
  width?: number
  height?: number
  /** The group this node sits in: it moves with it */
  parentId?: string
  /** `'parent'` keeps it inside its group */
  extent?: 'parent'
  /** Where the default node's handles go; default from MFlow's `direction` */
  sourcePosition?: FlowPosition
  targetPosition?: FlowPosition
  hidden?: boolean
  draggable?: boolean
  selectable?: boolean
  connectable?: boolean
  deletable?: boolean
  /** `false` keeps it from splicing into an edge when dropped onto one */
  insertable?: boolean
  /**
   * With snapToGrid, what lands on the grid is its position plus this (default its corner): `{ x: w / 2, y: h / 2 }`
   * puts its middle on the grid, e.g. a junction dot whose wires run along the grid lines
   */
  gridOffset?: FlowXY
  class?: string
}

/** What a `circle` node shows */
export interface FlowCircleData {
  label?: string
  /** Its fill: a container role (default a neutral surface) */
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral' | 'inverse'
  /** A small count or tag on its top right (a level, an excess) */
  badge?: string | number
  /** A soft halo around it, in a role's color */
  ring?: 'primary' | 'secondary' | 'tertiary' | 'error'
  /** Diameter in px (default 56) */
  size?: number
}

export type FlowMarker = 'arrow' | 'arrow-closed' | 'none'

export interface FlowEdge<D = any> {
  id: string
  source: string
  target: string
  /** The handle's `id` when its node has several */
  sourceHandle?: string | null
  targetHandle?: string | null
  /** `bezier` (default), `smoothstep`, `step`, `straight`, or a `#edge-<type>` slot */
  type?: string
  /**
   * For a `#edge-<type>` slot: how it's routed, which is the `path` the slot gets and where the edge is hit
   * (default `bezier`)
   */
  pathType?: 'bezier' | 'smoothstep' | 'step' | 'straight'
  label?: string
  /** The label chip's color (default a neutral chip) */
  labelTone?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral'
  /** Dashes that flow from source to target (`'reverse'`: from target to source) */
  animated?: boolean | 'reverse'
  /** The line's (and arrowhead's) color: an M3 role (`primary`, `tertiary`, `error`, `outline`…) or any CSS color. Changes animate */
  color?: string
  /** The line's width in px (default 2). Changes animate */
  width?: number
  /** A dashed line, standing still */
  dashed?: boolean
  /** Default `arrow-closed` */
  markerEnd?: FlowMarker
  markerStart?: FlowMarker
  data?: D
  hidden?: boolean
  selectable?: boolean
  deletable?: boolean
  /** Its ends can be dragged to other handles once selected; default MFlow's `edgesReconnectable` */
  reconnectable?: boolean
  /**
   * A `smoothstep`/`step` edge's own route: where its segments after the first run, alternately x and y (see
   * `routePoints`). Dragging a selected edge's segments writes it (MFlow's `edgesReroutable`); without one it's
   * routed automatically
   */
  route?: number[]
  /** Its segments can be dragged once selected; default MFlow's `edgesReroutable` */
  reroutable?: boolean
  /** The side it leaves an `'auto'` handle by (default the side facing its other end) */
  sourcePosition?: FlowPosition
  /** The side it arrives at an `'auto'` handle by (default the side facing its other end) */
  targetPosition?: FlowPosition
  class?: string
}

/** An edge found under a point (`getEdgeAt`) */
export interface FlowEdgeHit {
  edge: FlowEdge
  position: FlowXY
  direction: FlowPosition
  routes?: { before: number[]; after: number[] }
}

/** The view: `x`/`y` in px, where the flow's origin is on the canvas, and the zoom */
export interface FlowViewport { x: number; y: number; zoom: number }

/** A connection being made or checked */
export interface FlowConnection {
  source: string
  sourceHandle: string | null
  target: string
  targetHandle: string | null
}

export interface FlowSelection { nodes: string[]; edges: string[] }

/** A handle as measured: its center relative to its node's corner, in flow units */
export interface FlowHandleBounds {
  id: string | null
  type: 'source' | 'target'
  /** 'auto': each edge leaves or arrives on the side that faces its other end */
  position: FlowPosition | 'auto'
  x: number
  y: number
  connectable: boolean
}

export interface FlowFitOptions {
  /** Room around the nodes, a fraction of the view (default 0.1) */
  padding?: number
  /** Only these nodes */
  nodes?: string[]
  maxZoom?: number
  minZoom?: number
  /** Default true */
  animate?: boolean
}

/** What MFlow provides to everything inside it, and `useFlow()` returns */
export interface FlowContext {
  nodes: ComputedRef<FlowNode[]>
  edges: ComputedRef<FlowEdge[]>
  viewport: Readonly<Ref<FlowViewport>>
  selection: ComputedRef<FlowSelection>
  minZoom: ComputedRef<number>
  maxZoom: ComputedRef<number>
  /** Canvas size in px */
  size: Readonly<Ref<{ width: number; height: number }>>
  /** Interaction switched off by the lock button (or MFlow's `locked`) */
  locked: Ref<boolean>
  getNode(id: string): FlowNode | undefined
  /** A node's top left corner in flow coordinates, its parents added, where it's drawn right now */
  getAbsolutePosition(id: string): FlowXY
  /** A node's measured (or set) size */
  getSize(id: string): { width: number; height: number }
  /** Nodes overlapping this one (or a rectangle in flow coordinates), groups and its own family left out */
  getIntersectingNodes(node: string | { x: number; y: number; width: number; height: number }): FlowNode[]
  /**
   * The edge passing within `radius` (flow units, default 8) of a flow point, nearest first, skipping the ones
   * `ignore` returns true for: where on it the point falls (on the grid along it with snapToGrid), the way it runs
   * there toward its target, and for an edge with its own route, the routes that keep each half's shape if it's split
   * there (as the `branch` event gives). For dropping something onto an edge, e.g. a junction
   */
  getEdgeAt(p: FlowXY, opts?: { radius?: number; ignore?: (e: FlowEdge) => boolean }): FlowEdgeHit | null
  /** Page (client) coordinates → flow coordinates */
  screenToFlow(p: { x: number; y: number }): FlowXY
  flowToScreen(p: FlowXY): { x: number; y: number }
  setViewport(v: Partial<FlowViewport>, opts?: { animate?: boolean }): void
  fitView(opts?: FlowFitOptions): void
  /** Centers the view on a flow point, at `zoom` or the current zoom */
  setCenter(x: number, y: number, opts?: { zoom?: number; animate?: boolean }): void
  zoomIn(): void
  zoomOut(): void
  zoomTo(zoom: number, opts?: { animate?: boolean }): void
  addNodes(nodes: FlowNode | FlowNode[]): void
  addEdges(edges: FlowEdge | FlowEdge[]): void
  /** Several changes as one undoable step (nodes and edges added, changed or removed together): each list given replaces the current one */
  change(next: { nodes?: FlowNode[]; edges?: FlowEdge[] }): void
  updateNode(id: string, patch: Partial<FlowNode> | ((n: FlowNode) => FlowNode)): void
  updateEdge(id: string, patch: Partial<FlowEdge> | ((e: FlowEdge) => FlowEdge)): void
  /** Deletes nodes (with their edges and children) and edges by id */
  remove(ids: { nodes?: string[]; edges?: string[] }): void
  setSelection(sel: Partial<FlowSelection>): void
  /** Runs a layout over the nodes' measured sizes; default MFlow's `layout` (or the tree layout). Animated and undoable */
  layout(fn?: 'tree' | 'layered' | FlowLayout, options?: FlowLayoutOptions): Promise<void>
  undo(): void
  redo(): void
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  copy(): void
  cut(): void
  /** Pastes what was copied, at a flow point (default a step from the originals) */
  paste(at?: FlowXY): void
  /**
   * Drags a node with a pointer that's already down, e.g. one just added from a palette outside the canvas: it
   * follows the pointer from there (guides, splicing into an edge) until it's let go. With a finger, the page
   * doesn't scroll under it meanwhile (start the drag from a long press, so a swipe still scrolls your palette)
   */
  startDrag(id: string, e: PointerEvent): void
}

// Internal: what nodes and handles inside MFlow reach
export interface FlowInternals extends FlowContext {
  registerHandle(nodeId: string, el: HTMLElement, info: () => Omit<FlowHandleBounds, 'x' | 'y'>): () => void
  measureNode(nodeId: string): void
  startConnection(e: PointerEvent, nodeId: string, handleId: string | null, type: 'source' | 'target'): void
  /** The handle a connection being dragged would snap to (`nodeId:handleId:type`), and whether it's valid */
  connectionTarget: Readonly<Ref<{ key: string; valid: boolean } | null>>
  connecting: Readonly<Ref<boolean>>
  /** The edge a dragged node would splice into if dropped now */
  insertEdge: Readonly<Ref<string | null>>
  /** Dragging an edge draws a branch from its source (edgeBranching) */
  branching: ComputedRef<boolean>
  nodesConnectable: ComputedRef<boolean>
  direction: ComputedRef<'horizontal' | 'vertical'>
  registerNodeEl(id: string, el: HTMLElement | null): void
  selectedNodes: ComputedRef<Set<string>>
  selectedEdges: ComputedRef<Set<string>>
  dragging: Readonly<Ref<Set<string>>>
  isLifted(id: string): boolean
  zIndexOf(id: string): number
  edgeGeometry(e: FlowEdge): FlowEdgeGeometry | null
  isReconnectable(e: FlowEdge): boolean
  isReroutable(e: FlowEdge): boolean
  /** The corners of an orthogonal edge (its ends first and last), or null for a curve or a straight line */
  edgeCorners(e: FlowEdge): [number, number][] | null
  sidePositions(n: FlowNode): { source: FlowPosition; target: FlowPosition }
  onNodeKey(e: KeyboardEvent, id: string): void
  onEdgeKey(e: KeyboardEvent, id: string): void
}

// Internal: an edge's ends and path
export interface FlowEdgeGeometry extends FlowEdgePath {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: FlowPosition
  targetPosition: FlowPosition
  /** How far the end sits inside a handle (0 at a node's side) */
  sourceInset: number
  targetInset: number
}

export const FLOW_KEY: InjectionKey<FlowInternals> = Symbol('m3-flow')

// Internal: provided by each node's shell to the node (and its handles) inside
export interface FlowNodeState {
  id: string
  node: ComputedRef<FlowNode>
  selected: ComputedRef<boolean>
  dragging: ComputedRef<boolean>
}
export const FLOW_NODE_KEY: InjectionKey<FlowNodeState> = Symbol('m3-flow-node')

/**
 * The enclosing `<MFlow>`'s state and controls, from any component rendered inside it (a `#node-<type>` slot, a
 * panel of your own). Outside one, use MFlow's template ref, which exposes the same.
 */
export function useFlow(): FlowContext {
  const ctx = inject(FLOW_KEY, null)
  if (!ctx) throw new Error('useFlow() must be called inside <MFlow>')
  return ctx
}

/** The node a component is rendered in (inside a `#node-<type>` slot), or null */
export function useFlowNode() {
  return inject(FLOW_NODE_KEY, null)
}
