import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MAlert from '../components/MAlert.vue'

describe('MAlert', () => {
  it('renders slot content', () => {
    const wrapper = mount(MAlert, {
      slots: { default: 'Alert message' },
    })
    expect(wrapper.text()).toContain('Alert message')
  })

  it('renders title when provided', () => {
    const wrapper = mount(MAlert, {
      props: { title: 'Warning' },
      slots: { default: 'Content' },
    })
    expect(wrapper.text()).toContain('Warning')
  })

  it('defaults to info type', () => {
    const wrapper = mount(MAlert, {
      slots: { default: 'Content' },
    })
    expect(wrapper.find('[class*="primary"]').exists()).toBe(true)
  })

  it('shows close button when closeable', () => {
    const wrapper = mount(MAlert, {
      props: { closeable: true },
      slots: { default: 'Content' },
    })
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('hides close button by default', () => {
    const wrapper = mount(MAlert, {
      slots: { default: 'Content' },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('emits close when button clicked', async () => {
    const wrapper = mount(MAlert, {
      props: { closeable: true },
      slots: { default: 'Content' },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('uses closeAriaLabel prop', () => {
    const wrapper = mount(MAlert, {
      props: { closeable: true, closeAriaLabel: 'Dismiss' },
      slots: { default: 'Content' },
    })
    expect(wrapper.find('button').attributes('aria-label')).toBe('Dismiss')
  })
})
