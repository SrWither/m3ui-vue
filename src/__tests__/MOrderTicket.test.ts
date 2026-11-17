import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import MOrderTicket from '../components/MOrderTicket.vue'

const items = [
  { id: 1, name: 'Margherita', quantity: 2, modifiers: [{ label: 'onion', kind: 'remove' as const }, { label: 'extra cheese', kind: 'add' as const }] },
  { id: 2, name: 'Fries', note: 'well done' },
]

enableAutoUnmount(afterEach)
afterEach(() => vi.useRealTimers())

describe('MOrderTicket', () => {
  it('renders lines with quantities, modifiers and notes', () => {
    const w = mount(MOrderTicket, { props: { number: 42, title: 'Table 7', createdAt: Date.now(), items } })
    expect(w.text()).toContain('#42')
    expect(w.text()).toContain('2×')
    expect(w.text()).toContain('− onion')
    expect(w.text()).toContain('+ extra cheese')
    expect(w.text()).toContain('well done')
  })

  it('ticks the timer and changes color as the order ages', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
    const w = mount(MOrderTicket, { props: { number: 1, createdAt: new Date(2026, 0, 1, 11, 51, 0), items } })
    expect(w.find('[role="timer"]').text()).toBe('schedule 9:00')
    expect(w.find('[data-level]').attributes('data-level')).toBe('normal')
    vi.advanceTimersByTime(60_000)
    await w.vm.$nextTick()
    expect(w.find('[role="timer"]').text()).toBe('schedule 10:00')
    expect(w.find('[data-level]').attributes('data-level')).toBe('warn')
    await w.setProps({ lateAfter: 10 })
    expect(w.find('[data-level]').attributes('data-level')).toBe('late')
    w.unmount()
  })

  it('freezes the timer at finishedAt', () => {
    const w = mount(MOrderTicket, { props: { number: 1, createdAt: 0, finishedAt: 125_000, items } })
    expect(w.find('[role="timer"]').text()).toBe('check_circle 2:05')
    expect(w.find('[data-level]').attributes('data-level')).toBe('normal')
  })

  it('ticks lines done and emits complete on the last one', async () => {
    const w = mount(MOrderTicket, { props: { number: 1, createdAt: Date.now(), items, done: [1] } })
    const lines = w.findAll('li button')
    expect(lines[0]!.attributes('aria-pressed')).toBe('true')
    await lines[1]!.trigger('click')
    expect(w.emitted('update:done')?.[0]).toEqual([[1, 2]])
    expect(w.emitted('complete')).toHaveLength(1)
    await lines[0]!.trigger('click')
    expect(w.emitted('update:done')?.[1]).toEqual([[]])
  })

  it('ignores taps when readonly', async () => {
    const w = mount(MOrderTicket, { props: { number: 1, createdAt: Date.now(), items, readonly: true } })
    await w.findAll('li button')[0]!.trigger('click')
    expect(w.emitted('update:done')).toBeUndefined()
  })

  it('passes allDone to the actions slot', () => {
    const w = mount(MOrderTicket, {
      props: { number: 1, createdAt: Date.now(), items, done: [1, 2] },
      slots: { actions: `<template #actions="{ allDone }"><span>{{ allDone ? 'ready' : 'cooking' }}</span></template>` },
    })
    expect(w.text()).toContain('ready')
  })
})
