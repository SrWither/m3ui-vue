import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MToggleButton from '../components/MToggleButton.vue'

describe('MToggleButton', () => {
  it('reflects checked via aria-pressed', () => {
    const wrapper = mount(MToggleButton, { props: { checked: false } })
    expect(wrapper.attributes('aria-pressed')).toBe('false')
  })

  it('emits update:checked toggled on click', async () => {
    const wrapper = mount(MToggleButton, { props: { checked: false } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:checked')?.[0]).toEqual([true])
  })

  it('does not emit when disabled', async () => {
    const wrapper = mount(MToggleButton, { props: { checked: false, disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:checked')).toBeUndefined()
  })

  it('renders an icon when given', () => {
    const wrapper = mount(MToggleButton, { props: { checked: false, icon: 'star' } })
    expect(wrapper.findComponent({ name: 'MIcon' }).exists()).toBe(true)
  })
})
