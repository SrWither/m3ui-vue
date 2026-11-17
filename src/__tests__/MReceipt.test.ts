import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MReceipt from '../components/MReceipt.vue'

const items = [
  { name: 'Coffee', quantity: 3, price: 0.1 },
  { name: 'Croissant', price: 2.35, note: 'Warm' },
]

describe('MReceipt', () => {
  it('adds lines in cents, without float drift', () => {
    const w = mount(MReceipt, { props: { items } })
    // 3 × 0.1 = 0.30000000000000004 in floats
    expect(w.text()).toContain('0.30')
    expect(w.text()).toContain('3 × 0.10')
    expect(w.find('[data-receipt="total"]').text()).toContain('2.65')
    expect((w.vm as any).totals.total).toBe(2.65)
  })

  it('applies discounts, percentages and included taxes', () => {
    const w = mount(MReceipt, {
      props: {
        items: [{ name: 'A', price: 100 }],
        adjustments: [
          { label: 'Promo', percent: -10 },
          { label: 'VAT', percent: 21, included: true },
          { label: 'Tip', amount: 5 },
        ],
      },
    })
    expect(w.find('[data-receipt="subtotal"]').text()).toContain('100.00')
    expect(w.text()).toContain('Promo (10%)')
    expect(w.text()).toContain('-10.00')
    // VAT inside the discounted 90: 90 − 90 / 1.21
    expect(w.text()).toContain('15.62')
    expect((w.vm as any).totals.total).toBe(95)
  })

  it('shows the change when paid in excess', () => {
    const w = mount(MReceipt, {
      props: { items: [{ name: 'A', price: 37.4 }], payments: [{ method: 'Cash', amount: 50 }], currency: 'USD' },
    })
    expect(w.find('[data-receipt="change"]').text()).toContain('$12.60')
  })

  it('renders header and footer', () => {
    const w = mount(MReceipt, { props: { items, number: 'A-0042', footer: 'Thanks!' }, slots: { header: '<b>Café Sol</b>' } })
    expect(w.text()).toContain('Café Sol')
    expect(w.text()).toContain('#A-0042')
    expect(w.text()).toContain('Thanks!')
  })
})
