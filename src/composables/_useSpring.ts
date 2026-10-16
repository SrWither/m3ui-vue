// Internal: a set of numbers (corner radii, sizes...) that springs toward a target, written to the DOM
// once per frame through `apply`. Same integration as the rest of the library (semi-implicit Euler),
// in fixed 4ms substeps so a stiff spring stays stable on a dropped frame. Not exported from index.ts.
import { onMounted, onUnmounted, watch } from 'vue'

export interface SpringSpec { dampingRatio: number; stiffness: number }

/** MotionSchemeKeyTokens.FastSpatial in the Standard scheme (StandardMotionTokens.SpringFastSpatial*) */
export const FAST_SPATIAL: SpringSpec = { dampingRatio: 0.9, stiffness: 1400 }
/** MotionSchemeKeyTokens.DefaultEffects in the Standard scheme */
export const DEFAULT_EFFECTS: SpringSpec = { dampingRatio: 1, stiffness: 1600 }
/** MotionSchemeKeyTokens.DefaultSpatial in the Standard scheme */
export const DEFAULT_SPATIAL: SpringSpec = { dampingRatio: 0.9, stiffness: 700 }

const SUBSTEP = 0.004

export function useSpring(
  target: () => number[],
  apply: (values: readonly number[]) => void,
  spec: SpringSpec = FAST_SPATIAL,
) {
  let current = [...target()]
  let velocity = current.map(() => 0)
  let raf = 0
  let last = 0

  function frame(now: number) {
    let dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const t = target()
    if (t.length !== current.length) {
      current = [...t]
      velocity = t.map(() => 0)
    }
    const k = spec.stiffness
    const c = 2 * spec.dampingRatio * Math.sqrt(k)
    while (dt > 0) {
      const h = Math.min(dt, SUBSTEP)
      dt -= h
      for (let i = 0; i < t.length; i++) {
        velocity[i]! += (-k * (current[i]! - t[i]!) - c * velocity[i]!) * h
        current[i]! += velocity[i]! * h
      }
    }
    const settled = t.every((v, i) => Math.abs(v - current[i]!) < 0.05 && Math.abs(velocity[i]!) < 0.05)
    if (settled) {
      current = [...t]
      velocity = t.map(() => 0)
    }
    apply(current)
    raf = settled ? 0 : requestAnimationFrame(frame)
  }

  function start() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  /** Jumps to the target without animating (e.g. when the layout context changes). */
  function snap() {
    cancelAnimationFrame(raf)
    raf = 0
    current = [...target()]
    velocity = current.map(() => 0)
    apply(current)
  }

  watch(() => target().join(','), start)
  onMounted(() => apply(current))
  onUnmounted(() => cancelAnimationFrame(raf))

  return { snap }
}

/** Compose's FastOutSlowInEasing, cubic-bezier(0.4, 0, 0.2, 1) — the easing of a default tween() */
export function fastOutSlowIn(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  // Solve x(u) = t for the curve parameter u (Newton), then return y(u)
  let u = t
  for (let i = 0; i < 8; i++) {
    const x = 3 * u * (1 - u) ** 2 * 0.4 + 3 * u ** 2 * (1 - u) * 0.2 + u ** 3 - t
    const dx = 3 * (1 - u) ** 2 * 0.4 + 6 * u * (1 - u) * (0.2 - 0.4) + 3 * u ** 2 * 0.8
    if (Math.abs(dx) < 1e-6) break
    u -= x / dx
  }
  return 3 * u ** 2 * (1 - u) + u ** 3
}
