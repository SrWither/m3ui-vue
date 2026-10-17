import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import MBottomAppBar from '../components/MBottomAppBar.vue'
import MFab from '../components/MFab.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('MBottomAppBar', () => {
  it('is 80px with actions at the start by default, 64px and spread out when flexible', () => {
    const standard = mount(MBottomAppBar, { slots: { default: 'A' } })
    expect(standard.find('.h-20').exists()).toBe(true)
    expect(standard.find('.justify-start').exists()).toBe(true)
    const flexible = mount(MBottomAppBar, { props: { flexible: true }, slots: { default: 'A' } })
    expect(flexible.find('.h-16').classes()).toContain('justify-between')
    const fixed = mount(MBottomAppBar, { props: { flexible: true, arrangement: 'fixed' }, slots: { default: 'A' } })
    expect(fixed.find('.h-16').classes()).toEqual(expect.arrayContaining(['justify-center', 'gap-8']))
  })

  it('makes an MFab in #fab secondary and flat', () => {
    const w = mount(MBottomAppBar, { slots: { fab: () => h(MFab, { icon: 'add' }) } })
    const fab = w.findComponent(MFab).find('button')
    expect(fab.classes()).toContain('bg-secondary-container')
    expect(fab.classes()).not.toContain('shadow-elevation-3')
    // Outside the bar it keeps its defaults
    const alone = mount(MFab, { props: { icon: 'add' } }).find('button')
    expect(alone.classes()).toContain('bg-primary-container')
    expect(alone.classes()).toContain('shadow-elevation-3')
  })

  it('collapses with the content scrolling down and snaps back when left near the top (exit-always)', () => {
    vi.useFakeTimers()
    const scroller = document.createElement('div')
    document.body.appendChild(scroller)
    wrapper = mount(MBottomAppBar, {
      props: { scrollBehavior: 'exit-always', scrollTarget: scroller },
      slots: { default: 'A' },
      attachTo: document.body,
    })
    const outer = wrapper.element as HTMLElement
    Object.defineProperty(outer.firstElementChild!, 'offsetHeight', { value: 80 })
    const scrollTo = (y: number) => {
      scroller.scrollTop = y
      scroller.dispatchEvent(new Event('scroll'))
    }
    scrollTo(50)
    expect(outer.style.height).toBe('30px')
    scrollTo(200)
    expect(outer.style.height).toBe('0px')
    // Scrolling back up 60px brings 60px of it back; left there (75% open) it settles open
    scrollTo(140)
    expect(outer.style.height).toBe('60px')
    // The settle timer, then the spring's frames (fake timers drive requestAnimationFrame too)
    vi.advanceTimersByTime(1000)
    expect(outer.style.height).toBe('')
  })

  it('stays put when pinned', () => {
    const scroller = document.createElement('div')
    wrapper = mount(MBottomAppBar, { props: { scrollTarget: scroller }, slots: { default: 'A' } })
    scroller.scrollTop = 100
    scroller.dispatchEvent(new Event('scroll'))
    expect((wrapper.element as HTMLElement).style.height).toBe('')
  })
})
