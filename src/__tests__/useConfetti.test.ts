import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { __resetConfetti, fireConfetti, useConfetti } from '../composables/useConfetti'

// happy-dom has no 2D canvas: a fake one that records what's drawn
let fills: string[] = []
beforeEach(() => {
  fills = []
  vi.stubGlobal('Path2D', class { constructor(public d: string) {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      setTransform: () => {},
      translate: () => {},
      clearRect: () => {},
      fill: () => fills.push(ctx.fillStyle),
    }
    return ctx as unknown as CanvasRenderingContext2D
  })
})
afterEach(() => {
  __resetConfetti()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.querySelectorAll('canvas').forEach((c) => c.remove())
})

const canvas = () => document.querySelector('canvas')
const frames = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('useConfetti', () => {
  it('draws the pieces on one canvas over the page that ignores the pointer and assistive technology', async () => {
    fireConfetti({ x: 100, y: 100 }, { count: 30 })
    const c = canvas()!
    expect(c.getAttribute('aria-hidden')).toBe('true')
    expect(c.style.pointerEvents).toBe('none')
    expect(c.style.position).toBe('fixed')
    await frames(60)
    expect(fills.length).toBeGreaterThanOrEqual(30)
    // A second burst shares the canvas
    fireConfetti({ x: 100, y: 100 }, { count: 5 })
    expect(document.querySelectorAll('canvas')).toHaveLength(1)
  })

  it('takes its colors from the origin\'s theme tokens', async () => {
    const el = document.createElement('div')
    el.style.setProperty('--color-primary', '#c83228')
    el.style.setProperty('--color-tertiary', '#e5b92c')
    document.body.appendChild(el)
    fireConfetti(el, { count: 40 })
    await frames(60)
    expect(new Set(fills)).toEqual(new Set(['#c83228', '#e5b92c']))
    el.remove()
  })

  it('uses the given colors, and removes the canvas once the last piece has fallen', async () => {
    fireConfetti({ x: 10, y: 10 }, { count: 10, colors: ['red'] })
    await frames(60)
    expect(new Set(fills)).toEqual(new Set(['red']))
    await frames(4000)
    expect(canvas()).toBeNull()
  }, 8000)

  it('does nothing under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    fireConfetti({ x: 10, y: 10 })
    expect(canvas()).toBeNull()
  })

  it('fire() takes an event, an element, a point or just options', async () => {
    const { fire } = useConfetti()
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.addEventListener('click', (e) => fire(e, { count: 3, colors: ['blue'] }))
    button.click()
    fire({ from: 'top', count: 3, colors: ['green'] })
    await frames(60)
    expect(new Set(fills)).toEqual(new Set(['blue', 'green']))
    button.remove()
  })
})
