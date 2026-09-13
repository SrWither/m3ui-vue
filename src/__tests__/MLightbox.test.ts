import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MLightbox from '../components/MLightbox.vue'

const items = [
  { src: '/a.jpg', alt: 'A' },
  { src: '/b.jpg', alt: 'B' },
  { src: '/c.jpg', alt: 'C' },
]

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
    const stage = document.body.querySelector('.touch-pan-y') as HTMLElement
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
    const stage = document.body.querySelector('.touch-pan-y') as HTMLElement
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
    const stage = document.body.querySelector('.touch-pan-y') as HTMLElement
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
})
