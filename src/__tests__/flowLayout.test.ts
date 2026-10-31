import { describe, it, expect } from 'vitest'
import { layoutLayered, layoutTree } from '../composables/flowLayout'
import { arrowPath, getBezierPath, getSmoothStepPath, getStraightPath, smoothStepPoints } from '../composables/flowPaths'
import type { FlowEdge, FlowNode } from '../composables/useFlow'

const nodes = (...ids: string[]): FlowNode[] => ids.map((id) => ({ id, position: { x: 0, y: 0 } }))
const edges = (...pairs: string[]): FlowEdge[] => pairs.map((p) => {
  const [source, target] = p.split('>')
  return { id: p, source: source!, target: target! }
})
const size = { width: 100, height: 40 }
const overlaps = (r: Record<string, { x: number; y: number }>, w = 100, h = 40) => {
  const v = Object.values(r)
  return v.some((a, i) => v.some((b, j) => i < j && a.x < b.x + w && a.x + w > b.x && a.y < b.y + h && a.y + h > b.y))
}

describe('layoutTree', () => {
  it('centers parents over their children, levels apart', () => {
    const r = layoutTree(nodes('a', 'b', 'c', 'd'), edges('a>b', 'a>c', 'b>d'), { defaultSize: size, gap: 20, levelGap: 50 })
    expect(r.b!.y).toBe(90)
    expect(r.d!.y).toBe(180)
    expect(r.a!.x + 50).toBe(((r.b!.x + 50) + (r.c!.x + 50)) / 2)
    expect(r.d!.x).toBe(r.b!.x)
    expect(overlaps(r)).toBe(false)
  })

  it('runs left to right with LR, and survives cycles and several roots', () => {
    const r = layoutTree(nodes('a', 'b', 'x', 'y'), edges('a>b', 'b>a', 'x>y'), { direction: 'LR', defaultSize: size })
    expect(Object.keys(r).sort()).toEqual(['a', 'b', 'x', 'y'])
    expect(r.b!.x).toBeGreaterThan(r.a!.x)
    expect(r.y!.x).toBeGreaterThan(r.x!.x)
    expect(overlaps(r)).toBe(false)
  })

  it('leaves hidden nodes and children of groups out', () => {
    const ns = [...nodes('a', 'b'), { id: 'h', position: { x: 5, y: 5 }, hidden: true }, { id: 'k', position: { x: 5, y: 5 }, parentId: 'a' }]
    const r = layoutTree(ns, edges('a>b', 'a>h'), { defaultSize: size })
    expect(Object.keys(r).sort()).toEqual(['a', 'b'])
  })
})

describe('layoutLayered', () => {
  it('puts every edge one level onwards, without overlaps', () => {
    const r = layoutLayered(nodes('in', 'a', 'b', 'join', 'out'), edges('in>a', 'in>b', 'a>join', 'b>join', 'join>out'), { direction: 'LR', defaultSize: size, levelGap: 60 })
    expect(r.in!.x).toBe(0)
    expect(r.a!.x).toBe(160)
    expect(r.b!.x).toBe(160)
    expect(r.join!.x).toBe(320)
    expect(r.out!.x).toBe(480)
    // The join lines up between its two inputs
    expect(r.join!.y).toBeCloseTo((r.a!.y + r.b!.y) / 2)
    expect(overlaps(r)).toBe(false)
  })

  it('orders a level to avoid crossings', () => {
    // a→d and b→c would cross if c and d stayed in the order given
    const r = layoutLayered(nodes('a', 'b', 'c', 'd'), edges('a>d', 'b>c'), { defaultSize: size })
    expect(Math.sign(r.a!.x - r.b!.x)).toBe(Math.sign(r.d!.x - r.c!.x))
  })

  it('keeps a lane open for an edge across several levels', () => {
    // a→b→c→d, and a→d skipping two levels: d's long edge must not run under b and c
    const r = layoutLayered(nodes('a', 'b', 'c', 'd', 'x'), edges('a>b', 'b>c', 'c>d', 'a>d', 'x>c'), { direction: 'LR', defaultSize: size, gap: 20 })
    expect(Object.keys(r).sort()).toEqual(['a', 'b', 'c', 'd', 'x'])
    const ys = [r.a!.y, r.d!.y]
    // The straight line from a to d stays clear of b's and c's boxes
    const clear = (n: { y: number }) => Math.min(...ys) + 20 >= n.y + 40 || Math.max(...ys) + 20 <= n.y
    expect(clear(r.b!) || clear(r.c!) || r.a!.y !== r.b!.y).toBe(true)
    expect(overlaps(r)).toBe(false)
  })

  it('lays out a cycle', () => {
    const r = layoutLayered(nodes('a', 'b', 'c'), edges('a>b', 'b>c', 'c>a'), { defaultSize: size })
    expect(r.a!.y).toBeLessThan(r.b!.y)
    expect(r.b!.y).toBeLessThan(r.c!.y)
  })
})

describe('edge paths', () => {
  const ends = { sourceX: 0, sourceY: 0, targetX: 200, targetY: 100 }
  it('bezier leaves and arrives square to the sides, its label halfway', () => {
    const p = getBezierPath({ ...ends, sourcePosition: 'right', targetPosition: 'left' })
    expect(p.path).toBe('M0,0 C100,0 100,100 200,100')
    expect(p.labelX).toBe(100)
    expect(p.labelY).toBe(50)
    expect(p.targetAngle).toBeCloseTo(0)
  })

  it('smoothstep facing sides: one run halfway, rounded corners', () => {
    expect(smoothStepPoints({ ...ends, sourcePosition: 'right', targetPosition: 'left' })).toEqual([[0, 0], [100, 0], [100, 100], [200, 100]])
    const p = getSmoothStepPath({ ...ends, sourcePosition: 'right', targetPosition: 'left', borderRadius: 8 })
    expect(p.path).toContain('Q100,0 100,8')
    expect(p.labelX).toBe(100)
    expect(p.labelY).toBe(50)
  })

  it('smoothstep goes round when the target is behind the source', () => {
    const pts = smoothStepPoints({ sourceX: 200, sourceY: 0, targetX: 0, targetY: 100, sourcePosition: 'right', targetPosition: 'left', offset: 20 })
    expect(pts[1]).toEqual([220, 0])
    expect(pts.at(-2)).toEqual([-20, 100])
    expect(pts.at(-1)).toEqual([0, 100])
  })

  it('smoothstep from a side to a top: a single corner when it can', () => {
    expect(smoothStepPoints({ ...ends, sourcePosition: 'right', targetPosition: 'top' })).toEqual([[0, 0], [200, 0], [200, 100]])
  })

  it('straight lines and arrowheads', () => {
    const p = getStraightPath(ends)
    expect(p.path).toBe('M0,0 L200,100')
    expect(arrowPath(10, 0, 0, 10, true)).toMatch(/^M10,0 L.+ Z$/)
  })
})
