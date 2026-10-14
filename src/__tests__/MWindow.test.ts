import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MWindow from '../components/MWindow.vue'

// happy-dom has no layout: every parent is 1000×600.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function setup(props: Record<string, unknown> = {}) {
  const w = mount(MWindow, {
    props: { modelValue: true, title: 'Notes', x: 100, y: 100, width: '400px', height: '300px', ...props },
    attachTo: document.body,
  })
  const win = () => w.find('[role="dialog"]')
  const bar = () => win().find('div')
  return { w, win, bar }
}
const pointer = (type: string, x: number, y: number, target: EventTarget = window) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }))

describe('MWindow', () => {
  it('only the front window looks active; clicking another brings it forward', async () => {
    const Two = defineComponent({
      setup: () => () => [
        h(MWindow, { modelValue: true, title: 'A' }),
        h(MWindow, { modelValue: true, title: 'B' }),
      ],
    })
    const w = mount(Two, { attachTo: document.body })
    await nextTick()
    const [a, b] = w.findAll('[role="dialog"]')
    // The last one opened is in front.
    expect(b!.classes()).toContain('shadow-elevation-3')
    expect(b!.find('div').classes()).toContain('bg-surface-container-high')
    expect(a!.classes()).toContain('shadow-elevation-1')
    expect(a!.find('div').classes()).toContain('bg-surface-container')

    await a!.trigger('pointerdown')
    expect(a!.classes()).toContain('shadow-elevation-3')
    expect(b!.classes()).toContain('shadow-elevation-1')
    expect(Number((a!.element as HTMLElement).style.zIndex)).toBeGreaterThan(Number((b!.element as HTMLElement).style.zIndex))
    w.unmount()
  })

  it('title bar buttons are labelled buttons', () => {
    const { win, w } = setup()
    const buttons = win().findAll('button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['Minimize', 'Maximize', 'Close'])
    expect(buttons.every((b) => b.attributes('type') === 'button')).toBe(true)
    w.unmount()
  })

  it('lifts to elevation 4 while dragged', async () => {
    const { win, bar, w } = setup()
    pointer('pointerdown', 150, 110, bar().element)
    await nextTick()
    expect(win().classes()).toContain('shadow-elevation-4')
    pointer('pointermove', 200, 160)
    await nextTick()
    expect((win().element as HTMLElement).style.left).toBe('150px')
    expect((win().element as HTMLElement).style.top).toBe('150px')
    pointer('pointerup', 200, 160)
    await nextTick()
    expect(win().classes()).not.toContain('shadow-elevation-4')
    w.unmount()
  })

  it('resizes from the top edge, keeping the bottom edge in place', async () => {
    const { win, w } = setup()
    const top = win().findAll('.cursor-ns-resize').find((h) => h.classes().includes('top-0'))!
    pointer('pointerdown', 300, 100, top.element)
    pointer('pointermove', 300, 60)
    await nextTick()
    const style = (win().element as HTMLElement).style
    expect(style.top).toBe('60px')
    expect(style.height).toBe('340px')
    pointer('pointerup', 300, 60)
    w.unmount()
  })

  it('double-clicking the title bar maximizes to the parent and restores', async () => {
    const { win, bar, w } = setup()
    await bar().trigger('dblclick')
    const style = (win().element as HTMLElement).style
    expect([style.left, style.top, style.width, style.height]).toEqual(['0px', '0px', '1000px', '600px'])
    expect(win().classes()).toContain('rounded-none')
    expect(win().find('.cursor-ns-resize').exists()).toBe(false)
    expect(win().findAll('button')[1]!.attributes('aria-label')).toBe('Restore')

    await bar().trigger('dblclick')
    expect([style.left, style.top, style.width, style.height]).toEqual(['100px', '100px', '400px', '300px'])
    expect(w.emitted('maximize')).toEqual([[true], [false]])
    w.unmount()
  })

  it('dragging a maximized window detaches only after 40px, then eases to its size under the pointer', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout'] })
    const { win, bar, w } = setup()
    await bar().trigger('dblclick')
    const style = (win().element as HTMLElement).style
    // Grab the bar at x=500 (half of the 1000px maximized width), 20px below its top.
    pointer('pointerdown', 500, 20, bar().element)
    pointer('pointermove', 510, 50) // ~32px: not far enough to detach
    await nextTick()
    expect([style.left, style.width]).toEqual(['0px', '1000px'])

    pointer('pointermove', 520, 60) // ~45px: detaches
    vi.advanceTimersByTime(100)
    await nextTick()
    const midWidth = parseFloat(style.width)
    expect(midWidth).toBeLessThan(1000)
    expect(midWidth).toBeGreaterThan(400)
    // Still anchored mid-animation: half the current width left of the pointer.
    expect(parseFloat(style.left)).toBeCloseTo(520 - midWidth / 2, 0)

    vi.advanceTimersByTime(300)
    await nextTick()
    expect([style.width, style.height]).toEqual(['400px', '300px'])
    expect(style.left).toBe('320px')
    // The bar was grabbed 20px below its top edge, and still is.
    expect(style.top).toBe('40px')
    expect(win().classes()).toContain('rounded-xl')
    expect(w.emitted('maximize')).toEqual([[true], [false]])

    // Keeps following the pointer afterwards.
    pointer('pointermove', 600, 100)
    await nextTick()
    expect([style.left, style.top]).toEqual(['400px', '80px'])
    pointer('pointerup', 600, 100)
    vi.useRealTimers()
    w.unmount()
  })

  it('minimize folds the height to the title bar, keeping the body until the animation ends', async () => {
    vi.useFakeTimers()
    const { win, w } = setup()
    const body = () => win().findAll(':scope > div')[1]!.element as HTMLElement
    await win().findAll('button')[0]!.trigger('click')
    expect((win().element as HTMLElement).style.height).toBe('40px')
    expect(win().classes()).toContain('m3-window-geometry')
    expect(body().style.display).not.toBe('none')
    vi.advanceTimersByTime(350)
    await nextTick()
    expect(body().style.display).toBe('none')
    vi.useRealTimers()
    w.unmount()
  })

  it('snap: the top edge previews and maximizes, a side edge fills that half; off by default', async () => {
    const drag = async (bar: ReturnType<ReturnType<typeof setup>['bar']>, toX: number, toY: number) => {
      pointer('pointerdown', 200, 110, bar.element)
      pointer('pointermove', toX, toY)
      await nextTick()
    }
    const off = setup()
    await drag(off.bar(), 400, 5)
    expect(document.querySelector('.m3-window-snap-preview')).toBeNull()
    pointer('pointerup', 400, 5)
    await nextTick()
    expect((off.win().element as HTMLElement).style.width).toBe('400px')
    off.w.unmount()

    const { win, bar, w } = setup({ snap: true })
    const style = (win().element as HTMLElement).style
    await drag(bar(), 400, 5)
    expect(document.querySelector('.m3-window-snap-preview')).not.toBeNull()
    pointer('pointerup', 400, 5)
    await nextTick()
    expect([style.left, style.top, style.width, style.height]).toEqual(['0px', '0px', '1000px', '600px'])
    expect(w.emitted('maximize')).toEqual([[true]])

    // Dragging it off the top restores, then the right edge snaps it to the right half.
    pointer('pointerdown', 500, 20, bar().element)
    pointer('pointermove', 600, 200)
    pointer('pointermove', 995, 200)
    await nextTick()
    pointer('pointerup', 995, 200)
    await nextTick()
    expect([style.left, style.top, style.width, style.height]).toEqual(['500px', '0px', '500px', '600px'])
    expect(win().find('.cursor-ns-resize').exists()).toBe(false)

    // And double-click from the half restores the original size, not the half.
    await bar().trigger('dblclick')
    await bar().trigger('dblclick')
    expect([style.width, style.height]).toEqual(['400px', '300px'])
    w.unmount()
  })

  it('offscreen lets it leave the container up to 3/4 of its width, keeping the title bar; off by default', async () => {
    const dragBy = async (bar: Element, dx: number, dy: number) => {
      pointer('pointerdown', 200, 110, bar)
      pointer('pointermove', 200 + dx, 110 + dy)
      pointer('pointerup', 200 + dx, 110 + dy)
      await nextTick()
    }
    const inside = setup()
    const s1 = (inside.win().element as HTMLElement).style
    await dragBy(inside.bar().element, -1000, 1000)
    expect([s1.left, s1.top]).toEqual(['0px', '300px']) // 600 - 300: fully inside
    inside.w.unmount()

    const { win, bar, w } = setup({ offscreen: true })
    const style = (win().element as HTMLElement).style
    await dragBy(bar().element, -1000, 1000)
    expect([style.left, style.top]).toEqual(['-300px', '560px']) // 1/4 of 400 visible, only the 40px bar
    await dragBy(bar().element, 2000, -2000)
    expect([style.left, style.top]).toEqual(['900px', '0px']) // never above the top
    w.unmount()
  })

  it('snap: a top corner snaps to that side, not maximize', async () => {
    const { win, bar, w } = setup({ snap: true })
    const style = (win().element as HTMLElement).style
    pointer('pointerdown', 200, 110, bar().element)
    pointer('pointermove', 4, 3)
    await nextTick()
    pointer('pointerup', 4, 3)
    await nextTick()
    expect([style.left, style.top, style.width, style.height]).toEqual(['0px', '0px', '500px', '600px'])
    expect(w.emitted('maximize')).toBeUndefined()
    w.unmount()
  })

  it('focus() brings a window to the front and emits focus once per activation', async () => {
    const Two = defineComponent({
      setup() {
        const a = ref<InstanceType<typeof MWindow>>()
        return { a }
      },
      render() {
        return [
          h(MWindow, { ref: 'a', modelValue: true, title: 'A', onFocus: () => this.$emit('focusA') }),
          h(MWindow, { modelValue: true, title: 'B' }),
        ]
      },
      emits: ['focusA'],
    })
    const w = mount(Two, { attachTo: document.body })
    await nextTick()
    const [a] = w.findAll('[role="dialog"]')
    expect(a!.classes()).toContain('shadow-elevation-1')
    const focusesBefore = w.emitted('focusA')?.length ?? 0
    ;(w.vm.a as any).focus()
    await nextTick()
    expect(a!.classes()).toContain('shadow-elevation-3')
    expect(w.emitted('focusA')!.length).toBe(focusesBefore + 1)
    ;(w.vm.a as any).focus()
    expect(w.emitted('focusA')!.length).toBe(focusesBefore + 1)
    w.unmount()
  })
})
