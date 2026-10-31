import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MGantt from '../components/MGantt.vue'
import type { GanttTask } from '../composables/ganttSchedule'

// A 1200 × 600 chart at 40 px per day, the list 320 wide
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, right: 1200, bottom: 600, width: 1200, height: 600, x: 0, y: 0, toJSON() {} }) as DOMRect)
})
afterEach(() => vi.restoreAllMocks())

const tasks = (): GanttTask[] => [
  { id: 'p', name: 'Phase', start: '2026-03-02', end: '2026-03-06' },
  { id: 'a', name: 'Design', start: '2026-03-02', end: '2026-03-04', parentId: 'p', progress: 50 },
  { id: 'b', name: 'Build', start: '2026-03-05', end: '2026-03-06', parentId: 'p', dependencies: ['a'] },
  { id: 'm', name: 'Ship', start: '2026-03-09', type: 'milestone', dependencies: ['b'] },
]
async function gantt(props: Record<string, unknown> = {}) {
  const w = mount(MGantt, { props: { tasks: tasks(), today: null, ...props }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
function pointer(el: EventTarget, type: string, x: number, y = 100, extra: Record<string, unknown> = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, ...extra }))
}
const last = (w: ReturnType<typeof mount>) => {
  const e = w.emitted('update:tasks')
  return Object.fromEntries((e!.at(-1)![0] as GanttTask[]).map((t) => [t.id, t]))
}
const bar = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-gantt-task="${id}"]`).element

describe('MGantt', () => {
  it('lists tasks as a tree, rolls summaries up and draws bars, a milestone and dependencies', async () => {
    const w = await gantt()
    const rows = w.findAll('[role="row"][data-gantt-row]')
    expect(rows.map((r) => r.attributes('data-gantt-row'))).toEqual(['p', 'a', 'b', 'm'])
    expect(rows[1]!.attributes('aria-level')).toBe('2')
    expect(w.findAll('[data-gantt-task]')).toHaveLength(4)
    expect(w.find('.m3-gantt-summary').exists()).toBe(true)
    expect(w.findAll('.m3-gantt-link')).toHaveLength(2)
    // The summary's dates come from its tasks
    expect(rows[0]!.text()).toContain('5 d')
  })

  it('drags a bar by whole days, its summary following', async () => {
    const w = await gantt()
    pointer(bar(w, 'a'), 'pointerdown', 500)
    pointer(window, 'pointermove', 520)
    pointer(window, 'pointermove', 585)
    pointer(window, 'pointerup', 585)
    const t = last(w)
    expect(t.a).toMatchObject({ start: '2026-03-04', end: '2026-03-06' })
    expect(t.p).toMatchObject({ start: '2026-03-04', end: '2026-03-06' })
    expect(w.emitted('change')!.at(-1)![0]).toMatchObject({ kind: 'move' })
  })

  it('resizes from an end, sets progress, and with schedule="auto" pushes the tasks that depend on it', async () => {
    const w = await gantt({ schedule: 'auto' })
    const handle = bar(w, 'a').parentElement!.querySelector('[data-gantt-resize="end"]')!
    pointer(handle, 'pointerdown', 500)
    pointer(window, 'pointermove', 510)
    pointer(window, 'pointermove', 580)
    pointer(window, 'pointerup', 580)
    const t = last(w)
    expect(t.a).toMatchObject({ start: '2026-03-02', end: '2026-03-06' })
    // b waited on a: it moves past a's new end, and the milestone after it
    expect(t.b).toMatchObject({ start: '2026-03-07', end: '2026-03-08' })
    expect(t.m!.start).toBe('2026-03-09')
  })

  it('draws a dependency from one bar end to another', async () => {
    const w = await gantt({ tasks: [{ id: 'x', name: 'X', start: '2026-03-02', end: '2026-03-03' }, { id: 'y', name: 'Y', start: '2026-03-05', end: '2026-03-06' }] })
    const dot = w.find('.cursor-crosshair:last-of-type').element
    document.elementFromPoint = () => bar(w, 'y')
    pointer(dot, 'pointerdown', 400)
    pointer(window, 'pointermove', 450)
    pointer(window, 'pointermove', 600)
    pointer(window, 'pointerup', 600)
    expect(w.emitted('link')![0]![0]).toMatchObject({ from: 'x', to: 'y' })
    expect(last(w).y!.dependencies).toHaveLength(1)
  })

  it('reorders rows and indents with the keyboard; undo and redo', async () => {
    const w = await gantt()
    const row = w.find('[data-gantt-row="b"]')
    await row.trigger('keydown', { key: 'ArrowUp', altKey: true })
    expect(Object.keys(last(w))).toEqual(['p', 'b', 'a', 'm'])
    await w.setProps({ tasks: w.emitted('update:tasks')!.at(-1)![0] })
    await w.find('[data-gantt-row="m"]').trigger('keydown', { key: ']', ctrlKey: true })
    expect(last(w).m!.parentId).toBe('p')
    await w.find('[data-gantt-row="a"]').trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(last(w).a).toMatchObject({ start: '2026-03-03', end: '2026-03-05' })
    const before = w.emitted('update:tasks')!.length
    await w.find('[data-gantt-row="a"]').trigger('keydown', { key: 'z', ctrlKey: true })
    expect(w.emitted('update:tasks')!.length).toBe(before + 1)
    expect(last(w).a!.start).toBe('2026-03-02')
  })

  it('folds a summary, keeping its links drawn from it', async () => {
    const w = await gantt({ tasks: [...tasks(), { id: 'z', name: 'After', start: '2026-03-10', end: '2026-03-11', dependencies: ['a'] }] })
    await w.find('[aria-label="Collapse"]').trigger('click')
    expect(w.emitted('update:collapsed')![0]![0]).toEqual(['p'])
    expect(w.findAll('[data-gantt-row]').map((r) => r.attributes('data-gantt-row'))).toEqual(['p', 'm', 'z'])
    // a → z now runs from the folded phase
    expect(w.findAll('.m3-gantt-link').length).toBeGreaterThan(0)
  })

  it('marks the critical path', async () => {
    const w = await gantt({ criticalPath: true, tasks: [
      { id: 'a', name: 'A', start: '2026-03-02', end: '2026-03-03' },
      { id: 'b', name: 'B', start: '2026-03-04', end: '2026-03-09', dependencies: ['a'] },
      { id: 'c', name: 'C', start: '2026-03-04', end: '2026-03-04', dependencies: ['a'] },
    ] })
    expect(bar(w, 'b').className).toContain('bg-error-container')
    expect(bar(w, 'c').className).not.toContain('bg-error-container')
    expect(w.findAll('.m3-gantt-link.text-error')).toHaveLength(1)
  })

  it('readonly: no drag', async () => {
    const w = await gantt({ readonly: true })
    pointer(bar(w, 'a'), 'pointerdown', 500)
    pointer(window, 'pointermove', 600)
    pointer(window, 'pointerup', 600)
    expect(w.emitted('update:tasks')).toBeUndefined()
  })
})
