import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MCandlestickChart from '../components/MCandlestickChart.vue'

function series(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const open = 100 + i
    const close = i % 2 ? open - 2 : open + 3
    return { time: Date.UTC(2026, 0, 1 + i), open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, close, volume: 1000 + i }
  })
}

function rect(w: ReturnType<typeof mount>) {
  ;(w.element as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, right: 664, bottom: 320, width: 664, height: 320, x: 0, y: 0, toJSON() {} })
}

describe('MCandlestickChart', () => {
  it('draws rising and falling candles in separate paths', () => {
    const w = mount(MCandlestickChart, { props: { data: series(10) } })
    expect(w.find('[data-candles="up"]').attributes('d')).toMatch(/^M/)
    expect(w.find('[data-candles="down"]').attributes('d')).toMatch(/^M/)
    // 5 up candles: a wick and a body each
    expect((w.find('[data-candles="up"]').attributes('d')!.match(/V/g) ?? []).length).toBe(5)
  })

  it('shows the last candle in the legend and the last price', () => {
    const w = mount(MCandlestickChart, { props: { data: series(3) } })
    // last candle: open 102, close 105
    expect(w.find('[data-legend]').text()).toContain('Close 105.00')
    expect(w.find('[data-last-price]').text()).toBe('105.00')
  })

  it('draws moving averages once there are enough candles', () => {
    const w = mount(MCandlestickChart, { props: { data: series(30), movingAverages: [5, 50] } })
    expect(w.find('[data-ma="5"]').attributes('d')).toMatch(/^M/)
    expect(w.find('[data-ma="50"]').attributes('d')).toBe('')
  })

  it('moves the crosshair with the keyboard and emits hover', async () => {
    const data = series(10)
    const w = mount(MCandlestickChart, { props: { data } })
    await w.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('hover')![0]![0]).toEqual(data[8])
    expect(w.find('[data-legend]').text()).toContain('Close 111.00')
    await w.trigger('keydown', { key: 'Escape' })
    expect(w.emitted('hover')!.at(-1)![0]).toBeNull()
  })

  it('pans with a drag', async () => {
    const w = mount(MCandlestickChart, { props: { data: series(200), visible: 20 }, attachTo: document.body })
    rect(w)
    const before = w.find('[data-candles="up"]').attributes('d')
    await w.trigger('pointerdown', { pointerId: 1, clientX: 300, clientY: 100, button: 0, pointerType: 'mouse' })
    await w.trigger('pointermove', { pointerId: 1, clientX: 500, clientY: 100, pointerType: 'mouse' })
    await w.trigger('pointerup', { pointerId: 1, pointerType: 'mouse' })
    expect(w.find('[data-candles="up"]').attributes('d')).not.toBe(before)
    w.unmount()
  })

  it('follows new candles while the latest is in view', async () => {
    const w = mount(MCandlestickChart, { props: { data: series(10) } })
    await w.setProps({ data: series(11) })
    expect(w.find('[data-last-price]').text()).toBe('113.00')
    expect(w.find('[data-legend]').text()).toContain('Close 113.00')
  })
})
