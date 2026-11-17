import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MVitalsChart from '../components/MVitalsChart.vue'
import type { VitalSeries } from '../components/MVitalsChart.vue'

const h = (n: number) => Date.UTC(2026, 10, 17, n)
const series: VitalSeries[] = [
  { key: 'hr', label: 'Heart rate', unit: 'bpm', normal: [60, 100], data: [{ time: h(8), value: 72 }, { time: h(12), value: 88 }, { time: h(16), value: 112 }] },
  { key: 'bp', label: 'Blood pressure', unit: 'mmHg', normal: [[90, 120], [60, 80]], data: [{ time: h(8), value: [118, 76] }, { time: h(16), value: [124, 82] }] },
  { key: 'temp', label: 'Temperature', unit: '°C', decimals: 1, normal: [36.1, 37.2], data: [{ time: h(12), value: 35.6 }] },
]

describe('MVitalsChart', () => {
  it('shows the latest reading of each vital with its status', () => {
    const w = mount(MVitalsChart, { props: { series } })
    const row = (k: string) => w.find(`[data-vital="${k}"]`)
    expect(row('hr').find('[data-value]').text()).toBe('112')
    expect(row('hr').find('[data-status]').text()).toBe('High')
    expect(row('bp').find('[data-value]').text()).toBe('124/82')
    expect(row('bp').find('[data-status]').text()).toBe('High')
    expect(row('temp').find('[data-value]').text()).toBe('35.6')
    expect(row('temp').find('[data-status]').text()).toBe('Low')
  })

  it('draws normal bands and flags readings outside them', () => {
    const w = mount(MVitalsChart, { props: { series } })
    expect(w.findAll('[data-vital="hr"] [data-band]')).toHaveLength(1)
    expect(w.findAll('[data-vital="bp"] [data-band]')).toHaveLength(2)
    expect(w.findAll('[data-vital="hr"] [data-out]')).toHaveLength(1)
  })

  it('moves a shared crosshair with the arrow keys', async () => {
    const w = mount(MVitalsChart, { props: { series } })
    await w.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('hover')![0]![0]).toBe(h(16))
    await w.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('hover')![1]![0]).toBe(h(12))
    // At 12:00 each row shows its latest reading so far
    expect(w.find('[data-vital="hr"] [data-value]').text()).toBe('88')
    expect(w.find('[data-vital="bp"] [data-value]').text()).toBe('118/76')
    expect(w.find('[data-vital="bp"] [data-status]').exists()).toBe(false)
    expect(w.find('[data-hover-time]').exists()).toBe(true)
  })

  it('says when there are no readings', () => {
    const w = mount(MVitalsChart, { props: { series: [{ key: 'x', label: 'X', data: [] }] } })
    expect(w.text()).toContain('No readings')
  })
})
