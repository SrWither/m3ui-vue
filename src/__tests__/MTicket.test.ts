import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MTicket from '../components/MTicket.vue'

describe('MTicket', () => {
  it('renders the route, fields and stub', () => {
    const w = mount(MTicket, {
      props: {
        title: 'Aerolíneas',
        from: { code: 'EZE', name: 'Buenos Aires', time: '08:40' },
        to: { code: 'MDZ', name: 'Mendoza', time: '10:35' },
        fields: [{ label: 'Gate', value: 'B12' }, { label: 'Seat', value: '14C', strong: true }],
      },
      slots: { stub: '<div data-test="qr">QR</div>' },
    })
    expect(w.find('[data-route]').text()).toContain('EZE')
    expect(w.find('[data-route]').text()).toContain('MDZ')
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['Gate', 'Seat'])
    expect(w.find('[data-test="qr"]').exists()).toBe(true)
    expect(w.find('.m3-ticket__perforation').exists()).toBe(true)
  })

  it('has no stub or route when not given', () => {
    const w = mount(MTicket, { props: { title: 'Coupon' }, slots: { default: '20% off' } })
    expect(w.find('.m3-ticket__stub').exists()).toBe(false)
    expect(w.find('[data-route]').exists()).toBe(false)
    expect(w.text()).toContain('20% off')
  })

  it('colors the band with a role or a CSS color', async () => {
    const w = mount(MTicket, { props: { title: 'T', color: 'tertiary' } })
    const band = () => w.find('.m3-ticket__main > div').attributes('style')
    expect(band()).toContain('var(--color-tertiary)')
    await w.setProps({ color: 'secondary', orientation: 'vertical' })
    expect(band()).toContain('var(--color-secondary)')
    expect(w.attributes('data-orientation')).toBe('vertical')
  })
})
