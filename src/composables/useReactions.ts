// Floating reactions: an emoji or a Material Symbol that pops up from a point and floats away swaying, the way
// reactions rise over a live stream or a video call. Each one is an element in a fixed layer over the page (created
// with the first, removed after the last; no pointer events, hidden from assistive technology), moved by a Web
// Animation, which the compositor runs. Under reduced motion it only fades in and out where it starts.
import { originPoint, reducedMotion, type EffectOrigin } from './_effectCanvas'

/** What floats up: any text (an emoji, `'+1'`), or a Material Symbol (`{ icon: 'favorite' }`, filled by default). */
export type ReactionContent = string | { icon: string; filled?: boolean; color?: string }

export interface ReactionOptions {
  /** How many float up together, a little apart (default 1) */
  count?: number
  /** Size in px (default 32) */
  size?: number
  /** How far it rises, in px (default 260) */
  distance?: number
  /** How long it floats, in ms (default 2200) */
  duration?: number
  /** How far it sways to each side, in px (default 20) */
  sway?: number
}

/** Where a reaction starts: the pointer of an event, an element's center, or a point in viewport pixels */
export type ReactionOrigin = EffectOrigin

let layer: HTMLElement | null = null
let alive = 0

function ensureLayer() {
  if (layer) return layer
  layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:2147483000'
  document.body.appendChild(layer)
  return layer
}

function release(el: HTMLElement) {
  el.remove()
  if (--alive <= 0 && layer) {
    layer.remove()
    layer = null
    alive = 0
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 2

/** The path one reaction floats along, sampled for a linear Web Animation. */
function floatFrames(distance: number, sway: number, phase: number, drift: number): Keyframe[] {
  const frames: Keyframe[] = []
  const n = 30
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = -distance * easeOut(t)
    const wave = Math.sin(phase + t * Math.PI * 2.4)
    const x = sway * wave * (0.4 + 0.6 * t) + drift * t
    // Pops in past its size, settles, and shrinks a little as it fades out
    const scale = t < 0.12 ? 1.15 * easeOut(t / 0.12) : t < 0.22 ? 1.15 - 0.15 * ((t - 0.12) / 0.1) : 1 - 0.15 * ((t - 0.22) / 0.78)
    const opacity = t < 0.08 ? t / 0.08 : t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1
    frames.push({
      transform: `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(wave * 10).toFixed(1)}deg) scale(${scale.toFixed(3)})`,
      opacity: +opacity.toFixed(3),
    })
  }
  return frames
}

/** Sends a reaction floating up from a point. Browser only. */
export function fireReaction(origin: ReactionOrigin | undefined, content: ReactionContent, options: ReactionOptions = {}) {
  if (typeof window === 'undefined') return
  const point = originPoint(origin)
  const size = options.size ?? 32
  const count = Math.max(1, options.count ?? 1)
  const reduced = reducedMotion()
  const host = ensureLayer()
  // An icon's default color is the theme's primary where the reaction starts (an MScheme's, inside one)
  const iconColor = typeof content === 'object'
    ? content.color ?? (getComputedStyle(point.el).getPropertyValue('--color-primary').trim() || 'currentColor')
    : undefined

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.style.cssText = `position:absolute;left:${point.x}px;top:${point.y}px;line-height:1;font-size:${size}px;white-space:nowrap;opacity:0;will-change:transform,opacity`
    if (typeof content === 'string') el.textContent = content
    else {
      el.className = 'material-symbols-outlined'
      el.textContent = content.icon
      el.style.color = iconColor!
      if (content.filled !== false) el.style.fontVariationSettings = "'FILL' 1"
    }
    host.appendChild(el)
    alive++
    const duration = (options.duration ?? 2200) * (0.9 + Math.random() * 0.2)
    const frames = reduced
      ? [
          { transform: 'translate(-50%, -50%)', opacity: 0 },
          { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.2 },
          { transform: 'translate(-50%, -50%)', opacity: 0 },
        ]
      : floatFrames(
          (options.distance ?? 260) * (0.8 + Math.random() * 0.4),
          (options.sway ?? 20) * (0.7 + Math.random() * 0.6),
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 40,
        )
    const anim = el.animate(frames, { duration: reduced ? 1200 : duration, delay: i * 90, easing: 'linear', fill: 'both' })
    let done = false
    const end = () => {
      if (!done) release(el)
      done = true
    }
    anim.addEventListener('finish', end, { once: true })
    anim.addEventListener('cancel', end, { once: true })
  }
}

/**
 * Floating reactions for a component: `react(event, '🎉')` from the pointer, `react(el, { icon: 'favorite' })` from
 * an element, `react(el, '👏', { count: 5 })` for a handful.
 */
export function useReactions() {
  return { react: fireReaction }
}

/** Removes every reaction at once. Internal, for tests; not exported from index.ts. */
export function __resetReactions() {
  layer?.remove()
  layer = null
  alive = 0
}
