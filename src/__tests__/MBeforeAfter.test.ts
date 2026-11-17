import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MBeforeAfter from '../components/MBeforeAfter.vue'

function mockRect(el: Element, width = 200, height = 100) {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }) as DOMRect
}

function pointer(type: string, init: Partial<PointerEventInit>) {
  return new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, pointerType: 'mouse', ...init })
}

describe('MBeforeAfter', () => {
  it('clips the before layer at the position', () => {
    const w = mount(MBeforeAfter, { props: { modelValue: 30, before: 'a.jpg', after: 'b.jpg' } })
    const clipped = w.findAll('div').find((d) => d.attributes('style')?.includes('clip-path'))
    expect(clipped?.attributes('style')).toContain('inset(0 70% 0 0)')
  })

  it('moves the split to the pointer and follows the drag', async () => {
    const w = mount(MBeforeAfter, { props: { before: 'a.jpg', after: 'b.jpg' } })
    mockRect(w.element)
    w.element.dispatchEvent(pointer('pointerdown', { clientX: 50 }))
    w.element.dispatchEvent(pointer('pointermove', { clientX: 150 }))
    w.element.dispatchEvent(pointer('pointerup', { clientX: 150 }))
    expect(w.emitted('update:modelValue')).toEqual([[25], [75]])
    expect(w.emitted('change')).toEqual([[75]])
  })

  it('uses the vertical axis', async () => {
    const w = mount(MBeforeAfter, { props: { orientation: 'vertical' } })
    mockRect(w.element)
    w.element.dispatchEvent(pointer('pointerdown', { clientY: 20 }))
    expect(w.emitted('update:modelValue')?.[0]).toEqual([20])
  })

  it('follows a hovering mouse only with hover', async () => {
    const w = mount(MBeforeAfter)
    mockRect(w.element)
    w.element.dispatchEvent(pointer('pointermove', { clientX: 40 }))
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.setProps({ hover: true })
    w.element.dispatchEvent(pointer('pointermove', { clientX: 40 }))
    expect(w.emitted('update:modelValue')?.[0]).toEqual([20])
  })

  it('steps with the keyboard and clamps', async () => {
    const w = mount(MBeforeAfter, { props: { modelValue: 50 } })
    const slider = w.find('[role="slider"]')
    await slider.trigger('keydown', { key: 'ArrowRight' })
    await w.setProps({ modelValue: 51 })
    await slider.trigger('keydown', { key: 'PageDown' })
    await w.setProps({ modelValue: 41 })
    await slider.trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')).toEqual([[51], [41], [100]])
    expect(slider.attributes('aria-valuenow')).toBe('100')
  })

  it('ignores input when disabled', async () => {
    const w = mount(MBeforeAfter, { props: { disabled: true } })
    mockRect(w.element)
    w.element.dispatchEvent(pointer('pointerdown', { clientX: 10 }))
    await w.find('[role="slider"]').trigger('keydown', { key: 'Home' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('hides a label given as an empty string', () => {
    const w = mount(MBeforeAfter, { props: { beforeLabel: '', afterLabel: 'Now' } })
    expect(w.text()).not.toContain('Before')
    expect(w.text()).toContain('Now')
  })

  it('has no position utility on its root', () => {
    const w = mount(MBeforeAfter)
    expect(w.classes()).not.toContain('relative')
    expect(w.classes()).toContain('m3-before-after')
  })
})
