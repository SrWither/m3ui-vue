// Automatic layouts for MFlow, without dependencies: a tidy tree (org charts, mind maps) and a layered layout for
// directed graphs (workflows, pipelines; the Sugiyama method, simplified). Pure functions over nodes, edges and
// sizes that return positions, so a layout of your own (dagre, elkjs) can take their place: anything with the
// `FlowLayout` signature.
import type { FlowEdge, FlowNode, FlowXY } from './useFlow'

export type FlowLayoutDirection = 'TB' | 'BT' | 'LR' | 'RL'

export interface FlowLayoutOptions {
  /** TB (top to bottom, the default for a vertical MFlow), BT, LR (default for a horizontal one) or RL */
  direction?: FlowLayoutDirection
  /** Space between neighbors in a level, px (default 40) */
  gap?: number
  /** Space between levels, px (default 80) */
  levelGap?: number
  /** Node sizes; MFlow passes the measured ones */
  sizes?: Map<string, { width: number; height: number }> | Record<string, { width: number; height: number }>
  /** Size of a node missing from `sizes` (default 180 × 60) */
  defaultSize?: { width: number; height: number }
}

/** Top left corners by node id */
export type FlowLayoutResult = Record<string, FlowXY>

/** A layout: MFlow's `layout` prop and `layout()` take one */
export type FlowLayout = (
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: FlowLayoutOptions & { sizes: Map<string, { width: number; height: number }>; direction: FlowLayoutDirection },
) => FlowLayoutResult | Promise<FlowLayoutResult>

interface Prepared {
  ids: string[]
  size: (id: string) => { breadth: number; depth: number; width: number; height: number }
  out: Map<string, string[]>
  inc: Map<string, string[]>
  horizontal: boolean
  reversed: boolean
  gap: number
  levelGap: number
}

// Top-level, visible nodes only; edges into a group's children count as edges into the group
function prepare(nodes: FlowNode[], edges: FlowEdge[], o: FlowLayoutOptions): Prepared {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const top = (id: string) => {
    let n = byId.get(id)
    for (let i = 0; n?.parentId && i < 100; i++) n = byId.get(n.parentId)
    return n
  }
  const ids = nodes.filter((n) => !n.parentId && !n.hidden).map((n) => n.id)
  const keep = new Set(ids)
  const out = new Map<string, string[]>(ids.map((id) => [id, []]))
  const inc = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const e of edges) {
    if (e.hidden) continue
    const s = top(e.source)?.id
    const t = top(e.target)?.id
    if (!s || !t || s === t || !keep.has(s) || !keep.has(t)) continue
    if (out.get(s)!.includes(t)) continue
    out.get(s)!.push(t)
    inc.get(t)!.push(s)
  }
  const dir = o.direction ?? 'TB'
  const horizontal = dir === 'LR' || dir === 'RL'
  const sizes = o.sizes instanceof Map ? o.sizes : new Map(Object.entries(o.sizes ?? {}))
  const def = o.defaultSize ?? { width: 180, height: 60 }
  return {
    ids,
    size: (id) => {
      const s = sizes.get(id) ?? (byId.get(id)?.width && byId.get(id)?.height ? { width: byId.get(id)!.width!, height: byId.get(id)!.height! } : def)
      return { ...s, breadth: horizontal ? s.height : s.width, depth: horizontal ? s.width : s.height }
    },
    out,
    inc,
    horizontal,
    reversed: dir === 'BT' || dir === 'RL',
    gap: o.gap ?? 40,
    levelGap: o.levelGap ?? 80,
  }
}

// Breadth/depth coordinates (centers along the level, the level's start) → top left corners
function place(p: Prepared, along: Map<string, number>, level: Map<string, number>): FlowLayoutResult {
  const levels = Math.max(0, ...level.values()) + 1
  const depthOf = Array<number>(levels).fill(0)
  for (const id of p.ids) depthOf[level.get(id)!] = Math.max(depthOf[level.get(id)!]!, p.size(id).depth)
  const start: number[] = []
  let acc = 0
  for (let l = 0; l < levels; l++) {
    start.push(acc)
    acc += depthOf[l]! + p.levelGap
  }
  const total = acc - p.levelGap
  const res: FlowLayoutResult = {}
  for (const id of p.ids) {
    const s = p.size(id)
    const l = level.get(id)!
    // Centered within its level's band
    let d = start[l]! + (depthOf[l]! - s.depth) / 2
    if (p.reversed) d = total - d - s.depth
    const b = along.get(id)! - s.breadth / 2
    res[id] = p.horizontal ? { x: d, y: b } : { x: b, y: d }
  }
  return res
}

/**
 * A tidy tree: each parent centered over its children, every subtree side by side without overlapping, levels
 * aligned. Roots are the nodes nothing points to (in the nodes' order); a child's place among its siblings
 * follows the edges' order. Extra parents and cycles are ignored (a node goes under the first parent reached).
 */
export function layoutTree(nodes: FlowNode[], edges: FlowEdge[], options: FlowLayoutOptions = {}): FlowLayoutResult {
  const p = prepare(nodes, edges, options)
  const children = new Map<string, string[]>()
  const seen = new Set<string>()
  const roots = p.ids.filter((id) => !p.inc.get(id)!.length)
  // A graph that's all cycles still needs a root
  if (!roots.length && p.ids.length) roots.push(p.ids[0]!)
  const level = new Map<string, number>()
  const queue: string[] = []
  const visit = (r: string) => {
    if (seen.has(r)) return
    seen.add(r)
    level.set(r, 0)
    queue.push(r)
    while (queue.length) {
      const id = queue.shift()!
      const kids: string[] = []
      for (const c of p.out.get(id)!) {
        if (seen.has(c)) continue
        seen.add(c)
        level.set(c, level.get(id)! + 1)
        kids.push(c)
        queue.push(c)
      }
      children.set(id, kids)
    }
  }
  roots.forEach(visit)
  // Whatever only a cycle reaches becomes a root of its own
  for (const id of p.ids) if (!seen.has(id)) { roots.push(id); visit(id) }

  const width = new Map<string, number>()
  const measure = (id: string): number => {
    const kids = children.get(id)!
    const kidsW = kids.reduce((s, c) => s + measure(c), 0) + Math.max(0, kids.length - 1) * p.gap
    const w = Math.max(p.size(id).breadth, kidsW)
    width.set(id, w)
    return w
  }
  const along = new Map<string, number>()
  const assign = (id: string, left: number) => {
    const w = width.get(id)!
    along.set(id, left + w / 2)
    const kids = children.get(id)!
    const kidsW = kids.reduce((s, c) => s + width.get(c)!, 0) + Math.max(0, kids.length - 1) * p.gap
    let x = left + (w - kidsW) / 2
    for (const c of kids) {
      assign(c, x)
      x += width.get(c)! + p.gap
    }
  }
  let x = 0
  for (const r of roots) {
    measure(r)
    assign(r, x)
    x += width.get(r)! + p.gap * 2
  }
  return place(p, along, level)
}

/**
 * A layered layout for directed graphs: every edge points one level onwards where it can (longest path from the
 * sources), the order within a level reduces crossings (barycenter sweeps), and nodes line up with what they're
 * connected to without overlapping. Edges that close a cycle are laid out as if reversed.
 */
export function layoutLayered(nodes: FlowNode[], edges: FlowEdge[], options: FlowLayoutOptions = {}): FlowLayoutResult {
  const p = prepare(nodes, edges, options)
  // Break cycles: drop edges back to a node still on the DFS stack
  const state = new Map<string, 0 | 1 | 2>()
  const fwd = new Map<string, string[]>(p.ids.map((id) => [id, []]))
  const dfs = (id: string) => {
    state.set(id, 1)
    for (const t of p.out.get(id)!) {
      if (state.get(t) === 1) continue
      fwd.get(id)!.push(t)
      if (!state.get(t)) dfs(t)
    }
    state.set(id, 2)
  }
  const sources = p.ids.filter((id) => !p.inc.get(id)!.length)
  for (const id of [...sources, ...p.ids]) if (!state.get(id)) dfs(id)
  const back = new Map<string, string[]>(p.ids.map((id) => [id, []]))
  for (const [s, ts] of fwd) for (const t of ts) back.get(t)!.push(s)

  // Longest path layering, in topological order
  const level = new Map<string, number>()
  const indeg = new Map(p.ids.map((id) => [id, back.get(id)!.length]))
  const queue = p.ids.filter((id) => !indeg.get(id))
  while (queue.length) {
    const id = queue.shift()!
    if (!level.has(id)) level.set(id, 0)
    for (const t of fwd.get(id)!) {
      level.set(t, Math.max(level.get(t) ?? 0, level.get(id)! + 1))
      indeg.set(t, indeg.get(t)! - 1)
      if (!indeg.get(t)) queue.push(t)
    }
  }
  // Pull sources down next to what they feed (a lone input right before its consumer)
  for (const id of p.ids) {
    if (back.get(id)!.length || !fwd.get(id)!.length) continue
    level.set(id, Math.min(...fwd.get(id)!.map((t) => level.get(t)!)) - 1)
  }
  const levels: string[][] = []
  for (const id of p.ids) (levels[level.get(id)!] ??= []).push(id)
  for (let l = 0; l < levels.length; l++) levels[l] ??= []

  // An edge across several levels gets a placeholder in each level between, so the ordering and the spacing
  // keep a lane open for it instead of running it underneath the nodes in between
  const dummies = new Set<string>()
  for (const [s, ts] of [...fwd]) {
    for (const t of [...ts]) {
      const ls = level.get(s)!
      const lt = level.get(t)!
      if (lt - ls <= 1) continue
      ts.splice(ts.indexOf(t), 1)
      let prev = s
      for (let l = ls + 1; l < lt; l++) {
        const d = `\u0000${s}>${t}#${l}`
        dummies.add(d)
        level.set(d, l)
        levels[l]!.push(d)
        fwd.set(d, [])
        back.set(d, [prev])
        fwd.get(prev)!.push(d)
        prev = d
      }
      fwd.get(prev)!.push(t)
      back.set(t, back.get(t)!.map((x) => (x === s ? prev : x)))
    }
  }
  const LANE = 8
  const sizeOf = (id: string) => (dummies.has(id) ? { breadth: LANE, depth: 0 } : p.size(id))

  // Crossing reduction: order each level by the mean position of its neighbors in the previous one
  const pos = new Map<string, number>()
  const index = () => levels.forEach((ids) => ids.forEach((id, i) => pos.set(id, i)))
  index()
  const sweep = (down: boolean) => {
    const range = down ? levels.map((_, i) => i).slice(1) : levels.map((_, i) => i).reverse().slice(1)
    for (const l of range) {
      const nb = down ? back : fwd
      const bary = new Map(levels[l]!.map((id) => {
        const ns = nb.get(id)!
        return [id, ns.length ? ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length : pos.get(id)!]
      }))
      levels[l]!.sort((a, b) => bary.get(a)! - bary.get(b)!)
      levels[l]!.forEach((id, i) => pos.set(id, i))
    }
  }
  for (let i = 0; i < 4; i++) { sweep(true); sweep(false) }

  // Coordinates along the level: packed first, then pulled toward their neighbors' centers, keeping the order
  const along = new Map<string, number>()
  for (const ids of levels) {
    let x = 0
    for (const id of ids) {
      const b = sizeOf(id).breadth
      along.set(id, x + b / 2)
      x += b + p.gap
    }
  }
  const relax = (ids: string[], nb: Map<string, string[]>) => {
    const want = ids.map((id) => {
      const ns = nb.get(id)!
      return ns.length ? ns.reduce((s, n) => s + along.get(n)!, 0) / ns.length : along.get(id)!
    })
    // Where each wants to be, never closer than the gap to its neighbor: pushed rightwards in one pass and
    // leftwards in another, then averaged (both keep the spacing, so their mean does too, without drifting)
    const space = (i: number) => sizeOf(ids[i]!).breadth / 2 + p.gap + sizeOf(ids[i + 1]!).breadth / 2
    const right = [...want]
    for (let i = 1; i < ids.length; i++) right[i] = Math.max(right[i]!, right[i - 1]! + space(i - 1))
    const left = [...want]
    for (let i = ids.length - 2; i >= 0; i--) left[i] = Math.min(left[i]!, left[i + 1]! - space(i))
    ids.forEach((id, i) => along.set(id, (right[i]! + left[i]!) / 2))
  }
  for (let it = 0; it < 3; it++) {
    for (let l = 1; l < levels.length; l++) relax(levels[l]!, back)
    for (let l = levels.length - 2; l >= 0; l--) relax(levels[l]!, fwd)
  }
  // Start at 0
  let min = Infinity
  for (const id of p.ids) min = Math.min(min, along.get(id)! - p.size(id).breadth / 2)
  if (Number.isFinite(min)) for (const id of p.ids) along.set(id, along.get(id)! - min)
  return place(p, along, level)
}
