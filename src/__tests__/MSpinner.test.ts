import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSpinner from '../components/MSpinner.vue'

describe('MSpinner', () => {
  it('renders with default size', () => {
    const wrapper = mount(MSpinner)
    const span = wrapper.find('span')
    expect(span.attributes('style')).toContain('width: 20px')
  })

  it('respects custom size', () => {
    const wrapper = mount(MSpinner, { props: { size: 48 } })
    const span = wrapper.find('span')
    expect(span.attributes('style')).toContain('width: 48px')
  })

  it('uses locale default for aria-label', () => {
    const wrapper = mount(MSpinner)
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Loading')
  })

  it('uses custom label prop', () => {
    const wrapper = mount(MSpinner, { props: { label: 'Cargando' } })
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('Cargando')
  })

  it('renders standard spinner by default', () => {
    const wrapper = mount(MSpinner)
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('renders wavy spinner when wavy=true', () => {
    const wrapper = mount(MSpinner, { props: { wavy: true } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
