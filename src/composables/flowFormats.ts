// Graphs as text for MFlow: Graphviz DOT and Mermaid flowcharts, read into nodes and edges and written back. Pure
// functions without dependencies. Text formats carry no positions (DOT's `pos` aside), so what's read is laid out
// with layoutLayered (or layoutTree), clusters and subgraphs becoming groups laid out from the inside out.
import type { FlowEdge, FlowMarker, FlowNode, FlowXY } from './useFlow'
import { layoutLayered, layoutTree, type FlowLayoutDirection, type FlowLayoutOptions } from './flowLayout'

/** A graph read from text */
export interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** The graph's own direction (DOT `rankdir`, Mermaid `flowchart LR`) */
  rankdir: FlowLayoutDirection
  /** The same, as MFlow's `direction` prop */
  direction: 'horizontal' | 'vertical'
  /** False for a DOT `graph` (edges without arrows) */
  directed: boolean
  /** The DOT graph's name */
  name?: string
  /** The DOT graph's `label` */
  label?: string
  /** Every graph-level DOT attribute, as written */
  attrs: Record<string, string>
}

export interface FlowImportOptions {
  /** How to place the nodes: `'layered'` (default), `'tree'`, or `false` to leave them at 0,0 (for MFlow's `layout` prop, which measures them first) */
  layout?: 'layered' | 'tree' | false
  /** Gaps, sizes and direction for the layout (the direction defaults to the graph's own) */
  layoutOptions?: FlowLayoutOptions
  /** The type given to plain nodes (default none: MFlow's default node) */
  nodeType?: string
  /** The type given to every edge (e.g. `'smoothstep'`; default none: a bezier) */
  edgeType?: string
}

export interface FlowExportOptions {
  /** The direction written (`rankdir` / `flowchart XX`): a layout direction or MFlow's `direction` (default TB) */
  direction?: FlowLayoutDirection | 'horizontal' | 'vertical'
  /** Node sizes, for `positions` (default each node's `width`/`height`, else 180 × 60) */
  sizes?: Map<string, { width: number; height: number }> | Record<string, { width: number; height: number }>
}

export interface FlowDotExportOptions extends FlowExportOptions {
  /** The graph's name */
  name?: string
  /** `digraph` (default) or `graph`, whose edges have no direction */
  directed?: boolean
  /** Writes each node's place as `pos` (in points, y up), for `neato -n` */
  positions?: boolean
}

const ROLES = new Set(['primary', 'secondary', 'tertiary', 'error', 'neutral', 'inverse', 'outline', 'outline-variant', 'success', 'on-surface', 'on-surface-variant'])
const GROUP_PAD = 24
const GROUP_HEAD = 36
const CIRCLE = 56

function toRankdir(d: FlowExportOptions['direction']): FlowLayoutDirection {
  if (d === 'horizontal') return 'LR'
  if (d === 'vertical' || !d) return 'TB'
  return d
}
function asDirection(r: FlowLayoutDirection): 'horizontal' | 'vertical' {
  return r === 'LR' || r === 'RL' ? 'horizontal' : 'vertical'
}

// A guess at the default node's size before it's measured (min 11rem, max 18rem wide)
function estimateSize(n: FlowNode): { width: number; height: number } {
  if (n.width && n.height) return { width: n.width, height: n.height }
  if (n.type === 'circle') {
    const s = (n.data as { size?: number } | undefined)?.size ?? CIRCLE
    return { width: s, height: s }
  }
  const label = String((n.data as { label?: unknown } | undefined)?.label ?? n.id)
  const lines = label.split('\n')
  const longest = Math.max(...lines.map((l) => l.length))
  const width = Math.min(288, Math.max(176, 40 + longest * 8))
  const wraps = lines.reduce((sum, l) => sum + Math.max(1, Math.ceil((l.length * 8) / (width - 40))), 0)
  return { width, height: 36 + wraps * 20 }
}

// Lays out each group's children inside it (deepest first), then each level with the groups at their wrapped size.
// Positions of children come out relative to their group, as MFlow wants them
function place(nodes: FlowNode[], edges: FlowEdge[], how: 'layered' | 'tree', options: FlowLayoutOptions) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const children = new Map<string | undefined, FlowNode[]>()
  for (const n of nodes) {
    const p = n.parentId && byId.has(n.parentId) ? n.parentId : undefined
    if (!children.has(p)) children.set(p, [])
    children.get(p)!.push(n)
  }
  const given = options.sizes instanceof Map ? options.sizes : new Map(Object.entries(options.sizes ?? {}))
  const sizes = new Map<string, { width: number; height: number }>()
  const fn = how === 'tree' ? layoutTree : layoutLayered
  // The ancestor of `id` that sits in the level under `parent`
  const lift = (id: string, parent: string | undefined) => {
    let n = byId.get(id)
    for (let i = 0; n && i < 100; i++) {
      const p = n.parentId && byId.has(n.parentId) ? n.parentId : undefined
      if (p === parent) return n.id
      n = p ? byId.get(p) : undefined
    }
    return undefined
  }
  const level = (parent: string | undefined): { width: number; height: number } => {
    const members = children.get(parent) ?? []
    for (const m of members) {
      if (children.has(m.id)) {
        const inner = level(m.id)
        sizes.set(m.id, { width: Math.max(200, inner.width + GROUP_PAD * 2), height: Math.max(120, inner.height + GROUP_HEAD + GROUP_PAD) })
      } else sizes.set(m.id, given.get(m.id) ?? estimateSize(m))
    }
    const flat = members.map((m) => ({ ...m, parentId: undefined }))
    const lifted: FlowEdge[] = []
    for (const e of edges) {
      const s = lift(e.source, parent)
      const t = lift(e.target, parent)
      if (s && t && s !== t) lifted.push({ ...e, source: s, target: t })
    }
    const pos = fn(flat, lifted, { ...options, sizes })
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const m of members) {
      const p = pos[m.id] ?? { x: 0, y: 0 }
      const s = sizes.get(m.id)!
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + s.width)
      maxY = Math.max(maxY, p.y + s.height)
    }
    if (!members.length) return { width: 0, height: 0 }
    // Inside a group: from its padding and header; at the top: from 0,0
    const ox = parent === undefined ? -minX : GROUP_PAD - minX
    const oy = parent === undefined ? -minY : GROUP_HEAD - minY
    for (const m of members) {
      const p = pos[m.id] ?? { x: 0, y: 0 }
      m.position = { x: Math.round(p.x + ox), y: Math.round(p.y + oy) }
    }
    return { width: maxX - minX, height: maxY - minY }
  }
  level(undefined)
}

function finish(graph: FlowGraph, opts: FlowImportOptions, positioned: boolean) {
  if (positioned || opts.layout === false) return graph
  place(graph.nodes, graph.edges, opts.layout ?? 'layered', { direction: graph.rankdir, ...opts.layoutOptions })
  return graph
}

class FlowSyntaxError extends SyntaxError {
  constructor(message: string, src: string, at: number) {
    const before = src.slice(0, at).split('\n')
    super(`${message} (line ${before.length}, column ${before.at(-1)!.length + 1})`)
  }
}

// ── DOT ──────────────────────────────────────────────────────────────────────────────────────────────────

type Tok = { t: 'id'; v: string; quoted: boolean; html: boolean; at: number } | { t: 'p'; v: string; at: number }

function tokenizeDot(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]!
    if (/\s/.test(c)) { i++; continue }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? n : end + 2
      continue
    }
    // Preprocessor output lines
    if (c === '#' && (i === 0 || src[i - 1] === '\n')) { while (i < n && src[i] !== '\n') i++; continue }
    if (c === '-' && (src[i + 1] === '>' || src[i + 1] === '-')) { toks.push({ t: 'p', v: src.slice(i, i + 2), at: i }); i += 2; continue }
    if ('{}[];,=:'.includes(c)) { toks.push({ t: 'p', v: c, at: i }); i++; continue }
    if (c === '"') {
      const at = i
      let v = ''
      i++
      for (;;) {
        if (i >= n) throw new FlowSyntaxError('Unterminated string', src, at)
        const ch = src[i]!
        if (ch === '\\' && src[i + 1] === '"') { v += '"'; i += 2; continue }
        if (ch === '\\' && src[i + 1] === '\n') { i += 2; continue }
        if (ch === '"') { i++; break }
        v += ch
        i++
      }
      // "a" + "b" concatenates
      const last = toks.at(-1)
      if (last && last.t === 'p' && last.v === '+' && toks.at(-2)?.t === 'id' && (toks.at(-2) as { quoted: boolean }).quoted) {
        toks.pop()
        ;(toks.at(-1) as { v: string }).v += v
      } else toks.push({ t: 'id', v, quoted: true, html: false, at })
      continue
    }
    if (c === '+') { toks.push({ t: 'p', v: '+', at: i }); i++; continue }
    if (c === '<') {
      const at = i
      let depth = 0
      let j = i
      for (; j < n; j++) {
        if (src[j] === '<') depth++
        else if (src[j] === '>' && --depth === 0) break
      }
      if (j >= n) throw new FlowSyntaxError('Unterminated HTML label', src, at)
      toks.push({ t: 'id', v: src.slice(i + 1, j), quoted: true, html: true, at })
      i = j + 1
      continue
    }
    const num = /^-?(?:\.\d+|\d+(?:\.\d*)?)/.exec(src.slice(i, i + 40))
    if (num) { toks.push({ t: 'id', v: num[0], quoted: false, html: false, at: i }); i += num[0].length; continue }
    const word = /^[A-Za-z_\u0080-￿][\w\u0080-￿]*/.exec(src.slice(i, i + 4096))
    if (word) { toks.push({ t: 'id', v: word[0], quoted: false, html: false, at: i }); i += word[0].length; continue }
    throw new FlowSyntaxError(`Unexpected "${c}"`, src, i)
  }
  return toks
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .trim()
}

// DOT's escapes in labels: \N the node's id, \G the graph's name, \n \l \r line breaks
function dotLabel(v: string, id: string, graph: string) {
  return v
    .replace(/\\N/g, id)
    .replace(/\\G/g, graph)
    .replace(/\\[nlr]/g, '\n')
    .replace(/\\(.)/g, '$1')
    .replace(/\n$/, '')
}

function dotColor(v: string | undefined) {
  if (!v) return undefined
  // A color list ("red:blue;0.3") takes the first; a scheme ("/x11/red") is dropped
  const first = v.split(':')[0]!.split(';')[0]!.trim().replace(/^\/[^/]*\//, '')
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(first)) return first.slice(0, 7) + (first.length > 7 ? first.slice(7) : '')
  return /^[a-z]+$/i.test(first) ? first.toLowerCase() : undefined
}

function dotMarkers(attrs: Record<string, string>, directed: boolean): { markerEnd?: FlowMarker; markerStart?: FlowMarker } {
  const dir = attrs.dir ?? (directed ? 'forward' : 'none')
  const head = (a: string | undefined): FlowMarker => (a === 'none' ? 'none' : a && /vee|open|empty|normal-o|o/.test(a) && a !== 'normal' ? 'arrow' : 'arrow-closed')
  const end = dir === 'forward' || dir === 'both' ? head(attrs.arrowhead) : 'none'
  const start = dir === 'back' || dir === 'both' ? head(attrs.arrowtail) : 'none'
  const m: { markerEnd?: FlowMarker; markerStart?: FlowMarker } = {}
  if (end !== 'arrow-closed') m.markerEnd = end
  if (start !== 'none') m.markerStart = start
  return m
}

interface DotScope { node: Record<string, string>; edge: Record<string, string>; graph: Record<string, string>; cluster?: string; members: Set<string> }

/**
 * Reads a Graphviz DOT graph (`digraph`/`graph`, `strict`, subgraphs, defaults, ports, HTML labels): nodes take
 * their `label` (default the id), `shape=circle`/`doublecircle`/`point` makes a `circle` node, `style=invis` hides;
 * edges take `label`, `color`, `penwidth`, `style=dashed`/`dotted`/`bold`/`invis` and `dir`/`arrowhead`/`arrowtail`;
 * `cluster` subgraphs become groups. Every attribute as written is kept in each node's and edge's `data.attrs`
 * (ports as `tailport`/`headport`), to map the rest yourself. Laid out in layers along `rankdir`, unless every node
 * has a `pos`. Throws a SyntaxError (with line and column) on what isn't DOT.
 */
export function parseDot(source: string, options: FlowImportOptions = {}): FlowGraph {
  const toks = tokenizeDot(source)
  let k = 0
  const peek = (o = 0) => toks[k + o]
  const isP = (v: string, o = 0) => { const t = peek(o); return !!t && t.t === 'p' && t.v === v }
  const isKw = (v: string, o = 0) => { const t = peek(o); return !!t && t.t === 'id' && !t.quoted && t.v.toLowerCase() === v }
  const fail = (msg: string): never => {
    throw new FlowSyntaxError(msg, source, peek()?.at ?? source.length)
  }
  const expect = (v: string) => (isP(v) ? toks[k++] : fail(`Expected "${v}"`))
  const id = (): string => {
    const t = peek()
    if (!t || t.t !== 'id') return fail('Expected an id')
    k++
    return t.html ? htmlToText(t.v) : t.v
  }

  let strict = false
  if (isKw('strict')) { strict = true; k++ }
  let directed: boolean
  if (isKw('digraph')) directed = true
  else if (isKw('graph')) directed = false
  else return fail('Expected "graph" or "digraph"')
  k++
  const name = peek()?.t === 'id' ? id() : undefined

  const nodes: FlowNode[] = []
  const nodeAttrs = new Map<string, Record<string, string>>()
  const nodeScope = new Map<string, string | undefined>()
  const edges: FlowEdge[] = []
  const groupLabels = new Map<string, Record<string, string>>()
  const edgeKeys = new Set<string>()
  let anon = 0

  const attrList = () => {
    const a: Record<string, string> = {}
    while (isP('[')) {
      k++
      while (!isP(']')) {
        if (!peek()) fail('Expected "]"')
        const key = id()
        if (isP('=')) { k++; a[key] = id() } else a[key] = 'true'
        if (isP(';') || isP(',')) k++
      }
      k++
    }
    return a
  }
  const touchNode = (nid: string, scope: DotScope, attrs?: Record<string, string>) => {
    for (let s: DotScope | undefined = scope; s; s = parents.get(s)) s.members.add(nid)
    if (!nodeAttrs.has(nid)) {
      nodeAttrs.set(nid, { ...scope.node })
      nodeScope.set(nid, scope.cluster)
      nodes.push({ id: nid, position: { x: 0, y: 0 } })
    }
    if (attrs) Object.assign(nodeAttrs.get(nid)!, attrs)
  }
  const parents = new Map<DotScope, DotScope | undefined>()

  type Operand = { ids: string[]; port?: string }
  const operand = (scope: DotScope): Operand => {
    if (isKw('subgraph') || isP('{')) return { ids: [...subgraph(scope).members] }
    const nid = id()
    let port: string | undefined
    if (isP(':')) {
      k++
      port = id()
      if (isP(':')) { k++; port += ':' + id() }
    }
    touchNode(nid, scope)
    return { ids: [nid], port }
  }
  const subgraph = (outer: DotScope): DotScope => {
    let sname: string | undefined
    if (isKw('subgraph')) {
      k++
      if (peek()?.t === 'id') sname = id()
    }
    const scope: DotScope = { node: { ...outer.node }, edge: { ...outer.edge }, graph: {}, cluster: outer.cluster, members: new Set() }
    parents.set(scope, outer)
    if (sname && /^cluster/i.test(sname)) {
      let gid = sname
      while (nodeAttrs.has(gid) || groupLabels.has(gid)) gid = `${sname}_${++anon}`
      groupLabels.set(gid, scope.graph)
      nodes.push({ id: gid, type: 'group', position: { x: 0, y: 0 }, ...(outer.cluster ? { parentId: outer.cluster } : {}) })
      scope.cluster = gid
    }
    expect('{')
    stmts(scope)
    expect('}')
    return scope
  }
  const stmts = (scope: DotScope) => {
    while (peek() && !isP('}')) {
      stmt(scope)
      if (isP(';') || isP(',')) k++
    }
  }
  const stmt = (scope: DotScope) => {
    if ((isKw('graph') || isKw('node') || isKw('edge')) && isP('[', 1)) {
      const which = (peek() as { v: string }).v.toLowerCase() as 'graph' | 'node' | 'edge'
      k++
      Object.assign(scope[which], attrList())
      return
    }
    if (peek()?.t === 'id' && !isKw('subgraph') && isP('=', 1)) {
      const key = id()
      k++
      scope.graph[key] = id()
      return
    }
    const first = operand(scope)
    if (!isP('->') && !isP('--')) {
      if (isP('[')) {
        const a = attrList()
        for (const nid of first.ids) touchNode(nid, scope, a)
      }
      return
    }
    const chain: Operand[] = [first]
    while (isP('->') || isP('--')) {
      k++
      chain.push(operand(scope))
    }
    const a = { ...scope.edge, ...attrList() }
    for (let c = 0; c < chain.length - 1; c++) {
      const from = chain[c]!
      const to = chain[c + 1]!
      for (const s of from.ids) {
        for (const t of to.ids) {
          const key = directed ? `${s}\u0000${t}` : [s, t].sort().join('\u0000')
          if (strict && edgeKeys.has(key)) continue
          edgeKeys.add(key)
          const attrs = { ...a }
          if (from.port) attrs.tailport = from.port
          if (to.port) attrs.headport = to.port
          edges.push(dotEdge(s, t, attrs, edges.length, directed, options))
        }
      }
    }
  }

  const root: DotScope = { node: {}, edge: {}, graph: {}, members: new Set() }
  expect('{')
  stmts(root)
  expect('}')
  if (peek()) fail('Unexpected text after the graph')

  // Ids given with `id=` must stay unique
  const seen = new Set<string>()
  for (const e of edges) {
    while (seen.has(e.id)) e.id = `${e.id}_`
    seen.add(e.id)
  }

  let positioned = nodes.some((n) => n.type !== 'group')
  for (const n of nodes) {
    if (n.type === 'group') {
      const g = groupLabels.get(n.id)!
      n.data = { label: g.label !== undefined ? dotLabel(g.label, n.id, name ?? '') : undefined, attrs: { ...g } }
      continue
    }
    const attrs = nodeAttrs.get(n.id)!
    const parent = nodeScope.get(n.id)
    if (parent) n.parentId = parent
    const label = attrs.label !== undefined ? dotLabel(attrs.label, n.id, name ?? '') : n.id
    const shape = attrs.shape?.toLowerCase()
    if (shape === 'circle' || shape === 'doublecircle' || shape === 'point' || shape === 'mcircle') {
      n.type = 'circle'
      n.data = { label: shape === 'point' ? '' : label, ...(shape === 'doublecircle' ? { ring: 'primary' } : {}), attrs }
      if (shape === 'point') n.data.size = 16
    } else {
      if (options.nodeType) n.type = options.nodeType
      n.data = { label, attrs }
    }
    if (/\binvis\b/.test(attrs.style ?? '')) n.hidden = true
    const pos = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/.exec(attrs.pos ?? '')
    if (pos) {
      // Points, y up, the node's center
      const s = estimateSize(n)
      n.position = { x: (Number(pos[1]) * 4) / 3 - s.width / 2, y: (-Number(pos[2]) * 4) / 3 - s.height / 2 }
    } else positioned = false
  }
  if (positioned) {
    // Children's `pos` are absolute: make them relative to their group, and the whole from 0,0
    const top = nodes.filter((n) => n.type !== 'group')
    const minX = Math.min(...top.map((n) => n.position.x))
    const minY = Math.min(...top.map((n) => n.position.y))
    for (const n of top) n.position = { x: Math.round(n.position.x - minX), y: Math.round(n.position.y - minY) }
    if (nodes.some((n) => n.type === 'group')) place(nodes.filter((n) => n.type === 'group' || n.parentId), [], 'layered', {})
  }

  const rd = (root.graph.rankdir ?? '').toUpperCase()
  const rankdir: FlowLayoutDirection = rd === 'LR' || rd === 'RL' || rd === 'BT' ? rd : 'TB'
  const graph: FlowGraph = {
    nodes,
    edges,
    rankdir,
    direction: asDirection(rankdir),
    directed,
    attrs: { ...root.graph },
    ...(name !== undefined ? { name } : {}),
    ...(root.graph.label !== undefined ? { label: dotLabel(root.graph.label, '', name ?? '') } : {}),
  }
  return finish(graph, options, positioned && !nodes.some((n) => n.type === 'group'))
}

function dotEdge(source: string, target: string, attrs: Record<string, string>, index: number, directed: boolean, options: FlowImportOptions): FlowEdge {
  const e: FlowEdge = { id: attrs.id ?? `e${index + 1}`, source, target }
  if (options.edgeType) e.type = options.edgeType
  if (attrs.label !== undefined) e.label = dotLabel(attrs.label, '', '')
  const style = attrs.style ?? ''
  if (/\b(dashed|dotted)\b/.test(style)) e.dashed = true
  if (/\binvis\b/.test(style)) e.hidden = true
  const color = dotColor(attrs.color)
  if (color) e.color = color
  if (attrs.penwidth && Number(attrs.penwidth) > 0) e.width = Number(attrs.penwidth) * 2
  else if (/\bbold\b/.test(style)) e.width = 4
  Object.assign(e, dotMarkers(attrs, directed))
  e.data = { attrs }
  return e
}

const DOT_KEYWORDS = new Set(['strict', 'graph', 'digraph', 'node', 'edge', 'subgraph'])
function dotId(v: string) {
  if (/^[A-Za-z_][\w]*$/.test(v) && !DOT_KEYWORDS.has(v.toLowerCase())) return v
  if (/^-?(?:\.\d+|\d+(?:\.\d*)?)$/.test(v)) return v
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}
function dotAttrs(a: Record<string, string>) {
  const parts = Object.entries(a).map(([key, v]) => `${dotId(key)}=${dotId(v)}`)
  return parts.length ? ` [${parts.join(', ')}]` : ''
}
// What's kept from an imported `data.attrs`: the rest is written from the node's or edge's current state
const DOT_NODE_OWN = new Set(['label', 'pos', 'shape', 'style'])
const DOT_EDGE_OWN = new Set(['label', 'color', 'penwidth', 'style', 'dir', 'arrowhead', 'arrowtail', 'id', 'tailport', 'headport'])
function keptAttrs(data: unknown, own: Set<string>) {
  const a = (data as { attrs?: unknown } | undefined)?.attrs
  const out: Record<string, string> = {}
  if (a && typeof a === 'object') for (const [key, v] of Object.entries(a)) if (!own.has(key) && typeof v === 'string') out[key] = v
  return out
}
function labelOf(n: { id: string; data?: unknown }) {
  const l = (n.data as { label?: unknown } | undefined)?.label
  return l === undefined || l === null ? undefined : String(l)
}
function absolute(nodes: FlowNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const memo = new Map<string, FlowXY>()
  const at = (n: FlowNode, depth = 0): FlowXY => {
    if (memo.has(n.id)) return memo.get(n.id)!
    const p = n.parentId && byId.has(n.parentId) && depth < 100 ? at(byId.get(n.parentId)!, depth + 1) : { x: 0, y: 0 }
    const r = { x: p.x + n.position.x, y: p.y + n.position.y }
    memo.set(n.id, r)
    return r
  }
  return at
}
// Groups first, children inside them, depth first
function tree(nodes: FlowNode[]) {
  const ids = new Set(nodes.map((n) => n.id))
  const kids = new Map<string | undefined, FlowNode[]>()
  for (const n of nodes) {
    const p = n.parentId && ids.has(n.parentId) ? n.parentId : undefined
    if (!kids.has(p)) kids.set(p, [])
    kids.get(p)!.push(n)
  }
  return kids
}

/**
 * Writes nodes and edges as a Graphviz DOT graph: labels, `circle` nodes as `shape=circle` (`doublecircle` with a
 * ring), groups as `cluster` subgraphs, edge labels, colors (CSS ones; M3 roles are left out), widths, dashes,
 * arrows and hidden ones. Attributes kept in `data.attrs` (as `parseDot` leaves them) are written back too.
 */
export function toDot(nodes: FlowNode[], edges: FlowEdge[], options: FlowDotExportOptions = {}): string {
  const directed = options.directed ?? true
  const out: string[] = [`${directed ? 'digraph' : 'graph'}${options.name ? ` ${dotId(options.name)}` : ''} {`]
  const rankdir = toRankdir(options.direction)
  if (rankdir !== 'TB') out.push(`  rankdir=${rankdir};`)
  const kids = tree(nodes)
  const at = absolute(nodes)
  const given = options.sizes instanceof Map ? options.sizes : new Map(Object.entries(options.sizes ?? {}))
  const write = (parent: string | undefined, indent: string) => {
    for (const n of kids.get(parent) ?? []) {
      const label = labelOf(n)
      if (n.type === 'group') {
        const gid = /^cluster/i.test(n.id) ? n.id : `cluster_${n.id}`
        out.push(`${indent}subgraph ${dotId(gid)} {`)
        const ga = keptAttrs(n.data, DOT_NODE_OWN)
        if (label) ga.label = label
        for (const [key, v] of Object.entries(ga)) out.push(`${indent}  ${dotId(key)}=${dotId(v)};`)
        write(n.id, indent + '  ')
        out.push(`${indent}}`)
        continue
      }
      const a = keptAttrs(n.data, DOT_NODE_OWN)
      if (label !== undefined && label !== n.id) a.label = label
      if (n.type === 'circle') a.shape = (n.data as { ring?: unknown } | undefined)?.ring ? 'doublecircle' : 'circle'
      else if ((n.data as { attrs?: { shape?: string } } | undefined)?.attrs?.shape) a.shape = (n.data as { attrs: { shape: string } }).attrs.shape
      if (n.hidden) a.style = 'invis'
      if (options.positions) {
        const p = at(n)
        const s = given.get(n.id) ?? estimateSize(n)
        a.pos = `${round((p.x + s.width / 2) * 0.75)},${round(-(p.y + s.height / 2) * 0.75)}`
      }
      out.push(`${indent}${dotId(n.id)}${dotAttrs(a)};`)
    }
  }
  write(undefined, '  ')
  const op = directed ? '->' : '--'
  for (const e of edges) {
    const a = keptAttrs(e.data, DOT_EDGE_OWN)
    if (e.label) a.label = e.label
    if (e.color && !ROLES.has(e.color) && !e.color.startsWith('var(')) a.color = e.color
    if (e.width && e.width !== 2) a.penwidth = String(round(e.width / 2))
    const style = [e.dashed ? 'dashed' : '', e.hidden ? 'invis' : ''].filter(Boolean).join(',')
    if (style) a.style = style
    const end = e.markerEnd ?? 'arrow-closed'
    const start = e.markerStart ?? 'none'
    if (directed) {
      if (end === 'none' && start === 'none') a.dir = 'none'
      else if (end === 'none') a.dir = 'back'
      else if (start !== 'none') a.dir = 'both'
      if (end === 'arrow') a.arrowhead = 'vee'
      if (start === 'arrow') a.arrowtail = 'vee'
    }
    const tail = (e.data as { attrs?: { tailport?: string } } | undefined)?.attrs?.tailport
    const head = (e.data as { attrs?: { headport?: string } } | undefined)?.attrs?.headport
    const port = (p?: string) => (p ? ':' + p.split(':').map(dotId).join(':') : '')
    out.push(`  ${dotId(e.source)}${port(tail)} ${op} ${dotId(e.target)}${port(head)}${dotAttrs(a)};`)
  }
  out.push('}')
  return out.join('\n') + '\n'
}

function round(v: number) {
  return Math.round(v * 100) / 100
}

// ── Mermaid ──────────────────────────────────────────────────────────────────────────────────────────────

// Node shapes, longest delimiters first
const SHAPES: { open: string; close: string; shape: string }[] = [
  { open: '(((', close: ')))', shape: 'doublecircle' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[[', close: ']]', shape: 'subroutine' },
  { open: '[(', close: ')]', shape: 'cylinder' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '[/', close: '/]', shape: 'lean-right' },
  { open: '[\\', close: '\\]', shape: 'lean-left' },
  { open: '[/', close: '\\]', shape: 'trapezoid' },
  { open: '[\\', close: '/]', shape: 'inv-trapezoid' },
  { open: '>', close: ']', shape: 'odd' },
  { open: '(', close: ')', shape: 'rounded' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '{', close: '}', shape: 'diamond' },
]
const MERMAID_SKIP = /^(classDef|class|style|linkStyle|click|accTitle|accDescr|direction)\b/
const MERMAID_RESERVED = new Set(['end', 'graph', 'flowchart', 'subgraph', 'style', 'class', 'classdef', 'linkstyle', 'click', 'direction'])

function mermaidText(v: string) {
  let t = v.trim()
  if (t.startsWith('"') && t.endsWith('"') && t.length > 1) t = t.slice(1, -1)
  // Markdown strings ("`**bold**`")
  if (t.startsWith('`') && t.endsWith('`') && t.length > 1) t = t.slice(1, -1).replace(/\*\*|__|\*|_/g, '')
  return t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/#quot;/g, '"')
    .replace(/#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/#([a-z]+);/gi, (m, name) => ({ amp: '&', lt: '<', gt: '>', nbsp: ' ', apos: "'" })[name.toLowerCase() as 'amp'] ?? m)
}

// Splits on newlines and on `;` outside quotes and brackets
function mermaidStatements(src: string): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = []
  let depth = 0
  let quote = false
  let start = 0
  for (let i = 0; i <= src.length; i++) {
    const c = src[i]
    if (c === '"') quote = !quote
    else if (!quote && (c === '[' || c === '(' || c === '{')) depth++
    else if (!quote && (c === ']' || c === ')' || c === '}')) depth = Math.max(0, depth - 1)
    if (c === undefined || c === '\n' || (c === ';' && !quote && depth === 0)) {
      const raw = src.slice(start, i)
      const lead = raw.length - raw.trimStart().length
      const text = raw.trim()
      if (text && !text.startsWith('%%')) out.push({ text, at: start + lead })
      if (c === '\n') { quote = false; depth = 0 }
      start = i + 1
    }
  }
  return out
}

interface MermaidLink { line: 'solid' | 'dotted' | 'thick' | 'invisible'; start: string; end: string; label?: string; raw: string }

/**
 * Reads a Mermaid flowchart (`flowchart`/`graph` with TB/TD/BT/LR/RL): node shapes (`(( ))` makes a `circle` node,
 * `((( )))` one with a ring; every other shape is kept as `data.shape`), the `@{ shape, label }` syntax, chains and
 * `&`, links `-->` `---` `-.->` `==>` `~~~` `<-->` `--o` `--x` with `|labels|` or `-- labels -->`, and subgraphs as
 * groups. `classDef`, `style`, `click` and the like are skipped. Laid out in layers along its direction. Throws a
 * SyntaxError (with line and column) on what it can't read.
 */
export function parseMermaid(source: string, options: FlowImportOptions = {}): FlowGraph {
  const stmts = mermaidStatements(source.replace(/^\s*---\n[\s\S]*?\n---\s*\n/, (m) => '\n'.repeat(m.split('\n').length - 1)))
  const head = stmts.shift()
  const hm = head && /^(flowchart|graph)(?:\s+(TB|TD|BT|RL|LR))?\s*(.*)$/i.exec(head.text)
  if (!head || !hm) throw new FlowSyntaxError('Expected "flowchart" or "graph"', source, head?.at ?? 0)
  const d = (hm[2] ?? 'TB').toUpperCase()
  const rankdir: FlowLayoutDirection = d === 'TD' ? 'TB' : (d as FlowLayoutDirection)
  // `graph TD; A-->B` on one line
  if (hm[3]) stmts.unshift({ text: hm[3], at: head.at + head.text.length - hm[3].length })

  const nodes: FlowNode[] = []
  const byId = new Map<string, FlowNode>()
  const edges: FlowEdge[] = []
  const groups: string[] = []

  const touch = (id: string, label?: string, shape?: string) => {
    let n = byId.get(id)
    if (!n) {
      n = { id, position: { x: 0, y: 0 }, data: { label: id } }
      if (groups.length) n.parentId = groups.at(-1)
      if (options.nodeType) n.type = options.nodeType
      byId.set(id, n)
      nodes.push(n)
    } else if (groups.length && !n.parentId && n.id !== groups.at(-1)) {
      // Named again inside a subgraph, a node from outside any moves into it, as in Mermaid
      n.parentId = groups.at(-1)
    }
    if (n.type === 'group') return n
    if (label !== undefined) n.data.label = label
    if (shape) {
      n.data.shape = shape
      if (shape === 'circle' || shape === 'doublecircle' || shape === 'sm-circ' || shape === 'dbl-circ') {
        n.type = 'circle'
        if (shape === 'doublecircle' || shape === 'dbl-circ') n.data.ring = 'primary'
      } else if (n.type === 'circle') n.type = options.nodeType
    }
    return n
  }

  for (const { text, at } of stmts) {
    const fail = (msg: string, off = 0): never => {
      throw new FlowSyntaxError(msg, source, at + off)
    }
    if (/^end$/i.test(text)) {
      if (!groups.length) fail('"end" without a subgraph')
      groups.pop()
      continue
    }
    const sg = /^subgraph\s+(.+)$/i.exec(text)
    if (sg) {
      const rest = sg[1]!.trim()
      const m = /^([\w-]+)\s*\[(.*)\]$/.exec(rest)
      const gid = m ? m[1]! : /^[\w-]+$/.test(rest) ? rest : rest.replace(/^"|"$/g, '')
      const label = m ? mermaidText(m[2]!) : mermaidText(rest)
      const g: FlowNode = byId.get(gid) ?? { id: gid, position: { x: 0, y: 0 } }
      g.type = 'group'
      g.data = { label }
      if (groups.length) g.parentId = groups.at(-1)
      else delete g.parentId
      if (!byId.has(gid)) { byId.set(gid, g); nodes.push(g) }
      groups.push(gid)
      continue
    }
    if (MERMAID_SKIP.test(text)) continue

    let i = 0
    const ws = () => { while (i < text.length && /\s/.test(text[i]!)) i++ }
    const nodeRef = (): string => {
      ws()
      const m = /^[\w$À-￿](?:[\w$.À-￿]|-(?=[\wÀ-￿]))*/.exec(text.slice(i))
      if (!m) return fail(`Expected a node at "${text.slice(i, i + 12)}"`, i)
      const id = m[0]
      i += id.length
      let label: string | undefined
      let shape: string | undefined
      if (text.startsWith('@{', i)) {
        const end = text.indexOf('}', i)
        if (end < 0) fail('Unclosed "@{"', i)
        const body = text.slice(i + 2, end)
        const sm = /\bshape\s*:\s*([\w-]+)/.exec(body)
        const lm = /\blabel\s*:\s*("(?:[^"\\]|\\.)*"|[^,}]+)/.exec(body)
        if (sm) shape = sm[1]!.toLowerCase()
        if (lm) label = mermaidText(lm[1]!)
        i = end + 1
      } else {
        for (const s of SHAPES) {
          if (!text.startsWith(s.open, i)) continue
          const from = i + s.open.length
          const inner = text[from] === '"' ? text.indexOf('"', from + 1) + 1 : from
          const end = text.indexOf(s.close, inner)
          if (inner === 0 || end < 0) continue
          label = mermaidText(text.slice(from, end))
          shape = s.shape
          i = end + s.close.length
          break
        }
      }
      // `:::className`
      const cls = /^:::[\w-]+/.exec(text.slice(i))
      if (cls) i += cls[0].length
      touch(id, label, shape)
      return id
    }
    const group = () => {
      const ids = [nodeRef()]
      for (;;) {
        ws()
        if (text[i] !== '&') return ids
        i++
        ids.push(nodeRef())
      }
    }
    const link = (): MermaidLink | null => {
      ws()
      const rest = text.slice(i)
      // `-- text -->`, `== text ==>`, `-. text .->`
      const inline = /^(<|o|x)?(--|==|-\.)(?![-.>=|~])(?![ox](?:\s|$))\s*(.+?)\s*(-{2,}[->ox]|={2,}[=>ox]|\.+-[>ox]?|-\.+-[>ox]?)(?=\s|[\w"]|$)/.exec(rest)
      const plain = /^(<|o(?=[-=.])|x(?=[-=.]))?(~{3,}|-\.+-|-{2,}|={2,})(>|o(?![\w])|x(?![\w]))?/.exec(rest)
      let m: MermaidLink
      // `-- text -->` starts with exactly two dashes (or `==`, `-.`) and text: `--- B`, `--x B` and `-->|x| B` are plain
      if (inline) {
        const startsDot = inline[2] === '-.'
        const end = inline[4]!
        const arrow = /[>ox]$/.test(end) && !/^-+-$|^=+=$/.test(end) ? end.slice(-1) : ''
        m = { line: startsDot ? 'dotted' : inline[2] === '==' ? 'thick' : 'solid', start: inline[1] ?? '', end: arrow === '-' || arrow === '=' ? '' : arrow, label: mermaidText(inline[3]!), raw: inline[0] }
        i += inline[0].length
      } else if (plain) {
        const body = plain[2]!
        m = { line: body.startsWith('~') ? 'invisible' : body.includes('.') ? 'dotted' : body.startsWith('=') ? 'thick' : 'solid', start: plain[1] ?? '', end: plain[3] ?? '', raw: plain[0] }
        i += plain[0].length
        ws()
        if (text[i] === '|') {
          const end = text.indexOf('|', i + 1)
          if (end < 0) fail('Unclosed "|"', i)
          m.label = mermaidText(text.slice(i + 1, end))
          i = end + 1
        }
      } else return null
      return m
    }

    let from = group()
    for (;;) {
      ws()
      if (i >= text.length) break
      const l = link()
      if (!l) fail(`Unexpected "${text.slice(i, i + 12)}"`, i)
      const to = group()
      for (const s of from) for (const t of to) edges.push(mermaidEdge(s, t, l!, edges.length, options))
      from = to
    }
  }
  if (groups.length) throw new FlowSyntaxError(`Subgraph "${groups.at(-1)}" has no "end"`, source, source.length)

  // Parents before children
  const ordered: FlowNode[] = []
  const kids = tree(nodes)
  const walk = (p: string | undefined) => {
    for (const n of kids.get(p) ?? []) {
      ordered.push(n)
      walk(n.id)
    }
  }
  walk(undefined)
  const graph: FlowGraph = { nodes: ordered, edges, rankdir, direction: asDirection(rankdir), directed: true, attrs: {} }
  return finish(graph, options, false)
}

function mermaidMarker(c: string): FlowMarker {
  return c === '>' || c === '<' ? 'arrow-closed' : c === 'o' || c === 'x' ? 'arrow' : 'none'
}
function mermaidEdge(source: string, target: string, l: MermaidLink, index: number, options: FlowImportOptions): FlowEdge {
  const e: FlowEdge = { id: `e${index + 1}`, source, target }
  if (options.edgeType) e.type = options.edgeType
  if (l.label) e.label = l.label
  if (l.line === 'dotted') e.dashed = true
  if (l.line === 'thick') e.width = 4
  if (l.line === 'invisible') e.hidden = true
  const end = mermaidMarker(l.end)
  if (end !== 'arrow-closed') e.markerEnd = end
  if (l.start) e.markerStart = mermaidMarker(l.start)
  e.data = { link: l.raw.replace(/\s+/g, ' ') }
  return e
}

function mermaidQuote(v: string) {
  return `"${v.replace(/"/g, '#quot;').replace(/\n/g, '<br>')}"`
}
const MERMAID_OPEN = new Map(SHAPES.map((s) => [s.shape, s]))

/**
 * Writes nodes and edges as a Mermaid flowchart: labels, `circle` nodes as `(( ))` (`((( )))` with a ring), the
 * shape kept in `data.shape` (as `parseMermaid` leaves it), groups as subgraphs, and edges as `-->`, `---` (no
 * arrow), `-.->` (dashed), `==>` (3px or wider), `~~~` (hidden) or `<-->`, with their labels. Ids Mermaid can't take
 * are renamed (`n1`, `n2`…).
 */
export function toMermaid(nodes: FlowNode[], edges: FlowEdge[], options: FlowExportOptions = {}): string {
  const out = [`flowchart ${toRankdir(options.direction)}`]
  const names = new Map<string, string>()
  let next = 0
  const used = new Set<string>()
  for (const n of nodes) {
    const ok = /^[A-Za-z_][\w-]*$/.test(n.id) && !n.id.endsWith('-') && !MERMAID_RESERVED.has(n.id.toLowerCase())
    let name = ok ? n.id : ''
    while (!name || used.has(name)) name = `n${++next}`
    used.add(name)
    names.set(n.id, name)
  }
  const kids = tree(nodes)
  const write = (parent: string | undefined, indent: string) => {
    for (const n of kids.get(parent) ?? []) {
      const name = names.get(n.id)!
      const label = labelOf(n)
      if (n.type === 'group') {
        out.push(`${indent}subgraph ${name}[${mermaidQuote(label ?? n.id)}]`)
        write(n.id, indent + '  ')
        out.push(`${indent}end`)
        continue
      }
      const data = (n.data ?? {}) as { shape?: string; ring?: unknown }
      const shape = n.type === 'circle' ? (data.ring ? 'doublecircle' : 'circle') : data.shape && MERMAID_OPEN.has(data.shape) ? data.shape : label !== undefined && label !== n.id ? 'rect' : ''
      const s = shape ? MERMAID_OPEN.get(shape) : undefined
      out.push(`${indent}${name}${s ? `${s.open}${mermaidQuote(label ?? n.id)}${s.close}` : ''}`)
    }
  }
  write(undefined, '  ')
  for (const e of edges) {
    const s = names.get(e.source) ?? e.source
    const t = names.get(e.target) ?? e.target
    const end = e.markerEnd ?? 'arrow-closed'
    const start = e.markerStart ?? 'none'
    let l: string
    if (e.hidden) l = '~~~'
    else {
      const head = end !== 'none'
      const tail = start === 'none' ? '' : '<'
      if (e.dashed) l = `${tail}-.${head ? '->' : '-'}`
      else if ((e.width ?? 2) >= 3) l = `${tail}==${head ? '>' : '='}`
      else l = `${tail}--${head ? '>' : '-'}`
    }
    out.push(`  ${s} ${l}${e.label && !e.hidden ? `|${mermaidQuote(e.label)}|` : ''} ${t}`)
  }
  return out.join('\n') + '\n'
}
