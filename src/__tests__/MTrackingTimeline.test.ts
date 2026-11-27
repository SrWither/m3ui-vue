import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MTrackingTimeline from '../components/MTrackingTimeline.vue'
import { defaultLocale } from '../composables/useLocale'

const steps = [
  { label: 'Order placed', icon: 'receipt_long', time: '2026-11-27T14:00:00' },
  { label: 'Preparing', icon: 'skillet', time: '2026-11-27T14:05:00' },
  { label: 'On the way', icon: 'two_wheeler' },
  { label: 'Delivered', icon: 'home', time: '2026-11-27T14:41:00' },
]

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-27T14:20:00'))
  document.documentElement.lang = 'en'
})
afterEach(() => vi.useRealTimers())

const legs = (w: ReturnType<typeof mount>) => w.findAll('li[aria-hidden="true"] > span').map((s) => (s.element as HTMLElement).style.width)

describe('MTrackingTimeline', () => {
  it('titles the current stage, marks it, and fills the legs up to it', () => {
    const w = mount(MTrackingTimeline, { props: { steps, current: 2, stepProgress: 0.4 } })
    expect(w.find('h3').text()).toBe('On the way')
    expect(w.find('[aria-current="step"]').attributes('title')).toBe('On the way')
    expect(legs(w)).toEqual(['100%', '100%', '40%'])
  })

  it('shows the minutes left and the arrival time, and keeps counting down', async () => {
    const w = mount(MTrackingTimeline, { props: { steps, current: 2, eta: new Date('2026-11-27T14:32:00') } })
    expect(w.text()).toContain('12 min')
    expect(w.text()).toContain('Arrives 2:32')
    vi.advanceTimersByTime(11 * 60_000)
    await flushPromises()
    expect(w.text()).toContain(defaultLocale.trackingArrivingNow)
  })

  it('all done: Delivered with the last stage time, every leg full, no current step', () => {
    const w = mount(MTrackingTimeline, { props: { steps, current: 3, eta: new Date('2026-11-27T14:32:00') } })
    expect(w.text()).toContain('Delivered · 2:41')
    expect(w.text()).not.toContain('min')
    expect(legs(w)).toEqual(['100%', '100%', '100%'])
    expect(w.find('[aria-current="step"]').exists()).toBe(false)
  })

  it('delayed and canceled states', () => {
    const late = mount(MTrackingTimeline, { props: { steps, current: 1, status: 'delayed' } })
    expect(late.text()).toContain(defaultLocale.trackingDelayed)
    expect(late.find('[aria-current="step"] span.relative').classes()).toContain('bg-tertiary-container')
    const off = mount(MTrackingTimeline, { props: { steps, current: 1, status: 'canceled', stepProgress: 0.5 } })
    expect(off.text()).toContain(defaultLocale.trackingCanceled)
    expect(legs(off)[1]).toBe('0%') // nothing moves once canceled
    expect(off.find('[aria-current="step"]').text()).toContain('close')
  })

  it('opens the stages with their times (v-model:expanded)', async () => {
    const w = mount(MTrackingTimeline, { props: { steps, current: 2 } })
    const button = w.find('button[aria-expanded]')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    expect(w.emitted('update:expanded')![0]).toEqual([true])
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(w.text()).toContain('2:05')
  })
})
