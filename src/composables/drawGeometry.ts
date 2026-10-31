// The Drawing family's data and geometry: strokes with pressure turned into filled outlines, shapes, text, hit tests,
// the stroke-cutting eraser, moving and scaling, and SVG export. Pure functions, no Vue, so they work on the server
// and in tests, and an app can render or process a drawing without the canvas.

/** A point of a stroke: x, y, and the pressure (0–1) */
export type DrawPoint = [x: number, y: number, pressure: number]
export type DrawPen = 'pen' | 'brush' | 'marker' | 'highlighter'
export type DrawShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse'

interface DrawItemBase {
  id: string
  /** The layer it's on (`undefined`: the first one) */
  layer?: string
  /** The page it's on, in `mode="pages"` (its coordinates are then relative to that page) */
  page?: number
  color: string
}
export interface DrawStroke extends DrawItemBase {
  type: 'stroke'
  pen: DrawPen
  /** Width at full pressure, in drawing units */
  size: number
  points: DrawPoint[]
}
export interface DrawShape extends DrawItemBase {
  type: 'shape'
  shape: DrawShapeKind
  from: [number, number]
  to: [number, number]
  size: number
  /** Fill of a rect or an ellipse (`null`/absent: none) */
  fill?: string | null
}
export interface DrawText extends DrawItemBase {
  type: 'text'
  /** Top-left corner */
  at: [number, number]
  text: string
  /** Font size */
  size: number
}
export type DrawItem = DrawStroke | DrawShape | DrawText

export interface DrawLayer {
  id: string
  name: string
  visible?: boolean
  locked?: boolean
}
export interface DrawBox { x: number; y: number; width: number; height: number }

let seq = 0
export const drawId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`

/** How each pen behaves: how much pressure thins it, how much its ends taper, how opaque it is */
export const PENS: Record<DrawPen, { thinning: number; taper: number; opacity: number }> = {
  pen: { thinning: 0.6, taper: 0.4, opacity: 1 },
  brush: { thinning: 0.85, taper: 1, opacity: 1 },
  marker: { thinning: 0, taper: 0, opacity: 1 },
  highlighter: { thinning: 0, taper: 0, opacity: 0.35 },
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Smooths raw input points: each one moves part of the way toward the next sample (`smoothing` 0 keeps them as they
 * are, 1 follows lazily), and points closer than a fraction of the size are merged. Pressure is kept.
 */
export function smoothPoints(points: DrawPoint[], smoothing = 0.5, size = 4): DrawPoint[] {
  if (points.length < 2) return points.slice()
  const t = 1 - Math.min(0.9, Math.max(0, smoothing) * 0.85)
  const min = Math.max(0.5, size * 0.1)
  const out: DrawPoint[] = [points[0]!]
  let [x, y] = points[0]!
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    x += (p[0] - x) * t
    y += (p[1] - y) * t
    const last = out[out.length - 1]!
    if (Math.hypot(x - last[0], y - last[1]) >= min || i === points.length - 1) out.push([x, y, p[2]])
  }
  // Ends where the pointer did
  const end = points[points.length - 1]!
  out[out.length - 1] = [end[0], end[1], end[2]]
  return out
}

/** Pressure made up from speed, for a mouse or a finger: slow is heavy, fast is light */
export function simulatePressure(points: DrawPoint[], size: number): DrawPoint[] {
  let p = 0.5
  return points.map((pt, i) => {
    if (!i) return [pt[0], pt[1], 0.5]
    const prev = points[i - 1]!
    const speed = Math.min(1, Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) / (size * 2))
    p += (1 - speed - p) * 0.3
    return [pt[0], pt[1], Math.max(0.2, Math.min(1, p))]
  })
}

/** The radius along a stroke: pressure thins it, and the ends taper over a distance tied to its size */
function radii(points: DrawPoint[], size: number, pen: DrawPen) {
  const { thinning, taper } = PENS[pen]
  const dist: number[] = [0]
  for (let i = 1; i < points.length; i++) dist.push(dist[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]))
  const total = dist[dist.length - 1]!
  const tl = Math.min(total / 3, size * 3 * taper)
  return points.map((p, i) => {
    let r = (size / 2) * (1 - thinning * (1 - p[2]))
    if (tl > 0) {
      const ease = (v: number) => 1 - (1 - v) * (1 - v)
      r *= Math.max(0.15, Math.min(1, ease(Math.min(1, dist[i]! / tl)), ease(Math.min(1, (total - dist[i]!) / tl))))
    }
    return Math.max(0.25, r)
  })
}

/** A stroke as the SVG path of its filled outline (round caps, its width following pressure) */
export function strokePath(s: Pick<DrawStroke, 'points' | 'size' | 'pen'>): string {
  const pts = s.points
  if (!pts.length) return ''
  const rs = radii(pts, s.size, s.pen)
  if (pts.length === 1 || pts.every((p) => Math.hypot(p[0] - pts[0]![0], p[1] - pts[0]![1]) < 0.5)) {
    const [x, y] = pts[0]!
    const r = r2(Math.max(...rs))
    return `M${r2(x - r)} ${r2(y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
  }
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!
    const b = pts[Math.min(pts.length - 1, i + 1)]!
    let dx = b[0] - a[0]
    let dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const r = rs[i]!
    left.push([pts[i]![0] - dy * r, pts[i]![1] + dx * r])
    right.push([pts[i]![0] + dy * r, pts[i]![1] - dx * r])
  }
  // Each side as quadratic curves through the midpoints, joined by round caps
  const side = (ps: [number, number][]) => {
    let d = ''
    for (let i = 1; i < ps.length - 1; i++) {
      const [x, y] = ps[i]!
      const [nx, ny] = ps[i + 1]!
      d += `Q${r2(x)} ${r2(y)} ${r2((x + nx) / 2)} ${r2((y + ny) / 2)}`
    }
    const last = ps[ps.length - 1]!
    return `${d}L${r2(last[0])} ${r2(last[1])}`
  }
  const rEnd = r2(rs[rs.length - 1]!)
  const rStart = r2(rs[0]!)
  const back = right.slice().reverse()
  return `M${r2(left[0]![0])} ${r2(left[0]![1])}${side(left)}A${rEnd} ${rEnd} 0 0 1 ${r2(back[0]![0])} ${r2(back[0]![1])}${side(back)}A${rStart} ${rStart} 0 0 1 ${r2(left[0]![0])} ${r2(left[0]![1])}Z`
}

/** A shape's outline as an SVG path (stroked), plus an arrow's head (filled) */
export function shapePath(s: Pick<DrawShape, 'shape' | 'from' | 'to' | 'size'>): { d: string; head?: string } {
  const [x1, y1] = s.from
  const [x2, y2] = s.to
  switch (s.shape) {
    case 'rect': {
      const x = Math.min(x1, x2)
      const y = Math.min(y1, y2)
      return { d: `M${r2(x)} ${r2(y)}h${r2(Math.abs(x2 - x1))}v${r2(Math.abs(y2 - y1))}h${r2(-Math.abs(x2 - x1))}Z` }
    }
    case 'ellipse': {
      const rx = Math.abs(x2 - x1) / 2
      const ry = Math.abs(y2 - y1) / 2
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      return { d: `M${r2(cx - rx)} ${r2(cy)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0Z` }
    }
    case 'arrow': {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1
      const ux = (x2 - x1) / len
      const uy = (y2 - y1) / len
      const h = Math.min(len * 0.6, Math.max(10, s.size * 4))
      const w = h * 0.55
      const bx = x2 - ux * h
      const by = y2 - uy * h
      return {
        d: `M${r2(x1)} ${r2(y1)}L${r2(bx + ux * 0.5)} ${r2(by + uy * 0.5)}`,
        head: `M${r2(x2)} ${r2(y2)}L${r2(bx - uy * w)} ${r2(by + ux * w)}L${r2(bx + uy * w)} ${r2(by - ux * w)}Z`,
      }
    }
    default:
      return { d: `M${r2(x1)} ${r2(y1)}L${r2(x2)} ${r2(y2)}` }
  }
}

/** Holding Shift: lines snap to 45°, rects and ellipses become squares and circles */
export function constrain(kind: DrawShapeKind, from: [number, number], to: [number, number]): [number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  if (kind === 'rect' || kind === 'ellipse') {
    const m = Math.max(Math.abs(dx), Math.abs(dy))
    return [from[0] + Math.sign(dx || 1) * m, from[1] + Math.sign(dy || 1) * m]
  }
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const len = Math.hypot(dx, dy)
  return [from[0] + Math.cos(a) * len, from[1] + Math.sin(a) * len]
}

export const LINE_HEIGHT = 1.25
/** A text's box, estimated from its characters (good enough to hit and select it) */
export function textBox(t: Pick<DrawText, 'at' | 'text' | 'size'>): DrawBox {
  const lines = t.text.split('\n')
  return { x: t.at[0], y: t.at[1], width: Math.max(t.size, ...lines.map((l) => l.length * t.size * 0.56)), height: lines.length * t.size * LINE_HEIGHT }
}

/** An item's bounds */
export function itemBox(item: DrawItem): DrawBox {
  if (item.type === 'text') return textBox(item)
  const pts: [number, number][] = item.type === 'stroke' ? item.points.map((p) => [p[0], p[1]]) : [item.from, item.to]
  const pad = item.size / 2
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const [x, y] of pts) {
    x1 = Math.min(x1, x)
    y1 = Math.min(y1, y)
    x2 = Math.max(x2, x)
    y2 = Math.max(y2, y)
  }
  return { x: x1 - pad, y: y1 - pad, width: x2 - x1 + pad * 2, height: y2 - y1 + pad * 2 }
}
export function unionBox(boxes: DrawBox[]): DrawBox | null {
  if (!boxes.length) return null
  const x1 = Math.min(...boxes.map((b) => b.x))
  const y1 = Math.min(...boxes.map((b) => b.y))
  const x2 = Math.max(...boxes.map((b) => b.x + b.width))
  const y2 = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  return Math.hypot(ax + t * dx - px, ay + t * dy - py)
}
/** Points along a shape's outline, for hit tests and lasso */
function shapePoints(s: DrawShape): [number, number][] {
  const [x1, y1] = s.from
  const [x2, y2] = s.to
  if (s.shape === 'rect') return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]
  if (s.shape === 'ellipse') {
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    return Array.from({ length: 33 }, (_, i) => [cx + (Math.abs(x2 - x1) / 2) * Math.cos((i / 32) * Math.PI * 2), cy + (Math.abs(y2 - y1) / 2) * Math.sin((i / 32) * Math.PI * 2)])
  }
  return [s.from, s.to]
}

/** Whether a point (with a tolerance) touches an item */
export function hitItem(item: DrawItem, x: number, y: number, tolerance = 4): boolean {
  if (item.type === 'text') {
    const b = textBox(item)
    return x >= b.x - tolerance && x <= b.x + b.width + tolerance && y >= b.y - tolerance && y <= b.y + b.height + tolerance
  }
  if (item.type === 'shape' && item.fill && (item.shape === 'rect' || item.shape === 'ellipse')) {
    const b = itemBox(item)
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      if (item.shape === 'rect') return true
      const rx = b.width / 2
      const ry = b.height / 2
      if (((x - b.x - rx) / rx) ** 2 + ((y - b.y - ry) / ry) ** 2 <= 1) return true
    }
  }
  const pts: [number, number][] = item.type === 'stroke' ? item.points.map((p) => [p[0], p[1]]) : shapePoints(item)
  const reach = item.size / 2 + tolerance
  if (pts.length === 1) return Math.hypot(pts[0]![0] - x, pts[0]![1] - y) <= reach
  for (let i = 1; i < pts.length; i++) if (segDist(x, y, pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1]) <= reach) return true
  return false
}

/**
 * The stroke-cutting eraser: the parts of a stroke within `r` of (x, y) go, what's left splits into separate
 * strokes. Returns the item unchanged when it isn't touched, `[]` when it's all gone. Shapes and text go whole.
 */
export function eraseAt(item: DrawItem, x: number, y: number, r: number): DrawItem[] {
  if (item.type !== 'stroke') return hitItem(item, x, y, r) ? [] : [item]
  const reach = r + item.size / 2
  const pts = item.points
  if (pts.length === 1) return Math.hypot(pts[0]![0] - x, pts[0]![1] - y) <= reach ? [] : [item]
  let touched = false
  const runs: DrawPoint[][] = []
  let run: DrawPoint[] = []
  pts.forEach((p, i) => {
    const prev = pts[i - 1]
    const gone = Math.hypot(p[0] - x, p[1] - y) <= reach
    const crossed = !!prev && run.length > 0 && segDist(x, y, prev[0], prev[1], p[0], p[1]) <= reach
    if (gone || crossed) {
      touched = true
      if (run.length > 1) runs.push(run)
      run = gone ? [] : [p]
    } else run.push(p)
  })
  if (run.length > 1) runs.push(run)
  if (!touched) return [item]
  return runs.map((points, i) => ({ ...item, id: i ? drawId() : item.id, points }))
}

function inPolygon(x: number, y: number, poly: [number, number][]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
/** Whether a lasso (a closed polygon) takes an item: most of its points inside */
export function inLasso(item: DrawItem, poly: [number, number][]): boolean {
  if (poly.length < 3) return false
  let pts: [number, number][]
  if (item.type === 'stroke') pts = item.points.map((p) => [p[0], p[1]])
  else if (item.type === 'shape') pts = shapePoints(item)
  else {
    const b = textBox(item)
    pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
  }
  const n = pts.filter(([x, y]) => inPolygon(x, y, poly)).length
  return n >= Math.max(1, pts.length * 0.5)
}

/** An item moved by (dx, dy) and scaled by (sx, sy) around (ox, oy) */
export function transformItem(item: DrawItem, t: { dx?: number; dy?: number; sx?: number; sy?: number; ox?: number; oy?: number }): DrawItem {
  const { dx = 0, dy = 0, sx = 1, sy = 1, ox = 0, oy = 0 } = t
  const X = (x: number) => ox + (x - ox) * sx + dx
  const Y = (y: number) => oy + (y - oy) * sy + dy
  const k = Math.sqrt(Math.abs(sx * sy))
  if (item.type === 'stroke') return { ...item, size: item.size * k, points: item.points.map(([x, y, p]) => [X(x), Y(y), p]) }
  if (item.type === 'shape') return { ...item, size: item.size * k, from: [X(item.from[0]), Y(item.from[1])], to: [X(item.to[0]), Y(item.to[1])] }
  return { ...item, size: item.size * k, at: [X(item.at[0]), Y(item.at[1])] }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** One item as SVG markup */
export function itemSvg(item: DrawItem, fontFamily = 'sans-serif'): string {
  if (item.type === 'stroke') {
    const o = PENS[item.pen].opacity
    return `<path d="${strokePath(item)}" fill="${esc(item.color)}"${o < 1 ? ` fill-opacity="${o}"` : ''}/>`
  }
  if (item.type === 'shape') {
    const { d, head } = shapePath(item)
    const fill = item.fill && (item.shape === 'rect' || item.shape === 'ellipse') ? esc(item.fill) : 'none'
    return `<path d="${d}" fill="${fill}" stroke="${esc(item.color)}" stroke-width="${item.size}" stroke-linecap="round" stroke-linejoin="round"/>${head ? `<path d="${head}" fill="${esc(item.color)}"/>` : ''}`
  }
  const lines = item.text.split('\n')
  return `<text x="${item.at[0]}" y="${item.at[1]}" font-size="${item.size}" font-family="${esc(fontFamily)}" fill="${esc(item.color)}">${lines
    .map((l, i) => `<tspan x="${item.at[0]}" dy="${i ? item.size * LINE_HEIGHT : item.size * 0.95}">${esc(l) || ' '}</tspan>`)
    .join('')}</text>`
}

export interface DrawSvgOptions {
  /** The area to export (default: the items' bounds plus `padding`) */
  box?: DrawBox
  padding?: number
  /** A background fill (default: none, transparent) */
  background?: string
  /** Only the items of this page */
  page?: number
  /** Leave out these layers (hidden ones, say) */
  hiddenLayers?: string[]
  /** The layers' order, bottom first (items of other layers go first) */
  layers?: string[]
  fontFamily?: string
}
/** Items in drawing order: by layer, then as they come */
export function sortByLayer(items: DrawItem[], layers?: string[]) {
  if (!layers?.length) return items
  const rank = (i: DrawItem) => (i.layer === undefined ? 0 : Math.max(0, layers.indexOf(i.layer)))
  return items.map((it, i) => [it, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([it]) => it)
}
/** A drawing (or one page of it) as a standalone SVG document */
export function toDrawSvg(items: DrawItem[], opts: DrawSvgOptions = {}): string {
  const shown = sortByLayer(items, opts.layers).filter((i) => (opts.page === undefined || (i.page ?? 0) === opts.page) && !opts.hiddenLayers?.includes(i.layer ?? ''))
  const pad = opts.padding ?? 16
  const b = opts.box ?? unionBox(shown.map(itemBox)) ?? { x: 0, y: 0, width: 1, height: 1 }
  const box = opts.box ? b : { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 }
  const bg = opts.background ? `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${esc(opts.background)}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(box.x)} ${r2(box.y)} ${r2(box.width)} ${r2(box.height)}" width="${Math.ceil(box.width)}" height="${Math.ceil(box.height)}">${bg}${shown.map((i) => itemSvg(i, opts.fontFamily)).join('')}</svg>`
}

/** An SVG document rendered to a PNG blob (in a browser), `scale` times its size */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(img.width * scale)
    canvas.height = Math.ceil(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
