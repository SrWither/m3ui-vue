import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MAvailabilityCalendar from '../components/MAvailabilityCalendar.vue'

type Range = [string | null, string | null]

const base = {
  min: '2026-12-01',
  months: 1,
  firstDayOfWeek: 1,
  prices: (d: string) => (d.endsWith('-05') ? 200 : 100),
  unavailable: ['2026-12-10', '2026-12-11'],
}

function setup(extra: Record<string, unknown> = {}) {
  const w = mount(MAvailabilityCalendar, {
    props: {
      ...base,
      modelValue: [null, null] as Range,
      'onUpdate:modelValue': (v: Range) => w.setProps({ modelValue: v }),
      ...extra,
    },
  })
  return w
}
const day = (w: ReturnType<typeof setup>, d: string) => w.find(`[data-date="2026-12-${d}"]`)
const state = (w: ReturnType<typeof setup>, d: string) => day(w, d).element.parentElement!.dataset.state

describe('MAvailabilityCalendar', () => {
  it('lays out the month from the first day of the week', () => {
    const w = setup()
    // Dec 1 2026 is a Tuesday: one blank before it with Monday first
    const cells = w.findAll('[role="gridcell"]')
    expect(cells[0]!.find('button').exists()).toBe(false)
    expect(cells[1]!.find('button').attributes('data-date')).toBe('2026-12-01')
  })

  it('picks a stay and sums the nights', async () => {
    const w = setup()
    await day(w, '04').trigger('click')
    expect(w.props('modelValue')).toEqual(['2026-12-04', null])
    await day(w, '07').trigger('click')
    expect(w.props('modelValue')).toEqual(['2026-12-04', '2026-12-07'])
    expect(w.emitted('change')![0]![0]).toEqual({ start: '2026-12-04', end: '2026-12-07', nights: 3, total: 400 })
    expect(state(w, '05')).toBe('range')
    expect(w.find('[data-summary]').text()).toContain('3 nights')
  })

  it('lets a stay end on the morning a booked night starts, not run over it', async () => {
    const w = setup()
    await day(w, '08').trigger('click')
    expect(state(w, '10')).toBe('checkout-only')
    expect(state(w, '11')).toBe('booked')
    expect(state(w, '13')).toBe('disabled')
    await day(w, '13').trigger('click')
    expect(w.props('modelValue')).toEqual(['2026-12-08', null])
    await day(w, '10').trigger('click')
    expect(w.props('modelValue')).toEqual(['2026-12-08', '2026-12-10'])
  })

  it('blocks booked nights and check-ins that cannot fit the minimum stay', async () => {
    const w = setup({ minNights: 3 })
    expect(state(w, '10')).toBe('booked')
    expect(state(w, '08')).toBe('disabled')
    expect(state(w, '07')).toBe('available')
    await day(w, '07').trigger('click')
    expect(state(w, '08')).toBe('disabled')
    expect(state(w, '10')).toBe('checkout-only')
    expect(w.text()).toContain('Minimum stay: 3 nights')
  })

  it('picking an earlier day restarts the stay', async () => {
    const w = setup()
    await day(w, '06').trigger('click')
    await day(w, '03').trigger('click')
    expect(w.props('modelValue')).toEqual(['2026-12-03', null])
  })

  it('moves focus with the arrow keys across months', async () => {
    const w = setup({ modelValue: ['2026-12-31', null] as Range })
    await day(w, '31').trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[data-date="2027-01-01"]').exists()).toBe(true)
    expect(w.find('h3').text()).toMatch(/january 2027/i)
  })
})
