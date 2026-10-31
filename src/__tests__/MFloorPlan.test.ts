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
