import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MDrawCanvas from '../components/MDrawCanvas.vue'
import MDrawToolbar from '../components/MDrawToolbar.vue'
import type { DrawItem, DrawStroke } from '../composables/drawGeometry'

function setup(props: Record<string, unknown> = {}) {
  const w = mount(MDrawCanvas, {
    props: { modelValue: [] as DrawItem[], 'onUpdate:modelValue': (v: DrawItem[]) => w.setProps({ modelValue: v }), ...props },
    attachTo: document.body,
  })
  const el = w.element as HTMLElement
  const svg = el.querySelector('svg')!
  const ev = (type: string, x: number, y: number, o: Record<string, unknown> = {}) =>
    (type === 'pointerdown' ? svg : el).dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, ...o }))
  const drag = async (pts: [number, number][], o: Record<string, unknown> = {}) => {
    ev('pointerdown', ...pts[0]!, o)
    for (const p of pts.slice(1)) ev('pointermove', ...p, o)
    ev('pointerup', ...pts[pts.length - 1]!, o)
    await nextTick()
  }
  const items = () => w.props('modelValue') as DrawItem[]
  return { w, el, ev, drag, items }
}
const across = (y = 50): [number, number][] => Array.from({ length: 11 }, (_, i) => [i * 10, y])

describe('MDrawCanvas', () => {
  it('draws a stroke with the pen, and undo / redo take it back and forth', async () => {
    const { w, drag, items } = setup()
    await drag(across())
    expect(items()).toHaveLength(1)
    expect(items()[0]!.type).toBe('stroke')
    expect((items()[0] as DrawStroke).points.length).toBeGreaterThan(2)
    ;(w.vm as any).undo()
    await nextTick()
    expect(items()).toHaveLength(0)
    ;(w.vm as any).redo()
    await nextTick()
    expect(items()).toHaveLength(1)
  })
  it('the eraser cuts a stroke in two, in one undo step', async () => {
    const { w, drag, items } = setup()
    await drag(across())
    await w.setProps({ tool: 'eraser' })
    await drag([[50, 30], [50, 70]])
    expect(items()).toHaveLength(2)
    ;(w.vm as any).undo()
    await nextTick()
    expect(items()).toHaveLength(1)
  })
  it('the pen\'s eraser end erases whatever tool is picked', async () => {
    const { drag, items } = setup()
    await drag(across())
    await drag([[50, 30], [50, 70]], { pointerType: 'pen', button: 5, buttons: 32, pressure: 0.5 })
    expect(items()).toHaveLength(2)
  })
  it('draws shapes, and selects, moves and deletes them', async () => {
    const { w, drag, items, el } = setup({ tool: 'rect' })
    await drag([[10, 10], [60, 40]])
    expect(items()[0]).toMatchObject({ type: 'shape', shape: 'rect', from: [10, 10], to: [60, 40] })
    await w.setProps({ tool: 'select' })
    await drag([[0, 0], [100, 0], [100, 100], [0, 100]])
    expect(w.emitted('update:selection')!.at(-1)![0]).toEqual([items()[0]!.id])
    await w.setProps({ selection: [items()[0]!.id] })
    await drag([[10, 25], [30, 45]])
    expect(items()[0]).toMatchObject({ from: [30, 30], to: [80, 60] })
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await nextTick()
    expect(items()).toHaveLength(0)
  })
  it('with penOnly, a finger pans instead of drawing', async () => {
    const { w, drag, items } = setup({ penOnly: true })
    await drag(across(), { pointerType: 'touch' })
    expect(items()).toHaveLength(0)
    expect((w.emitted('update:viewport')!.at(-1)![0] as { x: number }).x).toBe(100)
  })
  it('in pages mode, items belong to the page under them, in its coordinates', async () => {
    const { drag, items } = setup({ mode: 'pages', pages: 2, pageSize: { width: 200, height: 100 } })
    await drag([[10, 150], [50, 150]])
    expect(items()[0]!.page).toBe(1)
    expect((items()[0] as DrawStroke).points[0]![1]).toBeCloseTo(26)
  })
  it('hidden and locked layers are left alone', async () => {
    const stroke = (id: string, layer: string): DrawItem => ({ id, type: 'stroke', pen: 'marker', color: '#000', size: 4, layer, points: across().map(([x, y]) => [x, y, 1]) })
    const { w, drag, items } = setup({
      modelValue: [stroke('a', 'l1'), stroke('b', 'l2')],
      layers: [{ id: 'l1', name: '1', locked: true }, { id: 'l2', name: '2' }],
      tool: 'stroke-eraser',
    })
    await drag([[50, 30], [50, 70]])
    expect(items().map((i) => i.id)).toEqual(['a'])
    expect(w.findAll('path').length).toBeGreaterThan(0)
  })
  it('the toolbar picks tools and colors', async () => {
    const w = mount({
      components: { MDrawCanvas, MDrawToolbar },
      data: () => ({ tool: 'pen', color: '#1d1b20' }),
      template: '<MDrawCanvas v-model:tool="tool" v-model:color="color"><MDrawToolbar /></MDrawCanvas>',
    })
    await w.find('[aria-label="Text"]').trigger('click')
    expect((w.vm as any).tool).toBe('text')
    await w.find('[aria-label="Color #e53935"]').trigger('click')
    expect((w.vm as any).color).toBe('#e53935')
    // A color that isn't a swatch lights up the custom-color button
    ;(w.vm as any).color = '#123456'
    await nextTick()
    expect(w.find('[aria-label="Custom color"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('MDrawCanvas background image', () => {
  it('places it by backgroundImageBox on an infinite canvas', () => {
    const w = mount(MDrawCanvas, { props: { backgroundImage: 'photo.jpg', backgroundImageBox: { x: 10, y: 20, width: 300, height: 200 } } })
    const img = w.find('image')
    expect([img.attributes('x'), img.attributes('y'), img.attributes('width'), img.attributes('height')]).toEqual(['10', '20', '300', '200'])
  })
})
