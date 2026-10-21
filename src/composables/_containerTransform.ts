/*
 * Internal (not exported from index.ts): Material's container transform, the engine behind MContainerTransform.
 *
 * A port of Material Components for Android's MaterialContainerTransform (transition/MaterialContainerTransform.java,
 * FitModeEvaluators, FadeModeEvaluators, MaskEvaluator, TransitionUtils), with its defaults: linear path between the
 * two boxes' top-centers, FIT_MODE_AUTO, FADE_MODE_IN, the non-arc progress thresholds, a 32% black scrim, 500ms
 * (motionDurationLong2) to open and 400ms (motionDurationMedium4) to close on the emphasized curve. Both views keep
 * their own layout and are scaled uniformly to the container's current width (or height), so nothing stretches;
 * a rounded clip, the union of both masked boxes, morphs between their shapes. Android draws snapshots on a canvas;
 * here the source is a clone, the destination the real panel, and every frame is computed up front and played as
 * Web Animations (see _springAnimation.ts) so the compositor runs the transforms and opacities.
 */
import { SAMPLE_MS } from './_springAnimation'

export interface Box { left: number; top: number; width: number; height: number }

interface Thresholds { fade: [number, number]; scale: [number, number]; scaleMask: [number, number]; shapeMask: [number, number] }
const ENTER: Thresholds = { fade: [0, 0.25], scale: [0, 1], scaleMask: [0, 1], shapeMask: [0, 0.75] }
const RETURN: Thresholds = { fade: [0.6, 0.9], scale: [0, 1], scaleMask: [0, 0.9], shapeMask: [0.3, 0.9] }

export const OPEN_MS = 500
export const CLOSE_MS = 400
export const SCRIM_OPACITY = 0x52 / 255

// Android's emphasized interpolator (motionEasingEmphasizedInterpolator): the path
// M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1, not a single cubic
function segment(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x: number) {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const u = (lo + hi) / 2
    const bx = (1 - u) ** 3 * x0 + 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u ** 2 * x2 + u ** 3 * x3
    if (bx < x) lo = u
    else hi = u
  }
  const u = (lo + hi) / 2
  return (1 - u) ** 3 * y0 + 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u ** 2 * y2 + u ** 3 * y3
}
export function emphasized(t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t < 0.166666
    ? segment(0, 0, 0.05, 0, 0.133333, 0.06, 0.166666, 0.4, t)
    : segment(0.166666, 0.4, 0.208333, 0.82, 0.25, 1, 1, 1, t)
}

const lerp = (a: number, b: number, f: number) => a + f * (b - a)
// TransitionUtils.lerp with start/end fractions (clamped outside them, like Android unless overshoot is allowed)
function lerpRange(a: number, b: number, [from, to]: [number, number], f: number) {
  if (f < from) return a
  if (f > to) return b
  return lerp(a, b, (f - from) / (to - from))
}

/** Where a view sits: translate from its own resting box, uniform scale from its top-left corner, opacity */
export interface ViewState { x: number; y: number; scale: number; opacity: number }
export interface Frame {
  /** The container's clip, in the same coordinates as the boxes, and its corner radius */
  clip: Box
  radius: number
  start: ViewState
  end: ViewState
  scrim: number
}

/**
 * The transition's state at progress `p` (already eased), from the `start` box to the `end` one. `entering` is the
 * direction (Android's TRANSITION_DIRECTION_AUTO: the bigger box is the detail), which picks the thresholds and the
 * fade: entering, the end view fades in on top of the start one; returning, the start one fades out on top.
 */
export function containerFrame(p: number, start: Box, end: Box, startRadius: number, endRadius: number, entering: boolean): Frame {
  const th = entering ? ENTER : RETURN

  // FitModeEvaluators: fit to the width unless the end box, scaled to the start's width, ends up shorter
  const fitWidth = entering
    ? (end.height * start.width) / end.width >= start.height
    : (start.height * end.width) / start.width >= end.height
  let startScale: number
  let endScale: number
  if (fitWidth) {
    const width = lerpRange(start.width, end.width, th.scale, p)
    startScale = width / start.width
    endScale = width / end.width
  } else {
    const height = lerpRange(start.height, end.height, th.scale, p)
    startScale = height / start.height
    endScale = height / end.height
  }
  const sw = start.width * startScale
  const sh = start.height * startScale
  const ew = end.width * endScale
  const eh = end.height * endScale

  // The linear motion path between the top-centers
  const mx = lerp(start.left + start.width / 2, end.left + end.width / 2, p)
  const my = lerp(start.top, end.top, p)
  const startBox = { left: mx - sw / 2, top: my, width: sw, height: sh }
  const endBox = { left: mx - ew / 2, top: my, width: ew, height: eh }

  // Mask the taller (or wider) of the two down toward the other over the scale-mask range
  const startMasked = { ...startBox }
  const endMasked = { ...endBox }
  const maskProgress = lerpRange(0, 1, th.scaleMask, p)
  if (fitWidth) {
    const maskStart = sh > eh
    const target = maskStart ? startMasked : endMasked
    target.height -= Math.abs(eh - sh) * (maskStart ? maskProgress : 1 - maskProgress)
  } else {
    const maskStart = sw > ew
    const target = maskStart ? startMasked : endMasked
    const diff = Math.abs(ew - sw) * (maskStart ? maskProgress : 1 - maskProgress)
    target.left += diff / 2
    target.width -= diff
  }
  const left = Math.min(startMasked.left, endMasked.left)
  const top = Math.min(startMasked.top, endMasked.top)
  const right = Math.max(startMasked.left + startMasked.width, endMasked.left + endMasked.width)
  const bottom = Math.max(startMasked.top + startMasked.height, endMasked.top + endMasked.height)

  const fade = lerpRange(0, 1, th.fade, p)
  return {
    clip: { left, top, width: right - left, height: bottom - top },
    radius: lerpRange(startRadius, endRadius, th.shapeMask, p),
    start: { x: startBox.left - start.left, y: startBox.top - start.top, scale: startScale, opacity: entering ? 1 : 1 - fade },
    end: { x: endBox.left - end.left, y: endBox.top - end.top, scale: endScale, opacity: entering ? fade : 1 },
    scrim: (entering ? p : 1 - p) * SCRIM_OPACITY,
  }
}

/** Every frame of a transition, one per 60Hz frame of `duration` ms, on the emphasized curve */
export function containerFrames(start: Box, end: Box, startRadius: number, endRadius: number, entering: boolean, duration: number): Frame[] {
  const n = Math.max(1, Math.round(duration / SAMPLE_MS))
  return Array.from({ length: n + 1 }, (_, i) => containerFrame(emphasized(i / n), start, end, startRadius, endRadius, entering))
}

const view = (s: ViewState): Keyframe => ({ transform: `translate(${s.x}px, ${s.y}px) scale(${s.scale})`, opacity: s.opacity })

/**
 * Plays `frames` on the clip layer (positioned at the viewport's origin, `vw` × `vh`), the two views and the scrim.
 * Returns the running animations (empty without the Web Animations API). `fill: 'forwards'` holds the last frame
 * (a closing run, until the layer is removed).
 */
export function playContainerFrames(
  frames: Frame[],
  els: { clip: HTMLElement; start?: HTMLElement | null; end: HTMLElement; scrim?: HTMLElement | null },
  vw: number,
  vh: number,
  fill?: FillMode,
): Animation[] {
  if (typeof els.end.animate !== 'function') return []
  const duration = (frames.length - 1) * SAMPLE_MS
  const options: KeyframeAnimationOptions = { duration, easing: 'linear', fill }
  const clip = (f: Frame) => {
    const { left, top, width, height } = f.clip
    return `inset(${top}px ${vw - left - width}px ${vh - top - height}px ${left}px round ${f.radius}px)`
  }
  const anims = [
    els.clip.animate(frames.map((f) => ({ clipPath: clip(f) })), options),
    els.end.animate(frames.map((f) => view(f.end)), options),
  ]
  if (els.start) anims.push(els.start.animate(frames.map((f) => view(f.start)), options))
  if (els.scrim) anims.push(els.scrim.animate(frames.map((f) => ({ opacity: f.scrim })), options))
  for (const a of anims) a.finished.catch(() => {})
  return anims
}

/** A resting box in viewport coordinates */
export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** An element's top-left corner radius in px (a percentage resolves against its width) */
export function radiusOf(el: Element): number {
  const value = getComputedStyle(el).borderTopLeftRadius || '0'
  const n = parseFloat(value)
  if (Number.isNaN(n)) return 0
  return value.trim().endsWith('%') ? (n / 100) * (el as HTMLElement).offsetWidth : n
}
