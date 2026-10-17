// Material 3's motion tokens for your own animations, from androidx's MotionTokens, StandardMotionTokens and
// ExpressiveMotionTokens. The same easings and durations are CSS variables in theme.css (`--ease-*`, which
// Tailwind turns into `ease-*` utilities, and `--duration-*`); the springs only make sense in JS, with
// `useSpring` (exported next to these) or your own loop. No imports here: _useSpring builds on this file.

/** A spring: dampingRatio 1 settles without overshoot, lower bounces; higher stiffness is faster */
export interface SpringSpec { dampingRatio: number; stiffness: number }

/**
 * Spring specs of the two motion schemes. Spatial springs move things (position, size, shape); effects springs
 * change color and opacity and never overshoot. Standard is the default scheme; Expressive is bouncier, for
 * Expressive components and moments that should feel lively.
 */
export const motionSprings = {
  standard: {
    fastSpatial: { dampingRatio: 0.9, stiffness: 1400 },
    defaultSpatial: { dampingRatio: 0.9, stiffness: 700 },
    slowSpatial: { dampingRatio: 0.9, stiffness: 300 },
    fastEffects: { dampingRatio: 1, stiffness: 3800 },
    defaultEffects: { dampingRatio: 1, stiffness: 1600 },
    slowEffects: { dampingRatio: 1, stiffness: 800 },
  },
  expressive: {
    fastSpatial: { dampingRatio: 0.6, stiffness: 800 },
    defaultSpatial: { dampingRatio: 0.8, stiffness: 380 },
    slowSpatial: { dampingRatio: 0.8, stiffness: 200 },
    fastEffects: { dampingRatio: 1, stiffness: 3800 },
    defaultEffects: { dampingRatio: 1, stiffness: 1600 },
    slowEffects: { dampingRatio: 1, stiffness: 800 },
  },
} as const satisfies Record<'standard' | 'expressive', Record<string, SpringSpec>>

/** Easing curves as cubic-bezier control points [x1, y1, x2, y2] (theme.css has them as `--ease-*`) */
export const motionEasings = {
  emphasized: [0.2, 0, 0, 1],
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15],
  standard: [0.2, 0, 0, 1],
  standardDecelerate: [0, 0, 0, 1],
  standardAccelerate: [0.3, 0, 1, 1],
  legacy: [0.4, 0, 0.2, 1],
  legacyDecelerate: [0, 0, 0.2, 1],
  legacyAccelerate: [0.4, 0, 1, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>

/** Durations in ms (theme.css has them as `--duration-short-1` … `--duration-extra-long-4`) */
export const motionDurations = {
  short1: 50, short2: 100, short3: 150, short4: 200,
  medium1: 250, medium2: 300, medium3: 350, medium4: 400,
  long1: 450, long2: 500, long3: 550, long4: 600,
  extraLong1: 700, extraLong2: 800, extraLong3: 900, extraLong4: 1000,
} as const

/**
 * A cubic-bezier easing as a function of progress (0–1), e.g. `cubicBezier(...motionEasings.emphasized)`, for
 * JS-driven tweens and for mapping a fraction through a curve
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    // Solve x(u) = t for the curve parameter u (Newton), then return y(u)
    let u = t
    for (let i = 0; i < 8; i++) {
      const x = 3 * u * (1 - u) ** 2 * x1 + 3 * u ** 2 * (1 - u) * x2 + u ** 3 - t
      const dx = 3 * (1 - u) ** 2 * x1 + 6 * u * (1 - u) * (x2 - x1) + 3 * u ** 2 * (1 - x2)
      if (Math.abs(dx) < 1e-6) break
      u -= x / dx
    }
    return 3 * u * (1 - u) ** 2 * y1 + 3 * u ** 2 * (1 - u) * y2 + u ** 3
  }
}
