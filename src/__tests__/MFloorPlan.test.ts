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
  it('editable + selectable multiple: a click toggles a table in the selection, a drag moves that table alone', async () => {
    const w = setup({ editable: true, selectable: 'multiple', dragMerged: true, merges: [{ id: 'm', tables: [1, 2] }], grid: 20, selection: [], 'onUpdate:selection': (v: unknown) => w.setProps({ selection: v as number[] }) })
    const press = (label: string, dx = 0) => {
      table(w, label).element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 1 }))
      if (dx) window.dispatchEvent(new PointerEvent('pointermove', { clientX: dx, clientY: 0, pointerId: 1 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: dx, clientY: 0, pointerId: 1 }))
    }
    // A press alone doesn't change the selection; the click toggles
    press('T1')
    expect(w.props('selection')).toEqual([])
    await table(w, 'T1').trigger('click')
    await table(w, 'T2').trigger('click')
    expect(w.props('selection')).toEqual([1, 2])
    await table(w, 'T1').trigger('click')
    expect(w.props('selection')).toEqual([2])
    // A drag moves only the table pressed: not the rest of the selection, nor its merge (dragMerged); the selection stays
    await table(w, 'T1').trigger('click')
    expect(w.props('selection')).toEqual([2, 1])
    await new Promise((r) => setTimeout(r))
    press('T2', 40)
    await nextTick()
    expect((w.props('tables') as FloorTable[]).map((t) => t.x)).toEqual([100, 340])
    await new Promise((r) => setTimeout(r))
    press('T1', 60)
    await nextTick()
    expect((w.props('tables') as FloorTable[]).map((t) => t.x)).toEqual([160, 340])
    expect(w.props('selection')).toEqual([2, 1])
  })
  it('tableSnap cell: a dropped table sits in the middle of a grid square, and arrows keep it there', async () => {
    const w = setup({ editable: true, grid: 20, tableSnap: 'cell', selection: [1], 'onUpdate:selection': (v: unknown) => w.setProps({ selection: v as number[] }) })
    table(w, 'T1').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 33, clientY: 47, pointerId: 1 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 33, clientY: 47, pointerId: 1 }))
    await nextTick()
    expect((w.props('tables') as FloorTable[])[0]).toMatchObject({ x: 130, y: 150 })
    await table(w, 'T1').trigger('keydown', { key: 'ArrowRight' })
    expect((w.props('tables') as FloorTable[])[0]).toMatchObject({ x: 150, y: 150 })
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
  it('resizes turned decor along its own axes, keeping the opposite corner', async () => {
    // A window turned to stand upright: its length runs down the plan, so dragging the handle down lengthens it
    const w = plan({ decor: [{ id: 'win', kind: 'window', x: 200, y: 200, width: 80, height: 10, rotation: 90 }], picked: { kind: 'decor', id: 'win' } })
    down(w.find('[data-resize]').element, 0, 0)
    moveUp(0, 40)
    await nextTick()
    const d = (w.props('decor') as any[])[0]
    expect(d).toMatchObject({ width: 120, height: 10 })
    // Its far end (the top, at y 160) stays put: the middle moved half the growth
    expect(d.x).toBeCloseTo(200)
    expect(d.y).toBeCloseTo(220)
  })
  it('resizes unturned decor from its corner, the opposite one staying put', async () => {
    const w = plan({ decor: [{ id: 'd', kind: 'door', x: 100, y: 100, width: 60, height: 14 }], picked: { kind: 'decor', id: 'd' } })
    down(w.find('[data-resize]').element, 0, 0)
    moveUp(20, 0)
    await nextTick()
    expect((w.props('decor') as any[])[0]).toMatchObject({ x: 110, y: 100, width: 80, height: 14 })
  })
  it('subgrid: walls, zones and decor snap halfway between the points, tables to the grid', async () => {
    const w = plan({ subgrid: 2, decor: [{ id: 'p', kind: 'plant', x: 100, y: 100 }] })
    down(w.find('[aria-label="Plant"]').element, 0, 0)
    moveUp(6, 0)
    await nextTick()
    expect((w.props('decor') as any[])[0]).toMatchObject({ x: 105, y: 100 })
    down(table(w, 'T1').element, 0, 0)
    moveUp(6, 0)
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ x: 110 })
  })
  it('arrows move the picked zone, decor or a wall\'s picked corner', async () => {
    const w = plan({
      subgrid: 2,
      areas: [{ id: 'z', x: 100, y: 100, width: 100, height: 100 }],
      walls: [{ id: 'w', points: [[0, 0], [100, 0]] }],
      picked: { kind: 'area', id: 'z' },
    })
    key(w, 'ArrowRight')
    await nextTick()
    key(w, 'ArrowDown', { shiftKey: true })
    await nextTick()
    expect(w.props('areas')[0]).toMatchObject({ x: 105, y: 125 })
    await w.setProps({ picked: { kind: 'wall', id: 'w', vertex: 1 } })
    key(w, 'ArrowLeft')
    await nextTick()
    expect(w.props('walls')[0].points).toEqual([[0, 0], [95, 0]])
  })
  it('a door and a window look different, and a door can be flipped', async () => {
    const w = plan({ decor: [{ id: 'd', kind: 'door', x: 100, y: 100 }, { id: 'v', kind: 'window', x: 300, y: 100, flip: true }] })
    const door = w.find('[aria-label="Door"]')
    const win = w.find('[aria-label="Window"]')
    expect(door.find('.m3-floor-door-swing').exists()).toBe(true)
    expect(win.find('.m3-floor-window-pane').exists()).toBe(true)
    expect(win.find('.m3-floor-door-swing').exists()).toBe(false)
    await w.setProps({ decor: [{ id: 'd', kind: 'door', x: 100, y: 100, flip: true }] })
    expect((w.find('[aria-label="Door"] svg').element as SVGElement).style.transform).toBe('scaleX(-1)')
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

describe('MFloorPlan merges across the room', () => {
  it('draws touching tables in one outline and tables apart in their own, joined by a line', () => {
    const tables: FloorTable[] = [
      { id: 1, label: '1', x: 100, y: 100, seats: 4 },
      { id: 2, label: '2', x: 172, y: 100, seats: 4 },
      { id: 3, label: '3', x: 700, y: 400, seats: 4 },
      { id: 4, label: '4', x: 400, y: 250, seats: 4 },
    ]
    const w = mount(MFloorPlan, { props: { tables, merges: [{ id: 'm', tables: [1, 2, 3], label: '1 + 2 + 3' }] } })
    // 1 and 2 touch: one outline; 3 is apart: its own; 4 (between them) isn't covered
    expect(w.findAll('.m3-floor-merge')).toHaveLength(2)
    expect(w.findAll('.m3-floor-merge-link')).toHaveLength(1)
    expect(w.findAll('.m3-floor-merge-label')).toHaveLength(1)
  })
})

describe('MFloorPlan dragMerged', () => {
  it('a merged table drags its merge along', async () => {
    const w: any = mount(MFloorPlan, {
      props: { editable: true, grid: 10, dragMerged: true, tables: base(), merges: [{ id: 'm', tables: [1, 2] }], 'onUpdate:tables': (v: FloorTable[]) => w.setProps({ tables: v }) },
      attachTo: document.body,
    })
    table(w, 'T1').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 4 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 30, pointerId: 4 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 30, pointerId: 4 }))
    await nextTick()
    expect(w.props('tables').map((t: FloorTable) => [t.x, t.y])).toEqual([[120, 130], [320, 130]])
  })
})

describe('MFloorPlan rotatable', () => {
  it('has no rotate handle when rotatable is off', () => {
    const on = mount(MFloorPlan, { props: { editable: true, tables: base(), selection: [1] } })
    const off = mount(MFloorPlan, { props: { editable: true, tables: base(), selection: [1], rotatable: false } })
    expect(on.findAll('[data-rotate]')).toHaveLength(1)
    expect(off.findAll('[data-rotate]')).toHaveLength(0)
    // decor only: the picked decor turns, a selected table doesn't
    const decorOnly = mount(MFloorPlan, { props: { editable: true, tables: base(), selection: [1], rotatable: ['decor'], decor: [{ id: 'p', kind: 'plant', x: 50, y: 50 }], picked: { kind: 'decor', id: 'p' } } })
    expect(decorOnly.findAll('[data-rotate]')).toHaveLength(1)
    expect(decorOnly.find('[aria-label="Plant"] [data-rotate]').exists()).toBe(true)
  })
})

describe('MFloorPlanToolbar without table presets', () => {
  it('hides Add a table when tables is empty', () => {
    const w = mount(MFloorPlanToolbar, { props: { plan: { context: { kinds: { value: {} }, picked: { value: null }, selection: { value: [] }, tool: { value: 'select' }, drawingWall: { value: false }, canUndo: { value: false }, canRedo: { value: false } } } as any, tables: [] } })
    expect(w.find('[aria-label="Add a table"]').exists()).toBe(false)
  })
})

describe('MFloorPlan 1.3.6', () => {
  const down = (el: Element, x: number, y: number, o: Record<string, unknown> = {}) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 7, ...o }))
  const move = (x: number, y: number) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 7 }))
  const up = (x: number, y: number) => window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 7 }))
  const moveUp = (x: number, y: number) => {
    move(x, y)
    up(x, y)
  }
  const key = (w: { element: Element }, k: string, o: Record<string, unknown> = {}) => w.element.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o }))
  function plan(props: Record<string, unknown> = {}) {
    const w: any = mount(MFloorPlan, {
      props: {
        editable: true,
        grid: 10,
        tables: base(),
        ...props,
        ...Object.fromEntries(['tables', 'areas', 'walls', 'decor', 'merges', 'selection', 'picked', 'zoom', 'tool'].map((k) => [`onUpdate:${k}`, (v: unknown) => w.setProps({ [k]: v })])),
      },
      attachTo: document.body,
    })
    return w
  }

  it('cellSize: tables by column and row, a drag steps a cell and gives cells back', async () => {
    const w = plan({ cellSize: 50, width: 500, height: 300, tables: [{ id: 1, label: 'A', x: 2, y: 1, shape: 'square', width: 40, height: 40 }] })
    // Drawn in the middle of cell (2, 1): 125, 75
    expect(table(w, 'A').element.parentElement!.style.left).toBe('125px')
    down(table(w, 'A').element, 0, 0)
    moveUp(48, 0)
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ x: 3, y: 1 })
    expect(w.emitted('move')!.at(-1)![0]).toEqual([{ id: 1, x: 3, y: 1 }])
    table(w, 'A').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ x: 3, y: 2 })
    // Kept inside the plan's cells
    w.vm.addTable({ label: 'B', x: 9, y: 5 })
    await nextTick()
    expect(w.props('tables')[1]).toMatchObject({ x: 9, y: 5 })
  })
  it('tableOrigin corner: x / y are the top-left corner', async () => {
    const w = plan({ tableOrigin: 'corner', tables: [{ id: 1, label: 'A', x: 100, y: 100, width: 60, height: 40, shape: 'rect' }] })
    expect(table(w, 'A').element.parentElement!.style.left).toBe('130px')
    down(table(w, 'A').element, 0, 0)
    moveUp(20, 10)
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ x: 120, y: 110 })
  })
  it('zoomable: Ctrl + wheel zooms about the pointer, and a drag then moves a table half as far', async () => {
    const w = plan({ zoomable: true })
    // happy-dom's WheelEvent drops ctrlKey from its init
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -347, clientX: 0, clientY: 0 })
    Object.defineProperty(wheel, 'ctrlKey', { value: true })
    w.element.dispatchEvent(wheel)
    await nextTick()
    expect(w.props('zoom')).toBeCloseTo(2, 1)
    await w.setProps({ zoom: 2 })
    down(table(w, 'T1').element, 0, 0)
    moveUp(40, 0)
    await nextTick()
    expect(w.props('tables')[0].x).toBe(120)
    // The buttons: back to the whole plan
    await w.find('[aria-label="Whole plan"]').trigger('click')
    expect(w.props('zoom')).toBe(1)
  })
  it('a background image sits under the plan, in plan units', () => {
    const w = plan({ backgroundImage: 'plan.png', backgroundBox: { x: 10, y: 20, width: 300, height: 200 }, backgroundOpacity: 0.3 })
    const img = w.find('img[data-floor-bg]').element as HTMLImageElement
    expect(img.style.left).toBe('10px')
    expect(img.style.width).toBe('300px')
    expect(img.style.opacity).toBe('0.3')
  })
  it('a mouse drag on empty floor selects the tables it touches', async () => {
    const w = plan()
    down(w.find('.m3-floor-view').element, 50, 50)
    move(250, 200)
    await nextTick()
    expect(w.find('.m3-floor-marquee').exists()).toBe(true)
    up(250, 200)
    await nextTick()
    expect(w.props('selection')).toEqual([1])
    expect(w.find('.m3-floor-marquee').exists()).toBe(false)
  })
  it('transferable: in service a table carried onto another emits transfer; canTransfer can refuse', async () => {
    const w = plan({ editable: false, transferable: true })
    down(table(w, 'T1').element, 100, 100)
    move(200, 100)
    await nextTick()
    expect(w.find('.m3-floor-carry').exists()).toBe(true)
    moveUp(300, 100)
    await nextTick()
    const [from, to] = w.emitted('transfer')![0] as FloorTable[]
    expect([from!.id, to!.id]).toEqual([1, 2])
    // The tables stay where they are
    expect(w.props('tables')[0].x).toBe(100)
    await w.setProps({ canTransfer: () => 'Busy' })
    down(table(w, 'T1').element, 100, 100)
    move(200, 100)
    moveUp(300, 100)
    await nextTick()
    expect(w.emitted('transfer-refused')![0]![2]).toBe('Busy')
  })
  it('resizes the selected table by its handle, about its middle', async () => {
    const w = plan({ selection: [1] })
    down(w.find('[data-table-resize]').element, 0, 0)
    moveUp(10, 5)
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ x: 100, y: 100, width: 92, height: 82 })
  })
  it('draws a zone of any shape corner by corner, and closes it on its first corner', async () => {
    const w = plan({ tool: 'polygon', tables: [] })
    for (const [x, y] of [[0, 0], [200, 0], [200, 100], [100, 100], [100, 200], [0, 200], [0, 0]]) down(w.element, x!, y!)
    await nextTick()
    const a = (w.props('areas') as any[])[0]
    expect(a.points).toHaveLength(6)
    expect(a).toMatchObject({ x: 0, y: 0, width: 200, height: 200 })
  })
  it('a double-click on a zone gives it a corner; corners drag, snap to walls, and Delete removes them', async () => {
    const w = plan({ tables: [], areas: [{ id: 'z', x: 100, y: 100, width: 200, height: 100 }], walls: [{ id: 'w', points: [[403, 97], [500, 97]] }], picked: { kind: 'area', id: 'z' } })
    const zone = w.find('.m3-floor-view > div.absolute.rounded-lg')
    zone.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 200, clientY: 100 }))
    await nextTick()
    let a = (w.props('areas') as any[])[0]
    expect(a.points).toEqual([[100, 100], [200, 100], [300, 100], [300, 200], [100, 200]])
    expect(w.props('picked')).toEqual({ kind: 'area', id: 'z', vertex: 1 })
    // Dragged near the wall's off-grid corner, it lands on it
    down(w.find('[data-zone-corner="2"]').element, 300, 100)
    moveUp(401, 99)
    await nextTick()
    a = (w.props('areas') as any[])[0]
    expect(a.points[2]).toEqual([403, 97])
    expect(a.width).toBe(303)
    key(w, 'Delete')
    await nextTick()
    expect((w.props('areas') as any[])[0].points).toHaveLength(4)
  })
  it('a wall being drawn joins another wall\'s corner nearby', async () => {
    const w = plan({ tool: 'wall', tables: [], walls: [{ id: 'w', points: [[33, 47], [33, 200]] }] })
    down(w.element, 35, 45)
    down(w.element, 200, 50)
    key(w, 'Enter')
    await nextTick()
    expect((w.props('walls') as any[])[1].points).toEqual([[33, 47], [200, 50]])
  })
  it('overlap: warn outlines tables on top of each other; prevent undoes the move', async () => {
    const w = plan({ tables: [{ id: 1, label: 'A', x: 100, y: 100 }, { id: 2, label: 'B', x: 130, y: 100 }, { id: 3, label: 'C', x: 400, y: 100 }] })
    expect(table(w, 'A').classes()).toContain('m3-floor-overlap')
    expect(table(w, 'C').classes()).not.toContain('m3-floor-overlap')
    await w.setProps({ overlap: 'prevent' })
    down(table(w, 'C').element, 0, 0)
    moveUp(-260, 0)
    await nextTick()
    expect(w.props('tables')[2].x).toBe(400)
  })
  it('seatNumbers: chairs numbered, taken ones colored, a click in service emits seat-click', async () => {
    const w = plan({ editable: false, seatNumbers: true, tables: [{ id: 1, label: 'A', x: 100, y: 100, seats: 4, activeSeats: [2] }] })
    const chairs = w.findAll('[data-seat]')
    expect(chairs.map((c) => c.text())).toEqual(['1', '2', '3', '4'])
    expect(chairs[1]!.classes()).toContain('m3-floor-chair-taken')
    await chairs[2]!.trigger('click')
    expect(w.emitted('seat-click')![0]!.slice(0, 2)).toEqual([expect.objectContaining({ id: 1 }), 3])
  })
  it('measure: the picked wall\'s sides in your unit', () => {
    const w = plan({ measure: { unit: 'm', per: 100 }, walls: [{ id: 'w', points: [[0, 0], [300, 0], [300, 150]] }], picked: { kind: 'wall', id: 'w' } })
    expect(w.findAll('.m3-floor-measure').map((m: any) => m.text())).toEqual(['3.00 m', '1.50 m'])
  })
  it('toSVG draws zones, walls, decor and tables', () => {
    const w = plan({ areas: [{ id: 'z', x: 0, y: 0, width: 100, height: 100, label: 'Hall' }], walls: [{ id: 'w', points: [[0, 0], [100, 0]] }], decor: [{ id: 'd', kind: 'door', x: 50, y: 0 }] })
    const svg = w.vm.toSVG() as string
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('>Hall</text>')
    expect(svg).toContain('<polyline')
    expect(svg).toContain('>T1</text>')
    expect(svg).toContain('A60 60')
  })
  it('duplicating near the edge keeps the copy inside the plan', async () => {
    const w = plan({ width: 400, height: 300, tables: [], decor: [{ id: 'p', kind: 'plant', x: 390, y: 290 }], areas: [{ id: 'z', x: 300, y: 200, width: 100, height: 100 }], picked: { kind: 'decor', id: 'p' } })
    w.vm.duplicate()
    await nextTick()
    const copy = (w.props('decor') as any[])[1]
    expect(copy.x).toBeLessThanOrEqual(380)
    expect(copy.y).toBeLessThanOrEqual(280)
    await w.setProps({ picked: { kind: 'area', id: 'z' } })
    w.vm.duplicate()
    await nextTick()
    const z = (w.props('areas') as any[])[1]
    expect(z.x + z.width).toBeLessThanOrEqual(400)
    expect(z.y + z.height).toBeLessThanOrEqual(300)
  })
})

describe('MFloorPlan zoom and tables', () => {
  it('tables don\'t slide when the plan zooms, only when they move', async () => {
    vi.useFakeTimers()
    const w: any = mount(MFloorPlan, { props: { tables: base(), zoomable: true, zoom: 1, 'onUpdate:zoom': (v: number) => w.setProps({ zoom: v }) }, attachTo: document.body })
    const wrap = () => table(w, 'T1').element.parentElement!
    expect(wrap().className).toContain('transition-[left,top]')
    await w.setProps({ zoom: 2 })
    expect(wrap().style.left).toBe('200px')
    expect(wrap().className).not.toContain('transition-[left,top]')
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(wrap().className).toContain('transition-[left,top]')
    vi.useRealTimers()
  })
})

describe('MFloorPlan cellSize and bigger tables', () => {
  it('a table resized by cell keeps its cell and covers the next ones; dragged, it lands on whole cells', async () => {
    const w: any = mount(MFloorPlan, {
      props: { editable: true, grid: 50, cellSize: 50, width: 500, height: 300, selection: [1], tables: [{ id: 1, label: 'A', x: 2, y: 1, shape: 'square', width: 40, height: 40 }], 'onUpdate:tables': (v: FloorTable[]) => w.setProps({ tables: v }) },
      attachTo: document.body,
    })
    const wrap = () => table(w, 'A').element.parentElement!
    // A one-cell table sits in the middle of its cell
    expect(wrap().style.left).toBe('125px')
    w.find('[data-table-resize]').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 8 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 0, pointerId: 8 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 60, clientY: 0, pointerId: 8 }))
    await nextTick()
    // Two cells wide: still in cell (2, 1), covering cells 2 and 3
    expect(w.props('tables')[0]).toMatchObject({ x: 2, y: 1, width: 100, height: 40 })
    expect(wrap().style.left).toBe('150px')
    table(w, 'A').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 8 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 70, clientY: 0, pointerId: 8 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 70, clientY: 0, pointerId: 8 }))
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ x: 3, y: 1 })
    expect(wrap().style.left).toBe('200px')
  })
})

describe('MFloorPlan resizeSnap', () => {
  const drag = (el: Element, dx: number, dy: number) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0, pointerId: 12 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: dx, clientY: dy, pointerId: 12 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: dx, clientY: dy, pointerId: 12 }))
  }
  function plan(props: Record<string, unknown>) {
    const w: any = mount(MFloorPlan, {
      props: { editable: true, ...props, ...Object.fromEntries(['tables', 'decor'].map((k) => [`onUpdate:${k}`, (v: unknown) => w.setProps({ [k]: v })])) },
      attachTo: document.body,
    })
    return w
  }
  it('grid: a table by cell grows by whole cells, keeping its margin', async () => {
    const w = plan({ grid: 50, cellSize: 50, resizeSnap: 'grid', selection: [1], tables: [{ id: 1, label: 'A', x: 1, y: 1, width: 40, height: 40 }] })
    drag(w.find('[data-table-resize]').element, 62, 10)
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ width: 90, height: 40 })
  })
  it('subgrid: a table about its middle grows a step on each side; free follows the pointer', async () => {
    const w = plan({ grid: 20, subgrid: 2, resizeSnap: 'subgrid', selection: [1], tables: [{ id: 1, label: 'A', x: 100, y: 100, width: 60, height: 60 }] })
    drag(w.find('[data-table-resize]').element, 13, 3)
    await nextTick()
    // Pulled 13 (26 in all, both sides): 20, one step of 10 per side
    expect(w.props('tables')[0]).toMatchObject({ width: 80, height: 60 })
    await w.setProps({ resizeSnap: 'free' })
    drag(w.find('[data-table-resize]').element, 7, 0)
    await nextTick()
    expect(w.props('tables')[0]).toMatchObject({ width: 94 })
  })
  it('decor steps too, from its fixed corner', async () => {
    const w = plan({ grid: 20, resizeSnap: 'grid', decor: [{ id: 'd', kind: 'door', x: 100, y: 100, width: 60, height: 14 }], picked: { kind: 'decor', id: 'd' } })
    drag(w.find('[data-resize]').element, 27, 2)
    await nextTick()
    expect((w.props('decor') as any[])[0]).toMatchObject({ width: 80, height: 14 })
  })
})
