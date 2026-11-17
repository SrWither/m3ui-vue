import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSeatMap from '../components/MSeatMap.vue'

const hall = ['ss_ss', '', 'pp_pp']

function ids(w: ReturnType<typeof mount>) {
  return w.findAll('[data-seat]').map((b) => b.attributes('data-seat'))
}

describe('MSeatMap', () => {
  it('names seats theater style, skipping gaps and blank rows', () => {
    const w = mount(MSeatMap, { props: { layout: hall } })
    expect(ids(w)).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'])
  })

  it('names seats plane style and numbers right to left', () => {
    const plane = mount(MSeatMap, { props: { layout: ['sss_sss', 'sss_sss'], naming: 'plane' } })
    expect(ids(plane).slice(0, 6)).toEqual(['1A', '1B', '1C', '1D', '1E', '1F'])
    const rtl = mount(MSeatMap, { props: { layout: ['sss'], numbering: 'rtl' } })
    expect(ids(rtl)).toEqual(['A3', 'A2', 'A1'])
  })

  it('selects and releases seats', async () => {
    const w = mount(MSeatMap, { props: { layout: hall, modelValue: ['A1'] } })
    await w.find('[data-seat="A2"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([['A1', 'A2']])
    await w.find('[data-seat="A1"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[1]).toEqual([[]])
    expect(w.emitted('select')?.[1]?.[1]).toBe(false)
  })

  it('does not pick occupied or blocked seats', async () => {
    const w = mount(MSeatMap, { props: { layout: hall, occupied: ['A1'], blocked: ['A2'] } })
    expect(w.find('[data-seat="A1"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-seat="A2"]').classes()).toContain('is-blocked')
    await w.find('[data-seat="A1"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('stops at max, or moves the selection when max is 1', async () => {
    const w = mount(MSeatMap, { props: { layout: hall, modelValue: ['A1', 'A2'], max: 2 } })
    await w.find('[data-seat="A3"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('limit')).toHaveLength(1)
    const one = mount(MSeatMap, { props: { layout: hall, modelValue: ['A1'], max: 1 } })
    await one.find('[data-seat="B2"]').trigger('click')
    expect(one.emitted('update:modelValue')?.[0]).toEqual([['B2']])
  })

  it('labels seats with category and price', () => {
    const w = mount(MSeatMap, {
      props: { layout: hall, categories: [{ key: 'p', label: 'Premium', price: 12, color: 'tertiary' }], currency: 'USD' },
    })
    expect(w.find('[data-seat="B1"]').attributes('aria-label')).toBe('Seat B1, Premium, $12.00')
    expect(w.text()).toContain('Premium · $12.00')
  })

  it('moves focus with arrows over gaps and blank rows, skipping occupied seats', async () => {
    const w = mount(MSeatMap, { props: { layout: hall, occupied: ['A3'] }, attachTo: document.body })
    const a2 = w.find('[data-seat="A2"]')
    expect(w.find('[data-seat="A1"]').attributes('tabindex')).toBe('0')
    await a2.trigger('keydown', { key: 'ArrowRight' })
    await w.vm.$nextTick()
    expect(document.activeElement?.getAttribute('data-seat')).toBe('A4')
    await w.find('[data-seat="A4"]').trigger('keydown', { key: 'ArrowDown' })
    await w.vm.$nextTick()
    expect(document.activeElement?.getAttribute('data-seat')).toBe('B4')
    w.unmount()
  })

  it('hides the stage with stage=false', () => {
    expect(mount(MSeatMap, { props: { layout: hall } }).text()).toContain('Screen')
    expect(mount(MSeatMap, { props: { layout: hall, stage: false } }).text()).not.toContain('Screen')
  })
})
