// A set of numbers (corner radii, sizes...) that springs toward a target, written to the DOM once per
// frame through `apply`. Same integration as the rest of the library (semi-implicit Euler), in fixed 4ms
// substeps so a stiff spring stays stable on a dropped frame. `useSpring` is public (index.ts, with the
// motion tokens); the constants below are the library's internal shorthands for the Standard scheme.
import { onMounted, onUnmounted, watch } from 'vue'
import { cubicBezier, motionSprings, type SpringSpec } from './motion'

export type { SpringSpec }

/** MotionSchemeKeyTokens.FastSpatial in the Standard scheme (StandardMotionTokens.SpringFastSpatial*) */
export const FAST_SPATIAL: SpringSpec = motionSprings.standard.fastSpatial
/** MotionSchemeKeyTokens.FastEffects in the Standard scheme */
export const FAST_EFFECTS: SpringSpec = motionSprings.standard.fastEffects
/** MotionSchemeKeyTokens.DefaultEffects in the Standard scheme */
export const DEFAULT_EFFECTS: SpringSpec = motionSprings.standard.defaultEffects
/** MotionSchemeKeyTokens.DefaultSpatial in the Standard scheme */
export const DEFAULT_SPATIAL: SpringSpec = motionSprings.standard.defaultSpatial

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
export const fastOutSlowIn = cubicBezier(0.4, 0, 0.2, 1)
