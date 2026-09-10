import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSignaturePad from '../components/MSignaturePad.vue'

function draw(wrapper: ReturnType<typeof mount>) {
  const canvas = wrapper.find('canvas')
  return canvas
    .trigger('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
    .then(() => canvas.trigger('pointermove', { clientX: 20, clientY: 20, pointerId: 1 }))
    .then(() => canvas.trigger('pointerup', { pointerId: 1 }))
}

describe('MSignaturePad', () => {
  it('starts empty', () => {
    const wrapper = mount(MSignaturePad)
    expect((wrapper.vm as any).isEmpty()).toBe(true)
  })

  it('is no longer empty after drawing a stroke', async () => {
    const wrapper = mount(MSignaturePad)
    await draw(wrapper)
    expect((wrapper.vm as any).isEmpty()).toBe(false)
  })

  it('emits begin, end and change with a data URL', async () => {
    const wrapper = mount(MSignaturePad)
    await draw(wrapper)
    expect(wrapper.emitted('begin')).toHaveLength(1)
    expect(wrapper.emitted('end')).toHaveLength(1)
    expect(wrapper.emitted('end')![0]![0]).toMatch(/^data:/)
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('clear() empties the pad', async () => {
    const wrapper = mount(MSignaturePad)
    await draw(wrapper)
    ;(wrapper.vm as any).clear()
    expect((wrapper.vm as any).isEmpty()).toBe(true)
  })

  it('undo() removes only the last stroke', async () => {
    const wrapper = mount(MSignaturePad)
    await draw(wrapper)
    await draw(wrapper)
    ;(wrapper.vm as any).undo()
    expect((wrapper.vm as any).isEmpty()).toBe(false)
    ;(wrapper.vm as any).undo()
    expect((wrapper.vm as any).isEmpty()).toBe(true)
  })

  it('does not draw when disabled', async () => {
    const wrapper = mount(MSignaturePad, { props: { disabled: true } })
    await draw(wrapper)
    expect((wrapper.vm as any).isEmpty()).toBe(true)
    expect(wrapper.emitted('begin')).toBeUndefined()
  })

  it('exposes toDataURL()', () => {
    const wrapper = mount(MSignaturePad)
    expect((wrapper.vm as any).toDataURL()).toMatch(/^data:/)
  })
})
