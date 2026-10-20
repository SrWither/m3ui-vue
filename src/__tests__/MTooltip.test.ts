import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MTooltip from '../components/MTooltip.vue'

const tip = () => document.querySelector('[role="tooltip"]')
const pointer = (type: string, pointerType: string, x = 10) =>
  new PointerEvent(type, { pointerType, pointerId: 1, clientX: x, clientY: 10, bubbles: true })

describe('MTooltip input (Compose BasicTooltip)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  const mountTip = (props: Record<string, unknown> = {}) => {
    const onClick = vi.fn()
    const w = mount(MTooltip, {
      props: { text: 'Change type', ...props },
      slots: { default: () => h('button', { class: 'btn', onClick }, 'T') },
      attachTo: document.body,
    })
    return { w, onClick, trigger: w.find('span').element as HTMLElement, btn: w.find('.btn').element as HTMLElement }
  }

  it('a mouse shows it on hover after the delay and hides it on leave', async () => {
    const { trigger } = mountTip()
    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(600)
    await nextTick()
    expect(tip()?.textContent).toContain('Change type')
    trigger.dispatchEvent(pointer('pointerleave', 'mouse'))
    await nextTick()
    expect(tip()).toBeNull()
  })

  it('a tap doesn\'t show it, and its click goes through', async () => {
    const { trigger, btn, onClick } = mountTip()
    // A browser emulates mouse events for a tap; the tooltip listens to pointer events
    trigger.dispatchEvent(pointer('pointerenter', 'touch'))
    btn.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(100)
    window.dispatchEvent(pointer('pointerup', 'touch'))
    // ...and after it the compatibility mouse events (mouseenter first)
    trigger.dispatchEvent(new MouseEvent('mouseenter'))
    btn.click()
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(tip()).toBeNull()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('a long press shows it, swallows its click, and hides it 1.5s after lifting', async () => {
    const { btn, onClick } = mountTip()
    btn.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(tip()).not.toBeNull()
    window.dispatchEvent(pointer('pointerup', 'touch'))
    btn.click()
    expect(onClick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1400)
    await nextTick()
    expect(tip()).not.toBeNull()
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(tip()).toBeNull()
    // The next tap clicks again
    btn.dispatchEvent(pointer('pointerdown', 'touch'))
    window.dispatchEvent(pointer('pointerup', 'touch'))
    btn.click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('a press that moves (a scroll) isn\'t a long press', async () => {
    const { btn } = mountTip()
    btn.dispatchEvent(pointer('pointerdown', 'touch'))
    window.dispatchEvent(pointer('pointermove', 'touch', 40))
    vi.advanceTimersByTime(600)
    await nextTick()
    expect(tip()).toBeNull()
  })

  it('a long-pressed rich tooltip stays until a touch outside it', async () => {
    const { btn } = mountTip({ rich: true })
    btn.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(500)
    window.dispatchEvent(pointer('pointerup', 'touch'))
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(tip()).not.toBeNull()
    tip()!.dispatchEvent(pointer('pointerdown', 'touch'))
    await nextTick()
    expect(tip()).not.toBeNull()
    document.body.dispatchEvent(pointer('pointerdown', 'touch'))
    await nextTick()
    expect(tip()).toBeNull()
  })

  it('Escape hides it', async () => {
    const { trigger, btn } = mountTip()
    trigger.dispatchEvent(pointer('pointerenter', 'mouse'))
    vi.advanceTimersByTime(600)
    await nextTick()
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(tip()).toBeNull()
  })
})
