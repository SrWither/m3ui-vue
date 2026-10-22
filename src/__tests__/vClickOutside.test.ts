import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vClickOutside, type ClickOutsideValue } from '../directives/vClickOutside'

const press = (target: EventTarget, type = 'pointerdown', button = 0) =>
  target.dispatchEvent(new PointerEvent(type, { button, bubbles: true, composed: true }))

describe('vClickOutside', () => {
  let outside: HTMLElement
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    outside = document.createElement('div')
    outside.className = 'outside'
    document.body.appendChild(outside)
  })
  afterEach(() => vi.useRealTimers())

  function host(value: () => ClickOutsideValue) {
    const w = mount(defineComponent({
      setup: () => () => withDirectives(h('div', { class: 'panel' }, [h('button', { class: 'inner' })]), [[vClickOutside, value()]]),
    }), { attachTo: document.body })
    vi.advanceTimersByTime(0)
    return { w, el: w.element as HTMLElement }
  }

  it('calls the handler for a press outside, not inside or with another button', () => {
    const handler = vi.fn()
    const { el } = host(() => handler)
    press(el.querySelector('.inner')!)
    expect(handler).not.toHaveBeenCalled()
    press(outside, 'pointerdown', 2)
    expect(handler).not.toHaveBeenCalled()
    press(outside)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('ignores the event that mounted it', () => {
    const handler = vi.fn()
    mount(defineComponent({
      setup: () => () => withDirectives(h('div'), [[vClickOutside, handler]]),
    }), { attachTo: document.body })
    press(outside)
    expect(handler).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    press(outside)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('treats excluded elements and selectors as inside, and can wait for the click', () => {
    const handler = vi.fn()
    const toggle = document.createElement('button')
    document.body.appendChild(toggle)
    const popup = document.createElement('div')
    popup.className = 'popup'
    popup.appendChild(document.createElement('span'))
    document.body.appendChild(popup)
    host(() => ({ handler, exclude: [toggle, '.popup'], event: 'click' }))
    press(toggle, 'click')
    press(popup.firstElementChild!, 'click')
    press(outside, 'pointerdown')
    expect(handler).not.toHaveBeenCalled()
    press(outside, 'click')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('stops while disabled and after unmount', async () => {
    const handler = vi.fn()
    const disabled = ref(true)
    const { w } = host(() => ({ handler, disabled: disabled.value }))
    press(outside)
    disabled.value = false
    await nextTick()
    vi.advanceTimersByTime(0)
    press(outside)
    expect(handler).toHaveBeenCalledTimes(1)
    w.unmount()
    press(outside)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
