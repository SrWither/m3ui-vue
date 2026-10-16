import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MLightbox from '../components/MLightbox.vue'

const items = [
  { src: '/a.jpg', alt: 'A' },
  { src: '/b.jpg', alt: 'B' },
  { src: '/c.jpg', alt: 'C' },
]

enableAutoUnmount(afterEach)

describe('MLightbox', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing when closed', () => {
    mount(MLightbox, {
      props: { modelValue: false, items },
      attachTo: document.body,
    })
    expect(document.body.querySelector('.fixed')).toBeNull()
  })

  it('shows the image at the given index when open', () => {
    mount(MLightbox, {
      props: { modelValue: true, items, index: 1 },
      attachTo: document.body,
    })
    const img = document.body.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/b.jpg')
  })

  it('next()/prev() navigate and emit update:index', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items, index: 0 },
      attachTo: document.body,
    })
    await (wrapper.vm as any).next()
    await nextTick()
    expect(wrapper.emitted('update:index')?.[0]).toEqual([1])
    expect(document.body.querySelector('img')?.getAttribute('src')).toBe('/b.jpg')
  })

  it('loops from the last image back to the first by default', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items, index: 2 },
      attachTo: document.body,
    })
    await (wrapper.vm as any).next()
    await nextTick()
    expect(document.body.querySelector('img')?.getAttribute('src')).toBe('/a.jpg')
  })

  it('does not loop past the last image when loop is false', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items, index: 2, loop: false },
      attachTo: document.body,
    })
    await (wrapper.vm as any).next()
    await nextTick()
    expect(document.body.querySelector('img')?.getAttribute('src')).toBe('/c.jpg')
  })

  it('emits update:modelValue false when the close button is clicked', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items },
      attachTo: document.body,
    })
    const closeBtn = document.body.querySelector('button[aria-label="Close"]') as HTMLButtonElement
    closeBtn.click()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('hides prev/next arrows for a single image', () => {
    mount(MLightbox, {
      props: { modelValue: true, items: [items[0]] },
      attachTo: document.body,
    })
    expect(document.body.querySelector('[aria-label="Previous"]')).toBeNull()
    expect(document.body.querySelector('[aria-label="Next"]')).toBeNull()
  })

  it('auto-detects <img> elements in the default slot when no items are given', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: false },
      slots: { default: '<img src="/x.jpg" alt="X" /><img src="/y.jpg" alt="Y" />' },
      attachTo: document.body,
    })
    await nextTick()
    const imgs = document.body.querySelectorAll('.contents img')
    expect(imgs).toHaveLength(2)
    ;(imgs[1] as HTMLImageElement).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(document.body.querySelectorAll('.fixed img')[0]?.getAttribute('src')).toContain('/y.jpg')
  })

  it('skips images marked data-lightbox="false"', async () => {
    mount(MLightbox, {
      props: { modelValue: false },
      slots: { default: '<img src="/x.jpg" data-lightbox="false" /><img src="/y.jpg" />' },
      attachTo: document.body,
    })
    await nextTick()
    const wrapperVm = document.body.querySelector('.contents img[src="/x.jpg"]') as HTMLImageElement
    expect(wrapperVm.onclick).toBeNull()
  })

  it('does not render thumbnails by default', () => {
    mount(MLightbox, {
      props: { modelValue: true, items },
      attachTo: document.body,
    })
    expect(document.body.querySelectorAll('.ring-2')).toHaveLength(0)
  })

  it('renders a thumbnail per image when showThumbnails is set, and clicking one jumps to it', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items, index: 0, showThumbnails: true },
      attachTo: document.body,
    })
    const thumbs = document.body.querySelectorAll('.ring-2')
    expect(thumbs).toHaveLength(3)
    ;(thumbs[2] as HTMLButtonElement).click()
    await nextTick()
    expect(wrapper.emitted('update:index')?.[0]).toEqual([2])
  })

  it('rounds the image by default', () => {
    mount(MLightbox, {
      props: { modelValue: true, items },
      attachTo: document.body,
    })
    expect(document.body.querySelector('img')?.className).toContain('rounded-2xl')
  })

  it('does not round the image when rounded is false', () => {
    mount(MLightbox, {
      props: { modelValue: true, items, rounded: false },
      attachTo: document.body,
    })
    expect(document.body.querySelector('img')?.className).not.toContain('rounded-2xl')
  })

  it('dragging left past the threshold navigates to the next image', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items, index: 0 },
      attachTo: document.body,
    })
    const stage = document.body.querySelector('[data-lb-stage]') as HTMLElement
    stage.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1, button: 0, bubbles: true }))
    stage.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, pointerId: 1, bubbles: true }))
    stage.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, pointerId: 1, bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:index')?.[0]).toEqual([1])
  })

  it('dragging right past the threshold navigates to the previous image', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items, index: 1 },
      attachTo: document.body,
    })
    const stage = document.body.querySelector('[data-lb-stage]') as HTMLElement
    stage.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, pointerId: 1, button: 0, bubbles: true }))
    stage.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, pointerId: 1, bubbles: true }))
    stage.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, pointerId: 1, bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:index')?.[0]).toEqual([0])
  })

  it('ignores drag gestures when there is only one image', async () => {
    const wrapper = mount(MLightbox, {
      props: { modelValue: true, items: [items[0]] },
      attachTo: document.body,
    })
    const stage = document.body.querySelector('[data-lb-stage]') as HTMLElement
    stage.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1, button: 0, bubbles: true }))
    stage.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, pointerId: 1, bubbles: true }))
    stage.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, pointerId: 1, bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:index')).toBeUndefined()
  })

  it('exposes open()/close() for programmatic control', async () => {
    const wrapper = mount(MLightbox, {
      props: { items },
      attachTo: document.body,
    })
    ;(wrapper.vm as any).open(2)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(document.body.querySelector('img')?.getAttribute('src')).toBe('/c.jpg')
  })

  describe('gestures, zoom and accessibility', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    })
    afterEach(() => vi.useRealTimers())

    const settle = () => vi.advanceTimersByTime(2000)
    const stage = () => document.body.querySelector('[data-lb-stage]') as HTMLElement
    const pointer = (type: string, x: number, y: number, id = 1) =>
      (type === 'pointerdown' ? stage() : stage()).dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, button: 0, bubbles: true }))

    it('is a modal dialog that announces the position', async () => {
      mount(MLightbox, { props: { modelValue: true, items, index: 1 }, attachTo: document.body })
      await nextTick()
      const dialog = document.body.querySelector('[role="dialog"]')!
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      expect(document.body.querySelector('[aria-live]')?.textContent).toBe('2 of 3')
    })

    it('moves focus to the close button and gives it back on close', async () => {
      const opener = document.createElement('button')
      document.body.appendChild(opener)
      opener.focus()
      const wrapper = mount(MLightbox, { props: { items }, attachTo: document.body })
      ;(wrapper.vm as any).open(0)
      await nextTick()
      await nextTick()
      expect(document.activeElement?.hasAttribute('data-lb-close')).toBe(true)
      ;(wrapper.vm as any).close()
      settle()
      await nextTick()
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
      expect(document.activeElement).toBe(opener)
    })

    it('dragging the image down far enough closes it', async () => {
      const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      pointer('pointerdown', 200, 200)
      vi.advanceTimersByTime(16)
      pointer('pointermove', 200, 260)
      vi.advanceTimersByTime(16)
      pointer('pointermove', 200, 400)
      pointer('pointerup', 200, 400)
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('a short drag down springs back instead of closing', async () => {
      const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      pointer('pointerdown', 200, 200)
      vi.advanceTimersByTime(200)
      pointer('pointermove', 200, 240)
      vi.advanceTimersByTime(200)
      pointer('pointerup', 200, 240)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('a double tap zooms in and another zooms back out', async () => {
      mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      settle()
      const zoomEl = () => document.body.querySelector('[data-lb-slide][data-offset="0"] [data-lb-zoom]') as HTMLElement
      const tap = () => {
        pointer('pointerdown', 0, 0)
        pointer('pointerup', 0, 0)
        vi.advanceTimersByTime(100)
      }
      tap()
      tap()
      settle()
      expect(zoomEl().style.transform).toContain('scale(2.5)')
      tap()
      tap()
      settle()
      expect(zoomEl().style.transform).toContain('scale(1)')
    })

    it('a zoomed image pans instead of swiping', async () => {
      const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      settle()
      pointer('pointerdown', 0, 0); pointer('pointerup', 0, 0); vi.advanceTimersByTime(100)
      pointer('pointerdown', 0, 0); pointer('pointerup', 0, 0)
      settle()
      pointer('pointerdown', 300, 200)
      pointer('pointermove', 50, 200)
      pointer('pointerup', 50, 200)
      expect(wrapper.emitted('update:index')).toBeUndefined()
    })

    it('a single tap on the image hides and shows the bars', async () => {
      mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      const bar = () => document.body.querySelector('[data-lb-close]')!.parentElement!
      const img = document.body.querySelector('[data-lb-slide][data-offset="0"] img') as HTMLElement
      img.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect
      const tapImage = () => {
        img.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1, button: 0, bubbles: true }))
        img.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 5, pointerId: 1, button: 0, bubbles: true }))
        vi.advanceTimersByTime(400)
      }
      tapImage()
      await nextTick()
      expect(bar().classList.contains('opacity-0')).toBe(true)
      tapImage()
      await nextTick()
      expect(bar().classList.contains('opacity-0')).toBe(false)
    })

    it('arrow keys navigate and Escape closes', async () => {
      const wrapper = mount(MLightbox, { props: { modelValue: true, items, index: 0 }, attachTo: document.body })
      await nextTick()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      expect(wrapper.emitted('update:index')?.[0]).toEqual([1])
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('renders the #actions slot with the current item', async () => {
      mount(MLightbox, {
        props: { modelValue: true, items, index: 2 },
        slots: { actions: `<template #actions="{ item, index }"><span class="act">{{ index }}:{{ item.alt }}</span></template>` },
        attachTo: document.body,
      })
      await nextTick()
      expect(document.body.querySelector('.act')?.textContent).toBe('2:C')
    })

    it('with two looping images, shows the other one on both sides', async () => {
      mount(MLightbox, { props: { modelValue: true, items: items.slice(0, 2), index: 0 }, attachTo: document.body })
      await nextTick()
      const offsets = [...document.body.querySelectorAll('[data-lb-slide]')].map((el) => [el.getAttribute('data-offset'), el.querySelector('img')!.getAttribute('src')])
      expect(offsets).toEqual([['0', '/a.jpg'], ['1', '/b.jpg'], ['-1', '/b.jpg']])
    })

    it('a click on the image toggles the bars even though the stage captured the pointer', async () => {
      const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      const img = document.body.querySelector('[data-lb-slide][data-offset="0"] img') as HTMLElement
      img.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 250, width: 200, height: 150, x: 100, y: 100, toJSON() {} }) as DOMRect
      // With pointer capture the browser targets pointerup at the stage, not the image.
      pointer('pointerdown', 150, 150)
      pointer('pointerup', 150, 150)
      vi.advanceTimersByTime(400)
      await nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(document.body.querySelector('[data-lb-close]')!.parentElement!.classList.contains('opacity-0')).toBe(true)
    })

    it('hides the bars as soon as it starts closing', async () => {
      const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
      await nextTick()
      ;(wrapper.vm as any).close()
      await nextTick()
      expect(document.body.querySelector('[data-lb-close]')!.parentElement!.classList.contains('opacity-0')).toBe(true)
    })

    it('keeps the active thumbnail in view without scrolling the viewer itself', async () => {
      const spy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
      const wrapper = mount(MLightbox, { props: { modelValue: true, items, showThumbnails: true }, attachTo: document.body })
      await nextTick()
      ;(wrapper.vm as any).next()
      await nextTick()
      await nextTick()
      expect(spy).not.toHaveBeenCalled()
      expect((document.body.querySelector('[role="dialog"]') as HTMLElement).scrollLeft).toBe(0)
      spy.mockRestore()
    })

    describe('pinch', () => {
      const zoomTransform = () => (document.body.querySelector('[data-lb-slide][data-offset="0"] [data-lb-zoom]') as HTMLElement).style.transform
      const scaleOf = () => Number(/scale\(([\d.]+)\)/.exec(zoomTransform())![1])
      const trackOf = () => (document.body.querySelector('[data-lb-slide][data-offset="0"]') as HTMLElement).style.transform

      it('spreading two fingers zooms in, pinching them back zooms out to 1', async () => {
        mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
        await nextTick()
        settle()
        pointer('pointerdown', 100, 200, 1)
        pointer('pointerdown', 200, 200, 2)
        pointer('pointermove', 50, 200, 1)
        pointer('pointermove', 250, 200, 2)
        expect(scaleOf()).toBeCloseTo(2, 5)
        pointer('pointermove', 125, 200, 1)
        pointer('pointermove', 175, 200, 2)
        expect(scaleOf()).toBeLessThan(1)
        pointer('pointerup', 125, 200, 1)
        pointer('pointerup', 175, 200, 2)
        settle()
        expect(scaleOf()).toBe(1)
      })

      it('a swipe the first finger had started is undone when the pinch begins', async () => {
        const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
        await nextTick()
        settle()
        pointer('pointerdown', 100, 200, 1)
        pointer('pointermove', 80, 200, 1)
        pointer('pointermove', 60, 200, 1)
        pointer('pointerdown', 200, 200, 2)
        pointer('pointermove', 30, 200, 1)
        pointer('pointermove', 260, 200, 2)
        pointer('pointerup', 30, 200, 1)
        pointer('pointerup', 260, 200, 2)
        settle()
        expect(wrapper.emitted('update:index')).toBeUndefined()
        expect(trackOf()).toContain('translate3d(0px')
        expect(scaleOf()).toBeGreaterThan(1.5)
      })

      it('lifting one finger lets the other keep moving the zoomed image', async () => {
        mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
        await nextTick()
        settle()
        pointer('pointerdown', 100, 200, 1)
        pointer('pointerdown', 200, 200, 2)
        pointer('pointermove', 0, 200, 1)
        pointer('pointermove', 300, 200, 2)
        pointer('pointerup', 0, 200, 1)
        const before = zoomTransform()
        pointer('pointermove', 340, 240, 2)
        expect(zoomTransform()).not.toBe(before)
        pointer('pointerup', 340, 240, 2)
      })

      it('a pinch never counts as a tap', async () => {
        const wrapper = mount(MLightbox, { props: { modelValue: true, items }, attachTo: document.body })
        await nextTick()
        pointer('pointerdown', 100, 200, 1)
        pointer('pointerdown', 200, 200, 2)
        pointer('pointerup', 100, 200, 1)
        pointer('pointerup', 200, 200, 2)
        vi.advanceTimersByTime(500)
        expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      })
    })

    it('opens from a cropped thumbnail with its shape, then uncrops', async () => {
      const thumb = document.createElement('button')
      thumb.style.borderTopLeftRadius = '12px'
      thumb.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect
      document.body.appendChild(thumb)
      // A 3:2 picture shown at 300×200 opening from a square: covered at scale 0.5, cropped to 200×200.
      Object.defineProperty(HTMLImageElement.prototype, 'offsetWidth', { configurable: true, get: () => 300 })
      Object.defineProperty(HTMLImageElement.prototype, 'offsetHeight', { configurable: true, get: () => 200 })
      const wrapper = mount(MLightbox, { props: { items }, attachTo: document.body })
      ;(wrapper.vm as any).open(0, thumb)
      await nextTick()
      await nextTick()
      await Promise.resolve()
      vi.advanceTimersByTime(16)
      const img = document.body.querySelector('[data-lb-slide][data-offset="0"] img') as HTMLElement
      // @ts-expect-error restore happy-dom's own getters
      delete HTMLImageElement.prototype.offsetWidth
      // @ts-expect-error restore happy-dom's own getters
      delete HTMLImageElement.prototype.offsetHeight
      const zoomEl = img.closest('[data-lb-zoom]') as HTMLElement
      expect(zoomEl.style.clipPath).toMatch(/^inset\(0px 4\d\.\d+px round/)
      settle()
      expect(zoomEl.style.clipPath).toBe('')
    })

    it('sizes an image from its ratio, so an SVG without width/height still shows', async () => {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute?.('data-lb-stage') ? 800 : 0 } })
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute?.('data-lb-stage') ? 600 : 0 } })
      const svg = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200'/>")}`
      mount(MLightbox, { props: { modelValue: true, items: [{ src: svg }] }, attachTo: document.body })
      await nextTick()
      await nextTick()
      const img = document.body.querySelector('[data-lb-slide] img') as HTMLImageElement
      Object.defineProperty(img, 'naturalWidth', { value: 400 })
      Object.defineProperty(img, 'naturalHeight', { value: 200 })
      img.dispatchEvent(new Event('load'))
      // happy-dom doesn't lay out the off-screen probe, so its error path falls back to the natural ratio.
      document.body.querySelectorAll('img').forEach((p) => p !== img && p.dispatchEvent(new Event('error')))
      await nextTick()
      // 800×600 stage minus 48px padding on each side leaves 704×504; a 2:1 image fills the width.
      expect(img.style.width).toBe('704px')
      expect(img.style.height).toBe('352px')
      // @ts-expect-error restore happy-dom's own getters
      delete HTMLElement.prototype.clientWidth
      // @ts-expect-error restore happy-dom's own getters
      delete HTMLElement.prototype.clientHeight
    })

    it('opening on another image shows it directly instead of sliding to it', async () => {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute?.('data-lb-stage') ? 800 : 0 } })
      const wrapper = mount(MLightbox, { props: { modelValue: true, items, index: 0 }, attachTo: document.body })
      await nextTick()
      settle()
      await wrapper.setProps({ modelValue: false })
      settle()
      await nextTick()
      // Second open, like a chat: the index and v-model change together.
      await wrapper.setProps({ index: 2, modelValue: true })
      await nextTick()
      vi.advanceTimersByTime(16)
      const current = document.body.querySelector('[data-lb-slide][data-offset="0"]') as HTMLElement
      expect(current.querySelector('img')!.getAttribute('src')).toBe('/c.jpg')
      expect(current.style.transform).toBe('translate3d(0px, 0, 0)')
      // @ts-expect-error restore happy-dom's own getter
      delete HTMLElement.prototype.clientWidth
    })
  })
})
