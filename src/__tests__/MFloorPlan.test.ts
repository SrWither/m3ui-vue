import { describe, expect, it, vi } from 'vitest'
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
    expect(w.findAll('.m3-floor-chair').length).toBe(10)
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
    const plant = w.find('[aria-label="Plant"]').element
    down(plant, 0, 0)
    moveUp(41, 19)
    await nextTick()
    expect((w.props('decor') as any[])[0]).toMatchObject({ x: 140, y: 120 })
    w.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await nextTick()
    expect(w.props('decor')).toEqual([])
  })
})

describe('MFloorPlan editing comforts', () => {
  const down = (el: Element, x: number, y: number, o: Record<string, unknown> = {}) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 5, ...o }))
  const moveUp = (x: number, y: number) => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 5 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 5 }))
  }
  const key = (w: { element: Element }, k: string, o: Record<string, unknown> = {}) => w.element.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o }))
  function plan(props: Record<string, unknown> = {}) {
    const w: any = mount(MFloorPlan, {
      props: {
        editable: true,
        grid: 10,
        tables: base(),
        merges: [{ id: 'm', tables: [1, 2] }],
        ...props,
        ...Object.fromEntries(['tables', 'areas', 'walls', 'decor', 'merges', 'selection', 'picked'].map((k) => [`onUpdate:${k}`, (v: unknown) => w.setProps({ [k]: v })])),
      },
      attachTo: document.body,
    })
    return w
  }
  it('undoes and redoes a drag', async () => {
    const w = plan()
    down(table(w, 'T1').element, 0, 0)
    moveUp(40, 0)
    await nextTick()
    expect(w.props('tables')[0].x).toBe(140)
    key(w, 'z', { ctrlKey: true })
    await nextTick()
    expect(w.props('tables')[0].x).toBe(100)
    key(w, 'z', { ctrlKey: true, shiftKey: true })
    await nextTick()
    expect(w.props('tables')[0].x).toBe(140)
  })
  it('Delete removes the selected tables and their merge; Ctrl+D duplicates', async () => {
    const w = plan({ selection: [2] })
    key(w, 'd', { ctrlKey: true })
    await nextTick()
    expect(w.props('tables')).toHaveLength(3)
    expect(w.props('tables')[2]).toMatchObject({ label: 'T2', x: 320, y: 120 })
    await w.setProps({ selection: [2] })
    key(w, 'Delete')
    await nextTick()
    expect(w.props('tables').map((t: FloorTable) => t.id)).not.toContain(2)
    expect(w.props('merges')).toEqual([])
  })
  it('resizes a zone by its top-left corner, keeping the opposite one', async () => {
    const w = plan({ areas: [{ id: 'z', x: 100, y: 100, width: 200, height: 100 }], picked: { kind: 'area', id: 'z' } })
    down(w.find('[data-corner="nw"]').element, 0, 0)
    moveUp(-40, -20)
    await nextTick()
    expect(w.props('areas')[0]).toMatchObject({ x: 60, y: 80, width: 240, height: 120 })
  })
  it('a double-click adds a corner to a wall; Delete removes a picked corner', async () => {
    const w = plan({ walls: [{ id: 'w', points: [[0, 0], [200, 0]] }] })
    const path = w.find('svg path').element
    path.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 100, clientY: 0 }))
    await nextTick()
    expect(w.props('walls')[0].points).toEqual([[0, 0], [100, 0], [200, 0]])
    expect(w.props('picked')).toEqual({ kind: 'wall', id: 'w', vertex: 1 })
    key(w, 'Delete')
    await nextTick()
    expect(w.props('walls')[0].points).toEqual([[0, 0], [200, 0]])
  })
  it('rotates the picked table by its handle in 15° steps', async () => {
    const w = plan({ selection: [1] })
    const h = w.find('[data-rotate]').element
    // The table's center is (100, 100) at scale 1; pointing right of it is 90°
    h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 40, pointerId: 6 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 98, pointerId: 6 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 98, pointerId: 6 }))
    await nextTick()
    expect(w.props('tables')[0].rotation).toBe(90)
  })
})

import MFloorPlanToolbar from '../components/MFloorPlanToolbar.vue'
import MFloorPlanInspector from '../components/MFloorPlanInspector.vue'
import { defineComponent, h, ref as vref } from 'vue'

describe('MFloorPlan family', () => {
  it('draws decor kinds of yours, and the #decor slot replaces their inside', () => {
    const w = mount(MFloorPlan, {
      props: { decor: [{ id: 'tv', kind: 'tv', x: 100, y: 100 }], decorKinds: { tv: { label: 'TV', icon: 'tv', width: 80, height: 20, shape: 'bar', color: '#000' } } },
      slots: { decor: '<template #decor="{ item, kind }"><b class="mine">{{ kind.label }}:{{ item.id }}</b></template>' },
    })
    const el = w.find('[aria-label="TV"]')
    expect(el.attributes('style')).toContain('width: 80px')
    expect(w.find('.mine').text()).toBe('TV:tv')
  })
  it('in service, selectable multiple + merge() joins tables; canMerge can refuse', async () => {
    const w: any = mount(MFloorPlan, {
      props: {
        tables: base(),
        selectable: 'multiple',
        canMerge: (ids: (string | number)[]) => (ids.includes(3) ? 'Table 3 has an open bill' : true),
        'onUpdate:selection': (v: unknown) => w.setProps({ selection: v }),
        'onUpdate:merges': (v: unknown) => w.setProps({ merges: v }),
      },
    })
    await table(w, 'T1').trigger('click')
    await table(w, 'T2').trigger('click')
    expect(w.props('selection')).toEqual([1, 2])
    const m = w.vm.merge()
    expect(m).toMatchObject({ tables: [1, 2], label: 'T1 + T2' })
    expect(w.emitted('merge')).toHaveLength(1)
    expect(w.vm.merge([1, 3])).toBeNull()
    expect(w.emitted('merge-refused')![0]).toEqual([[1, 2, 3], 'Table 3 has an open bill'])
    w.vm.split(1)
    expect(w.emitted('split')).toHaveLength(1)
  })
  it('the toolbar adds tables and undoes, and the inspector edits from outside the plan', async () => {
    const App = defineComponent({
      setup() {
        const plan = vref()
        const tables = vref<FloorTable[]>(base())
        return () => [
          h(MFloorPlan, { ref: plan, editable: true, tables: tables.value, 'onUpdate:tables': (v: FloorTable[]) => (tables.value = v) }),
          h(MFloorPlanToolbar, { plan: plan.value }),
          h(MFloorPlanInspector, { plan: plan.value }),
        ]
      },
    })
    const w = mount(App, { attachTo: document.body })
    await nextTick()
    await w.find('[aria-label="Add a table"]').trigger('click')
    await nextTick()
    const item = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Round · 2'))!
    item.click()
    await nextTick()
    expect(w.findAll('.m3-floor-plan [role="button"]')).toHaveLength(3)
    // The new table is selected: the inspector shows it, and renaming it goes into the tables
    const field = w.find('.m3-floor-plan-inspector input')
    await field.setValue('Window seat')
    expect(w.find('.m3-floor-plan').text()).toContain('Window seat')
    await w.find('[aria-label="Undo"]').trigger('click')
    await w.find('[aria-label="Undo"]').trigger('click')
    expect(w.findAll('.m3-floor-plan [role="button"]')).toHaveLength(2)
    w.unmount()
  })
})

describe('MFloorPlan by touch', () => {
  const touch = (type: string, el: EventTarget, x: number, y: number) =>
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 9, pointerType: 'touch' }))
  function plan(props: Record<string, unknown> = {}) {
    const w: any = mount(MFloorPlan, {
      props: { editable: true, grid: 10, tables: base(), ...props, ...Object.fromEntries(['tables', 'selection', 'walls'].map((k) => [`onUpdate:${k}`, (v: unknown) => w.setProps({ [k]: v })])) },
      attachTo: document.body,
    })
    return w
  }
  it('holding a table down adds it to the selection; a tap still picks only it', async () => {
    vi.useFakeTimers()
    const w = plan({ selection: [1] })
    touch('pointerdown', table(w, 'T2').element, 0, 0)
    vi.advanceTimersByTime(500)
    touch('pointerup', window, 0, 0)
    await nextTick()
    expect(w.props('selection')).toEqual([1, 2])
    await table(w, 'T2').trigger('click')
    expect(w.props('selection')).toEqual([1, 2])
    vi.useRealTimers()
  })
  it('dragging an unpicked table with a finger picks it and moves it', async () => {
    const w = plan({ selection: [1] })
    touch('pointerdown', table(w, 'T2').element, 0, 0)
    touch('pointermove', window, 40, 0)
    touch('pointerup', window, 40, 0)
    await nextTick()
    expect(w.props('selection')).toEqual([2])
    expect(w.props('tables')[1].x).toBe(340)
  })
  it('a wall being drawn can be finished from the context (the toolbar\'s Done)', async () => {
    const w = plan({ tool: 'wall' })
    const down = (x: number, y: number) => w.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 3 }))
    down(0, 0)
    down(100, 0)
    await nextTick()
    expect(w.vm.context.drawingWall.value).toBe(true)
    w.vm.context.finishWall()
    await nextTick()
    expect(w.props('walls')[0].points).toEqual([[0, 0], [100, 0]])
  })
})
