import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MOrderBook from '../components/MOrderBook.vue'
import type { OrderBookLevel } from '../components/MOrderBook.vue'

const bids: OrderBookLevel[] = [[99.5, 2], [100, 1], [99.75, 3]]
const asks: OrderBookLevel[] = [[100.5, 1], [100.25, 4], [101, 2]]

afterEach(() => vi.useRealTimers())

const prices = (w: ReturnType<typeof mount>, side: string) =>
  w.findAll(`[data-side="${side}"]`).map((r) => r.findAll('span.relative')[0]!.text())

describe('MOrderBook', () => {
  it('sorts asks above bids with the best of each by the middle', () => {
    const w = mount(MOrderBook, { props: { bids, asks } })
    expect(prices(w, 'ask')).toEqual(['101.00', '100.50', '100.25'])
    expect(prices(w, 'bid')).toEqual(['100.00', '99.75', '99.50'])
  })

  it('accumulates totals and shows the spread', () => {
    const w = mount(MOrderBook, { props: { bids, asks } })
    const bidTotals = w.findAll('[data-side="bid"]').map((r) => r.findAll('span.relative')[2]!.text())
    expect(bidTotals).toEqual(['1.0000', '4.0000', '6.0000'])
    expect(w.find('[data-spread]').text()).toContain('0.25')
  })

  it('groups levels into price steps', () => {
    const w = mount(MOrderBook, { props: { bids, asks, step: 1 } })
    expect(prices(w, 'bid')).toEqual(['100', '99'])
    expect(prices(w, 'ask')).toEqual(['101'])
    const sizes = w.findAll('[data-side="bid"]').map((r) => r.findAll('span.relative')[1]!.text())
    expect(sizes).toEqual(['1.0000', '5.0000'])
  })

  it('caps the levels per side', () => {
    const w = mount(MOrderBook, { props: { bids, asks, levels: 2 } })
    expect(prices(w, 'bid')).toEqual(['100.00', '99.75'])
    expect(prices(w, 'ask')).toEqual(['100.50', '100.25'])
  })

  it('flashes a level whose size changed', async () => {
    vi.useFakeTimers()
    const w = mount(MOrderBook, { props: { bids, asks } })
    expect(w.find('.m3-ob-flash').exists()).toBe(false)
    await w.setProps({ bids: [[99.5, 2], [100, 1.5], [99.75, 3]] })
    expect(w.findAll('.m3-ob-flash')).toHaveLength(1)
    vi.advanceTimersByTime(800)
    await w.vm.$nextTick()
    expect(w.find('.m3-ob-flash').exists()).toBe(false)
  })

  it('points the last price arrow the way it moved', async () => {
    const w = mount(MOrderBook, { props: { bids, asks, lastPrice: 100.1 } })
    await w.setProps({ lastPrice: 100.2 })
    expect(w.find('[data-middle]').text()).toContain('arrow_upward')
    await w.setProps({ lastPrice: 100 })
    expect(w.find('[data-middle]').text()).toContain('arrow_downward')
  })

  it('emits the clicked level', async () => {
    const w = mount(MOrderBook, { props: { bids, asks, layout: 'split' } })
    await w.find('[data-side="ask"]').trigger('click')
    expect(w.emitted('select')![0]![0]).toEqual({ price: 100.25, size: 4, side: 'ask' })
  })
})
