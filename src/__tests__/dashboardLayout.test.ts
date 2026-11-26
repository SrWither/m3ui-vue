import { describe, expect, it } from 'vitest'
import { clampItem, compactLayout, layoutRows, moveItem, normalizeLayout, type DashboardItem } from '../composables/dashboardLayout'

const L = (...items: [string, number, number, number, number, Partial<DashboardItem>?][]): DashboardItem[] =>
  items.map(([id, x, y, w, h, more]) => ({ id, x, y, w, h, ...more }))
const pos = (layout: DashboardItem[]) => Object.fromEntries(layout.map((i) => [i.id, [i.x, i.y, i.w, i.h]]))

describe('dashboardLayout', () => {
  it('clamps to the columns and size limits', () => {
    expect(clampItem({ id: 'a', x: 10, y: -2, w: 5, h: 0 }, 12)).toMatchObject({ x: 7, y: 0, w: 5, h: 1 })
    expect(clampItem({ id: 'a', x: 0, y: 0, w: 1, h: 9, minW: 3, maxH: 4 }, 12)).toMatchObject({ w: 3, h: 4 })
    expect(clampItem({ id: 'a', x: 0, y: 0, w: 20, h: 1 }, 12).w).toBe(12)
  })

  it('compacts items upward, leaving static ones in place', () => {
    expect(pos(compactLayout(L(['a', 0, 3, 4, 2], ['b', 4, 5, 4, 2])))).toEqual({ a: [0, 0, 4, 2], b: [4, 0, 4, 2] })
    expect(pos(compactLayout(L(['s', 0, 2, 6, 1, { static: true }], ['a', 0, 5, 4, 2])))).toEqual({ s: [0, 2, 6, 1], a: [0, 0, 4, 2] })
    expect(pos(compactLayout(L(['s', 0, 1, 6, 1, { static: true }], ['a', 0, 5, 4, 2])))).toEqual({ s: [0, 1, 6, 1], a: [0, 2, 4, 2] })
  })

  it('pushes what an item lands on below it, then compacts', () => {
    // a over b's column: b goes below a
    const moved = moveItem(L(['a', 0, 0, 6, 2], ['b', 6, 0, 6, 2]), 'a', { x: 6 }, 12)
    expect(pos(moved)).toEqual({ a: [6, 0, 6, 2], b: [6, 2, 6, 2] })
    // Order of the array is kept
    expect(moved.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('resizes, pushing neighbors below', () => {
    const out = moveItem(L(['a', 0, 0, 6, 2], ['b', 6, 0, 6, 2], ['c', 0, 2, 12, 1]), 'a', { w: 12 }, 12)
    expect(pos(out)).toEqual({ a: [0, 0, 12, 2], b: [6, 2, 6, 2], c: [0, 4, 12, 1] })
  })

  it('never moves a static item, and keeps others off it', () => {
    const base = L(['s', 0, 0, 12, 1, { static: true }], ['a', 0, 1, 6, 2])
    expect(pos(moveItem(base, 's', { y: 3 }, 12))).toEqual({ s: [0, 0, 12, 1], a: [0, 1, 6, 2] })
    expect(pos(moveItem(base, 'a', { y: 0 }, 12))).toEqual({ s: [0, 0, 12, 1], a: [0, 1, 6, 2] })
  })

  it('normalizes overlapping or out-of-range input', () => {
    const out = normalizeLayout(L(['a', 0, 0, 6, 2], ['b', 2, 0, 6, 2], ['c', 11, 0, 4, 1]), 12)
    expect(pos(out)).toEqual({ a: [0, 0, 6, 2], b: [2, 2, 6, 2], c: [8, 0, 4, 1] })
    expect(layoutRows(out)).toBe(4)
  })
})
