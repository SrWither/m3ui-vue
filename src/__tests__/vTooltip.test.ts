import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { mount } from '@vue/test-utils'
import { vTooltip, type TooltipValue } from '../directives/vTooltip'

// A closing tooltip fades out before it's removed: the open one is the one the element points to
const shown = (el: Element) => {
  const id = el.getAttribute('aria-describedby')
  return id ? document.getElementById(id) : null
}
const pointer = (type: string, pointerType: string, x = 10) =>
  new PointerEvent(type, { pointerType, pointerId: 1, clientX: x, clientY: 10, bubbles: true })

describe('vTooltip', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  function host(value: () => TooltipValue, onClick = vi.fn()) {
    const w = mount(defineComponent({
      setup: () => () => withDirectives(h('button', { class: 'btn', onClick }, 'Save'), [[vTooltip, value()]]),
    }), { attachTo: document.body })
    return { w, el: w.element as HTMLElement, onClick }
  }

  it('shows the text on hover after the delay, described by it, and hides on leave', () => {
    const { el } = host(() => 'Save changes')
    el.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(599)
    expect(shown(el)).toBeNull()
    vi.advanceTimersByTime(1)
    const tip = shown(el)!
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(tip.textContent).toBe('Save changes')
    el.dispatchEvent(pointer('pointerleave', 'mouse'))
    expect(el.hasAttribute('aria-describedby')).toBe(false)
  })

  it('takes options, and shows nothing when disabled or empty', () => {
    const { el } = host(() => ({ text: 'Later', delay: 100, placement: 'bottom' }))
    el.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(100)
    expect(shown(el)?.textContent).toBe('Later')

    const off = host(() => ({ text: 'Nope', disabled: true }))
    off.el.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(600)
    expect(shown(off.el)).toBeNull()
  })

  it('a long press shows it and swallows its click; a tap clicks', async () => {
    const { el, onClick } = host(() => 'Save')
    el.dispatchEvent(pointer('pointerdown', 'touch'))
    window.dispatchEvent(pointer('pointerup', 'touch'))
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(shown(el)).toBeNull()

    el.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(500)
    expect(shown(el)?.textContent).toBe('Save')
    window.dispatchEvent(pointer('pointerup', 'touch'))
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1500)
    expect(shown(el)).toBeNull()
  })

  it('follows a new text while shown, hides when it empties, and cleans up on unmount', async () => {
    const text = ref('One')
    const { w, el } = host(() => text.value)
    el.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(600)
    text.value = 'Two'
    await nextTick()
    expect(shown(el)?.textContent).toBe('Two')
    text.value = ''
    await nextTick()
    expect(shown(el)).toBeNull()
    el.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(600)
    w.unmount()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('Escape hides it', () => {
    const { el } = host(() => 'Save')
    el.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(600)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(shown(el)).toBeNull()
  })
})
