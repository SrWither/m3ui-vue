import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MBarcode from '../components/MBarcode.vue'

// happy-dom's canvas.getContext('2d') returns null, and jsbarcode uses it to
// measure the text label width — so tests here disable displayValue to avoid
// that gap (a real browser has no such issue).
describe('MBarcode', () => {
  it('renders an svg with barcode content for a valid value', () => {
    const wrapper = mount(MBarcode, { props: { value: '123456789012', displayValue: false } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.element.childElementCount).toBeGreaterThan(0)
  })

  it('defaults the aria-label to the encoded value', () => {
    const wrapper = mount(MBarcode, { props: { value: 'ORDER-123', displayValue: false } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('ORDER-123')
  })

  it('uses a custom label when provided', () => {
    const wrapper = mount(MBarcode, { props: { value: 'ORDER-123', label: 'Order number', displayValue: false } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Order number')
  })

  it('shows an error slot fallback for a value invalid in the given format', async () => {
    const wrapper = mount(MBarcode, { props: { value: 'not-a-valid-ean', format: 'EAN13', displayValue: false } })
    await nextTick()
    expect(wrapper.find('svg').attributes('style')).toContain('display: none')
    expect(wrapper.text().length).toBeGreaterThan(0)
  })

  it('re-renders when the value changes', async () => {
    const wrapper = mount(MBarcode, { props: { value: '111111111111', displayValue: false } })
    const first = wrapper.find('svg').html()
    await wrapper.setProps({ value: '222222222222' })
    expect(wrapper.find('svg').html()).not.toBe(first)
  })
})
