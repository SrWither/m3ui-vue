import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MCountdown from '../components/MCountdown.vue'

const T0 = new Date('2026-01-01T00:00:00Z').getTime()
const D = 86_400_000, H = 3_600_000, M = 60_000, S = 1000

describe('MCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => vi.useRealTimers())

  it('splits the time left into the units', () => {
    const w = mount(MCountdown, { props: { to: T0 + 2 * D + 3 * H + 4 * M + 5 * S, animate: false } })
    const p = (w.vm as any).parts
    expect([p.days, p.hours, p.minutes, p.seconds]).toEqual([2, 3, 4, 5])
    expect(w.attributes('role')).toBe('timer')
  })

  it('folds units left out into the next larger one shown', () => {
    const w = mount(MCountdown, { props: { to: T0 + 2 * D + 3 * H + 30 * S, units: ['hours', 'minutes'], animate: false } })
    const p = (w.vm as any).parts
    // 51h, and the 30s round up into the minutes.
    expect([p.hours, p.minutes]).toEqual([51, 1])
  })

  it('ticks down and emits finished once', async () => {
    const w = mount(MCountdown, { props: { to: T0 + 3 * S, animate: false } })
    expect((w.vm as any).parts.seconds).toBe(3)
    await vi.advanceTimersByTimeAsync(1000)
    expect((w.vm as any).parts.seconds).toBe(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect((w.vm as any).parts.finished).toBe(true)
    expect(w.emitted('finished')).toHaveLength(1)
    expect(w.emitted('tick')!.length).toBeGreaterThanOrEqual(3)
  })

  it("doesn't emit finished when mounted with a past date, and shows the #finished slot", async () => {
    const w = mount(MCountdown, { props: { to: T0 - 1000 }, slots: { finished: '<b>Done</b>' } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.emitted('finished')).toBeUndefined()
    expect(w.html()).toContain('<b>Done</b>')
  })

  it('restarts when `to` moves to the future', async () => {
    const w = mount(MCountdown, { props: { to: T0 - 1000, animate: false } })
    await w.setProps({ to: T0 + 2 * S })
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('finished')).toHaveLength(1)
  })

  it('hideEmpty drops leading zero units but keeps the last', async () => {
    const w = mount(MCountdown, { props: { to: T0 + 5 * M, hideEmpty: true, animate: false } })
    await nextTick()
    expect(w.findAll('.rounded-md')).toHaveLength(2) // minutes + seconds
  })

  it('names units in the given language, plural-aware', () => {
    const w = mount(MCountdown, { props: { to: T0 + 1 * D + 2 * H, units: ['days', 'hours'], locale: 'es', animate: false } })
    expect(w.text()).toContain('día')
    expect(w.text()).toContain('horas')
    expect(w.attributes('aria-label')).toMatch(/1 día, 2 horas/)
  })

  it('hands the parts to a custom default slot', () => {
    const w = mount(MCountdown, {
      props: { to: T0 + 90 * S },
      slots: { default: `<template #default="{ minutes, seconds }">{{ minutes }}m{{ seconds }}s</template>` },
    })
    expect(w.text()).toBe('1m30s')
  })
})
