import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MPullToRefresh from '../components/MPullToRefresh.vue'

function touch(el: Element, type: string, y: number) {
  const t = { identifier: 1, clientY: y, clientX: 0, target: el }
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>
  Object.assign(ev, {
    touches: type === 'touchend' ? [] : [t],
    changedTouches: [t],
  })
  el.dispatchEvent(ev)
  return ev
}

function mountPtr() {
  const wrapper = mount(MPullToRefresh, { slots: { default: '<div>list</div>' }, attachTo: document.body })
  const scrollEl = wrapper.find('.overflow-y-auto').element
  return { wrapper, scrollEl }
}

describe('MPullToRefresh (touch)', () => {
  it('blocks native scroll and emits refresh on a downward pull past threshold', () => {
    const { wrapper, scrollEl } = mountPtr()
    touch(scrollEl, 'touchstart', 100)
    const move1 = touch(scrollEl, 'touchmove', 120)
    const move2 = touch(scrollEl, 'touchmove', 200)
    touch(scrollEl, 'touchend', 200)
    expect(move1.defaultPrevented).toBe(true)
    expect(move2.defaultPrevented).toBe(true)
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not refresh on a short pull', () => {
    const { wrapper, scrollEl } = mountPtr()
    touch(scrollEl, 'touchstart', 100)
    touch(scrollEl, 'touchmove', 130)
    touch(scrollEl, 'touchend', 130)
    expect(wrapper.emitted('refresh')).toBeUndefined()
    wrapper.unmount()
  })

  it('leaves an upward swipe to native scrolling', () => {
    const { wrapper, scrollEl } = mountPtr()
    touch(scrollEl, 'touchstart', 200)
    const up = touch(scrollEl, 'touchmove', 150)
    const down = touch(scrollEl, 'touchmove', 300)
    touch(scrollEl, 'touchend', 300)
    expect(up.defaultPrevented).toBe(false)
    expect(down.defaultPrevented).toBe(false)
    expect(wrapper.emitted('refresh')).toBeUndefined()
    wrapper.unmount()
  })

  it('ignores touches when the list is scrolled down', () => {
    const { wrapper, scrollEl } = mountPtr()
    ;(scrollEl as HTMLElement).scrollTop = 50
    Object.defineProperty(scrollEl, 'scrollTop', { value: 50, configurable: true })
    touch(scrollEl, 'touchstart', 100)
    const move = touch(scrollEl, 'touchmove', 250)
    touch(scrollEl, 'touchend', 250)
    expect(move.defaultPrevented).toBe(false)
    expect(wrapper.emitted('refresh')).toBeUndefined()
    wrapper.unmount()
  })
})

function pointer(el: Element | Window, type: string, y: number) {
  const ev = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, clientY: y })
  el.dispatchEvent(ev)
  return ev
}

describe('MPullToRefresh (mouse)', () => {
  function mountWithRow() {
    const wrapper = mount(MPullToRefresh, { slots: { default: '<button class="row">row</button>' }, attachTo: document.body })
    const scrollEl = wrapper.find('.overflow-y-auto').element as HTMLElement
    const captured: number[] = []
    scrollEl.setPointerCapture = (id: number) => void captured.push(id)
    scrollEl.hasPointerCapture = (id: number) => captured.includes(id)
    scrollEl.releasePointerCapture = () => {}
    return { wrapper, scrollEl, row: wrapper.find('.row').element, captured }
  }

  it('does not capture the pointer on a plain click at the top, so the item still gets it', () => {
    const { wrapper, row, captured } = mountWithRow()
    pointer(row, 'pointerdown', 100)
    pointer(row, 'pointerup', 100)
    expect(captured).toHaveLength(0)
    expect(wrapper.emitted('refresh')).toBeUndefined()
    wrapper.unmount()
  })

  it('captures once the mouse drags down, and refreshes past the threshold', () => {
    const { wrapper, scrollEl, row, captured } = mountWithRow()
    pointer(row, 'pointerdown', 100)
    pointer(scrollEl, 'pointermove', 102)
    expect(captured).toHaveLength(0)
    pointer(scrollEl, 'pointermove', 200)
    expect(captured).toHaveLength(1)
    pointer(scrollEl, 'pointerup', 200)
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    wrapper.unmount()
  })
})
