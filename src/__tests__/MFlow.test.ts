import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MFlow from '../components/MFlow.vue'
import MFlowHandle from '../components/MFlowHandle.vue'
import type { FlowEdge, FlowNode, FlowXY } from '../composables/useFlow'
import { routePoints, pointsToRoute } from '../composables/flowPaths'

// happy-dom has no layout: the canvas is 800×600 at the page's corner, every node 180×60
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(180)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60)
  // Nodes measure their handles against their own rect: put each handle on its side of a 180×60 node
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = (x: number, y: number, w: number, h: number) => ({ left: x, top: y, x, y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }) as DOMRect
    if (this.classList.contains('m3-flow')) return r(0, 0, 800, 600)
    if (this.classList.contains('m3-flow-handle')) {
      const c = this.className
      const [x, y] = c.includes('left-1/2') && c.includes('top-1/2') ? [90, 30] : c.includes('right-0') ? [180, 30] : c.includes('bottom-0') ? [90, 60] : c.includes('top-1/2') ? [0, 30] : [90, 0]
      return r(x - 5, y - 5, 10, 10)
    }
    return r(0, 0, 0, 0)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const N = (id: string, x: number, y: number, extra: Partial<FlowNode> = {}): FlowNode => ({ id, position: { x, y }, data: { label: id.toUpperCase() }, ...extra })

async function flow(props: Record<string, unknown> = {}) {
  const w = mount(MFlow, { props: { nodes: [N('a', 0, 0), N('b', 300, 0)], edges: [{ id: 'e1', source: 'a', target: 'b' }], animate: false, ...props }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const node = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-flow-node="${id}"]`).element as HTMLElement
// happy-dom's WheelEvent drops the modifier keys and the position
function wheel(el: EventTarget, init: { deltaX?: number; deltaY?: number; ctrlKey?: boolean; clientX?: number; clientY?: number }) {
  const e = new WheelEvent('wheel', { deltaX: init.deltaX ?? 0, deltaY: init.deltaY ?? 0, bubbles: true, cancelable: true })
  for (const k of ['ctrlKey', 'clientX', 'clientY'] as const) Object.defineProperty(e, k, { value: init[k] ?? (k === 'ctrlKey' ? false : 0) })
  el.dispatchEvent(e)
}
function pointer(el: EventTarget, type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, ...extra }))
}

describe('MFlow', () => {
  it('renders nodes where they are and an edge between them', async () => {
    const w = await flow()
    expect(w.findAll('.m3-flow-node')).toHaveLength(2)
    expect(node(w, 'b').style.transform).toBe('translate(300px, 0px)')
    const d = w.find('.m3-flow-edge path').attributes('d')
    // a's right side (180, 30) to b's left side (300, 30)
    expect(d).toMatch(/^M180,30 C/)
    expect(d).toMatch(/300,30$/)
  })
  it('dragging a node moves it with the pointer and commits once on drop', async () => {
    const w = await flow()
    const a = node(w, 'a')
    pointer(a, 'pointerdown', 90, 30)
    pointer(window, 'pointermove', 120, 40)
    pointer(window, 'pointermove', 190, 130)
    await nextTick()
    expect(a.style.transform).toBe('translate(100px, 100px)')
    expect(w.emitted('update:nodes')).toBeUndefined()
    pointer(window, 'pointerup', 190, 130)
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    expect(nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 100, y: 100 })
    expect(w.emitted('node-drag-stop')).toHaveLength(1)
  })

  it('snaps to the grid', async () => {
    const w = await flow({ snapToGrid: true, gridSize: 25 })
    pointer(node(w, 'a'), 'pointerdown', 90, 30)
    pointer(window, 'pointermove', 150, 70)
    pointer(window, 'pointerup', 150, 70)
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    expect(nodes[0]!.position).toEqual({ x: 50, y: 50 })
  })

  it('selects on click, adds with Shift, clears on the background; Delete removes nodes with their edges', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 0, 300)], edges: [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' }] })
    pointer(node(w, 'a'), 'pointerdown', 10, 10)
    pointer(window, 'pointerup', 10, 10)
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['a'], edges: [] })
    pointer(node(w, 'c'), 'pointerdown', 10, 310, { shiftKey: true })
    pointer(window, 'pointerup', 10, 310, { shiftKey: true })
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['a', 'c'], edges: [] })
    await w.trigger('keydown', { key: 'Delete' })
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(nodes.map((n) => n.id)).toEqual(['b'])
    expect(edges).toEqual([])
    expect((w.emitted('delete')![0]![0] as { nodes: FlowNode[] }).nodes.map((n) => n.id)).toEqual(['a', 'c'])
    pointer(w.element, 'pointerdown', 600, 500)
    pointer(window, 'pointerup', 600, 500)
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: [], edges: [] })
  })

  it('undoes and redoes, including changes made by the parent', async () => {
    const w = await flow()
    pointer(node(w, 'a'), 'pointerdown', 90, 30)
    pointer(window, 'pointermove', 190, 30)
    pointer(window, 'pointerup', 190, 30)
    await w.setProps({ nodes: w.emitted('update:nodes')!.at(-1)![0] })
    // The parent adds a node
    await w.setProps({ nodes: [...(w.props('nodes') as FlowNode[]), N('c', 0, 300)] })
    await flushPromises()
    await w.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]).map((n) => n.id)).toEqual(['a', 'b'])
    await w.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[])[0]!.position).toEqual({ x: 0, y: 0 })
    await w.trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[])[0]!.position).toEqual({ x: 100, y: 0 })
  })

  it('connects a source handle to another node, once, and only when valid', async () => {
    const isValidConnection = vi.fn(() => true)
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edges: [{ id: 'e1', source: 'a', target: 'b' }], isValidConnection })
    const handle = node(w, 'a').querySelector('[data-flow-handle="source"]')!
    // Dropped over c's body: snaps to c's target handle
    pointer(handle, 'pointerdown', 180, 30)
    pointer(window, 'pointermove', 350, 220)
    await nextTick()
    expect(w.find('.m3-flow-connection-line').exists()).toBe(true)
    pointer(window, 'pointerup', 350, 220)
    expect(w.emitted('connect')![0]![0]).toEqual({ source: 'a', sourceHandle: null, target: 'c', targetHandle: null })
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(edges.map((e) => [e.source, e.target])).toEqual([['a', 'b'], ['a', 'c']])
    await w.setProps({ edges })
    // a → b again is a duplicate
    pointer(handle, 'pointerdown', 180, 30)
    pointer(window, 'pointermove', 350, 20)
    pointer(window, 'pointerup', 350, 20)
    expect(w.emitted('connect')).toHaveLength(1)
    const end = w.emitted('connect-end')!.at(-1)![0] as { connection: unknown; position: { x: number; y: number } }
    expect(end.connection).toBeNull()
    // Dropped on nothing: the spot is reported, to offer a node there
    pointer(handle, 'pointerdown', 180, 30)
    pointer(window, 'pointermove', 600, 500)
    pointer(window, 'pointerup', 600, 500)
    expect((w.emitted('connect-end')!.at(-1)![0] as { position: unknown }).position).toEqual({ x: 600, y: 500 })
    isValidConnection.mockReturnValue(false)
    pointer(handle, 'pointerdown', 180, 30)
    pointer(window, 'pointermove', 350, 220)
    pointer(window, 'pointerup', 350, 220)
    expect(w.emitted('connect')).toHaveLength(1)
  })

  it('moves the selection with the arrow keys, one undo step for a run of nudges', async () => {
    const w = await flow({ selection: { nodes: ['a'], edges: [] } })
    for (let i = 0; i < 3; i++) await w.trigger('keydown', { key: 'ArrowRight' })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[])[0]!.position).toEqual({ x: 30, y: 0 })
    await w.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[])[0]!.position).toEqual({ x: 0, y: 0 })
  })

  it('pans with the wheel and zooms about the pointer with Ctrl + wheel', async () => {
    const w = await flow()
    wheel(w.element, { deltaX: 10, deltaY: 20 })
    expect(w.emitted('update:viewport')!.at(-1)![0]).toEqual({ x: -10, y: -20, zoom: 1 })
    wheel(w.element, { deltaY: -50, ctrlKey: true, clientX: 400, clientY: 300 })
    const v = w.emitted('update:viewport')!.at(-1)![0] as { x: number; y: number; zoom: number }
    expect(v.zoom).toBeCloseTo(Math.exp(0.5))
    // The flow point under the pointer stays there
    expect((400 - v.x) / v.zoom).toBeCloseTo(410)
    expect((300 - v.y) / v.zoom).toBeCloseTo(320)
  })

  it('Shift + drag on the background selects the nodes it touches', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 0, 300)] })
    pointer(w.element, 'pointerdown', 250, -10, { shiftKey: true })
    pointer(window, 'pointermove', 500, 100, { shiftKey: true })
    await nextTick()
    expect(w.find('.m3-flow-marquee').exists()).toBe(true)
    pointer(window, 'pointerup', 500, 100, { shiftKey: true })
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['b'], edges: [] })
  })

  it('a group carries its children, and dropIntoGroups moves a node into one', async () => {
    const nodes = [N('g', 0, 0, { type: 'group', width: 400, height: 300 }), N('k', 20, 50, { parentId: 'g' }), N('x', 600, 0)]
    const w = await flow({ nodes, edges: [], dropIntoGroups: true })
    expect(node(w, 'k').style.transform).toBe('translate(20px, 50px)')
    pointer(node(w, 'g'), 'pointerdown', 300, 250)
    pointer(window, 'pointermove', 400, 300)
    await nextTick()
    expect(node(w, 'k').style.transform).toBe('translate(120px, 100px)')
    pointer(window, 'pointerup', 400, 300)
    await w.setProps({ nodes: w.emitted('update:nodes')!.at(-1)![0] })
    // x dropped inside the group (now at 100, 50)
    pointer(node(w, 'x'), 'pointerdown', 610, 10)
    pointer(window, 'pointermove', 200, 200)
    pointer(window, 'pointerup', 200, 200)
    const moved = (w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]).find((n) => n.id === 'x')!
    expect(moved.parentId).toBe('g')
    expect(moved.position).toEqual({ x: 190 - 100, y: 190 - 50 })
  })

  it('copies and pastes nodes with the edges between them, under new ids', async () => {
    const w = await flow({ selection: { nodes: ['a', 'b'], edges: [] } })
    await w.trigger('keydown', { key: 'c', ctrlKey: true })
    await w.trigger('keydown', { key: 'v', ctrlKey: true })
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(nodes).toHaveLength(4)
    const [c, d] = nodes.slice(2)
    expect(c!.id).not.toBe('a')
    expect(c!.position).toEqual({ x: 40, y: 40 })
    expect(edges.at(-1)).toMatchObject({ source: c!.id, target: d!.id })
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: [c!.id, d!.id], edges: [edges.at(-1)!.id] })
  })

  it('pastes at the pointer on the grid with snapToGrid', async () => {
    const w = await flow({ selection: { nodes: ['a'], edges: [] }, snapToGrid: true, gridSize: 20 })
    await w.trigger('keydown', { key: 'c', ctrlKey: true })
    // The pointer over the canvas at a spot off the grid: the copy lands a whole number of steps away
    pointer(w.element, 'pointerenter', 0, 0)
    pointer(w.element, 'pointermove', 133, 77)
    w.vm.paste({ x: 133, y: 77 })
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    expect(nodes.at(-1)!.position).toEqual({ x: 140, y: 80 })
  })

  it('edgeSpacing moves overlapping parallel step runs from different sources apart, not ones from the same source', async () => {
    const run = (w: ReturnType<typeof mount>, id: string) => {
      const d = w.find(`[data-flow-edge="${id}"] .m3-flow-edge-line`).attributes('d')
      // The vertical run: the x where the path turns down or up (the first corner's x)
      return Number(d.match(/^M[\d.-]+,[\d.-]+ L([\d.-]+),/)![1])
    }
    const nodes = [N('a', 0, 0), N('c', 0, 100), N('b', 300, 200), N('d', 300, -100), N('e', 300, 300)]
    const step = { type: 'smoothstep' as const, markerEnd: 'none' as const }
    // a → b runs down x = 240 from 30 to 230, c → d up from 130 to -70: they overlap from 30 to 130
    const edges: FlowEdge[] = [{ id: 'ab', source: 'a', target: 'b', ...step }, { id: 'cd', source: 'c', target: 'd', ...step }]
    const off = await flow({ nodes, edges })
    expect(run(off, 'ab') + 8).toBe(run(off, 'cd') + 8)
    off.unmount()
    const on = await flow({ nodes, edges, edgeSpacing: 10 })
    const xs = [run(on, 'ab'), run(on, 'cd')].map((x) => x + 8).sort()
    expect(xs[1]! - xs[0]!).toBe(10)
    // getEdgePath gives what's drawn
    expect((on.vm as unknown as { getEdgePath(id: string): string }).getEdgePath('cd')).toBe(on.find('[data-flow-edge="cd"] .m3-flow-edge-line').attributes('d'))
    on.unmount()
    // From the same source they may share it
    const same = await flow({ nodes, edges: [{ id: 'ab', source: 'a', target: 'b', ...step }, { id: 'ae', source: 'a', target: 'e', ...step }], edgeSpacing: 10 })
    expect(run(same, 'ab')).toBe(run(same, 'ae'))
    same.unmount()
  })

  it('Ctrl+D duplicates the selection without touching the clipboard', async () => {
    const w = await flow({ selection: { nodes: ['a'], edges: [] } })
    await w.trigger('keydown', { key: 'c', ctrlKey: true })
    await w.setProps({ selection: { nodes: ['a', 'b'], edges: [] } })
    await w.trigger('keydown', { key: 'd', ctrlKey: true })
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(nodes).toHaveLength(4)
    expect(nodes[2]!.position).toEqual({ x: 40, y: 40 })
    expect(edges.at(-1)).toMatchObject({ source: nodes[2]!.id, target: nodes[3]!.id })
    // The clipboard still holds only a
    await w.trigger('keydown', { key: 'v', ctrlKey: true })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[])).toHaveLength(5)
  })

  it('a selected edge\'s end can be dragged to another node', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], selection: { nodes: [], edges: ['e1'] } })
    const end = w.find('[data-flow-reconnect="target"]').element
    pointer(end, 'pointerdown', 300, 30)
    pointer(window, 'pointermove', 350, 230)
    pointer(window, 'pointerup', 350, 230)
    expect((w.emitted('reconnect')![0]![0] as { connection: unknown }).connection).toEqual({ source: 'a', sourceHandle: null, target: 'c', targetHandle: null })
    expect((w.emitted('update:edges')!.at(-1)![0] as FlowEdge[])[0]).toMatchObject({ id: 'e1', source: 'a', target: 'c' })
  })

  it('lines a dragged node up with others within a few px, and shows the guide', async () => {
    const w = await flow()
    pointer(node(w, 'a'), 'pointerdown', 90, 30)
    pointer(window, 'pointermove', 90, 230)
    pointer(window, 'pointermove', 393, 233)
    await nextTick()
    // Its left edge snaps to b's (300) from 303
    expect(node(w, 'a').style.transform).toBe('translate(300px, 203px)')
    expect(w.findAll('line')).toHaveLength(1)
    pointer(window, 'pointerup', 393, 233)
  })

  it('lays the nodes out as a tree with layout="tree"', async () => {
    const nodes = [N('root', 0, 0), N('l', 0, 0), N('r', 0, 0)]
    const edges = [{ id: '1', source: 'root', target: 'l' }, { id: '2', source: 'root', target: 'r' }]
    const w = await flow({ nodes, edges, layout: 'tree', direction: 'vertical', layoutOptions: { gap: 20, levelGap: 40 } })
    const out = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    const at = (id: string) => out.find((n) => n.id === id)!.position
    expect(at('l')).toEqual({ x: 0, y: 100 })
    expect(at('r')).toEqual({ x: 200, y: 100 })
    expect(at('root')).toEqual({ x: 100, y: 0 })
  })

  it('springs a node to a position set from outside', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const w = await flow({ animate: true })
    await w.setProps({ nodes: [N('a', 200, 0), N('b', 300, 0)] })
    expect(node(w, 'a').style.transform).toBe('translate(0px, 0px)')
    vi.advanceTimersByTime(100)
    await nextTick()
    const mid = parseFloat(node(w, 'a').style.transform.slice(10))
    expect(mid).toBeGreaterThan(20)
    expect(mid).toBeLessThan(200)
    vi.advanceTimersByTime(1500)
    await nextTick()
    expect(node(w, 'a').style.transform).toBe('translate(200px, 0px)')
    vi.useRealTimers()
  })
  it('a node can be dragged out of a group that wraps its children', async () => {
    // The group has no size: it wraps k (20..200 × 50..110) plus padding, about 224 × 134
    const nodes = [N('g', 0, 0, { type: 'group' }), N('k', 20, 50, { parentId: 'g' })]
    const w = await flow({ nodes, edges: [], dropIntoGroups: true })
    pointer(node(w, 'k'), 'pointerdown', 30, 60)
    pointer(window, 'pointermove', 300, 300)
    await nextTick()
    // The group doesn't follow it while dragged
    expect(node(w, 'g').style.width).toBe('224px')
    pointer(window, 'pointerup', 400, 400)
    const k = (w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]).find((n) => n.id === 'k')!
    expect(k.parentId).toBeUndefined()
    expect(k.position).toEqual({ x: 290, y: 290 })
  })
  it('disconnects: the × on a selected edge, an edge end dropped on nothing, an input pulled off', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edges: [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'a', target: 'c' }], selection: { nodes: [], edges: ['e1'] } })
    await nextTick()
    // The click of the tap that selected the edge lands on the × that appeared under the finger: it keeps the edge
    w.find('[data-flow-edge-delete="e1"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    expect(w.emitted('update:edges')).toBeUndefined()
    pointer(w.find('[data-flow-edge-delete="e1"]').element, 'pointerdown', 240, 30)
    expect((w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]).map((e) => e.id)).toEqual(['e2'])
    await w.setProps({ edges: w.emitted('update:edges')!.at(-1)![0] })
    // c's input has e2: dragging from it pulls e2 off; dropped on nothing it's gone
    const input = node(w, 'c').querySelector('[data-flow-handle="target"]')!
    pointer(input, 'pointerdown', 300, 230)
    pointer(window, 'pointermove', 600, 500)
    pointer(window, 'pointerup', 600, 500)
    expect(w.emitted('update:edges')!.at(-1)![0]).toEqual([])
    expect(w.emitted('connect')).toBeUndefined()
  })

  it('an input pulled off and dropped on another node moves the edge there', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edges: [{ id: 'e1', source: 'a', target: 'b' }] })
    pointer(node(w, 'b').querySelector('[data-flow-handle="target"]')!, 'pointerdown', 300, 30)
    pointer(window, 'pointermove', 350, 230)
    pointer(window, 'pointerup', 350, 230)
    expect((w.emitted('update:edges')!.at(-1)![0] as FlowEdge[])[0]).toMatchObject({ id: 'e1', source: 'a', target: 'c' })
  })
  it('beforeDelete can refuse, or confirm later', async () => {
    let answer: (v: boolean) => void = () => {}
    const beforeDelete = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(new Promise<boolean>((r) => (answer = r)))
    const w = await flow({ selection: { nodes: ['a'], edges: [] }, beforeDelete })
    await w.trigger('keydown', { key: 'Delete' })
    expect(beforeDelete).toHaveBeenCalledWith({ nodes: [expect.objectContaining({ id: 'a' })], edges: [expect.objectContaining({ id: 'e1' })] })
    expect(w.emitted('update:nodes')).toBeUndefined()
    await w.trigger('keydown', { key: 'Delete' })
    expect(w.emitted('update:nodes')).toBeUndefined()
    answer(true)
    await flushPromises()
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]).map((n) => n.id)).toEqual(['b'])
    expect(w.emitted('delete')).toHaveLength(1)
  })
  it('a lone node dropped onto an edge splices into it, in one undo step', async () => {
    // a (0..180) → c (600..780) runs along y = 30; b starts below, unconnected
    const w = await flow({ nodes: [N('a', 0, 0), N('c', 600, 0), N('b', 300, 300)], edges: [{ id: 'e1', source: 'a', target: 'c', type: 'straight', animated: true, label: 'x' }] })
    pointer(node(w, 'b'), 'pointerdown', 390, 330)
    pointer(window, 'pointermove', 390, 30)
    await nextTick()
    // Lit up while over it
    expect(w.find('[data-flow-edge="e1"] .m3-flow-edge-halo').exists()).toBe(true)
    expect(w.find('[data-flow-edge="e1"] path:nth-child(3)').attributes('stroke-width')).toBe('4')
    pointer(window, 'pointerup', 390, 30)
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(edges.map((e) => [e.source, e.target])).toEqual([['a', 'b'], ['b', 'c']])
    // The old edge's look, not its label
    expect(edges.every((e) => e.type === 'straight' && e.animated && !e.label)).toBe(true)
    expect((w.emitted('insert')![0]![0] as { edge: FlowEdge }).edge.id).toBe('e1')
    await w.setProps({ nodes: w.emitted('update:nodes')!.at(-1)![0], edges })
    await w.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]).map((e) => e.id)).toEqual(['e1'])
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]).find((n) => n.id === 'b')!.position).toEqual({ x: 300, y: 300 })
  })

  it('a node that already has connections, or insertOnEdge off, just moves', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('c', 600, 0), N('b', 300, 300), N('d', 300, 500)], edges: [{ id: 'e1', source: 'a', target: 'c', type: 'straight' }, { id: 'e2', source: 'b', target: 'd' }] })
    pointer(node(w, 'b'), 'pointerdown', 390, 330)
    pointer(window, 'pointermove', 390, 30)
    pointer(window, 'pointerup', 390, 30)
    expect(w.emitted('insert')).toBeUndefined()
    expect(w.emitted('update:edges')).toBeUndefined()
    const off = await flow({ nodes: [N('a', 0, 0), N('c', 600, 0), N('b', 300, 300)], edges: [{ id: 'e1', source: 'a', target: 'c', type: 'straight' }], insertOnEdge: false })
    pointer(node(off, 'b'), 'pointerdown', 390, 330)
    pointer(window, 'pointermove', 390, 30)
    pointer(window, 'pointerup', 390, 30)
    expect(off.emitted('insert')).toBeUndefined()
  })
  it('on touch, a long press on the background starts a selection box', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 0, 300)] })
    pointer(w.element, 'pointerdown', 250, -10, { pointerType: 'touch' })
    vi.advanceTimersByTime(500)
    pointer(window, 'pointermove', 500, 100, { pointerType: 'touch' })
    pointer(window, 'pointerup', 500, 100, { pointerType: 'touch' })
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['b'], edges: [] })
    expect(w.emitted('update:viewport')).toBeUndefined()
    vi.useRealTimers()
  })
  it('after a pinch, the finger left on pans, and the next single finger pans without zooming', async () => {
    const w = await flow()
    const touch = (el: EventTarget, type: string, id: number, x: number, y: number) => pointer(el, type, x, y, { pointerType: 'touch', pointerId: id })
    touch(w.element, 'pointerdown', 1, 300, 400)
    touch(w.element, 'pointerdown', 2, 500, 400)
    touch(window, 'pointermove', 2, 700, 400)
    const zoom = (w.emitted('update:viewport')!.at(-1)![0] as { zoom: number }).zoom
    expect(zoom).toBeCloseTo(2)
    // One finger lifts: the other keeps panning
    touch(window, 'pointerup', 1, 300, 400)
    const before = w.emitted('update:viewport')!.at(-1)![0] as { x: number; y: number; zoom: number }
    touch(window, 'pointermove', 2, 700, 450)
    expect(w.emitted('update:viewport')!.at(-1)![0]).toEqual({ x: before.x, y: before.y + 50, zoom })
    touch(window, 'pointerup', 2, 700, 450)
    // A fresh single finger is a pan, not a pinch against a finger that's gone
    const start = w.emitted('update:viewport')!.at(-1)![0] as { x: number; y: number; zoom: number }
    touch(w.element, 'pointerdown', 3, 400, 400)
    touch(window, 'pointermove', 3, 460, 400)
    expect(w.emitted('update:viewport')!.at(-1)![0]).toEqual({ x: start.x + 60, y: start.y, zoom })
    touch(window, 'pointerup', 3, 460, 400)
  })
  it('edgesReroutable: dragging a selected step edge\'s segment gives it a route, which moves with both its nodes', async () => {
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b', type: 'smoothstep' }]
    const w = await flow({ edges, edgesReroutable: true, selection: { nodes: [], edges: ['e1'] } })
    await nextTick()
    const grip = w.find('[data-flow-segment="0"]')
    expect(grip.exists()).toBe(true)
    pointer(grip.element, 'pointerdown', 240, 30)
    pointer(window, 'pointermove', 240, 60)
    pointer(window, 'pointermove', 240, 90)
    pointer(window, 'pointerup', 240, 90)
    const out = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    // A jog a grid step from each handle, running where the pointer let go
    expect(out[0]!.route).toEqual([200, 90, 280])
    expect(w.emitted('reroute')![0]![0]).toMatchObject({ id: 'e1', route: [200, 90, 280] })
    await w.setProps({ edges: out })
    expect(w.find('.m3-flow-edge-line').attributes('d')).toMatch(/^M180,30 L/)
  })
  it('a segment grip moves out from under the delete button', async () => {
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b', type: 'smoothstep' }]
    const w = await flow({ edges, edgesReroutable: true, selection: { nodes: [], edges: ['e1'] } })
    await nextTick()
    // The × sits at (240, 30), 40px wide with its hit area: the grip of the one segment (180 → 300) slides clear of it
    const grip = w.find('[data-flow-segment="0"]')
    const cx = Number(grip.attributes('x')) + 9
    expect(Math.abs(cx - 240)).toBeGreaterThanOrEqual(20 + 9)
    expect(cx).toBeGreaterThan(180)
    expect(cx).toBeLessThan(300)
  })
  it('snapToGrid puts a node\'s position plus its gridOffset on the grid', async () => {
    const w = await flow({ nodes: [N('a', 10, 10, { gridOffset: { x: 10, y: 10 } }), N('b', 300, 0)], snapToGrid: true, gridSize: 20 })
    pointer(node(w, 'a'), 'pointerdown', 100, 40)
    pointer(window, 'pointermove', 140, 80)
    pointer(window, 'pointermove', 203, 143)
    pointer(window, 'pointerup', 203, 143)
    const nodes = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    // Its middle (position + 10) sits on the 20px grid
    expect(nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 110, y: 110 })
  })
  it('getEdgeAt finds the edge under a point, where on it, and which way it runs', async () => {
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b', type: 'smoothstep' }]
    const w = await flow({ edges, snapToGrid: true, gridSize: 20 })
    const ctx = w.vm as unknown as { getEdgeAt: (p: FlowXY, o?: object) => unknown }
    expect(ctx.getEdgeAt({ x: 243, y: 34 })).toMatchObject({ edge: { id: 'e1' }, position: { x: 240, y: 30 }, direction: 'right' })
    expect(ctx.getEdgeAt({ x: 243, y: 60 })).toBeNull()
    expect(ctx.getEdgeAt({ x: 243, y: 34 }, { ignore: (e: FlowEdge) => e.id === 'e1' })).toBeNull()
  })
  it('a tap on a handle selects its node; a drag from it still connects', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)] })
    const out = w.find('[data-flow-node="a"] [data-flow-handle="source"]').element
    pointer(out, 'pointerdown', 180, 30)
    pointer(window, 'pointerup', 181, 30)
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['a'], edges: [] })
    expect(w.emitted('connect')).toBeUndefined()
    // b's input already has e1: tapped (not pulled), it selects b and leaves e1 alone
    pointer(w.find('[data-flow-node="b"] [data-flow-handle="target"]').element, 'pointerdown', 300, 30)
    pointer(window, 'pointerup', 300, 30)
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['b'], edges: [] })
    expect(w.emitted('update:edges')).toBeUndefined()
  })
  it('content in a node that focuses itself on pointerdown keeps its focus; the canvas still takes it elsewhere', async () => {
    const w = mount(MFlow, {
      props: { nodes: [N('a', 0, 0, { type: 'pad' })], edges: [], animate: false },
      slots: { 'node-pad': `<template #node-pad><div class="pad" data-flow-nodrag tabindex="0"><button class="key" @pointerdown="$event.currentTarget.closest('.pad').focus()">Up</button></div></template>` },
      attachTo: document.body,
    })
    await flushPromises()
    const pad = w.find('.pad').element as HTMLElement
    pointer(w.find('.key').element, 'pointerdown', 10, 10)
    expect(document.activeElement).toBe(pad)
    pointer(window, 'pointerup', 10, 10)
    // On the node itself (not its own content) or the pane, the canvas takes the focus as before
    pointer(node(w, 'a'), 'pointerdown', 5, 5)
    pointer(window, 'pointerup', 5, 5)
    expect(document.activeElement).not.toBe(pad)
    expect(w.element.contains(document.activeElement)).toBe(true)
    w.unmount()
  })
  it("a handle at position 'auto' leaves on the side facing the edge's other end", async () => {
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b', type: 'step', markerEnd: 'none' }]
    const w = mount(MFlow, {
      props: { nodes: [N('a', 0, 0, { type: 'dot' }), N('b', 300, 200)], edges, animate: false },
      slots: { 'node-dot': `<template #node-dot><div style="width:180px;height:60px"><MFlowHandle type="source" position="auto" /></div></template>` },
      global: { components: { MFlowHandle } },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
    // From the middle of a (90, 30) toward b's left side (300, 230): it goes right first
    expect(w.find('.m3-flow-edge-line').attributes('d')).toMatch(/^M90,30 L\d+/)
    const first = () => w.find('.m3-flow-edge-line').attributes('d').match(/^M90,30 L(-?[\d.]+),(-?[\d.]+)/)!
    expect(Number(first()[1])).toBeGreaterThan(90)
    // b far below and only a little to the right: it goes down first
    await w.setProps({ nodes: [N('a', 0, 0, { type: 'dot' }), N('b', 120, 600)] })
    await nextTick()
    expect(Number(first()[1])).toBe(90)
    expect(Number(first()[2])).toBeGreaterThan(30)
    // An edge can ask for its side: up first, whatever the other end
    await w.setProps({ edges: [{ ...edges[0]!, sourcePosition: 'top' as const }] })
    await nextTick()
    expect(Number(first()[1])).toBe(90)
    expect(Number(first()[2])).toBeLessThan(30)
  })
  it('routePoints / pointsToRoute round-trip, and the ends stretch when a node moves', () => {
    const ends = { sourceX: 0, sourceY: 0, sourcePosition: 'right' as const, targetX: 200, targetY: 100, targetPosition: 'left' as const }
    const pts = routePoints({ ...ends, route: [60, 40, 140] })
    expect(pts).toEqual([[0, 0], [60, 0], [60, 40], [140, 40], [140, 100], [200, 100]])
    expect(pointsToRoute(pts, 'right', 'left')).toEqual([60, 40, 140])
    expect(pointsToRoute(pts, 'right')).toEqual([60, 40, 140, 100])
    // The target went up: the last leg still arrives level with it
    expect(routePoints({ ...ends, targetY: -20, route: [60, 40, 140] }).at(-2)).toEqual([140, -20])
  })
  it('a pinch that starts on a node zooms without selecting it; a tap on a node still selects it', async () => {
    const w = await flow()
    const touch = (el: EventTarget, type: string, id: number, x: number, y: number) => pointer(el, type, x, y, { pointerType: 'touch', pointerId: id })
    touch(node(w, 'a'), 'pointerdown', 1, 60, 30)
    touch(w.element, 'pointerdown', 2, 260, 30)
    touch(window, 'pointermove', 2, 460, 30)
    touch(window, 'pointerup', 1, 60, 30)
    touch(window, 'pointerup', 2, 460, 30)
    expect(w.emitted('update:selection')).toBeUndefined()
    touch(node(w, 'b'), 'pointerdown', 3, 360, 30)
    touch(window, 'pointerup', 3, 360, 30)
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['b'], edges: [] })
  })
  it('a node spliced in without room pushes the next one, and what comes after it, along', async () => {
    // a (0..180) → c (260..440) → d (600..): b (180 wide) can't fit between a and c with 48px each side
    const nodes = [N('a', 0, 0), N('c', 260, 0), N('d', 600, 0), N('b', 100, 300)]
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'c', type: 'straight' }, { id: 'e2', source: 'c', target: 'd' }]
    const w = await flow({ nodes, edges })
    pointer(node(w, 'b'), 'pointerdown', 190, 330)
    pointer(window, 'pointermove', 220, 30)
    await nextTick()
    expect(w.find('.m3-flow-edge-halo').exists()).toBe(true)
    pointer(window, 'pointerup', 220, 30)
    const out = w.emitted('update:nodes')!.at(-1)![0] as FlowNode[]
    const x = (id: string) => out.find((n) => n.id === id)!.position.x
    // b sits 48px after a; c 48px after b; d keeps its distance from c
    expect(x('b')).toBe(228)
    expect(x('c')).toBe(228 + 180 + 48)
    expect(x('d') - x('c')).toBe(600 - 260)
    expect(x('a')).toBe(0)
  })
  it('leaves what is in its default slot alone: no pan from a panel, its wheel scrolls it', async () => {
    const w = mount(MFlow, {
      props: { nodes: [N('a', 0, 0)], edges: [], animate: false },
      slots: { default: '<div class="panel" style="position:absolute;right:0;top:0">Panel</div>' },
      attachTo: document.body,
    })
    await flushPromises()
    const panel = w.find('.panel').element
    pointer(panel, 'pointerdown', 700, 10)
    pointer(window, 'pointermove', 600, 100)
    pointer(window, 'pointerup', 600, 100)
    wheel(panel, { deltaY: 50 })
    expect(w.emitted('update:viewport')).toBeUndefined()
  })

  it('startDrag hands a pointer that is already down to a node added from outside', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('c', 600, 0)], edges: [{ id: 'e1', source: 'a', target: 'c', type: 'straight' }] })
    const ctx = w.vm as unknown as { addNodes(n: FlowNode): void; startDrag(id: string, e: PointerEvent): void }
    // A palette item dragged in: added under the pointer, then dragged on and dropped onto the edge
    ctx.addNodes(N('b', 300, 300))
    ctx.startDrag('b', new PointerEvent('pointerdown', { clientX: 390, clientY: 330, pointerId: 1, pointerType: 'mouse' }))
    // Mounted and measured on the next render, as between two pointer moves in a browser
    await nextTick()
    pointer(window, 'pointermove', 390, 30)
    pointer(window, 'pointerup', 390, 30)
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(edges.map((e) => [e.source, e.target])).toEqual([['a', 'b'], ['b', 'c']])
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual({ nodes: ['b'], edges: [] })
  })
  it('startDrag with a finger keeps the touch from scrolling until it is lifted', async () => {
    const w = await flow({ nodes: [N('a', 0, 0)] })
    const ctx = w.vm as unknown as { addNodes(n: FlowNode): void; startDrag(id: string, e: PointerEvent): void }
    // The finger came from a palette outside the canvas, whose touch-action lets the browser scroll
    const palette = document.createElement('button')
    document.body.appendChild(palette)
    const move = () => {
      const e = new Event('touchmove', { bubbles: true, cancelable: true })
      palette.dispatchEvent(e)
      return e.defaultPrevented
    }
    ctx.addNodes(N('b', 300, 300))
    const down = new PointerEvent('pointermove', { clientX: 390, clientY: 330, pointerId: 3, pointerType: 'touch' })
    Object.defineProperty(down, 'target', { value: palette })
    ctx.startDrag('b', down)
    await nextTick()
    expect(move()).toBe(true)
    // Its moves go to where it began even once that's gone from the page
    palette.remove()
    expect(move()).toBe(true)
    pointer(window, 'pointerup', 390, 30, { pointerId: 3, pointerType: 'touch' })
    expect(move()).toBe(false)
  })
  it('a node shown again appears at its position instead of sliding from where it was hidden', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const w = await flow({ animate: true })
    await w.setProps({ nodes: [N('a', 0, 0, { hidden: true }), N('b', 300, 0)] })
    // Hidden, and moved meanwhile (a layout, say); then shown
    await w.setProps({ nodes: [N('a', 500, 200, { hidden: true }), N('b', 300, 0)] })
    await w.setProps({ nodes: [N('a', 500, 200), N('b', 300, 0)] })
    await nextTick()
    expect(node(w, 'a').style.transform).toBe('translate(500px, 200px)')
    // A move once it shows still springs
    await w.setProps({ nodes: [N('a', 600, 200), N('b', 300, 0)] })
    expect(node(w, 'a').style.transform).toBe('translate(500px, 200px)')
    vi.advanceTimersByTime(1500)
    await nextTick()
    expect(node(w, 'a').style.transform).toBe('translate(600px, 200px)')
    vi.useRealTimers()
  })
  it('circle nodes: edges run center to center cut at the rims, opposite ones side by side; edges restyle declaratively', async () => {
    const C = (id: string, x: number, y: number) => N(id, x, y, { type: 'circle', width: 60, height: 60, data: { label: id, badge: 2, color: 'tertiary' } })
    const w = await flow({
      nodes: [C('a', 0, 0), C('b', 300, 0)],
      edges: [{ id: 'ab', source: 'a', target: 'b', color: 'tertiary', width: 5, labelTone: 'error', label: '3/4' }, { id: 'ba', source: 'b', target: 'a', dashed: true }],
    })
    expect(node(w, 'a').textContent).toContain('2')
    const d = w.find('[data-flow-edge="ab"] path:nth-child(2)')
    // a's center (30, 30) + rim 30 → 60; b's center 330 - rim 30 - 2 → 298; shifted 6px sideways (b → a exists)
    expect(d.attributes('d')).toBe('M60,36 L298,36')
    expect(d.attributes('style')).toContain('stroke: var(--color-tertiary)')
    expect(d.attributes('style')).toContain('stroke-width: 5px')
    expect(w.find('[data-flow-edge="ba"] path:nth-child(2)').classes()).toContain('m3-flow-edge-dashed')
    expect(w.find('.m3-flow-edge-label span').classes()).toContain('bg-error-container')
  })

  it('a double click on the background reports the spot', async () => {
    const w = await flow({ zoomOnDoubleClick: false })
    w.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 500, clientY: 400 }))
    expect(w.emitted('pane-dblclick')![0]![0]).toEqual({ x: 500, y: 400 })
    expect(w.emitted('update:viewport')).toBeUndefined()
  })
  it('a parent that hands the nodes back copied makes one undo step, not two', async () => {
    const w = await flow({ 'onUpdate:nodes': (ns: FlowNode[]) => w.setProps({ nodes: ns.map((n) => ({ ...n })) }) })
    pointer(node(w, 'a'), 'pointerdown', 90, 30)
    pointer(window, 'pointermove', 190, 30)
    pointer(window, 'pointerup', 190, 30)
    await flushPromises()
    await w.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((w.emitted('update:nodes')!.at(-1)![0] as FlowNode[])[0]!.position).toEqual({ x: 0, y: 0 })
  })
  it('a circle splices into an edge between two circles, the new edges keeping its data', async () => {
    const C = (id: string, x: number, y: number) => N(id, x, y, { type: 'circle', width: 60, height: 60 })
    const w = await flow({ nodes: [C('a', 0, 0), C('c', 600, 0), C('b', 300, 300)], edges: [{ id: 'e1', source: 'a', target: 'c', data: { capacity: 7 } }] })
    pointer(node(w, 'b'), 'pointerdown', 330, 330)
    pointer(window, 'pointermove', 330, 30)
    await nextTick()
    pointer(window, 'pointerup', 330, 30)
    const edges = w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]
    expect(edges.map((e) => [e.source, e.target, e.data.capacity])).toEqual([['a', 'b', 7], ['b', 'c', 7]])
  })

  it('edgeBranching: a drag from an edge connects its source to another node, the preview leaving from the grab', async () => {
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edgeBranching: true })
    const hit = w.find('[data-flow-edge="e1"] path').element
    pointer(hit, 'pointerdown', 240, 30)
    pointer(window, 'pointermove', 340, 220)
    await nextTick()
    // The preview starts where the edge was grabbed, not at a's handle
    expect(w.find('.m3-flow-connection-line').attributes('d')).toMatch(/^M240,30/)
    expect(w.emitted('connect-start')![0]![0]).toEqual({ nodeId: 'a', handleId: null, type: 'source' })
    pointer(window, 'pointerup', 340, 220)
    expect(w.emitted('connect')![0]![0]).toEqual({ source: 'a', sourceHandle: null, target: 'c', targetHandle: null })
    expect((w.emitted('update:edges')!.at(-1)![0] as FlowEdge[]).map((e) => [e.source, e.target])).toEqual([['a', 'b'], ['a', 'c']])
    // The view didn't pan meanwhile
    expect(w.emitted('update:viewport')).toBeUndefined()
  })
  it("edgeBranching 'junction': adds nothing, and tells where on the edge the branch was grabbed", async () => {
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b', type: 'smoothstep' }]
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edges, edgeBranching: 'junction', snapToGrid: true, gridSize: 20 })
    pointer(w.find('[data-flow-edge="e1"] path').element, 'pointerdown', 243, 34)
    pointer(window, 'pointermove', 340, 220)
    pointer(window, 'pointerup', 340, 220)
    // On the edge (y 30) and on the grid along it (x 240)
    expect(w.emitted('branch')![0]![0]).toMatchObject({ edge: { id: 'e1' }, connection: { source: 'a', target: 'c' }, position: { x: 240, y: 30 }, direction: 'right', end: { x: 340, y: 220 } })
    expect(w.emitted('connect')).toBeUndefined()
    expect(w.emitted('update:edges')).toBeUndefined()
    // Dropped on nothing: still a branch, with no connection
    pointer(w.find('[data-flow-edge="e1"] path').element, 'pointerdown', 260, 30)
    pointer(window, 'pointermove', 500, 500)
    pointer(window, 'pointerup', 500, 500)
    expect(w.emitted('branch')![1]![0]).toMatchObject({ connection: null, position: { x: 260, y: 30 } })
  })
  it("edgeBranching 'junction': on a vertical run, says it runs down, and splits an edge's own route in two", async () => {
    // a's right (180, 30) → over at x 240 → down to b's left (300, 230)
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b', type: 'smoothstep', route: [240] }]
    const w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 200), N('c', 600, 400)], edges, edgeBranching: 'junction', snapToGrid: true, gridSize: 20 })
    pointer(w.find('[data-flow-edge="e1"] path').element, 'pointerdown', 243, 128)
    pointer(window, 'pointermove', 500, 500)
    pointer(window, 'pointerup', 500, 500)
    const ev = w.emitted('branch')![0]![0] as { position: FlowXY; direction: string; routes: { before: number[]; after: number[] } }
    expect(ev.position).toEqual({ x: 240, y: 120 })
    expect(ev.direction).toBe('bottom')
    expect(routePoints({ sourceX: 180, sourceY: 30, sourcePosition: 'right', targetX: 240, targetY: 120, targetPosition: 'top', route: ev.routes.before })).toEqual([[180, 30], [240, 30], [240, 120]])
    expect(routePoints({ sourceX: 240, sourceY: 120, sourcePosition: 'bottom', targetX: 300, targetY: 230, targetPosition: 'left', route: ev.routes.after })).toEqual([[240, 120], [240, 230], [300, 230]])
  })
  it('edgeBranching: a click still selects; off (the default), a drag from an edge pans; a finger only branches a selected edge', async () => {
    let w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edgeBranching: true })
    let hit = w.find('[data-flow-edge="e1"] path').element
    pointer(hit, 'pointerdown', 240, 30)
    pointer(window, 'pointerup', 240, 30)
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 240, clientY: 30 }))
    await nextTick()
    expect((w.emitted('update:selection')!.at(-1)![0] as { edges: string[] }).edges).toEqual(['e1'])
    w.unmount()

    w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)] })
    hit = w.find('[data-flow-edge="e1"] path').element
    pointer(hit, 'pointerdown', 240, 30)
    pointer(window, 'pointermove', 340, 220)
    pointer(window, 'pointerup', 340, 220)
    expect(w.emitted('connect')).toBeUndefined()
    expect(w.emitted('update:viewport')).toBeDefined()
    w.unmount()

    const touch = { pointerType: 'touch' }
    w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edgeBranching: true })
    hit = w.find('[data-flow-edge="e1"] path').element
    pointer(hit, 'pointerdown', 240, 30, touch)
    pointer(window, 'pointermove', 340, 220, touch)
    pointer(window, 'pointerup', 340, 220, touch)
    expect(w.emitted('connect')).toBeUndefined()
    // (that touch panned the view: start again)
    w.unmount()
    w = await flow({ nodes: [N('a', 0, 0), N('b', 300, 0), N('c', 300, 200)], edgeBranching: true, selection: { nodes: [], edges: ['e1'] } })
    hit = w.find('[data-flow-edge="e1"] path').element
    pointer(hit, 'pointerdown', 240, 30, touch)
    pointer(window, 'pointermove', 340, 220, touch)
    pointer(window, 'pointerup', 340, 220, touch)
    expect(w.emitted('connect')).toHaveLength(1)
  })
  it('pathType routes a slot edge: the path it gets and where it is hit', async () => {
    const w = mount(MFlow, {
      props: { nodes: [N('a', 0, 0), N('b', 300, 100)], edges: [{ id: 'e1', source: 'a', target: 'b', type: 'wire', pathType: 'step' }], animate: false },
      slots: { 'edge-wire': `<template #edge-wire="{ path }"><path class="wire" :d="path" /></template>` },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
    const d = w.find('.wire').attributes('d')
    expect(d).not.toContain('C')
    expect(d).toContain('L')
    // The hit stroke follows the same route
    expect(w.find('[data-flow-edge="e1"] path').attributes('d')).toBe(d)
  })
})

describe('MFlow context menu', () => {
  it("keeps the browser's menu closed on the canvas but still emits pane-contextmenu; nativeContextMenu lets it open", async () => {
    const { default: MFlow } = await import('../components/MFlow.vue')
    const { mount } = await import('@vue/test-utils')
    for (const native of [false, true]) {
      const w = mount(MFlow, { props: { nodes: [], edges: [], nativeContextMenu: native } })
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
      w.element.dispatchEvent(e)
      expect(e.defaultPrevented).toBe(!native)
      expect(w.emitted('pane-contextmenu')).toHaveLength(1)
      w.unmount()
    }
  })
})
