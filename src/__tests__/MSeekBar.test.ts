import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MSeekBar from '../components/MSeekBar.vue'

// happy-dom has no layout: the track is 400px wide from x = 0
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 400, bottom: 46, width: 400, height: 46, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const track = (w: ReturnType<typeof mount>) => w.find('[role="slider"]').element as HTMLElement
const pointer = (type: string, x: number, extra: Partial<PointerEventInit> = {}) =>
  new PointerEvent(type, { clientX: x, clientY: 20, pointerId: 1, button: 0, pointerType: 'mouse', ...extra })

describe('MSeekBar', () => {
  it('shows elapsed and total time, h:mm:ss past an hour, and toggles remaining', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 75, duration: 200 } })
    expect(w.text()).toContain('1:15')
    expect(w.text()).toContain('3:20')
    await w.find('button').trigger('click')
    expect(w.text()).toContain('-2:05')
    expect(w.emitted('update:remaining')![0]).toEqual([true])

    await w.setProps({ modelValue: 65, duration: 3725 })
    expect(w.text()).toContain('0:01:05')
    expect(w.text()).toContain('-1:01:00')
  })

  it('a click seeks to that point', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 0, duration: 100 }, attachTo: document.body })
    await nextTick()
    track(w).dispatchEvent(pointer('pointerdown', 100))
    window.dispatchEvent(pointer('pointerup', 100))
    expect(w.emitted('seek')![0]).toEqual([25])
    expect(w.emitted('update:modelValue')![0]).toEqual([25])
    w.unmount()
  })

  it('a drag scrubs locally and seeks once on release, or live with live', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 10, duration: 100 }, attachTo: document.body })
    await nextTick()
    track(w).dispatchEvent(pointer('pointerdown', 40))
    window.dispatchEvent(pointer('pointermove', 200))
    await nextTick()
    expect(w.emitted('scrub-start')![0]).toEqual([10])
    expect(w.emitted('scrub')!.at(-1)).toEqual([50])
    expect(w.emitted('update:modelValue')).toBeUndefined()
    // The label follows the drag, not modelValue
    expect(w.text()).toContain('0:50')
    window.dispatchEvent(pointer('pointerup', 200))
    expect(w.emitted('seek')).toEqual([[50]])
    expect(w.emitted('update:modelValue')).toEqual([[50]])

    await w.setProps({ live: true })
    track(w).dispatchEvent(pointer('pointerdown', 40))
    window.dispatchEvent(pointer('pointermove', 80))
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([20])
    window.dispatchEvent(pointer('pointerup', 80))
    w.unmount()
  })

  it('a touch waits for a horizontal move, and leaves a vertical one to the page', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 0, duration: 100 }, attachTo: document.body })
    await nextTick()
    const touch = { pointerType: 'touch' }
    track(w).dispatchEvent(pointer('pointerdown', 100, touch))
    expect(w.emitted('scrub-start')).toBeUndefined()
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 102, clientY: 60, pointerId: 1, pointerType: 'touch' }))
    window.dispatchEvent(pointer('pointercancel', 102, touch))
    expect(w.emitted('seek')).toBeUndefined()

    track(w).dispatchEvent(pointer('pointerdown', 100, touch))
    window.dispatchEvent(pointer('pointermove', 120, touch))
    expect(w.emitted('scrub-start')).toHaveLength(1)
    window.dispatchEvent(pointer('pointerup', 120, touch))
    expect(w.emitted('seek')).toEqual([[30]])
    w.unmount()
  })

  it('keys seek by keyStep, 10% and to the ends', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 50, duration: 200 } })
    await w.find('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    await w.find('[role="slider"]').trigger('keydown', { key: 'PageDown' })
    await w.find('[role="slider"]').trigger('keydown', { key: 'End' })
    expect(w.emitted('seek')).toEqual([[55], [35], [200]])
  })

  it('draws the buffered part and splits the track at chapters', async () => {
    const w = mount(MSeekBar, {
      props: { modelValue: 0, duration: 100, buffered: 50, variant: 'line', chapters: [{ start: 0, title: 'Intro' }, { start: 25, title: 'Verse' }] },
    })
    await nextTick()
    const pieces = w.findAll('[role="slider"] > div.overflow-hidden')
    expect(pieces).toHaveLength(2)
    // First chapter: 0–98px (a 4px gap at 100px), all buffered
    expect((pieces[0]!.element as HTMLElement).style.width).toBe('98px')
    // Nothing played yet: its only fill is the buffered one
    const fills = pieces[0]!.findAll('div')
    expect(fills).toHaveLength(1)
    expect((fills[0]!.element as HTMLElement).style.width).toBe('98px')
    // The second chapter is buffered up to 200px
    expect((pieces[1]!.find('div').element as HTMLElement).style.width).toBe('98px')
  })

  it('shows the time and chapter under the pointer', async () => {
    const w = mount(MSeekBar, {
      props: { modelValue: 0, duration: 100, chapters: [{ start: 0, title: 'Intro' }, { start: 25, title: 'Verse' }] },
    })
    await nextTick()
    track(w).dispatchEvent(pointer('pointermove', 160))
    await nextTick()
    expect(w.text()).toContain('Verse ·')
    expect(w.text()).toContain('0:40')
    track(w).dispatchEvent(new PointerEvent('pointerleave'))
    await nextTick()
    expect(w.text()).not.toContain('Verse')
  })

  it('the line thickens under the pointer', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 50, duration: 100, variant: 'line', size: 'xs' } })
    await nextTick()
    const piece = () => w.find('[role="slider"] > div.overflow-hidden').element as HTMLElement
    expect(piece().style.height).toBe('4px')
    track(w).dispatchEvent(pointer('pointermove', 100))
    await nextTick()
    expect(piece().style.height).toBe('6px')
    track(w).dispatchEvent(new PointerEvent('pointerleave'))
    await nextTick()
    expect(piece().style.height).toBe('4px')
  })

  it('advances on its own while playing', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    const w = mount(MSeekBar, { props: { modelValue: 10, duration: 100, playing: true } })
    await nextTick()
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(w.text()).toContain('0:12')
    await w.setProps({ playing: false })
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(w.text()).toContain('0:12')
  })

  it('without a duration it can\'t seek', async () => {
    const w = mount(MSeekBar, { props: { modelValue: 0, duration: Infinity }, attachTo: document.body })
    await nextTick()
    expect(w.text()).toContain('--:--')
    expect(track(w).getAttribute('tabindex')).toBe('-1')
    track(w).dispatchEvent(pointer('pointerdown', 100))
    window.dispatchEvent(pointer('pointerup', 100))
    expect(w.emitted('seek')).toBeUndefined()
    w.unmount()
  })
})
