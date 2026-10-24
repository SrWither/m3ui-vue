// Confetti: a burst of Material 3's expressive shapes (MShape's) in the theme's colors, for the end of a flow (an
// order placed, a task done). Drawn on the effects' shared canvas (_effectCanvas), which goes away when the last
// piece has fallen. Simple physics (gravity, air drag, spin and a flip that flattens each piece as it turns). Nothing
// happens under reduced motion.
import { getShape, toSvgPath, type ShapeName } from 'shape-morph'
import { __resetEffectCanvas, originPoint, reducedMotion, runLayer, themeColors, type EffectLayer, type EffectOrigin } from './_effectCanvas'

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
  /**
   * Keep it going for this long, in ms: a rain that keeps falling (`from: 'top'`) or a fountain from the point,
   * `count` then being pieces per second. `Infinity` runs until the returned `stop()`. Unset: one burst
   */
  duration?: number
}

/** Stops a running confetti before its `duration` ends; the pieces already out finish falling. */
export type StopConfetti = () => void

/** Where a burst starts: the pointer of an event, an element's center, or a point in viewport pixels */
export type ConfettiOrigin = EffectOrigin

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

// A confetti with a `duration`: it adds `rate` pieces per second (fractions carried over) until `until`
interface Emitter {
  until: number
  rate: number
  carry: number
  spawn: () => Piece
}

let pieces: Piece[] = []
let emitters: Emitter[] = []

const layer: EffectLayer = {
  step(ctx, dt, dpr, now) {
    const height = window.innerHeight
    emitters = emitters.filter((e) => e.until > now)
    for (const e of emitters) {
      e.carry += e.rate * dt
      for (; e.carry >= 1; e.carry--) pieces.push(e.spawn())
    }
    pieces = pieces.filter((p) => p.age < p.life && p.y < height + 60)
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
    return pieces.length > 0 || emitters.length > 0
  },
}


/**
 * Fires confetti: one burst, or with `duration` a rain or fountain that keeps going (stop it early with the returned
 * function). Browser only; does nothing under reduced motion.
 */
export function fireConfetti(origin?: ConfettiOrigin, options: ConfettiOptions = {}): StopConfetti {
  const noop = () => {}
  if (typeof window === 'undefined') return noop
  if (reducedMotion()) return noop
  const top = options.from === 'top'
  const point = originPoint(origin)
  const colors = options.colors?.length ? options.colors : themeColors(point.el, ROLES)
  const shapes = options.shapes?.length ? options.shapes : DEFAULT_SHAPES
  const count = options.count ?? (top ? 160 : 80)
  const spread = ((options.spread ?? 70) * Math.PI) / 180
  const angle = ((options.angle ?? 0) * Math.PI) / 180
  const speed = options.velocity ?? 950
  const size = options.size ?? 14
  // A rain with a duration starts its pieces just above the screen (they keep coming), a single one spread over a
  // band above it (they all come at once)
  const band = options.duration ? 0.05 : 0.4
  const spawn = (): Piece => {
    const dir = angle + (Math.random() - 0.5) * spread
    const v = top ? 100 + Math.random() * 200 : speed * (0.55 + Math.random() * 0.6)
    return {
      x: top ? Math.random() * window.innerWidth : point.x,
      y: top ? -20 - Math.random() * window.innerHeight * band : point.y,
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
    }
  }
  if (!runLayer(layer)) return noop
  let emitter: Emitter | null = null
  if (options.duration && options.duration > 0) {
    emitter = { until: performance.now() + options.duration, rate: count, carry: 0, spawn }
    emitters.push(emitter)
  } else {
    for (let i = 0; i < count; i++) pieces.push(spawn())
  }
  return () => {
    if (emitter) emitter.until = 0
  }
}

/**
 * Confetti for a component: `fire(event)` from the pointer, `fire(el)` from an element, `fire({ from: 'top' })`,
 * `fire({ from: 'top', duration: 5000 })` for a rain that lasts. Returns a function that stops it early.
 */
export function useConfetti() {
  function fire(origin?: ConfettiOrigin | ConfettiOptions, options?: ConfettiOptions): StopConfetti {
    const isOrigin = origin instanceof Event || (typeof Element !== 'undefined' && origin instanceof Element) || (origin && 'x' in origin && 'y' in origin && !('from' in origin))
    if (isOrigin) return fireConfetti(origin as ConfettiOrigin, options)
    return fireConfetti(undefined, { ...(origin as ConfettiOptions | undefined), ...options })
  }
  return { fire }
}

/** Stops every burst and removes the canvas. Internal, for tests; not exported from index.ts. */
export function __resetConfetti() {
  pieces = []
  emitters = []
  __resetEffectCanvas()
}
