// Confetti: a burst of Material 3's expressive shapes (MShape's) in the theme's colors, for the end of a flow (an
// order placed, a task done). One shared canvas over the page, created on the first burst and removed when the last
// piece has fallen; it never takes pointer events and assistive technology ignores it. Simple physics (gravity, air
// drag, spin and a flip that flattens each piece as it turns) in a rAF loop. Nothing happens under reduced motion.
import { getShape, toSvgPath, type ShapeName } from 'shape-morph'

export interface ConfettiOptions {
  /** How many pieces (default 80; 160 for `from: 'top'`) */
  count?: number
  /** Shapes to pick from (MShape's names) */
  shapes?: ShapeName[]
  /** Any CSS colors. Default: the theme's primary, secondary and tertiary roles and their containers, read at the origin */
  colors?: string[]
  /** Burst from a point (default) or rain from the top of the screen */
  from?: 'point' | 'top'
  /** Burst angle in degrees, 0 = up (default 0) */
  angle?: number
  /** Cone the pieces leave in, in degrees (default 70) */
  spread?: number
  /** Launch speed in px/s (default 950) */
  velocity?: number
  /** Piece size in px (default 14) */
  size?: number
}

/** Where a burst starts: the pointer of an event, an element's center, or a point in viewport pixels */
export type ConfettiOrigin = MouseEvent | PointerEvent | Element | { x: number; y: number }

const DEFAULT_SHAPES: ShapeName[] = ['Cookie4Sided', 'Sunny', 'Clover4Leaf', 'Heart', 'Pill', 'Triangle', 'SoftBurst', 'Circle', 'Gem', 'Flower']
const ROLES = ['primary', 'secondary', 'tertiary', 'primary-container', 'tertiary-container']
const GRAVITY = 1500
const DRAG = 1.6
const SIZE = 100

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  flip: number
  flipSpeed: number
  size: number
  path: Path2D
  color: string
  age: number
  life: number
}

const paths = new Map<string, Path2D>()
function pathFor(shape: ShapeName) {
  let path = paths.get(shape)
  if (!path) {
    path = new Path2D(toSvgPath(getShape(shape), SIZE))
    paths.set(shape, path)
  }
  return path
}

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let pieces: Piece[] = []
let raf = 0
let last = 0

function ensureCanvas() {
  if (canvas) return ctx
  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000'
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  if (!ctx) {
    teardown()
    return null
  }
  resize()
  window.addEventListener('resize', resize)
  return ctx
}

function resize() {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
}

function teardown() {
  cancelAnimationFrame(raf)
  raf = 0
  window.removeEventListener('resize', resize)
  canvas?.remove()
  canvas = null
  ctx = null
  pieces = []
}

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const height = window.innerHeight
  pieces = pieces.filter((p) => p.age < p.life && p.y < height + 60)
  if (!pieces.length || !ctx || !canvas) {
    teardown()
    return
  }
  const dpr = canvas.width / window.innerWidth
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const p of pieces) {
    p.age += dt
    p.vx -= p.vx * DRAG * dt
    p.vy += (GRAVITY - p.vy * DRAG) * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.spin * dt
    p.flip += p.flipSpeed * dt
    const fade = Math.min(1, (p.life - p.age) / 0.6)
    ctx.globalAlpha = Math.max(0, fade)
    ctx.fillStyle = p.color
    const scale = (p.size / SIZE) * dpr
    ctx.setTransform(scale * Math.cos(p.rot), scale * Math.sin(p.rot), -scale * Math.sin(p.rot) * Math.cos(p.flip), scale * Math.cos(p.rot) * Math.cos(p.flip), p.x * dpr, p.y * dpr)
    ctx.translate(-SIZE / 2, -SIZE / 2)
    ctx.fill(p.path)
  }
  raf = requestAnimationFrame(frame)
}

function originPoint(origin: ConfettiOrigin | undefined): { x: number; y: number; el: Element } {
  if (origin && 'clientX' in origin) {
    const el = (origin.currentTarget as Element | null) ?? (origin.target as Element | null) ?? document.documentElement
    // A click from the keyboard (Enter, Space) has no pointer position: burst from the element instead
    if (origin.detail === 0 && origin.clientX === 0 && origin.clientY === 0) return originPoint(el)
    return { x: origin.clientX, y: origin.clientY, el }
  }
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: origin }
  }
  if (origin) return { ...origin, el: document.documentElement }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6, el: document.documentElement }
}

function themeColors(el: Element) {
  const style = getComputedStyle(el)
  const colors = ROLES.map((role) => style.getPropertyValue(`--color-${role}`).trim()).filter(Boolean)
  return colors.length ? colors : ['#6750a4', '#625b71', '#7d5260', '#eaddff', '#ffd8e4']
}

/** Fires a burst of confetti. Browser only; does nothing under reduced motion. */
export function fireConfetti(origin?: ConfettiOrigin, options: ConfettiOptions = {}) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const top = options.from === 'top'
  const point = originPoint(origin)
  const colors = options.colors?.length ? options.colors : themeColors(point.el)
  const shapes = options.shapes?.length ? options.shapes : DEFAULT_SHAPES
  const count = options.count ?? (top ? 160 : 80)
  const spread = ((options.spread ?? 70) * Math.PI) / 180
  const angle = ((options.angle ?? 0) * Math.PI) / 180
  const speed = options.velocity ?? 950
  const size = options.size ?? 14
  if (!ensureCanvas()) return
  for (let i = 0; i < count; i++) {
    const dir = angle + (Math.random() - 0.5) * spread
    const v = top ? 100 + Math.random() * 200 : speed * (0.55 + Math.random() * 0.6)
    pieces.push({
      x: top ? Math.random() * window.innerWidth : point.x,
      y: top ? -20 - Math.random() * window.innerHeight * 0.4 : point.y,
      vx: top ? (Math.random() - 0.5) * 200 : Math.sin(dir) * v,
      vy: top ? v : -Math.cos(dir) * v,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 4 + Math.random() * 8,
      size: size * (0.7 + Math.random() * 0.6),
      path: pathFor(shapes[Math.floor(Math.random() * shapes.length)]!),
      color: colors[Math.floor(Math.random() * colors.length)]!,
      age: 0,
      life: top ? 4 + Math.random() * 1.5 : 2.4 + Math.random() * 1.2,
    })
  }
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
}

/** Confetti for a component: `fire(event)` from the pointer, `fire(el)` from an element, `fire({ from: 'top' })`. */
export function useConfetti() {
  function fire(origin?: ConfettiOrigin | ConfettiOptions, options?: ConfettiOptions) {
    const isOrigin = origin instanceof Event || (typeof Element !== 'undefined' && origin instanceof Element) || (origin && 'x' in origin && 'y' in origin && !('from' in origin))
    if (isOrigin) fireConfetti(origin as ConfettiOrigin, options)
    else fireConfetti(undefined, { ...(origin as ConfettiOptions | undefined), ...options })
  }
  return { fire }
}

/** Stops every burst and removes the canvas. Internal, for tests; not exported from index.ts. */
export function __resetConfetti() {
  teardown()
}
