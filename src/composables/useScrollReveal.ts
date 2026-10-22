import { getCurrentInstance, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { motionSprings } from './motion'
import { playSamples, prefersReducedMotion, sampleSpring } from './_springAnimation'

/** How an element enters: from below, from a side, growing, or only fading. */
export type RevealEffect = 'fade-up' | 'fade' | 'scale' | 'slide-left' | 'slide-right'

export interface ScrollRevealOptions {
  /** How it enters (default `'fade-up'`) */
  effect?: RevealEffect
  /** Distance in px for the slide effects (default 24) */
  distance?: number
  /** Delay in ms before it starts (default 0) */
  delay?: number
  /** Extra delay in ms for each next element revealed at the same time, so a list cascades in (default 60) */
  stagger?: number
  /** Reveal only the first time (default `true`); with `false` it hides again once it leaves the screen */
  once?: boolean
  /** How much of the element has to be visible, 0 to 1 (default 0.15) */
  threshold?: number
  /** Grows or shrinks the area that counts as visible, like IntersectionObserver's `rootMargin` (default `'0px'`) */
  rootMargin?: string
  /** Motion scheme of the springs: `'standard'` (default) or `'expressive'` (a little bounce) */
  scheme?: 'standard' | 'expressive'
  /** Pace: M3's fast, default or slow springs (default `'default'`); slow suits large, calm entrances */
  speed?: 'fast' | 'default' | 'slow'
}

const OFFSET: Record<RevealEffect, (d: number) => { x: number; y: number; scale: number }> = {
  'fade-up': (d) => ({ x: 0, y: d, scale: 1 }),
  fade: () => ({ x: 0, y: 0, scale: 1 }),
  scale: () => ({ x: 0, y: 0, scale: 0.92 }),
  'slide-left': (d) => ({ x: d, y: 0, scale: 1 }),
  'slide-right': (d) => ({ x: -d, y: 0, scale: 1 }),
}

const hiddenStyle = (o: ReturnType<(typeof OFFSET)[RevealEffect]>) =>
  ({ opacity: '0', transform: `translate(${o.x}px, ${o.y}px) scale(${o.scale})` })

/**
 * Internal engine shared by `useScrollReveal` and `v-reveal`: one IntersectionObserver for a set of options.
 * Elements are hidden (inline opacity/transform) when observed and play the springs in as they enter; the ones
 * entering together cascade by `stagger`.
 */
export function createReveal(options: ScrollRevealOptions = {}) {
  const { effect = 'fade-up', distance = 24, delay = 0, stagger = 60, once = true, threshold = 0.15, rootMargin = '0px', scheme = 'standard', speed = 'default' } = options
  const offset = OFFSET[effect](distance)
  const springs = motionSprings[scheme]
  const shown = new WeakSet<Element>()
  const anims = new WeakMap<Element, Animation>()
  const reduced = prefersReducedMotion()

  function show(el: HTMLElement, wait: number) {
    shown.add(el)
    anims.get(el)?.cancel()
    // End state inline, then the samples over it: nothing jumps when the animation ends
    el.style.opacity = ''
    el.style.transform = ''
    const move = sampleSpring(0, 1, 0, springs[`${speed}Spatial`], 0.001)
    const fade = sampleSpring(0, 1, 0, springs[`${speed}Effects`], 0.001)
    const n = Math.max(move.length, fade.length)
    const at = (s: number[], i: number) => s[Math.min(i, s.length - 1)]!
    const frames = Array.from({ length: n }, (_, i) => i)
    const anim = playSamples(el, frames, (i) => {
      const m = at(move, i)
      const k = 1 - m
      return {
        opacity: String(at(fade, i)),
        transform: `translate(${offset.x * k}px, ${offset.y * k}px) scale(${1 - (1 - offset.scale) * k})`,
      }
    }, wait)
    if (anim) {
      // Before its delay the animation isn't applying yet: keep it hidden until then
      anim.effect?.updateTiming({ fill: 'backwards' })
      anims.set(el, anim)
    }
  }

  function hide(el: HTMLElement) {
    shown.delete(el)
    anims.get(el)?.cancel()
    Object.assign(el.style, hiddenStyle(offset))
  }

  const observer =
    typeof IntersectionObserver === 'undefined' || reduced
      ? null
      : new IntersectionObserver(
          (entries) => {
            // Cascade in document order among the ones entering in this batch
            const entering = entries
              .filter((e) => e.isIntersecting && !shown.has(e.target))
              .map((e) => e.target as HTMLElement)
              .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
            entering.forEach((el, i) => {
              show(el, delay + i * stagger)
              if (once) observer!.unobserve(el)
            })
            if (!once) {
              for (const e of entries) if (!e.isIntersecting && shown.has(e.target)) hide(e.target as HTMLElement)
            }
          },
          { threshold, rootMargin },
        )

  return {
    observe(el: Element) {
      // Without an observer (server, old browser) or with reduced motion, it's simply there
      if (!observer || shown.has(el)) return
      hide(el as HTMLElement)
      observer.observe(el)
    },
    unobserve(el: Element) {
      observer?.unobserve(el)
      anims.get(el)?.cancel()
    },
    disconnect() {
      observer?.disconnect()
    },
  }
}

type Target = Element | null | undefined | Iterable<Element | null | undefined>

/**
 * Reveals elements as they scroll into view: they fade (and slide or grow) in on M3's springs, cascading when
 * several enter together. Pass an element, a template ref, an array of them, or a getter. Off with reduced motion:
 * everything is simply there. For a single element in a template, `v-reveal` does the same.
 */
export function useScrollReveal(target: MaybeRefOrGetter<Target>, options: ScrollRevealOptions = {}) {
  const reveal = createReveal(options)
  let current: Element[] = []
  const list = (t: Target): Element[] =>
    !t ? [] : t instanceof Element ? [t] : [...t].filter((e): e is Element => !!e)

  watch(
    () => list(toValue(target)),
    (next) => {
      for (const el of current) if (!next.includes(el)) reveal.unobserve(el)
      for (const el of next) if (!current.includes(el)) reveal.observe(el)
      current = next
    },
    { immediate: true, flush: 'post' },
  )
  if (getCurrentInstance()) onBeforeUnmount(() => reveal.disconnect())

  return {
    /** Stops watching (elements already revealed stay) */
    stop: () => reveal.disconnect(),
  }
}
