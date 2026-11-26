import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MDashboardGrid from '../components/MDashboardGrid.vue'
import type { DashboardItem } from '../composables/dashboardLayout'

let width = 1200
let wrapper: VueWrapper | undefined
beforeEach(() => {
  width = 1200
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return (this as HTMLElement).classList.contains('m3-dashboard-grid') ? width : 0 } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

// 12 columns over 1200px with 16px gaps: a column is 85.33px, a step 101.33px; rows are 96px, a step 112px
const base = (): (DashboardItem & { label: string })[] => [
  { id: 'a', x: 0, y: 0, w: 6, h: 2, label: 'Sales' },
  { id: 'b', x: 6, y: 0, w: 6, h: 2, label: 'Visitors' },
  { id: 'c', x: 0, y: 2, w: 12, h: 1, label: 'Orders', static: false },
]

async function mountGrid(props: Record<string, unknown> = {}) {
  const layout = ref(base())
  const Host = defineComponent({
    setup: () => () => h(MDashboardGrid, { modelValue: layout.value, 'onUpdate:modelValue': (v: typeof layout.value) => (layout.value = v), ...props }, {
      item: ({ item }: { item: DashboardItem & { label: string } }) => h('div', { class: 'card' }, item.label),
    }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  await nextTick()
  await nextTick()
  return layout
}

const items = () => wrapper!.findAll('.m3-dashboard-grid__item')
const item = (label: string) => items().find((i) => i.text().includes(label))!

describe('MDashboardGrid', () => {
  it('places widgets on the grid by their cells', async () => {
    await mountGrid()
    const b = item('Visitors').element as HTMLElement
    expect(b.style.transform).toBe('translate(608px, 0px)')
    expect(parseFloat(b.style.width)).toBeCloseTo(592, 0)
    expect(b.style.height).toBe('208px')
    expect((wrapper!.find('.m3-dashboard-grid').element as HTMLElement).style.height).toBe('320px')
  })

  it('moves a widget with the mouse, pushing the one it lands on below', async () => {
    const layout = await mountGrid()
    const a = item('Sales').element
    a.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, pointerType: 'mouse', bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 110, clientY: 50, pointerType: 'mouse' }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 708, clientY: 50, pointerType: 'mouse' }))
    await nextTick()
    // The landing spot shows
    expect(wrapper!.find('.border-dashed').exists()).toBe(true)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }))
    await nextTick()
    const pos = Object.fromEntries(layout.value.map((i) => [i.id, [i.x, i.y, i.w, i.h]]))
    expect(pos).toEqual({ a: [6, 0, 6, 2], b: [6, 2, 6, 2], c: [0, 4, 12, 1] })
    // Labels and other fields kept
    expect(layout.value[0]!.label).toBe('Sales')
  })

  it('resizes from the corner', async () => {
    const layout = await mountGrid()
    const corner = item('Sales').find('[data-dashboard-resize]').element
    corner.dispatchEvent(new PointerEvent('pointerdown', { clientX: 590, clientY: 200, button: 0, pointerType: 'mouse', bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 590, clientY: 312, pointerType: 'mouse' }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }))
    await nextTick()
    expect(layout.value.find((i) => i.id === 'a')).toMatchObject({ w: 6, h: 3 })
    expect(layout.value.find((i) => i.id === 'c')).toMatchObject({ y: 3 })
  })

  it('needs a long press with a finger, and a moving finger is a scroll', async () => {
    const layout = await mountGrid()
    const a = item('Sales').element
    a.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, pointerType: 'touch', bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 90, pointerType: 'touch' }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }))
    await nextTick()
    expect(layout.value).toEqual(base())
  })

  it('moves and resizes with the keyboard, and Escape puts it back', async () => {
    const layout = await mountGrid()
    const a = item('Sales')
    await a.trigger('keydown', { key: ' ' })
    expect(wrapper!.find('[aria-live]').text()).toContain('Picked up Sales')
    await a.trigger('keydown', { key: 'ArrowRight' })
    // b is pushed below; compaction floats nothing into an empty spot, so down alone wouldn't stick
    expect(layout.value.find((i) => i.id === 'a')).toMatchObject({ x: 1, y: 0 })
    await a.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(layout.value.find((i) => i.id === 'a')!.h).toBe(3)
    await nextTick()
    expect(wrapper!.find('[aria-live]').text()).toContain('Sales: column 2, row 1, 6 by 3')
    await a.trigger('keydown', { key: 'Escape' })
    expect(layout.value.find((i) => i.id === 'a')).toMatchObject({ x: 0, y: 0, w: 6 })
  })

  it('leaves static widgets and read-only grids alone', async () => {
    const layout = await mountGrid({ editable: false })
    expect(item('Sales').attributes('tabindex')).toBeUndefined()
    expect(wrapper!.find('[data-dashboard-resize]').exists()).toBe(false)
    item('Sales').element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 50, button: 0, pointerType: 'mouse', bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 700, clientY: 50, pointerType: 'mouse' }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }))
    expect(layout.value).toEqual(base())
  })

  it('stacks in one column below the breakpoint, in reading order', async () => {
    width = 400
    await mountGrid()
    expect(items().map((i) => i.text())).toEqual(['Sales', 'Visitors', 'Orders'])
    expect(wrapper!.find('[data-dashboard-resize]').exists()).toBe(false)
  })
})
