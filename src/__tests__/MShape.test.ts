import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MShape from '../components/MShape.vue'

describe('MShape', () => {
  it('renders a filled path when there is no default slot', () => {
    const wrapper = mount(MShape, { props: { shape: 'Heart' } })
    const path = wrapper.find('svg[viewBox] path')
    expect(path.exists()).toBe(true)
    expect(path.attributes('d')).toMatch(/^M/)
    expect(path.attributes('fill')).toBe('currentColor')
  })

  it('respects a custom fill color', () => {
    const wrapper = mount(MShape, { props: { shape: 'Circle', fill: 'red' } })
    expect(wrapper.find('svg[viewBox] path').attributes('fill')).toBe('red')
  })

  it('clips slot content instead of rendering a filled shape when a slot is given', () => {
    const wrapper = mount(MShape, {
      props: { shape: 'Pentagon' },
      slots: { default: '<img src="x.png" />' },
    })
    expect(wrapper.find('svg[viewBox]').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(true)
    const clipDiv = wrapper.find('img').element.parentElement as HTMLElement
    expect(clipDiv.style.clipPath).toMatch(/^url\(#m3-shape-/)
  })

  it('defines a clipPath element with a unique id', () => {
    const wrapper = mount(MShape, { props: { shape: 'Gem' } })
    const clipPath = wrapper.find('clipPath')
    expect(clipPath.exists()).toBe(true)
    expect(clipPath.attributes('clipPathUnits')).toBe('objectBoundingBox')
  })
})
