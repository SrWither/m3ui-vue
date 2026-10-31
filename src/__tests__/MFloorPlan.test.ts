import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MFloorPlan, { type FloorTable } from '../components/MFloorPlan.vue'

const base = (): FloorTable[] => [
  { id: 1, label: 'T1', x: 100, y: 100, seats: 4, status: 'occupied', badge: 12 },
  { id: 2, label: 'T2', x: 300, y: 100, shape: 'round', seats: 6 },
]
function setup(props: Record<string, unknown> = {}) {
  const w = mount(MFloorPlan, {
    props: { tables: base(), 'onUpdate:tables': (v: FloorTable[]) => w.setProps({ tables: v }), ...props },
    attachTo: document.body,
  })
  return w
}
const table = (w: ReturnType<typeof setup>, label: string) => w.findAll('[role="button"]').find((b) => b.attributes('aria-label')!.startsWith(label))!

describe('MFloorPlan', () => {
  it('draws tables with their status, seats and badge', () => {
    const w = setup()
    expect(table(w, 'T1').attributes('aria-label')).toBe('T1, Occupied, 4 seats, 12')
    expect(table(w, 'T1').attributes('style')).toContain('--color-primary-container')
    // chairs: 4 + 6
    expect(w.findAll('.bg-outline-variant').length).toBe(10)
  })
  it('a click opens a table in service mode, without moving it', async () => {
    const w = setup()
    await table(w, 'T2').trigger('click')
    expect(w.emitted('table-click')![0]![0]).toMatchObject({ id: 2 })
    table(w, 'T2').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 0, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, clientY: 0, pointerId: 1 }))
    expect(w.emitted('move')).toBeUndefined()
  })
  it('editable: a drag moves the selected tables, snapped to the grid, and emits move', async () => {
    const w = setup({ editable: true, grid: 20, selection: [1, 2], 'onUpdate:selection': (v: unknown) => w.setProps({ selection: v as number[] }) })
    table(w, 'T1').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 33, clientY: 47, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 33, clientY: 47, pointerId: 1 }))
    await nextTick()
    expect(w.emitted('move')![0]![0]).toEqual([{ id: 1, x: 140, y: 140 }, { id: 2, x: 340, y: 140 }])
    expect((w.props('tables') as FloorTable[])[0]).toMatchObject({ x: 140, y: 140 })
  })
  it('editable: arrows nudge by the grid, and tables stay inside the plan', async () => {
    const w = setup({ editable: true, grid: 10 })
    await table(w, 'T1').trigger('keydown', { key: 'ArrowLeft' })
    expect((w.props('tables') as FloorTable[])[0]).toMatchObject({ x: 90 })
    for (let i = 0; i < 20; i++) await table(w, 'T1').trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect((w.props('tables') as FloorTable[])[0]!.y).toBe(36)
  })
  it('draws merged tables as one group', () => {
    const w = setup({ merges: [{ id: 'm', tables: [1, 2], label: 'T1 + T2' }] })
    expect(w.text()).toContain('T1 + T2')
  })
})

describe('MFloorPlan zones, walls and decor', () => {
  const down = (el: Element, x: number, y: number) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 3 }))
  const moveUp = (x: number, y: number) => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 3 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 3 }))
  }
  function plan(props: Record<string, unknown>) {
    const w = mount(MFloorPlan, { props: { editable: true, grid: 10, ...props }, attachTo: document.body })
    for (const k of ['areas', 'walls', 'decor']) (w.vm as any)[`onUpdate:${k}`] = null
    return w
  }
  it('draws a wall corner by corner, Enter ends it', async () => {
    const w = plan({ tool: 'wall' })
    const root = w.element as HTMLElement
    down(root, 10, 10)
    down(root, 200, 12)
    down(root, 200, 300)
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect((w.emitted('update:walls')!.at(-1)![0] as any[])[0].points).toEqual([[10, 10], [200, 10], [200, 300]])
  })
  it('drags out a zone, snapped', async () => {
    const w = plan({ tool: 'area' })
    down(w.element, 20, 20)
    moveUp(203, 118)
    await nextTick()
    expect((w.emitted('update:areas')!.at(-1)![0] as any[])[0]).toMatchObject({ x: 20, y: 20, width: 180, height: 100 })
  })
  it('moves decor and deletes what is picked', async () => {
    const w = plan({ decor: [{ id: 'p', kind: 'plant', x: 100, y: 100 }], 'onUpdate:decor': (v: unknown) => w.setProps({ decor: v as any }) })
    const plant = w.find('[aria-label="plant"]').element
    down(plant, 0, 0)
    moveUp(41, 19)
    await nextTick()
    expect((w.props('decor') as any[])[0]).toMatchObject({ x: 140, y: 120 })
    w.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await nextTick()
    expect(w.props('decor')).toEqual([])
  })
})
