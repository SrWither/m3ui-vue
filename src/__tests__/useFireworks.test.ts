import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { __resetFireworks, launchFireworks, shapeOutline, useFireworks } from '../composables/useFireworks'

// happy-dom has no 2D canvas: a fake one that records the strokes
let strokes: string[] = []
beforeEach(() => {
  strokes = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      setTransform: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => strokes.push(ctx.strokeStyle),
    }
    return ctx as unknown as CanvasRenderingContext2D
  })
})
afterEach(() => {
  __resetFireworks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.querySelectorAll('canvas').forEach((c) => c.remove())
})

const canvas = () => document.querySelector('canvas')
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('useFireworks', () => {
  it('lays a burst out along the shape: n points, the farthest at 1', () => {
    for (const shape of ['Circle', 'Heart', 'Flower'] as const) {
      const out = shapeOutline(shape, 48)
      expect(out).toHaveLength(96)
      let max = 0
      for (let i = 0; i < out.length; i += 2) max = Math.max(max, Math.hypot(out[i]!, out[i + 1]!))
      expect(max).toBeCloseTo(1, 5)
    }
    // A circle's points all sit on it
    const ring = shapeOutline('Circle', 32)
    for (let i = 0; i < ring.length; i += 2) expect(Math.hypot(ring[i]!, ring[i + 1]!)).toBeGreaterThan(0.97)
  })

  it('launches rockets on the shared canvas in the given colors, and removes it after the last burst', async () => {
    launchFireworks({ count: 2, colors: ['red'] })
    expect(canvas()!.getAttribute('aria-hidden')).toBe('true')
    await wait(200)
    expect(strokes.length).toBeGreaterThan(0)
    expect(new Set(strokes)).toEqual(new Set(['red']))
    // Up to 0.5s of stagger, 1.3s of flight and 2.6s of burst
    await wait(4600)
    expect(canvas()).toBeNull()
  }, 8000)

  it("a classic burst throws streaks out in every direction that fall as they fade", async () => {
    const segments: [number, number, number, number][] = []
    let from: [number, number] = [0, 0]
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function () {
      const ctx = {
        fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, lineCap: 'butt',
        setTransform: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
        moveTo: (x: number, y: number) => { from = [x, y] },
        lineTo: (x: number, y: number) => { segments.push([...from, x, y]) },
        stroke: () => strokes.push(ctx.strokeStyle),
      }
      return ctx as unknown as CanvasRenderingContext2D
    })
    launchFireworks({ count: 1, shapes: ['classic'], colors: ['gold'], size: 100 })
    // The rocket flies about a second, then the burst
    await wait(1700)
    const recent = segments.slice(-400)
    const dx = recent.map((s) => s[2] - s[0])
    const dy = recent.map((s) => s[3] - s[1])
    // Streaks going left and right, and (with gravity winning) more of them going down than up by now
    expect(dx.some((d) => d > 0) && dx.some((d) => d < 0)).toBe(true)
    expect(dy.filter((d) => d > 0).length).toBeGreaterThan(dy.filter((d) => d < 0).length)
    expect(new Set(strokes)).toEqual(new Set(['gold']))
    await wait(3200)
    expect(canvas()).toBeNull()
  }, 8000)

  it('keeps launching with a duration until stop()', async () => {
    const stop = useFireworks().launch({ count: 20, duration: Infinity, colors: ['blue'] })
    await wait(400)
    stop()
    // What's in the air finishes, then the canvas goes
    expect(canvas()).not.toBeNull()
    await wait(4200)
    expect(canvas()).toBeNull()
  }, 8000)

  it('does nothing under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    launchFireworks()
    expect(canvas()).toBeNull()
  })
})
