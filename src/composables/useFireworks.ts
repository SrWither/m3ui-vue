// Fireworks: rockets rise from the bottom of the screen and burst, in the theme's colors. A classic burst (a peony)
// throws its sparks out from the center in every direction, trailing streaks, then drag slows them and gravity pulls
// them down as they flicker out: simulated. A shaped one lays its sparks out along one of Material 3's expressive
// shapes (MShape's: a ring, a heart, a flower…): kinematic, so the shape stays readable while it opens and sags. Drawn
// on the effects' shared canvas (_effectCanvas) with useConfetti. Nothing happens under reduced motion.
import { getShape, type ShapeName } from 'shape-morph'
import { __resetEffectCanvas, reducedMotion, runLayer, themeColors, type EffectLayer } from './_effectCanvas'

export interface FireworksOptions {
  /** How many rockets (default 6, launched over about a second and a half); with `duration`, rockets per second */
  count?: number
  /**
   * What the bursts look like, one picked per burst: `'classic'` (sparks thrown out from the center that fall as they
   * fade) or an MShape's name the sparks are laid out along (`'Circle'` is a ring). Default: mostly classic, with a
   * ring, a heart, a flower… now and then
   */
  shapes?: FireworkShape[]
  /** Any CSS colors. Default: the theme's primary, secondary and tertiary roles and their containers */
  colors?: string[]
  /** Burst radius in px. Default: a sixth of the screen's smaller side, between 70 and 180 */
  size?: number
  /** Keep launching for this long, in ms (`count` then being rockets per second); `Infinity` runs until `stop()` */
  duration?: number
}

/** A burst's look: `'classic'`, or an MShape's name its sparks are laid out along. */
export type FireworkShape = 'classic' | ShapeName

/** Stops launching before `duration` ends; what's already in the air finishes. */
export type StopFireworks = () => void

const DEFAULT_SHAPES: FireworkShape[] = ['classic', 'classic', 'classic', 'classic', 'classic', 'classic', 'Circle', 'Heart', 'Flower', 'Sunny', 'Clover4Leaf']
const ROLES = ['primary', 'secondary', 'tertiary', 'primary-container', 'tertiary-container']
const SPARKS = 64
const CLASSIC_SPARKS = 90
// Sparks are slowed by DRAG (1/s) and pulled by GRAVITY (px/s²); a shaped burst instead opens over EXPAND seconds
// (ease out) while sagging SAG px/s². Every spark draws a streak through its last TAIL positions, kept every
// TAIL_STEP seconds whatever the frame rate (so ~0.27s of it); a rocket, its last TRAIL
const DRAG = 2.2
const GRAVITY = 110
const EXPAND = 0.9
const SAG = 70
const TAIL = 17
const TAIL_STEP = 1 / 60
const TRAIL = 10

interface Rocket {
  x0: number
  y0: number
  x1: number
  y1: number
  flight: number
  age: number
  trail: number[]
  color: string
  burst: () => void
}

interface Burst {
  cx: number
  cy: number
  radius: number
  /** A shaped burst's sparks, as offsets from the center (see shapeOutline); a classic one has none */
  offsets: Float32Array | null
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  /** The last TAIL positions of every spark, oldest first, the newest being where it is now: `[spark][step][x, y]` */
  tail: Float32Array
  /** Time since the tail last moved up a step */
  tailClock: number
  colors: string[]
  age: number
  life: number
}

interface Pending {
  at: number
  launch: () => void
}

const outlines = new Map<string, Float32Array>()

/**
 * `n` points evenly spaced along a shape's outline, as offsets from its center scaled so the farthest is at 1
 * (`[x0, y0, x1, y1, …]`). Exported for tests.
 */
export function shapeOutline(shape: ShapeName, n = SPARKS): Float32Array {
  const key = `${shape}:${n}`
  let out = outlines.get(key)
  if (out) return out
  // The outline as a polyline (each cubic sampled), then n points at equal distances along it
  const pts: number[] = []
  for (const cubic of getShape(shape).cubics) {
    const p = cubic.points
    for (let i = 0; i < 16; i++) {
      const t = i / 16
      const u = 1 - t
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
      pts.push(a * p[0]! + b * p[2]! + c * p[4]! + d * p[6]!, a * p[1]! + b * p[3]! + c * p[5]! + d * p[7]!)
    }
  }
  const count = pts.length / 2
  const lengths = [0]
  for (let i = 1; i <= count; i++) {
    const j = i % count
    lengths.push(lengths[i - 1]! + Math.hypot(pts[j * 2]! - pts[(i - 1) * 2]!, pts[j * 2 + 1]! - pts[(i - 1) * 2 + 1]!))
  }
  const total = lengths[count]!
  // Centered on its bounding box (sampling isn't even along the outline, so an average would lean)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, pts[i * 2]!); maxX = Math.max(maxX, pts[i * 2]!)
    minY = Math.min(minY, pts[i * 2 + 1]!); maxY = Math.max(maxY, pts[i * 2 + 1]!)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  out = new Float32Array(n * 2)
  let seg = 0
  let max = 0
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total
    while (lengths[seg + 1]! < target) seg++
    const f = (target - lengths[seg]!) / (lengths[seg + 1]! - lengths[seg]! || 1)
    const j = (seg + 1) % count
    const x = pts[seg * 2]! + (pts[j * 2]! - pts[seg * 2]!) * f - cx
    const y = pts[seg * 2 + 1]! + (pts[j * 2 + 1]! - pts[seg * 2 + 1]!) * f - cy
    out[k * 2] = x
    out[k * 2 + 1] = y
    max = Math.max(max, Math.hypot(x, y))
  }
  for (let i = 0; i < out.length; i++) out[i]! /= max || 1
  outlines.set(key, out)
  return out
}

let rockets: Rocket[] = []
let bursts: Burst[] = []
let pending: Pending[] = []
let emitters: { until: number; rate: number; carry: number; launch: () => void }[] = []

const easeOut = (t: number) => 1 - (1 - t) ** 3

function createBurst(cx: number, cy: number, radius: number, colors: string[], offsets: Float32Array | null): Burst {
  const n = offsets ? offsets.length / 2 : CLASSIC_SPARKS
  const b: Burst = {
    cx, cy, radius, colors, offsets, age: 0,
    life: offsets ? 1.9 * (0.85 + Math.random() * 0.3) : 2 + Math.random() * 0.6,
    x: new Float32Array(n).fill(cx),
    y: new Float32Array(n).fill(cy),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    tail: new Float32Array(n * TAIL * 2),
    tailClock: 0,
  }
  for (let i = 0; i < n; i++) {
    if (!offsets) {
      // A sphere of sparks seen from the front: denser toward the rim, some flying toward or away from us. With drag
      // alone a spark stops speed / DRAG away, so that's the radius
      const angle = Math.random() * Math.PI * 2
      const depth = Math.random() * 2 - 1
      const speed = radius * DRAG * Math.sqrt(1 - depth * depth) * (0.92 + Math.random() * 0.12)
      b.vx[i] = Math.cos(angle) * speed
      b.vy[i] = Math.sin(angle) * speed
    }
    for (let k = 0; k < TAIL; k++) {
      b.tail[(i * TAIL + k) * 2] = cx
      b.tail[(i * TAIL + k) * 2 + 1] = cy
    }
  }
  return b
}

function stepBurst(ctx: CanvasRenderingContext2D, b: Burst, dt: number) {
  b.age += dt
  const t = b.age
  const n = b.x.length
  const opened = b.radius * easeOut(Math.min(t / EXPAND, 1))
  b.tailClock += dt
  const shift = b.tailClock >= TAIL_STEP
  if (shift) b.tailClock %= TAIL_STEP
  for (let i = 0; i < n; i++) {
    if (b.offsets) {
      b.x[i] = b.cx + b.offsets[i * 2]! * opened
      b.y[i] = b.cy + b.offsets[i * 2 + 1]! * opened + SAG * t * t
    } else {
      b.vx[i]! -= b.vx[i]! * DRAG * dt
      b.vy[i]! += (GRAVITY - b.vy[i]! * DRAG) * dt
      b.x[i]! += b.vx[i]! * dt
      b.y[i]! += b.vy[i]! * dt
    }
    const base = i * TAIL * 2
    if (shift) b.tail.copyWithin(base, base + 2, base + TAIL * 2)
    b.tail[base + (TAIL - 1) * 2] = b.x[i]!
    b.tail[base + (TAIL - 1) * 2 + 1] = b.y[i]!
  }
  // A flash where it bursts
  if (t < 0.15) {
    ctx.globalAlpha = 0.35 * (1 - t / 0.15)
    ctx.fillStyle = b.colors[0]!
    ctx.beginPath()
    ctx.arc(b.cx, b.cy, b.radius * 0.25, 0, Math.PI * 2)
    ctx.fill()
  }
  // Fades over the second half of its life, the sparks flickering out over the last third
  const left = 1 - t / b.life
  const fade = Math.max(0, Math.min(1, left * 2))
  const flicker = left < 0.35
  const shown = new Uint8Array(n)
  for (let i = 0; i < n; i++) shown[i] = !flicker || Math.random() < 0.6 ? 1 : 0
  // One path per color and streak segment, fainter and thinner toward the tail's end, then a bright head
  b.colors.forEach((color, ci) => {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    for (let k = 1; k < TAIL; k++) {
      const along = k / (TAIL - 1)
      ctx.globalAlpha = fade * along * along
      ctx.lineWidth = 0.8 + 1.6 * along
      ctx.beginPath()
      for (let i = ci; i < n; i += b.colors.length) {
        if (!shown[i]) continue
        const a = (i * TAIL + k - 1) * 2
        ctx.moveTo(b.tail[a]!, b.tail[a + 1]!)
        ctx.lineTo(b.tail[a + 2]!, b.tail[a + 3]!)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = fade
    ctx.beginPath()
    for (let i = ci; i < n; i += b.colors.length) {
      if (!shown[i]) continue
      ctx.moveTo(b.x[i]! + 1.8, b.y[i]!)
      ctx.arc(b.x[i]!, b.y[i]!, 1.8, 0, Math.PI * 2)
    }
    ctx.fill()
  })
}

const layer: EffectLayer = {
  step(ctx, dt, dpr, now) {
    emitters = emitters.filter((e) => e.until > now)
    for (const e of emitters) {
      e.carry += e.rate * dt
      for (; e.carry >= 1; e.carry--) e.launch()
    }
    const due = pending.filter((p) => p.at <= now)
    pending = pending.filter((p) => p.at > now)
    for (const p of due) p.launch()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'

    for (const r of rockets) {
      r.age += dt
      const t = easeOut(Math.min(r.age / r.flight, 1))
      r.trail.push(r.x0 + (r.x1 - r.x0) * t, r.y0 + (r.y1 - r.y0) * t)
      if (r.trail.length > TRAIL * 2) r.trail.splice(0, 2)
      ctx.strokeStyle = r.color
      ctx.lineWidth = 2.5
      for (let i = 2; i < r.trail.length; i += 2) {
        ctx.globalAlpha = i / r.trail.length
        ctx.beginPath()
        ctx.moveTo(r.trail[i - 2]!, r.trail[i - 1]!)
        ctx.lineTo(r.trail[i]!, r.trail[i + 1]!)
        ctx.stroke()
      }
      if (r.age >= r.flight) r.burst()
    }
    rockets = rockets.filter((r) => r.age < r.flight)

    for (const b of bursts) stepBurst(ctx, b, dt)
    bursts = bursts.filter((b) => b.age < b.life)

    return rockets.length > 0 || bursts.length > 0 || pending.length > 0 || emitters.length > 0
  },
}

/**
 * Launches fireworks: a few rockets, or with `duration` a show that keeps going (stop it early with the returned
 * function). Browser only; does nothing under reduced motion.
 */
export function launchFireworks(options: FireworksOptions = {}): StopFireworks {
  const noop = () => {}
  if (typeof window === 'undefined' || reducedMotion()) return noop
  const colors = options.colors?.length ? options.colors : themeColors(document.documentElement, ROLES)
  const shapes = options.shapes?.length ? options.shapes : DEFAULT_SHAPES
  const count = options.count ?? 6
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]!

  const launch = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const x0 = w * (0.1 + Math.random() * 0.8)
    const color = pick(colors)
    const rocket: Rocket = {
      x0,
      y0: h + 10,
      x1: x0 + (Math.random() - 0.5) * 120,
      y1: h * (0.15 + Math.random() * 0.3),
      flight: 0.9 + Math.random() * 0.4,
      age: 0,
      trail: [],
      color,
      burst() {
        const shape = pick(shapes)
        const radius = (options.size ?? Math.min(180, Math.max(70, Math.min(w, h) / 6))) * (0.8 + Math.random() * 0.4)
        // Sometimes two colors, alternating spark by spark
        const burstColors = Math.random() < 0.3 ? [color, pick(colors)] : [color]
        if (shape === 'classic') {
          bursts.push(createBurst(this.x1, this.y1, radius, burstColors, null))
          return
        }
        const base = shapeOutline(shape)
        // Turned at random, except a heart, which reads only upright
        const angle = shape === 'Heart' ? 0 : Math.random() * Math.PI * 2
        const cos = Math.cos(angle), sin = Math.sin(angle)
        // A ring gets a second, smaller one inside it
        const rings = shape === 'Circle' ? [1, 0.55] : [1]
        const offsets = new Float32Array(base.length * rings.length)
        rings.forEach((scale, k) => {
          for (let i = 0; i < base.length; i += 2) {
            offsets[k * base.length + i] = (base[i]! * cos - base[i + 1]! * sin) * scale
            offsets[k * base.length + i + 1] = (base[i]! * sin + base[i + 1]! * cos) * scale
          }
        })
        bursts.push(createBurst(this.x1, this.y1, radius, burstColors, offsets))
      },
    }
    rockets.push(rocket)
  }

  if (!runLayer(layer)) return noop
  let emitter: (typeof emitters)[number] | null = null
  const now = performance.now()
  if (options.duration && options.duration > 0) {
    emitter = { until: now + options.duration, rate: count, carry: 1, launch }
    emitters.push(emitter)
  } else {
    // The first one right away, the rest over about 0.25s each
    for (let i = 0; i < count; i++) pending.push({ at: now + (i === 0 ? 0 : Math.random() * count * 250), launch })
  }
  return () => {
    if (emitter) emitter.until = 0
  }
}

/** Fireworks for a component: `launch()`, `launch({ shapes: ['classic'] })`, `launch({ shapes: ['Heart'] })`, `launch({ duration: 10000 })`. */
export function useFireworks() {
  return { launch: launchFireworks }
}

/** Stops every firework and removes the canvas. Internal, for tests; not exported from index.ts. */
export function __resetFireworks() {
  rockets = []
  bursts = []
  pending = []
  emitters = []
  __resetEffectCanvas()
}
