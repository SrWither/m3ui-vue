import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vSwipe, type SwipeValue } from '../directives/vSwipe'

function host(value: () => SwipeValue, onClick = vi.fn()) {
  const w = mount(defineComponent({
    setup: () => () => withDirectives(h('div', { onClick }), [[vSwipe, value()]]),
  }), { attachTo: document.body })
  return { w, el: w.element as HTMLElement, onClick }
}

// Moves from (sx, sy) by (dx, dy) in `steps` events `msPerStep` apart, then lifts
function drag(el: HTMLElement, dx: number, dy: number, { steps = 5, msPerStep = 16, pointerType = 'touch', sx = 100, sy = 100 } = {}) {
  let t = 1000
  // happy-dom stamps events with its own clock: pin timeStamp so the speed is what the test says
  const ev = (type: string, x: number, y: number) => {
    const e = new PointerEvent(type, { pointerId: 1, pointerType, button: 0, clientX: x, clientY: y, bubbles: true })
    Object.defineProperty(e, 'timeStamp', { value: t })
    return e
  }
  el.dispatchEvent(ev('pointerdown', sx, sy))
  for (let i = 1; i <= steps; i++) {
    t += msPerStep
    window.dispatchEvent(ev('pointermove', sx + (dx * i) / steps, sy + (dy * i) / steps))
  }
  window.dispatchEvent(ev('pointerup', sx + dx, sy + dy))
}

describe('vSwipe', () => {
  it('calls the handler of the direction swiped, with the distance', () => {
    const left = vi.fn()
    const right = vi.fn()
    const { el } = host(() => ({ left, right }))
    drag(el, -80, 5)
    expect(left).toHaveBeenCalledTimes(1)
    expect(left.mock.calls[0]![0]).toMatchObject({ direction: 'left', dx: -80, dy: 5 })
    drag(el, 80, 0)
    expect(right).toHaveBeenCalledTimes(1)
  })

  it('counts a short flick but not a short slow drag', () => {
    const handler = vi.fn()
    const { el } = host(() => handler)
    drag(el, 0, -30, { steps: 3, msPerStep: 200 })
    expect(handler).not.toHaveBeenCalled()
    drag(el, 0, -30, { steps: 3, msPerStep: 10 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0].direction).toBe('up')
  })

  it('sets touch-action from the directions listened to', async () => {
    const value = ref<SwipeValue>({ left: () => {} })
    const { el } = host(() => value.value)
    expect(el.style.touchAction).toBe('pan-y')
    value.value = { down: () => {} }
    await nextTick()
    expect(el.style.touchAction).toBe('pan-x')
    value.value = () => {}
    await nextTick()
    expect(el.style.touchAction).toBe('none')
    value.value = { left: () => {}, disabled: true }
    await nextTick()
    expect(el.style.touchAction).toBe('')
  })

  it('ignores a drag along an axis nobody listens to, and the mouse unless asked', () => {
    const left = vi.fn()
    const onMove = vi.fn()
    const { el } = host(() => ({ left, onMove }))
    drag(el, -10, -120)
    expect(left).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()
    drag(el, -120, 0, { pointerType: 'mouse' })
    expect(left).not.toHaveBeenCalled()
    const withMouse = host(() => ({ left, mouse: true }))
    drag(withMouse.el, -120, 0, { pointerType: 'mouse' })
    expect(left).toHaveBeenCalledTimes(1)
  })

  it('reports moves and the end, and swallows the click a swipe ends in', () => {
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const { el, onClick } = host(() => ({ right: () => {}, onMove, onEnd }), vi.fn())
    drag(el, 30, 0, { msPerStep: 200 })
    expect(onMove).toHaveBeenLastCalledWith(30, 0, expect.any(PointerEvent))
    expect(onEnd).toHaveBeenCalledWith(false)
    el.click()
    expect(onClick).not.toHaveBeenCalled()
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
