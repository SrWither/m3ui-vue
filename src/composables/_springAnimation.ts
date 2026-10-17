import type { SpringSpec } from './motion'

/*
 * Internal (not exported from index.ts): springs played as Web Animations.
 *
 * The library's springs normally step in a rAF loop (see CLAUDE.md). That loop runs on the main thread, and an
 * enter/exit animation starts exactly when the main thread is busiest: mounting the panel's content, re-laying
 * out the page for a scroll lock. On phones that janked visibly (MNavigationDrawer's open, where the old CSS
 * transition hadn't, since the compositor runs those). So enter/exit/settle springs are simulated up front, one
 * sample per 60Hz frame, and played as a linear Web Animation of transform/opacity, which the compositor runs
 * too. Same curve, bounce and release velocity as the loop; only a finger-driven drag writes styles directly.
 *
 * Pattern: write the end state inline, then play the samples over it (an animation beats inline styles), so
 * nothing jumps when it ends; to interrupt, read `sampleAt(samples, anim.currentTime)`, write that inline and
 * cancel.
 */

export const SAMPLE_MS = 1000 / 60
// Stiff springs (FastEffects, 3800) diverge at a 16ms Euler step: integrate in 4ms substeps
const SUBSTEP = 0.004

/**
 * The spring from `from` to `to`, starting at `velocity` (units/s), one sample per 60Hz frame until it's within
 * `epsilon` of `to` (and slower than `epsilon * 10` per second). The last sample is exactly `to`.
 */
export function sampleSpring(from: number, to: number, velocity: number, spring: SpringSpec, epsilon: number): number[] {
  const out = [from]
  let pos = from
  let vel = velocity
  const damping = 2 * spring.dampingRatio * Math.sqrt(spring.stiffness)
  for (let i = 0; i < 600; i++) {
    for (let left = SAMPLE_MS / 1000; left > 1e-9; left -= SUBSTEP) {
      const h = Math.min(SUBSTEP, left)
      vel += (-spring.stiffness * (pos - to) - damping * vel) * h
      pos += vel * h
    }
    out.push(pos)
    if (Math.abs(pos - to) < epsilon && Math.abs(vel) < epsilon * 10) break
  }
  out[out.length - 1] = to
  return out
}

/** The value `samples` has `time` ms into playback (an Animation's currentTime), linear between frames */
export function sampleAt(samples: number[], time: CSSNumberish | null | undefined): number {
  const t = Number(time ?? 0) / SAMPLE_MS
  const i = Math.floor(t)
  if (i >= samples.length - 1) return samples[samples.length - 1]!
  if (i < 0) return samples[0]!
  return samples[i]! + (samples[i + 1]! - samples[i]!) * (t - i)
}

/** How long `samples` play, in ms */
export const samplesDuration = (samples: number[]) => (samples.length - 1) * SAMPLE_MS

/**
 * Plays `samples` on `el` as a linear Web Animation, each mapped to a keyframe. Null when there's nothing to
 * play or no Web Animations API (the inline end state then simply stands).
 */
export function playSamples(
  el: Element | null | undefined,
  samples: number[],
  keyframe: (value: number) => Keyframe,
  delay = 0,
): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function' || samples.length < 2) return null
  const anim = (el as HTMLElement).animate(samples.map(keyframe), { duration: samplesDuration(samples), delay, easing: 'linear' })
  // cancel() rejects `finished`; nothing has to wait on it
  anim.finished.catch(() => {})
  return anim
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
