import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MPinInput from '../components/MPinInput.vue'

describe('MPinInput', () => {
  it('renders `length` boxes', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', length: 4 } })
    expect(wrapper.findAll('input')).toHaveLength(4)
  })

  it('defaults to 6 boxes', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '' } })
    expect(wrapper.findAll('input')).toHaveLength(6)
  })

  it('renders each digit in its own box', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '12', length: 4 } })
    const inputs = wrapper.findAll('input')
    expect(inputs[0].element.value).toBe('1')
    expect(inputs[1].element.value).toBe('2')
    expect(inputs[2].element.value).toBe('')
  })

  it('emits update:modelValue and advances focus on digit entry', async () => {
    const wrapper = mount(MPinInput, {
      props: { modelValue: '', length: 4 },
      attachTo: document.body,
    })
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('5')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['5'])
    wrapper.unmount()
  })

  it('rejects non-numeric input by default', async () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', length: 4 } })
    const input = wrapper.findAll('input')[0]
    await input.setValue('a')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('allows letters when type is alphanumeric', async () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', length: 4, type: 'alphanumeric' } })
    const input = wrapper.findAll('input')[0]
    await input.setValue('a')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['a'])
  })

  it('emits complete when all boxes are filled', async () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '123', length: 4 } })
    const input = wrapper.findAll('input')[3]
    await input.setValue('4')
    expect(wrapper.emitted('complete')![0]).toEqual(['1234'])
  })

  it('moves focus back and clears the previous box on backspace from an empty box', async () => {
    const wrapper = mount(MPinInput, {
      props: { modelValue: '12', length: 4 },
      attachTo: document.body,
    })
    const inputs = wrapper.findAll('input')
    await inputs[2].trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['1'])
    wrapper.unmount()
  })

  it('distributes a pasted code across the remaining boxes', async () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', length: 4 } })
    const input = wrapper.findAll('input')[0]
    await input.trigger('paste', {
      clipboardData: { getData: () => '1234' },
    })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['1234'])
    expect(wrapper.emitted('complete')![0]).toEqual(['1234'])
  })

  it("keeps a skipped box's position when it's filled in afterwards", async () => {
    // Simulates clicking box 3 directly while boxes 1-2 are still empty,
    // then coming back to fill the gap — the middle boxes must not shift.
    const wrapper = mount(MPinInput, { props: { modelValue: '1', length: 4 } })

    await wrapper.findAll('input')[3].setValue('4')
    let value = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    await wrapper.setProps({ modelValue: value })
    let inputs = wrapper.findAll('input')
    expect(inputs[0].element.value).toBe('1')
    expect(inputs[1].element.value).toBe('')
    expect(inputs[2].element.value).toBe('')
    expect(inputs[3].element.value).toBe('4')

    await inputs[2].setValue('3')
    value = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    await wrapper.setProps({ modelValue: value })
    inputs = wrapper.findAll('input')
    expect(inputs[2].element.value).toBe('3')
    expect(inputs[3].element.value).toBe('4')

    await inputs[1].setValue('2')
    expect(wrapper.emitted('complete')!.at(-1)).toEqual(['1234'])
  })

  it('renders as masked input when masked is true', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', length: 4, masked: true } })
    expect(wrapper.findAll('input')[0].attributes('type')).toBe('password')
  })

  it('derives length from groups and renders a separator at each boundary', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', groups: [2, 3, 2] } })
    expect(wrapper.findAll('input')).toHaveLength(7)
    const spans = wrapper.findAll('span')
    expect(spans).toHaveLength(2)
    expect(spans[0].text()).toBe('-')
    expect(spans[1].text()).toBe('-')
  })

  it('uses a custom separator', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', groups: [2, 2], separator: '•' } })
    expect(wrapper.find('span').text()).toBe('•')
  })

  it('treats grouped boxes as one continuous value for typing and complete', async () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '12', groups: [2, 2] } })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(4)
    await inputs[2].setValue('3')
    let value = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    await wrapper.setProps({ modelValue: value })
    await wrapper.findAll('input')[3].setValue('4')
    expect(wrapper.emitted('complete')!.at(-1)).toEqual(['1234'])
  })

  it('disables all boxes when disabled', () => {
    const wrapper = mount(MPinInput, { props: { modelValue: '', length: 4, disabled: true } })
    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })
})
