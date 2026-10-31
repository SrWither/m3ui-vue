import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MResourceTimeline from '../components/MResourceTimeline.vue'
import type { TimelineEvent, TimelineResource } from '../composables/useResourceTimeline'

// 1200 × 600, the list 220 wide, 240 px a day = 10 px an hour; rows 56 high under a 56 px header
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, right: 1200, bottom: 600, width: 1200, height: 600, x: 0, y: 0, toJSON() {} }) as DOMRect)
})
afterEach(() => vi.restoreAllMocks())

const resources: TimelineResource[] = [
  { id: 'ana', name: 'Ana Ruiz', group: 'Kitchen' },
  { id: 'leo', name: 'Leo Paz', group: 'Kitchen' },
  { id: 'mia', name: 'Mia Sol', group: 'Floor', capacity: 2 },
]
const events = (): TimelineEvent[] => [
  { id: 's1', resourceId: 'ana', start: '2026-03-02T09:00', end: '2026-03-02T17:00', title: 'Morning' },
  { id: 's2', resourceId: 'ana', start: '2026-03-02T16:00', end: '2026-03-02T22:00', title: 'Evening' },
  { id: 's3', resourceId: 'mia', start: '2026-03-02T10:00', end: '2026-03-02T14:00', title: 'Lunch' },
  { id: 's4', resourceId: 'mia', start: '2026-03-02T11:00', end: '2026-03-02T15:00', title: 'Lunch 2' },
]
async function timeline(props: Record<string, unknown> = {}) {
  const w = mount(MResourceTimeline, { props: { resources, events: events(), now: null, start: '2026-03-02T00:00', ...props }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
function pointer(el: EventTarget, type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, ...extra }))
}
const block = (w: ReturnType<typeof mount>, title: string) => w.findAll('[data-timeline-event]').find((b) => b.text().includes(title))!
const last = (w: ReturnType<typeof mount>) => Object.fromEntries((w.emitted('update:events')!.at(-1)![0] as TimelineEvent[]).map((e) => [e.id, e]))

describe('MResourceTimeline', () => {
  it('groups resources, stacks overlaps in lanes and marks conflicts past capacity', async () => {
    const w = await timeline()
    expect(w.findAll('button[aria-expanded]').map((b) => b.text().replace('expand_more', ''))).toEqual(['Kitchen2', 'Floor1'])
    expect(w.findAll('[data-timeline-event]')).toHaveLength(4)
    // Ana holds one at a time: her two overlap; Mia holds two
    expect(block(w, 'Morning').classes()).toContain('outline-error')
    expect(block(w, 'Lunch 2').classes()).not.toContain('outline-error')
  })

  it('moves a booking in time by snapped steps and to another resource', async () => {
    const w = await timeline()
    const y = 56 + 40 + 20
    pointer(block(w, 'Lunch').element, 'pointerdown', 500, y)
    pointer(window, 'pointermove', 510, y)
    // 1 hour right (10 px) plus a bit, and down into Leo's row (Kitchen header 40, Ana's row is two lanes high)
    pointer(window, 'pointermove', 512, 56 + 40 + 88 + 20)
    pointer(window, 'pointerup', 512, 56 + 40 + 88 + 20)
    const e = last(w)
    expect(e.s3).toMatchObject({ resourceId: 'leo', start: '2026-03-02T11:15', end: '2026-03-02T15:15' })
    expect(w.emitted('change')![0]![0]).toMatchObject({ kind: 'move' })
  })

  it("overlap='prevent' refuses a drop that conflicts", async () => {
    const w = await timeline({ overlap: 'prevent', events: events().filter((e) => e.id !== 's2') })
    // Lunch onto Ana, who's busy 9 to 5
    pointer(block(w, 'Lunch').element, 'pointerdown', 500, 300)
    pointer(window, 'pointermove', 510, 300)
    pointer(window, 'pointermove', 500, 56 + 40 + 20)
    pointer(window, 'pointerup', 500, 56 + 40 + 20)
    expect(w.emitted('update:events')).toBeUndefined()
    expect(w.emitted('conflict')![0]![0]).toMatchObject({ event: { id: 's3', resourceId: 'ana' } })
  })

  it('with creatable, dragging across empty time asks for a booking', async () => {
    const w = await timeline({ creatable: true })
    const pane = w.findAll('.relative.shrink-0').at(-1)!.element
    const y = 56 + 40 + 88 + 20
    // From 02:00 to 05:00 on Leo (the view starts 48 px before `start`)
    pointer(pane, 'pointerdown', 220 + 48 + 20, y)
    pointer(window, 'pointermove', 220 + 48 + 30, y)
    pointer(window, 'pointermove', 220 + 48 + 50, y)
    pointer(window, 'pointerup', 220 + 48 + 50, y)
    expect(w.emitted('create')![0]![0]).toEqual({ resourceId: 'leo', start: '2026-03-02T02:00', end: '2026-03-02T05:00' })
  })

  it('keyboard: arrows move and resize, up/down change resource, undo', async () => {
    const w = await timeline()
    await block(w, 'Lunch').trigger('keydown', { key: 'ArrowRight' })
    expect(last(w).s3!.start).toBe('2026-03-02T10:15')
    await block(w, 'Lunch').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(last(w).s3!.end).toBe('2026-03-02T14:30')
    await block(w, 'Lunch').trigger('keydown', { key: 'ArrowUp' })
    expect(last(w).s3!.resourceId).toBe('leo')
    await block(w, 'Lunch').trigger('keydown', { key: 'z', ctrlKey: true })
    expect(last(w).s3!.resourceId).toBe('mia')
  })

  it('folds a group', async () => {
    const w = await timeline()
    await w.findAll('button[aria-expanded]')[0]!.trigger('click')
    expect(w.emitted('update:collapsed')![0]![0]).toEqual(['Kitchen'])
    expect(w.findAll('[data-timeline-event]')).toHaveLength(2)
  })
})
