import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MFlow from '../components/MFlow.vue'
import type { FlowEdge, FlowNode } from '../composables/useFlow'

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
      const [x, y] = c.includes('right-0') ? [180, 30] : c.includes('bottom-0') ? [90, 60] : c.includes('top-1/2') ? [0, 30] : [90, 0]
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
})
