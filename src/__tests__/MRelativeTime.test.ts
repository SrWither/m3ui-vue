import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MRelativeTime from '../components/MRelativeTime.vue'

describe('MRelativeTime', () => {
  it('renders a past time as "ago"', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const wrapper = mount(MRelativeTime, { props: { value: fiveMinAgo, locale: 'en' } })
    expect(wrapper.text()).toContain('ago')
  })

  it('renders a future time as "in"', () => {
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const wrapper = mount(MRelativeTime, { props: { value: inTwoHours, locale: 'en' } })
    expect(wrapper.text()).toContain('in')
  })

  it('renders "now" for the current instant', () => {
    const wrapper = mount(MRelativeTime, { props: { value: new Date(), locale: 'en' } })
    expect(wrapper.text().toLowerCase()).toContain('now')
  })

  it('sets datetime and title attributes', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    const wrapper = mount(MRelativeTime, { props: { value: date, locale: 'en' } })
    const time = wrapper.find('time')
    expect(time.attributes('datetime')).toBe(date.toISOString())
    expect(time.attributes('title')).toBeTruthy()
  })

  it('accepts a timestamp number and an ISO string', () => {
    const wrapper1 = mount(MRelativeTime, { props: { value: Date.now(), locale: 'en' } })
    const wrapper2 = mount(MRelativeTime, { props: { value: new Date().toISOString(), locale: 'en' } })
    expect(wrapper1.find('time').exists()).toBe(true)
    expect(wrapper2.find('time').exists()).toBe(true)
  })

  it('respects the locale prop', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const wrapper = mount(MRelativeTime, { props: { value: fiveMinAgo, locale: 'es' } })
    expect(wrapper.text()).toMatch(/hace/i)
  })
})
