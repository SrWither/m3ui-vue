import { describe, it, expect, afterEach, vi } from 'vitest'
import { __resetReactions, fireReaction, useReactions } from '../composables/useReactions'

afterEach(() => {
  __resetReactions()
  vi.unstubAllGlobals()
})

const layer = () => document.querySelector<HTMLElement>('body > div[aria-hidden="true"]')
const items = () => Array.from(layer()?.querySelectorAll('span') ?? [])

describe('useReactions', () => {
  it('floats an emoji up from the point in a layer that ignores the pointer and assistive technology', () => {
    fireReaction({ x: 120, y: 300 }, '🎉')
    const l = layer()!
    expect(l.style.pointerEvents).toBe('none')
    expect(l.style.position).toBe('fixed')
    const [el] = items()
    expect(el!.textContent).toBe('🎉')
    expect(el!.style.left).toBe('120px')
    expect(el!.style.top).toBe('300px')
    const anim = el!.getAnimations()[0]!
    const frames = anim.effect!.getKeyframes!()
    // It rises: the last frame is well above the first
    const y = (f: Keyframe) => Number(/translate\([-\d.]+px, ([-\d.]+)px\)/.exec(String(f.transform))![1])
    expect(y(frames.at(-1)!)).toBeLessThan(-150)
  })

  it('renders an icon filled, in the theme primary where it starts, and removes everything when done', () => {
    const el = document.createElement('div')
    el.style.setProperty('--color-primary', '#c83228')
    document.body.appendChild(el)
    useReactions().react(el, { icon: 'favorite' }, { count: 3 })
    const spans = items()
    expect(spans).toHaveLength(3)
    expect(spans[0]!.className).toBe('material-symbols-outlined')
    expect(spans[0]!.textContent).toBe('favorite')
    expect(spans[0]!.style.color).toBe('#c83228')
    expect(spans[0]!.style.fontVariationSettings).toContain('FILL')
    for (const s of spans) s.getAnimations().forEach((a) => a.finish())
    expect(layer()).toBeNull()
    el.remove()
  })

  it('only fades in place under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    fireReaction({ x: 10, y: 10 }, '👍')
    const frames = items()[0]!.getAnimations()[0]!.effect!.getKeyframes!()
    expect(frames.every((f) => f.transform === 'translate(-50%, -50%)')).toBe(true)
  })
})
