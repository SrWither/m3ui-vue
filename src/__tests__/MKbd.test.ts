import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MKbd from '../components/MKbd.vue'

describe('MKbd', () => {
  it('splits a "+"-delimited string into separate kbd elements', () => {
    const wrapper = mount(MKbd, { props: { keys: 'Ctrl+Shift+K' } })
    const kbds = wrapper.findAll('kbd')
    expect(kbds.map((k) => k.text())).toEqual(['Ctrl', 'Shift', 'K'])
  })

  it('accepts an array of keys directly', () => {
    const wrapper = mount(MKbd, { props: { keys: ['Cmd', 'K'] } })
    const kbds = wrapper.findAll('kbd')
    expect(kbds.map((k) => k.text())).toEqual(['Cmd', 'K'])
  })

  it('renders a single key with no separator', () => {
    const wrapper = mount(MKbd, { props: { keys: 'Esc' } })
    expect(wrapper.findAll('kbd')).toHaveLength(1)
    expect(wrapper.text()).toBe('Esc')
  })

  it('renders the separator between keys, but not trailing', () => {
    const wrapper = mount(MKbd, { props: { keys: 'Ctrl+K' } })
    expect(wrapper.text()).toBe('Ctrl+K')
  })

  it('supports a custom separator', () => {
    const wrapper = mount(MKbd, { props: { keys: ['Ctrl', 'K'], separator: ' then ' } })
    expect(wrapper.text()).toBe('Ctrl then K')
  })
})
