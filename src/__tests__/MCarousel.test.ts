import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MCarousel from '../components/MCarousel.vue'
import {
  Strategy,
  heroKeylineList,
  maxScrollOffset,
  multiBrowseKeylineList,
  placeItem,
  snapScrollOffset,
  uncontainedKeylineList,
} from '../composables/_carouselStrategy'

const sizes = (s: Strategy) => s.defaultKeylines.keylines.map((k) => Math.round(k.size))

describe('carousel strategy (Compose port)', () => {
  it('multi-browse arranges large, medium and small items between two anchors', () => {
    const s = new Strategy(multiBrowseKeylineList(380, 186, 8, 6), 380, 8, 0, 0)
    expect(sizes(s)).toEqual([10, 186, 122, 56, 10])
    expect(s.itemMainAxisSize).toBe(186)
  })

  it('multi-browse drops small items when there are fewer items than keylines', () => {
    // Upstream removes small items first and never removes large ones (they're fully unmasked).
    const s = new Strategy(multiBrowseKeylineList(380, 186, 8, 2), 380, 8, 0, 0)
    expect(s.defaultKeylines.keylines.filter((k) => !k.isAnchor && k.size <= 56)).toHaveLength(0)
  })

  it('centered hero puts the large item between two small ones', () => {
    const s = new Strategy(heroKeylineList(380, null, 8, 6, true), 380, 8, 0, 0)
    expect(sizes(s)).toEqual([10, 40, 284, 40, 10])
  })

  it('uncontained keeps items at their size and cuts off the last visible one', () => {
    const s = new Strategy(uncontainedKeylineList(380, 186, 8), 380, 8, 0, 0)
    expect(s.itemMainAxisSize).toBe(194)
    expect(s.defaultKeylines.keylines.filter((k) => !k.isAnchor).map((k) => k.size)).toEqual([194, 194])
  })

  it.each([
    ['multi-browse', multiBrowseKeylineList(412, 186, 8, 7), 7, 16],
    ['hero', heroKeylineList(412, null, 8, 7, true), 7, 0],
    ['uncontained', uncontainedKeylineList(412, 186, 8), 7, 0],
  ] as const)('%s: masked items touch with exactly the item spacing at any scroll', (_name, keylines, count, padding) => {
    const s = new Strategy(keylines, 412, 8, padding, padding)
    const max = maxScrollOffset(s, count)
    for (let scroll = 0; scroll <= max; scroll += max / 23) {
      const spans = Array.from({ length: count }, (_, i) => {
        const p = placeItem(s, i, scroll, max)
        return [p.offset + p.maskStart, p.offset + p.maskStart + p.maskSize] as const
      }).filter(([a, b]) => b > 0 && a < 412)
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i]![0] - spans[i - 1]![1]).toBeCloseTo(8, 3)
      }
    }
  })

  it('snaps every item, the last one flush with the end padding', () => {
    const s = new Strategy(multiBrowseKeylineList(412, 186, 8, 6), 412, 8, 16, 16)
    const max = maxScrollOffset(s, 6)
    expect(snapScrollOffset(s, 0, 6)).toBe(0)
    expect(snapScrollOffset(s, 5, 6)).toBe(max)
    const last = placeItem(s, 5, max, max)
    expect(last.offset + last.maskStart + last.maskSize).toBeCloseTo(412 - 16, 3)
    const first = placeItem(s, 0, 0, max)
    expect(first.offset + first.maskStart).toBeCloseTo(16, 3)
  })
})

const items = Array.from({ length: 6 }, (_, i) => ({ src: `${i}.jpg`, label: `Item ${i}` }))

function translateOf(el: Element) {
  const m = /translate3d\((-?[\d.]+)px/.exec((el as HTMLElement).style.transform)
  return m ? Number(m[1]) : NaN
}

describe('MCarousel', () => {
  let wrapper: VueWrapper | null = null
  let rafTime = 0

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    rafTime = 0
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.classList?.contains('m3-carousel') ? 380 : 0 } })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
    // @ts-expect-error restore happy-dom's own getter
    delete HTMLElement.prototype.clientWidth
  })

  async function mountCarousel(props: Record<string, unknown> = {}) {
    wrapper = mount(MCarousel, {
      props: { items, ...props, 'onUpdate:modelValue': (v: number) => wrapper!.setProps({ modelValue: v }) },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    return wrapper
  }

  function settle() {
    for (let i = 0; i < 200; i++) {
      rafTime += 16
      vi.advanceTimersByTime(16)
    }
  }

  const itemEls = () => wrapper!.findAll('[data-carousel-item]').map((w) => w.element as HTMLElement)

  it('renders every item as a labelled group inside a carousel region', async () => {
    await mountCarousel({ label: 'Photos' })
    const root = wrapper!.get('.m3-carousel')
    expect(root.attributes('role')).toBe('region')
    expect(root.attributes('aria-roledescription')).toBe('Carousel')
    expect(root.attributes('aria-label')).toBe('Photos')
    expect(itemEls()).toHaveLength(6)
    expect(itemEls()[1]!.getAttribute('aria-label')).toBe('2 of 6')
  })

  it('lays items out at the focal size and masks the ones after it', async () => {
    await mountCarousel()
    const [first, second] = itemEls()
    expect(first!.style.width).toBe('186px')
    expect(translateOf(first!)).toBe(0)
    expect(first!.style.clipPath).toBe('inset(0 0px 0 0px round var(--radius-xl))')
    // The medium item (122px) is masked from both sides of its 186px box.
    expect(second!.style.clipPath).toBe('inset(0 32px 0 32px round var(--radius-xl))')
  })

  it('ArrowRight moves to the next item and updates v-model', async () => {
    await mountCarousel({ modelValue: 0 })
    await wrapper!.get('.m3-carousel').trigger('keydown', { key: 'ArrowRight' })
    settle()
    expect(wrapper!.emitted('update:modelValue')?.at(-1)).toEqual([1])
    expect(translateOf(itemEls()[1]!)).toBeCloseTo(0, 0)
  })

  it('setting v-model scrolls to that item', async () => {
    await mountCarousel({ modelValue: 0 })
    await wrapper!.setProps({ modelValue: 3 })
    settle()
    expect(translateOf(itemEls()[3]!)).toBeCloseTo(0, 0)
  })

  it('a fast drag advances exactly one item (single-advance fling)', async () => {
    await mountCarousel({ modelValue: 0 })
    const item = itemEls()[0]!
    item.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 100, bubbles: true }))
    for (let x = 290; x >= 100; x -= 30) {
      rafTime += 10
      vi.advanceTimersByTime(10)
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: 100 }))
    }
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 100 }))
    settle()
    await nextTick()
    expect(wrapper!.props('modelValue')).toBe(1)
    expect(translateOf(itemEls()[1]!)).toBeCloseTo(0, 0)
  })

  it('a drag does not count as a click on the item', async () => {
    await mountCarousel()
    const item = itemEls()[0]!
    item.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 100, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 250, clientY: 100 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 250, clientY: 100 }))
    item.click()
    expect(wrapper!.emitted('itemClick')).toBeUndefined()
  })

  it('clicking a partly visible item emits itemClick and brings it into focus', async () => {
    await mountCarousel({ modelValue: 0 })
    itemEls()[1]!.click()
    settle()
    await nextTick()
    expect(wrapper!.emitted('itemClick')?.[0]).toEqual([items[1], 1])
    expect(wrapper!.props('modelValue')).toBe(1)
  })

  it('renders a custom #item slot', async () => {
    wrapper = mount(MCarousel, {
      props: { items },
      slots: { item: `<template #item="{ item, index }"><p class="custom">{{ index }}-{{ item.label }}</p></template>` },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.findAll('.custom').map((w) => w.text())[2]).toBe('2-Item 2')
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
