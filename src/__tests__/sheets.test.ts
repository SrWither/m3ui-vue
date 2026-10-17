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
