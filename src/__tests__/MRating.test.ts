import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MRating from '../components/MRating.vue'

// Items are laid out as 32px-wide boxes (size 28 + 4) starting at x=0.
function mockLayout(wrapper: ReturnType<typeof mount>) {
  const items = wrapper.findAll('[role="slider"] > span')
  items.forEach((item, i) => {
    const left = i * 32
    item.element.getBoundingClientRect = () =>
      ({ left, right: left + 32, width: 32, top: 0, bottom: 32, height: 32, x: left, y: 0 }) as DOMRect
  })
}

function filledWidths(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.start-0.overflow-hidden').map((el) => el.attributes('style'))
}

describe('MRating', () => {
  it('renders the filled part of a half value', () => {
    const wrapper = mount(MRating, { props: { modelValue: 2.5 } })
    const widths = filledWidths(wrapper)
    expect(widths[1]).toContain('width: 100%')
    expect(widths[2]).toContain('width: 50%')
    expect(widths[3]).toContain('width: 0%')
  })

  it('renders arbitrary fractions exactly', () => {
    const wrapper = mount(MRating, { props: { modelValue: 4.25, readonly: true } })
    expect(filledWidths(wrapper)[4]).toContain('width: 25%')
  })

  it('does not reset to 0 when clicking the current value again', async () => {
    const wrapper = mount(MRating, { props: { modelValue: 3 } })
    mockLayout(wrapper)
    const root = wrapper.find('[role="slider"]')
    root.element.setPointerCapture = () => {}
    root.element.releasePointerCapture = () => {}
    await root.trigger('pointerdown', { button: 0, clientX: 80, pointerId: 1 })
    await root.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('picks a half value from the left half of an item', async () => {
    const wrapper = mount(MRating, { props: { modelValue: 0, halfIncrements: true } })
    mockLayout(wrapper)
    const root = wrapper.find('[role="slider"]')
    root.element.setPointerCapture = () => {}
    await root.trigger('pointerdown', { button: 0, clientX: 70, pointerId: 1 })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([2.5])
  })

  it('steps with the keyboard and clamps to range', async () => {
    const wrapper = mount(MRating, { props: { modelValue: 1, halfIncrements: true } })
    const root = wrapper.find('[role="slider"]')
    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('keydown', { key: 'Home' })
    await root.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[1.5], [0], [5]])
  })

  it('ignores input when readonly or disabled', async () => {
    const ro = mount(MRating, { props: { modelValue: 2, readonly: true } })
    await ro.find('[role="img"]').trigger('keydown', { key: 'ArrowRight' })
    expect(ro.emitted('update:modelValue')).toBeUndefined()

    const dis = mount(MRating, { props: { modelValue: 2, disabled: true } })
    expect(dis.find('[role="slider"]').attributes('tabindex')).toBeUndefined()
    await dis.find('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(dis.emitted('update:modelValue')).toBeUndefined()
  })
})
