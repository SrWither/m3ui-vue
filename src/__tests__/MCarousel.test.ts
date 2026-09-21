import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MCarousel from '../components/MCarousel.vue'

const items = [
  { src: 'a.jpg', label: 'A' },
  { src: 'b.jpg', label: 'B' },
  { src: 'c.jpg', label: 'C' },
]

describe('MCarousel', () => {
  it('renders one slot per item', () => {
    const wrapper = mount(MCarousel, { props: { items } })
    expect(wrapper.findAll('img')).toHaveLength(3)
  })

  it('renders item labels', () => {
    const wrapper = mount(MCarousel, { props: { items } })
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('hides arrows when showArrows is false', () => {
    const wrapper = mount(MCarousel, { props: { items, showArrows: false } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('exposes next/prev without throwing', () => {
    const wrapper = mount(MCarousel, { props: { items } })
    expect(() => (wrapper.vm as any).next()).not.toThrow()
    expect(() => (wrapper.vm as any).prev()).not.toThrow()
  })
})
