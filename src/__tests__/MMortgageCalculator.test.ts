import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MMortgageCalculator from '../components/MMortgageCalculator.vue'
import type { MortgageInput } from '../components/MMortgageCalculator.vue'

const input: MortgageInput = { price: 250_000, down: 50_000, rate: 6, years: 30 }

function setup(extra: Record<string, unknown> = {}) {
  const w = mount(MMortgageCalculator, {
    props: { modelValue: input, currency: 'USD', 'onUpdate:modelValue': (v: MortgageInput) => w.setProps({ modelValue: v }), ...extra },
  })
  return w
}

describe('MMortgageCalculator', () => {
  it('shows the monthly payment of the loan', () => {
    const w = setup()
    expect(w.find('[data-loan]').text()).toBe('$200,000')
    expect(w.find('[data-monthly]').text()).toBe('$1,199.10')
  })

  it('changes the term from the chips', async () => {
    const w = setup()
    await w.find('[data-term="15"]').trigger('click')
    expect(w.props('modelValue').years).toBe(15)
    expect(w.find('[data-monthly]').text()).toBe('$1,687.71')
  })

  it('adds monthly extras and shows the falling payments of the german system', () => {
    const w = setup({ system: 'german', extras: [{ label: 'Insurance', amount: 50 }] })
    // 200000 / 360 = 555.56 principal + 1000 interest + 50
    expect(w.find('[data-monthly]').text()).toBe('$1,605.56')
    expect(w.text()).toContain('Last payment')
  })

  it('folds the schedule by year', async () => {
    const w = setup()
    expect(w.find('[data-schedule]').exists()).toBe(false)
    await w.find('[data-toggle-schedule]').trigger('click')
    expect(w.findAll('[data-schedule] tbody tr')).toHaveLength(30)
    expect(w.findAll('[data-schedule] tbody tr').at(-1)!.text()).toContain('$0')
  })

  it('keeps the down payment within the price', async () => {
    const w = setup()
    await w.find('[data-field="price"] input').setValue('40000')
    expect(w.props('modelValue')).toMatchObject({ price: 40_000, down: 40_000 })
  })
})
