import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MBottomSheet from '../components/MBottomSheet.vue'
import MSideSheet from '../components/MSideSheet.vue'

// happy-dom has no layout: the panel is 400px tall / 320px wide. Fake timers drive rAF.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'Date'] })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const panel = () => document.querySelector<HTMLElement>('[data-sheet-panel]')
const scrim = () => document.querySelector<HTMLElement>('[data-sheet-scrim]')

describe.each([
  ['MBottomSheet', MBottomSheet, 'translateY', 400],
  ['MSideSheet', MSideSheet, 'translateX', 320],
] as const)('%s motion', (_, Comp, fn, size) => {
  it('slides in from fully off-screen with the scrim fading in, then out on close', async () => {
    const w = mount(Comp as any, { props: { modelValue: false }, attachTo: document.body, global: { stubs: { transition: false } } })
    await w.setProps({ modelValue: true })
    await nextTick()
    // Played as Web Animations over the open state written inline
    expect(panel()!.style.transform).toBe(`${fn}(0%)`)
    expect(scrim()!.style.opacity).toBe('1')
    const [slide] = panel()!.getAnimations()
    const frames = (slide!.effect as KeyframeEffect).getKeyframes()
    expect(frames[0]!.transform).toBe(`${fn}(100%)`)
    expect(frames[frames.length - 1]!.transform).toBe(`${fn}(0%)`)
    const [fade] = scrim()!.getAnimations()
    expect((fade!.effect as KeyframeEffect).getKeyframes()[0]!.opacity).toBe('0')

    slide!.finish()
    fade!.finish()
    await w.setProps({ modelValue: false })
    await nextTick()
    expect(panel()!.style.transform).toBe(`${fn}(100%)`)
    panel()!.getAnimations().forEach((a) => a.finish())
    scrim()!.getAnimations().forEach((a) => a.finish())
    await nextTick()
    expect(panel()).toBeNull()
    w.unmount()
  })

  it('a short drag springs back; a long one dismisses', async () => {
    const w = mount(Comp as any, { props: { modelValue: true }, attachTo: document.body, global: { stubs: { transition: false } } })
    await nextTick()
    panel()!.getAnimations().forEach((a) => a.finish())
    scrim()!.getAnimations().forEach((a) => a.finish())
    const handle = (fn === 'translateY'
      ? panel()!.querySelector('.cursor-grab')
      : panel()!.querySelector('.cursor-ew-resize')) as HTMLElement
    handle.setPointerCapture = () => {}
    const at = (v: number) => (fn === 'translateY' ? { clientY: v, clientX: 0 } : { clientX: v, clientY: 0 })

    handle.dispatchEvent(new PointerEvent('pointerdown', { ...at(0), pointerId: 1 }))
    vi.advanceTimersByTime(16)
    handle.dispatchEvent(new PointerEvent('pointermove', { ...at(40), pointerId: 1 }))
    expect(panel()!.style.transform).toBe(`${fn}(${(40 / size) * 100}%)`)
    vi.advanceTimersByTime(200)
    handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    expect(panel()!.style.transform).toBe(`${fn}(0%)`)
    expect(panel()!.getAnimations().filter((a) => a.playState === 'running')).toHaveLength(1)
    expect(w.emitted('update:modelValue')).toBeUndefined()

    handle.dispatchEvent(new PointerEvent('pointerdown', { ...at(0), pointerId: 1 }))
    vi.advanceTimersByTime(16)
    handle.dispatchEvent(new PointerEvent('pointermove', { ...at(150), pointerId: 1 }))
    handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
    w.unmount()
  })
})

describe('MBottomSheet partial / maxHeight', () => {
  const open = (props: Record<string, unknown>) => {
    const w = mount(MBottomSheet, {
      props: { modelValue: true, ...props },
      slots: { default: '<div class="body">content</div>' },
      attachTo: document.body,
      global: { stubs: { transition: false } },
    })
    return w
  }
  const settle = async () => {
    await nextTick()
    panel()!.getAnimations().forEach((a) => a.finish())
    scrim()?.getAnimations().forEach((a) => a.finish())
  }
  const handle = () => panel()!.querySelector<HTMLElement>('[data-sheet-handle]')!
  const drag = (dy: number, wait = 200) => {
    const h = handle()
    h.setPointerCapture = () => {}
    h.dispatchEvent(new PointerEvent('pointerdown', { clientY: 300, pointerId: 1 }))
    vi.advanceTimersByTime(16)
    h.dispatchEvent(new PointerEvent('pointermove', { clientY: 300 + dy, pointerId: 1 }))
    vi.advanceTimersByTime(wait)
    h.dispatchEvent(new PointerEvent('pointerup', { clientY: 300 + dy, pointerId: 1 }))
  }
  const touch = (el: Element, type: string, y: number) => {
    const t = { identifier: 7, clientX: 0, clientY: y, target: el } as unknown as Touch
    const e = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] })
    Object.defineProperty(e, 'changedTouches', { value: [t] })
    el.dispatchEvent(e)
    return e
  }

  beforeEach(() => { vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600) })

  it('caps the height: 60vh by default, 92vh with fullHeight, or maxHeight', async () => {
    let w = open({})
    expect(panel()!.style.maxHeight).toBe('60vh')
    w.unmount()
    w = open({ fullHeight: true })
    expect(panel()!.style.maxHeight).toBe('92vh')
    w.unmount()
    w = open({ maxHeight: '480px', partial: true })
    expect(panel()!.style.maxHeight).toBe('480px')
    w.unmount()
  })

  it('opens partially expanded and the handle toggles it', async () => {
    // 400px panel on a 600px screen: half the screen shows, so the partial offset is 100/400
    const w = open({ partial: true })
    await settle()
    expect(panel()!.style.transform).toBe('translateY(25%)')
    expect(handle().getAttribute('role')).toBe('button')
    handle().dispatchEvent(new MouseEvent('click', { clientY: 0 }))
    expect(panel()!.style.transform).toBe('translateY(0%)')
    expect(w.emitted('update:expanded')!.at(-1)).toEqual([true])
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(panel()!.style.transform).toBe('translateY(25%)')
    expect(w.emitted('update:expanded')!.at(-1)).toEqual([false])
    w.unmount()
  })

  it('opens fully expanded when the sheet is no taller than the partial share', async () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000)
    const w = open({ partial: true })
    await settle()
    expect(panel()!.style.transform).toBe('translateY(0%)')
    expect(handle().getAttribute('role')).toBeNull()
    w.unmount()
  })

  it('drags between partial, expanded and dismissed', async () => {
    const w = open({ partial: true })
    await settle()
    drag(-150)
    expect(panel()!.style.transform).toBe('translateY(0%)')
    // From expanded, 150px down lands nearer the partial anchor than off-screen
    drag(150)
    expect(panel()!.style.transform).toBe('translateY(25%)')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    drag(150)
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
    w.unmount()
  })

  it('a flick goes to the next anchor that way', async () => {
    const w = open({ partial: true, expanded: true })
    await settle()
    expect(panel()!.style.transform).toBe('translateY(0%)')
    drag(40, 16)
    expect(panel()!.style.transform).toBe('translateY(25%)')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('the content drags a partially expanded sheet up, and only scrolls once expanded', async () => {
    const w = open({ partial: true })
    await settle()
    const body = panel()!.querySelector('.body')!
    touch(body, 'touchstart', 400)
    vi.advanceTimersByTime(16)
    const move = touch(body, 'touchmove', 250)
    expect(move.defaultPrevented).toBe(true)
    expect(panel()!.style.transform).toBe('translateY(0%)')
    vi.advanceTimersByTime(200)
    touch(body, 'touchend', 250)
    expect(w.emitted('update:expanded')!.at(-1)).toEqual([true])

    // Expanded: a drag up is the content's scroll, not the sheet's
    touch(body, 'touchstart', 400)
    const up = touch(body, 'touchmove', 300)
    expect(up.defaultPrevented).toBe(false)
    touch(body, 'touchend', 300)

    // Scrolled down, a drag down scrolls back; at the top it collapses the sheet
    const content = body.parentElement!
    content.scrollTop = 50
    Object.defineProperty(content, 'scrollTop', { value: 50, configurable: true })
    touch(body, 'touchstart', 300)
    expect(touch(body, 'touchmove', 400).defaultPrevented).toBe(false)
    touch(body, 'touchend', 400)
    Object.defineProperty(content, 'scrollTop', { value: 0, configurable: true })
    touch(body, 'touchstart', 300)
    vi.advanceTimersByTime(16)
    expect(touch(body, 'touchmove', 450).defaultPrevented).toBe(true)
    vi.advanceTimersByTime(200)
    touch(body, 'touchend', 450)
    expect(panel()!.style.transform).toBe('translateY(25%)')
    w.unmount()
  })

  it('without partial, the content never drags the sheet', async () => {
    const w = open({})
    await settle()
    const body = panel()!.querySelector('.body')!
    touch(body, 'touchstart', 400)
    expect(touch(body, 'touchmove', 500).defaultPrevented).toBe(false)
    expect(panel()!.style.transform).toBe('translateY(0%)')
    w.unmount()
  })

  it('squares the corners only when asked and the expanded sheet fills the screen', async () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400)
    let w = open({ partial: true, expanded: true })
    await settle()
    expect(panel()!.classList.contains('rounded-t-[28px]')).toBe(true)
    w.unmount()
    w = open({ partial: true, expanded: true, squareCornersWhenFull: true })
    await settle()
    expect(panel()!.classList.contains('rounded-t-none')).toBe(true)
    handle().dispatchEvent(new MouseEvent('click', { clientY: 0 }))
    await nextTick()
    expect(panel()!.classList.contains('rounded-t-[28px]')).toBe(true)
    w.unmount()
  })
})
