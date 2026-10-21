import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MAnimatedNumber from '../components/MAnimatedNumber.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

// The digit each column shows: its strip's translateY, in lines
const shown = (w: VueWrapper) =>
  w.findAll('.m3-anum-strip').map((s) => Number(/translateY\((-?[\d.]+)lh\)/.exec((s.element as HTMLElement).style.transform)![1]) * -1 + 0)
const settle = () => new Promise((r) => setTimeout(r, 1200))

describe('MAnimatedNumber', () => {
  it('renders the formatted number for assistive technology and each digit in its column', () => {
    wrapper = mount(MAnimatedNumber, { props: { value: 1234, locale: 'en' } })
    expect(wrapper.find('.m3-anum-sr').text()).toBe('1,234')
    expect(wrapper.find('.m3-anum-cells').attributes('aria-hidden')).toBe('true')
    expect(shown(wrapper)).toEqual([1, 2, 3, 4])
    expect(wrapper.findAll('.m3-anum-cell').map((c) => c.text().length === 1 ? c.text() : 'digit')).toContain(',')
  })

  it('formats with Intl options and the given locale', () => {
    const format = { style: 'currency', currency: 'EUR' } as const
    wrapper = mount(MAnimatedNumber, { props: { value: 1234.5, locale: 'es', format } })
    expect(wrapper.find('.m3-anum-sr').text()).toBe(new Intl.NumberFormat('es', format).format(1234.5))
  })

  it('jumps to a new value without animate', async () => {
    wrapper = mount(MAnimatedNumber, { props: { value: 42, animate: false, locale: 'en' } })
    await wrapper.setProps({ value: 57 })
    expect(shown(wrapper)).toEqual([5, 7])
  })

  it('rolls forward through 9 → 0 when the number grows, and settles on the new digits', async () => {
    wrapper = mount(MAnimatedNumber, { props: { value: 19, locale: 'en' }, attachTo: document.body })
    await wrapper.setProps({ value: 20 })
    await new Promise((r) => setTimeout(r, 60))
    // Mid-roll the ones column sits between 9 and the 0 after it (the strip's second run), not rolling back down
    const ones = shown(wrapper)[1]!
    expect(ones).toBeGreaterThan(9)
    await settle()
    expect(shown(wrapper).map((d) => d % 10)).toEqual([2, 0])
  })

  it('rolls a new leading digit in from 0', async () => {
    wrapper = mount(MAnimatedNumber, { props: { value: 99, locale: 'en' }, attachTo: document.body })
    await wrapper.setProps({ value: 100 })
    expect(wrapper.findAll('.m3-anum-strip')).toHaveLength(3)
    await settle()
    expect(shown(wrapper).map((d) => d % 10)).toEqual([1, 0, 0])
  })

  // Adding a digit re-rendered the columns and Vue wrote their first-render style again: the ones column showed
  // the digit it had at mount (8) for a frame, until the loop's next write
  it('keeps every column where it was when the number gains a digit', async () => {
    wrapper = mount(MAnimatedNumber, { props: { value: 98, locale: 'en' }, attachTo: document.body })
    await wrapper.setProps({ value: 99 })
    await settle()
    await wrapper.setProps({ value: 100 })
    const [, tens, ones] = shown(wrapper)
    expect(tens! % 10).toBeCloseTo(9, 1)
    expect(ones! % 10).toBeCloseTo(9, 1)
  })

  it('formats any currency, percent or unit with Intl', () => {
    const cases: [number, string, Intl.NumberFormatOptions][] = [
      [1234.5, 'es-AR', { style: 'currency', currency: 'ARS', currencyDisplay: 'symbol' }],
      [1234.5, 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' }],
      [1234.5, 'ja-JP', { style: 'currency', currency: 'JPY' }],
      [0.256, 'en', { style: 'percent', maximumFractionDigits: 1 }],
      [88, 'en', { style: 'unit', unit: 'kilometer-per-hour' }],
    ]
    for (const [value, locale, format] of cases) {
      const w = mount(MAnimatedNumber, { props: { value, locale, format } })
      expect(w.find('.m3-anum-sr').text()).toBe(new Intl.NumberFormat(locale, format).format(value))
      w.unmount()
    }
  })

  it('gives dollar-sign currencies their country in any language', () => {
    const cases: [string, string, string][] = [
      ['es-AR', 'ARS', 'AR$\u00a01.234,50'],
      ['es-MX', 'MXN', 'MX$1,234.50'],
      ['es-MX', 'ARS', 'AR$1,234.50'],
      ['es-AR', 'USD', 'US$\u00a01.234,50'],
      ['en-US', 'USD', 'US$1,234.50'],
      ['en-US', 'CLP', 'CL$1,235'],
      ['en-US', 'TWD', 'NT$1,234.50'],
      ['es', 'ARS', '1234,50\u00a0AR$'],
      // Symbols that already name their currency stay as Intl writes them
      ['en-US', 'MXN', 'MX$1,234.50'],
      ['es-AR', 'EUR', '€\u00a01.234,50'],
      ['ja-JP', 'JPY', '￥1,235'],
    ]
    for (const [locale, currency, text] of cases) {
      const w = mount(MAnimatedNumber, { props: { value: 1234.5, locale, format: { style: 'currency', currency } } })
      expect(w.find('.m3-anum-sr').text(), `${locale} ${currency}`).toBe(text)
      w.unmount()
    }
  })

  it('shows durations as m:ss, adding hours past an hour', async () => {
    wrapper = mount(MAnimatedNumber, { props: { value: 59, type: 'duration', animate: false } })
    expect(wrapper.find('.m3-anum-sr').text()).toBe('0:59')
    await wrapper.setProps({ value: 3725 })
    expect(wrapper.find('.m3-anum-sr').text()).toBe('1:02:05')
    expect(shown(wrapper)).toEqual([1, 0, 2, 0, 5])
  })

  it('shows a Date as a time and rolls the tens of seconds through 0-5 only', async () => {
    const at = (s: number) => new Date(2026, 0, 1, 13, 4, s)
    const format = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } as const
    wrapper = mount(MAnimatedNumber, { props: { value: at(59), locale: 'en-GB', format }, attachTo: document.body })
    expect(wrapper.find('.m3-anum-sr').text()).toBe('13:04:59')
    // The tens of seconds have a 0-5 strip, twice
    const strips = wrapper.findAll('.m3-anum-strip')
    expect(strips[4]!.findAll('span')).toHaveLength(12)
    await wrapper.setProps({ value: new Date(2026, 0, 1, 13, 5, 0) })
    await new Promise((r) => setTimeout(r, 60))
    // 5 → 0 rolls one step forward (into the strip's second run), not five back
    expect(shown(wrapper)[4]!).toBeGreaterThan(5)
    await settle()
    expect(wrapper.find('.m3-anum-sr').text()).toBe('13:05:00')
  })
})
