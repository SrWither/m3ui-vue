import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, withDirectives } from 'vue'
import { vLongPress, type LongPressValue } from '../directives/vLongPress'

const pointer = (type: string, pointerType = 'touch', x = 10, y = 10) =>
  new PointerEvent(type, { pointerType, pointerId: 1, button: 0, clientX: x, clientY: y, bubbles: true })

function host(value: LongPressValue, onClick = vi.fn()) {
  const w = mount(defineComponent({
    setup: () => () => withDirectives(h('button', { onClick }, 'Hold'), [[vLongPress, value]]),
  }), { attachTo: document.body })
  return { w, el: w.element as HTMLElement, onClick }
}

describe('vLongPress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires after the duration, marks the press while held, and swallows the click it ends in', () => {
    const handler = vi.fn()
    const { el, onClick } = host(handler)
    el.dispatchEvent(pointer('pointerdown'))
    expect(el.dataset.longPressing).toBe('')
    vi.advanceTimersByTime(499)
    expect(handler).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0]).toBeInstanceOf(PointerEvent)
    expect(el.dataset.longPressing).toBeUndefined()
    window.dispatchEvent(pointer('pointerup'))
    el.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('a short press is a plain click, and moving past the tolerance cancels it', () => {
    const handler = vi.fn()
    const { el, onClick } = host({ handler, duration: 300 })
    el.dispatchEvent(pointer('pointerdown'))
    vi.advanceTimersByTime(100)
    window.dispatchEvent(pointer('pointerup'))
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)

    el.dispatchEvent(pointer('pointerdown'))
    window.dispatchEvent(pointer('pointermove', 'touch', 10, 25))
    vi.advanceTimersByTime(300)
    expect(handler).not.toHaveBeenCalled()
  })

  it('leaves the mouse alone with mouse: false, and does nothing when disabled', () => {
    const handler = vi.fn()
    const { el } = host({ handler, mouse: false })
    el.dispatchEvent(pointer('pointerdown', 'mouse'))
    vi.advanceTimersByTime(600)
    expect(handler).not.toHaveBeenCalled()

    const off = host({ handler, disabled: true })
    off.el.dispatchEvent(pointer('pointerdown'))
    vi.advanceTimersByTime(600)
    expect(handler).not.toHaveBeenCalled()
  })

  it('stops swallowing clicks a moment after a press that ended in none', () => {
    const { el, onClick } = host(vi.fn())
    el.dispatchEvent(pointer('pointerdown'))
    vi.advanceTimersByTime(500)
    window.dispatchEvent(pointer('pointerup'))
    vi.advanceTimersByTime(400)
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('blocks the browser\'s long-press menu while pressing', () => {
    const { el } = host(vi.fn())
    el.dispatchEvent(pointer('pointerdown'))
    const menu = new Event('contextmenu', { cancelable: true })
    el.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
  })
})
