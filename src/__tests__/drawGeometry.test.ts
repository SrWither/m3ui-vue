import { describe, expect, it } from 'vitest'
import { constrain, eraseAt, hitItem, inLasso, itemBox, strokePath, toDrawSvg, transformItem, type DrawStroke, type DrawItem } from '../composables/drawGeometry'

const line = (x1: number, x2: number, y = 0): DrawStroke => ({
  id: 's', type: 'stroke', pen: 'marker', color: '#000', size: 4,
  points: Array.from({ length: 11 }, (_, i) => [x1 + ((x2 - x1) * i) / 10, y, 1]),
})

describe('drawGeometry', () => {
  it('outlines a stroke, and a dot as a circle', () => {
    expect(strokePath(line(0, 100))).toMatch(/^M.*A.*A.*Z$/)
    expect(strokePath({ ...line(0, 0), points: [[5, 5, 1]] })).toMatch(/a2 2 0 1 0 4 0/)
  })
  it('cuts a stroke in two where the eraser passes, and removes it when all of it is gone', () => {
    const parts = eraseAt(line(0, 100), 50, 0, 3)
    expect(parts).toHaveLength(2)
    expect(parts[0]!.id).toBe('s')
    expect(parts[1]!.id).not.toBe('s')
    expect((parts[0] as DrawStroke).points.every((p) => p[0] < 50)).toBe(true)
    expect(eraseAt(line(0, 100), 50, 30, 3)).toHaveLength(1)
    const s = line(0, 4)
    expect(eraseAt(s, 2, 0, 10)).toEqual([])
  })
  it('leaves an untouched item as the same object', () => {
    const s = line(0, 100)
    expect(eraseAt(s, 50, 40, 3)[0]).toBe(s)
  })
  it('hits shapes by their outline, filled ones inside too', () => {
    const rect: DrawItem = { id: 'r', type: 'shape', shape: 'rect', from: [0, 0], to: [100, 50], color: '#000', size: 2 }
    expect(hitItem(rect, 50, 0)).toBe(true)
    expect(hitItem(rect, 50, 25)).toBe(false)
    expect(hitItem({ ...rect, fill: '#f00' }, 50, 25)).toBe(true)
  })
  it('selects by lasso when most of an item is inside', () => {
    const poly: [number, number][] = [[-10, -10], [60, -10], [60, 10], [-10, 10]]
    expect(inLasso(line(0, 50), poly)).toBe(true)
    expect(inLasso(line(0, 200), poly)).toBe(false)
  })
  it('moves and scales items', () => {
    const s = transformItem(line(0, 10), { dx: 5, sx: 2, sy: 2 }) as DrawStroke
    expect(s.points[10]![0]).toBe(25)
    expect(s.size).toBe(8)
    expect(itemBox(s).x).toBe(1)
  })
  it('snaps a line to 45° and a rect to a square', () => {
    const [x, y] = constrain('line', [0, 0], [10, 9])
    expect(x).toBeCloseTo(y)
    expect(constrain('rect', [0, 0], [10, -4])).toEqual([10, -10])
  })
  it('exports SVG of one page with its background', () => {
    const svg = toDrawSvg([{ ...line(0, 10), page: 1 }, { ...line(0, 10), id: 'b', page: 0 }, { id: 't', type: 'text', at: [0, 0], text: 'a<b', size: 12, color: '#000', page: 1 }], {
      page: 1, box: { x: 0, y: 0, width: 100, height: 100 }, background: '#fff',
    })
    expect(svg.match(/<path/g)).toHaveLength(1)
    expect(svg).toContain('a&lt;b')
    expect(svg).toContain('fill="#fff"')
  })
})
