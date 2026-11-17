import { describe, it, expect } from 'vitest'
import { amortize } from '../composables/mortgage'

describe('amortize', () => {
  it('computes the fixed payment of a french loan', () => {
    const a = amortize({ principal: 200_000, rate: 6, years: 30 })
    expect(a.payments).toHaveLength(360)
    expect(a.firstPayment).toBeCloseTo(1199.1, 1)
    expect(a.payments.at(-1)!.balance).toBe(0)
    expect(a.totalPaid).toBeCloseTo(a.totalInterest + 200_000, 1)
  })

  it('keeps the principal fixed in a german loan', () => {
    const a = amortize({ principal: 120_000, rate: 12, years: 10, system: 'german' })
    expect(a.payments[0]!.principal).toBe(1000)
    expect(a.firstPayment).toBe(2200)
    expect(a.lastPayment).toBeCloseTo(1010, 0)
    expect(a.payments.at(-1)!.balance).toBe(0)
  })

  it('handles a zero rate and an empty loan', () => {
    expect(amortize({ principal: 12_000, rate: 0, years: 1 }).firstPayment).toBe(1000)
    expect(amortize({ principal: 0, rate: 5, years: 10 }).payments).toEqual([])
  })
})
