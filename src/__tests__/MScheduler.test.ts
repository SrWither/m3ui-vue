import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MScheduler from '../components/MScheduler.vue'
import type { SchedulerEvent } from '../components/MScheduler.vue'

// A Wednesday; with the default Monday start its week runs Oct 12 – Oct 18, 2026.
const date = '2026-10-14'
let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountScheduler(events: SchedulerEvent[], props: Record<string, unknown> = {}) {
  wrapper = mount(MScheduler, { props: { events, date, startHour: 8, endHour: 20, hourHeight: 60, locale: 'en-US', ...props } })
  return wrapper
}

const block = (title: string) => wrapper!.findAll('[data-scheduler-event]').find((b) => b.text().includes(title))!
const px = (v: string) => Number.parseFloat(v)

describe('MScheduler', () => {
  it('shows the week of the date prop', () => {
    mountScheduler([])
    expect(wrapper!.findAll('[data-scheduler-day]').map((d) => d.attributes('data-scheduler-day'))).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ])
  })

  it('weekStartsOn 0 starts the week on Sunday', () => {
    mountScheduler([], { weekStartsOn: 0 })
    expect(wrapper!.find('[data-scheduler-day]').attributes('data-scheduler-day')).toBe('2026-10-11')
  })

  it('places events with minute precision', () => {
    mountScheduler([{ id: 1, title: 'Standup', start: '2026-10-14T09:30', end: '2026-10-14T10:15' }])
    const style = block('Standup').attributes('style')!
    // 9:30 is 1.5 hours after 8:00 at 60px an hour; 45 minutes is 45px (minus the 1px gaps).
    expect(px(/top: ([\d.]+)px/.exec(style)![1]!)).toBe(91)
    expect(px(/height: ([\d.]+)px/.exec(style)![1]!)).toBe(43)
  })

  it('puts overlapping events side by side', () => {
    mountScheduler([
      { id: 1, title: 'Alpha', start: '2026-10-14T10:00', end: '2026-10-14T12:00' },
      { id: 2, title: 'Beta', start: '2026-10-14T11:00', end: '2026-10-14T13:00' },
      { id: 3, title: 'Gamma', start: '2026-10-14T14:00', end: '2026-10-14T15:00' },
    ])
    expect(block('Alpha').attributes('style')).toContain('width: calc(50% - 4px)')
    expect(block('Beta').attributes('style')).toContain('left: calc(50% + 2px)')
    expect(block('Gamma').attributes('style')).toContain('width: calc(100% - 4px)')
  })

  it('clips events that start before startHour instead of dropping them', () => {
    mountScheduler([{ id: 1, title: 'Early run', start: '2026-10-14T06:30', end: '2026-10-14T09:00' }])
    expect(block('Early run').attributes('style')).toContain('top: 1px')
  })

  it('shows multi-day and all-day events as bars across their days', () => {
    mountScheduler([
      { id: 1, title: 'Conference', start: '2026-10-13T09:00', end: '2026-10-15T17:00' },
      { id: 2, title: 'Holiday', start: '2026-10-16', end: '2026-10-16', allDay: true },
      { id: 3, title: 'Trip', start: '2026-10-17', end: '2026-10-22', allDay: true },
    ])
    expect(wrapper!.findAll('[data-scheduler-event]')).toHaveLength(0)
    const bars = wrapper!.findAll('[data-scheduler-bar]')
    const style = (t: string) => bars.find((b) => b.text().includes(t))!.attributes('style')
    expect(style('Conference')).toContain('grid-column: 2 / 5')
    expect(style('Holiday')).toContain('grid-column: 5 / 6')
    // Runs past Sunday: clipped to the week's last column.
    expect(style('Trip')).toContain('grid-column: 6 / 8')
  })

  it('stacks overlapping bars in separate lanes', () => {
    mountScheduler([
      { id: 1, title: 'A', start: '2026-10-12', end: '2026-10-14', allDay: true },
      { id: 2, title: 'B', start: '2026-10-13', end: '2026-10-15', allDay: true },
    ])
    const rows = wrapper!.findAll('[data-scheduler-bar]').map((b) => /grid-row: (\d+)/.exec(b.attributes('style')!)![1])
    expect(rows).toEqual(['1', '2'])
  })

  it('an event ending at midnight stays in the time grid', () => {
    mountScheduler([{ id: 1, title: 'Late', start: '2026-10-14T18:00', end: '2026-10-15T00:00' }])
    expect(wrapper!.findAll('[data-scheduler-bar]')).toHaveLength(0)
    expect(block('Late').exists()).toBe(true)
  })

  it('navigating emits update:date and follows the date prop', async () => {
    mountScheduler([])
    await wrapper!.findAll('button')[1]!.trigger('click')
    expect(wrapper!.emitted('update:date')?.[0]).toEqual(['2026-10-21'])
    await wrapper!.setProps({ date: '2026-12-02' })
    expect(wrapper!.find('[data-scheduler-day]').attributes('data-scheduler-day')).toBe('2026-11-30')
  })

  it('follows the view prop and emits update:view from the toggle', async () => {
    mountScheduler([])
    await wrapper!.setProps({ view: 'day' })
    expect(wrapper!.findAll('[data-scheduler-day]')).toHaveLength(1)
    const weekToggle = wrapper!.findAll('button').find((b) => b.text() === 'Week')!
    await weekToggle.trigger('click')
    expect(wrapper!.emitted('update:view')?.[0]).toEqual(['week'])
    expect(wrapper!.findAll('[data-scheduler-day]')).toHaveLength(7)
  })

  it('clicking a day header in week view opens that day', async () => {
    mountScheduler([])
    const headers = wrapper!.findAll('button').filter((b) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(b.text()))
    await headers[4]!.trigger('click')
    expect(wrapper!.emitted('update:view')?.[0]).toEqual(['day'])
    expect(wrapper!.emitted('update:date')?.[0]).toEqual(['2026-10-16'])
  })

  it('renders an #event slot', () => {
    wrapper = mount(MScheduler, {
      props: { events: [{ id: 1, title: 'Lunch', start: '2026-10-14T12:00', end: '2026-10-14T13:00' }], date, locale: 'en-US' },
      slots: { event: `<template #event="{ event }"><b class="custom">{{ event.title }}!</b></template>` },
    })
    expect(wrapper.find('.custom').text()).toBe('Lunch!')
  })
})
