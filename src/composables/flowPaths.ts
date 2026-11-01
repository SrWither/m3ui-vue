// Edge paths for MFlow, also exported for edges of your own (`#edge-<type>` slots). Every function takes the two
// ends in flow coordinates plus the side of its node each end leaves from, and returns an SVG path, the point
// where a label sits and the direction the path arrives in (for an arrowhead).

/** A side of a node: where a handle sits and the direction an edge leaves it in */
export type FlowPosition = 'top' | 'right' | 'bottom' | 'left'

export interface FlowEdgePathParams {
  sourceX: number
  sourceY: number
  /** Default 'bottom' */
  sourcePosition?: FlowPosition
  targetX: number
  targetY: number
  /** Default 'top' */
  targetPosition?: FlowPosition
}

export interface FlowEdgePath {
  /** The SVG path (`d`) */
  path: string
  /** Where the label goes: the path's middle */
  labelX: number
  labelY: number
  /** The direction the path leaves the source in, in radians (0 = right, π/2 = down) */
  sourceAngle: number
  /** The direction the path arrives at the target in, in radians: the way an arrowhead points */
  targetAngle: number
}

const NORMAL: Record<FlowPosition, [number, number]> = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
}
const angleOf = (x: number, y: number) => Math.atan2(y, x)
const r = (n: number) => Math.round(n * 100) / 100

/** A straight line between the ends */
export function getStraightPath(p: FlowEdgePathParams): FlowEdgePath {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = p
  const a = angleOf(tx - sx, ty - sy)
  return { path: `M${r(sx)},${r(sy)} L${r(tx)},${r(ty)}`, labelX: (sx + tx) / 2, labelY: (sy + ty) / 2, sourceAngle: a, targetAngle: a }
}

// React Flow's control point distance: half the distance along the side's direction, or a curve that grows with
// the square root of how far behind the node the other end is
function controlOffset(distance: number, curvature: number) {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance)
}
function controlPoint(pos: FlowPosition, x1: number, y1: number, x2: number, y2: number, c: number): [number, number] {
  switch (pos) {
    case 'left': return [x1 - controlOffset(x1 - x2, c), y1]
    case 'right': return [x1 + controlOffset(x2 - x1, c), y1]
    case 'top': return [x1, y1 - controlOffset(y1 - y2, c)]
    default: return [x1, y1 + controlOffset(y2 - y1, c)]
  }
}

/** A cubic curve that leaves and arrives square to the nodes' sides. `curvature` (default 0.25) bends it more when the target is behind the source */
export function getBezierPath(p: FlowEdgePathParams & { curvature?: number }): FlowEdgePath {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = p
  const sp = p.sourcePosition ?? 'bottom'
  const tp = p.targetPosition ?? 'top'
  const c = p.curvature ?? 0.25
  const [c1x, c1y] = controlPoint(sp, sx, sy, tx, ty, c)
  const [c2x, c2y] = controlPoint(tp, tx, ty, sx, sy, c)
  const labelX = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx
  const labelY = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ty
  return {
    path: `M${r(sx)},${r(sy)} C${r(c1x)},${r(c1y)} ${r(c2x)},${r(c2y)} ${r(tx)},${r(ty)}`,
    labelX,
    labelY,
    sourceAngle: angleOf(...NORMAL[sp]),
    targetAngle: angleOf(-NORMAL[tp][0], -NORMAL[tp][1]),
  }
}

type Pt = [number, number]

/** The corners of an orthogonal route between the ends, leaving and arriving square to the sides */
export function smoothStepPoints(p: FlowEdgePathParams & { offset?: number }): Pt[] {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = p
  const sp = p.sourcePosition ?? 'bottom'
  const tp = p.targetPosition ?? 'top'
  const off = p.offset ?? 20
  const [nsx, nsy] = NORMAL[sp]
  const [ntx, nty] = NORMAL[tp]
  const s1: Pt = [sx + nsx * off, sy + nsy * off]
  const t1: Pt = [tx + ntx * off, ty + nty * off]
  const sH = nsx !== 0
  const tH = ntx !== 0
  let mid: Pt[]
  if (sH && tH) {
    if (nsx === -ntx && (tx - sx) * nsx >= 2 * off) {
      // Facing each other with room: one vertical run halfway
      const mx = (sx + tx) / 2
      mid = [[mx, sy], [mx, ty]]
    } else if (nsx === ntx) {
      // Both sides look the same way: go round past the farther one
      const x = nsx > 0 ? Math.max(s1[0], t1[0]) : Math.min(s1[0], t1[0])
      mid = [[x, sy], [x, ty]]
    } else {
      // Behind: out, across halfway between the ends, and back in
      const my = (sy + ty) / 2
      mid = [s1, [s1[0], my], [t1[0], my], t1]
    }
  } else if (!sH && !tH) {
    if (nsy === -nty && (ty - sy) * nsy >= 2 * off) {
      const my = (sy + ty) / 2
      mid = [[sx, my], [tx, my]]
    } else if (nsy === nty) {
      const y = nsy > 0 ? Math.max(s1[1], t1[1]) : Math.min(s1[1], t1[1])
      mid = [[sx, y], [tx, y]]
    } else {
      const mx = (sx + tx) / 2
      mid = [s1, [mx, s1[1]], [mx, t1[1]], t1]
    }
  } else if (sH) {
    // Leaves sideways, arrives from above or below: one corner when both legs go the right way
    if ((tx - sx) * nsx >= off && (ty - sy) * -nty >= off) mid = [[tx, sy]]
    else mid = [s1, [s1[0], t1[1]], t1]
  } else {
    if ((ty - sy) * nsy >= off && (tx - sx) * -ntx >= off) mid = [[sx, ty]]
    else mid = [s1, [t1[0], s1[1]], t1]
  }
  return cleanPoints([[sx, sy], ...mid, [tx, ty]])
}

/** Drops repeated and collinear points from an orthogonal polyline */
function cleanPoints(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const q of pts) {
    const a = out[out.length - 1]
    if (a && Math.abs(a[0] - q[0]) < 0.01 && Math.abs(a[1] - q[1]) < 0.01) continue
    const b = out[out.length - 2]
    if (a && b && ((Math.abs(b[0] - a[0]) < 0.01 && Math.abs(a[0] - q[0]) < 0.01) || (Math.abs(b[1] - a[1]) < 0.01 && Math.abs(a[1] - q[1]) < 0.01))) {
      out[out.length - 1] = q
      continue
    }
    out.push(q)
  }
  return out
}

function midpointAlong(pts: Pt[]): Pt {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1])
  let left = total / 2
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!
    const [bx, by] = pts[i]!
    const len = Math.hypot(bx - ax, by - ay)
    if (left <= len && len > 0) return [ax + ((bx - ax) * left) / len, ay + ((by - ay) * left) / len]
    left -= len
  }
  return pts[0] ?? [0, 0]
}

/**
 * The corners of an orthogonal edge routed through `route`: the positions of its segments after the first, alternately
 * x and y, starting with where the leg leaving the source ends (an x when the source's side is left or right). The
 * legs at the ends stretch to wherever the nodes are, and a corner is added before the target when it's needed to
 * arrive square to its side, so the route stays orthogonal as the nodes move.
 */
export function routePoints(p: FlowEdgePathParams & { route: number[] }): Pt[] {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = p
  const sp = p.sourcePosition ?? 'bottom'
  const tp = p.targetPosition ?? 'top'
  let horizontal = NORMAL[sp][0] !== 0
  const tH = NORMAL[tp][0] !== 0
  let cur: Pt = [sx, sy]
  const pts: Pt[] = [cur]
  for (const c of p.route) {
    cur = horizontal ? [c, cur[1]] : [cur[0], c]
    pts.push(cur)
    horizontal = !horizontal
  }
  if (horizontal === tH) {
    // The next leg runs the target's way: straight in when it's level with it, else a jog halfway
    if (Math.abs(tH ? cur[1] - ty : cur[0] - tx) > 0.01) {
      if (tH) {
        const mx = (cur[0] + tx) / 2
        pts.push([mx, cur[1]], [mx, ty])
      } else {
        const my = (cur[1] + ty) / 2
        pts.push([cur[0], my], [tx, my])
      }
    }
  } else pts.push(tH ? [cur[0], ty] : [tx, cur[1]])
  pts.push([tx, ty])
  return cleanPoints(pts)
}

/** The other way round: the `route` that runs an orthogonal edge through these corners (its ends first and last) */
export function pointsToRoute(points: Pt[], sourcePosition: FlowPosition = 'bottom', targetPosition?: FlowPosition): number[] {
  const pts = cleanPoints(points)
  const route: number[] = []
  let horizontal = NORMAL[sourcePosition][0] !== 0
  let cur = pts[0]
  if (!cur) return route
  for (let i = 1; i < pts.length - 1; i++) {
    const q = pts[i]!
    const segH = Math.abs(q[1] - cur[1]) < 0.01
    // A leg the other way first: a zero-length one keeps the axes alternating
    if (segH !== horizontal) {
      route.push(horizontal ? cur[0] : cur[1])
      horizontal = !horizontal
    }
    // The last corner follows the target (when the last leg arrives square to its side), so it isn't kept
    if (i === pts.length - 2 && targetPosition && (NORMAL[targetPosition][0] !== 0) === !horizontal) break
    route.push(horizontal ? q[0] : q[1])
    horizontal = !horizontal
    cur = q
  }
  return route
}

/** Right-angled steps through `route` (see `routePoints`), rounded like `getSmoothStepPath` */
export function getRoutedPath(p: FlowEdgePathParams & { route: number[]; borderRadius?: number }): FlowEdgePath {
  return roundedPath(routePoints(p), p.borderRadius ?? 8)
}

/** Right-angled steps with rounded corners (`borderRadius`, default 8; 0 gives sharp steps). `offset` (default 20) is how far it leaves a node before turning */
export function getSmoothStepPath(p: FlowEdgePathParams & { borderRadius?: number; offset?: number }): FlowEdgePath {
  return roundedPath(smoothStepPoints(p), p.borderRadius ?? 8)
}

function roundedPath(pts: Pt[], radius: number): FlowEdgePath {
  let d = `M${r(pts[0]![0])},${r(pts[0]![1])}`
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]!
    const next = pts[i + 1]
    if (!next || radius <= 0) {
      d += ` L${r(x)},${r(y)}`
      continue
    }
    const [px, py] = pts[i - 1]!
    const rad = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(next[0] - x, next[1] - y) / 2)
    const ux = Math.sign(x - px)
    const uy = Math.sign(y - py)
    const vx = Math.sign(next[0] - x)
    const vy = Math.sign(next[1] - y)
    d += ` L${r(x - ux * rad)},${r(y - uy * rad)} Q${r(x)},${r(y)} ${r(x + vx * rad)},${r(y + vy * rad)}`
  }
  const [labelX, labelY] = midpointAlong(pts)
  const a = pts[0]!
  const b = pts[1] ?? a
  const y = pts[pts.length - 2] ?? a
  const z = pts[pts.length - 1]!
  return { path: d, labelX, labelY, sourceAngle: angleOf(b[0] - a[0], b[1] - a[1]), targetAngle: angleOf(z[0] - y[0], z[1] - y[1]) }
}

/**
 * Points along an edge's path, close enough together to measure how far something is from it (bezier curves are
 * sampled; step paths are their corners)
 */
export function edgePathPoints(type: string | undefined, p: FlowEdgePathParams & { route?: number[] }): [number, number][] {
  if (p.route && (type === 'smoothstep' || type === 'step')) return routePoints({ ...p, route: p.route })
  if (type === 'straight') return [[p.sourceX, p.sourceY], [p.targetX, p.targetY]]
  if (type === 'smoothstep' || type === 'step') return smoothStepPoints(p)
  const sp = p.sourcePosition ?? 'bottom'
  const tp = p.targetPosition ?? 'top'
  const [c1x, c1y] = controlPoint(sp, p.sourceX, p.sourceY, p.targetX, p.targetY, 0.25)
  const [c2x, c2y] = controlPoint(tp, p.targetX, p.targetY, p.sourceX, p.sourceY, 0.25)
  const out: [number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const u = 1 - t
    out.push([
      u * u * u * p.sourceX + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p.targetX,
      u * u * u * p.sourceY + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p.targetY,
    ])
  }
  return out
}

/** The distance from a point to a polyline */
export function distanceToPoints(x: number, y: number, pts: [number, number][]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!
    const [bx, by] = pts[i]!
    const dx = bx - ax
    const dy = by - ay
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
    best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y))
  }
  return best
}

/** `getSmoothStepPath` with sharp corners */
export function getStepPath(p: FlowEdgePathParams & { offset?: number; route?: number[] }): FlowEdgePath {
  return p.route ? getRoutedPath({ ...p, route: p.route, borderRadius: 0 }) : getSmoothStepPath({ ...p, borderRadius: 0 })
}

/** An arrowhead's path at (x, y) pointing along `angle`: open (two strokes) or closed (a filled triangle's outline) */
export function arrowPath(x: number, y: number, angle: number, size = 10, closed = false): string {
  const spread = 0.45
  const ax = x - size * Math.cos(angle - spread)
  const ay = y - size * Math.sin(angle - spread)
  const bx = x - size * Math.cos(angle + spread)
  const by = y - size * Math.sin(angle + spread)
  return closed
    ? `M${r(x)},${r(y)} L${r(ax)},${r(ay)} L${r(bx)},${r(by)} Z`
    : `M${r(ax)},${r(ay)} L${r(x)},${r(y)} L${r(bx)},${r(by)}`
}
