import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MQRCode from '../components/MQRCode.vue'

describe('MQRCode', () => {
  it('renders an svg with the given size', () => {
    const wrapper = mount(MQRCode, { props: { value: 'https://example.com', size: 150 } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('width')).toBe('150')
    expect(svg.attributes('height')).toBe('150')
  })

  it('defaults the aria-label to the encoded value', () => {
    const wrapper = mount(MQRCode, { props: { value: 'https://example.com' } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('https://example.com')
  })

  it('uses a custom label when provided', () => {
    const wrapper = mount(MQRCode, { props: { value: 'https://example.com', label: 'Table 5 menu' } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Table 5 menu')
  })

  it('defaults to plain square modules (rects, no arcs)', () => {
    const wrapper = mount(MQRCode, { props: { value: 'hi', color: '#ff0000', background: '#eeeeee' } })
    const rects = wrapper.findAll('rect')
    expect(rects[0].attributes('fill')).toBe('#eeeeee')
    const moduleRects = rects.slice(1)
    expect(moduleRects.length).toBeGreaterThan(1)
    expect(moduleRects.every((r) => r.attributes('fill') === '#ff0000')).toBe(true)
    expect(wrapper.findAll('path')).toHaveLength(0)
  })

  it('rounds only the outer container when rounded is true', () => {
    const rounded = mount(MQRCode, { props: { value: 'hi', rounded: true } })
    const square = mount(MQRCode, { props: { value: 'hi', rounded: false } })
    expect(Number(rounded.find('rect').attributes('rx'))).toBeGreaterThan(0)
    expect(Number(square.find('rect').attributes('rx'))).toBe(0)
    // modules are always plain rects with no rx, regardless of `rounded`
    expect(rounded.findAll('rect').slice(1).every((r) => !r.attributes('rx'))).toBe(true)
  })

  it('renders dot-style modules as paths when moduleStyle is "dots"', () => {
    const wrapper = mount(MQRCode, { props: { value: 'hi', moduleStyle: 'dots', color: '#ff0000' } })
    const paths = wrapper.findAll('path')
    expect(paths.length).toBeGreaterThan(1)
    expect(paths.every((p) => p.attributes('fill') === '#ff0000')).toBe(true)
    // isolated modules should have rounded/circular corners (arc commands)
    expect(paths.some((p) => p.attributes('d')!.includes('A'))).toBe(true)
  })

  it('falls back to an error message when the data is too large to encode', () => {
    const tooLong = 'x'.repeat(5000)
    const wrapper = mount(MQRCode, { props: { value: tooLong } })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.text().length).toBeGreaterThan(0)
  })
})
