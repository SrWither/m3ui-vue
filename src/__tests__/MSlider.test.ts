import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MSlider from '../components/MSlider.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

// happy-dom has no layout: the slider's track is 880px long (the docs' Volume slider in the bug report)
const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.classList.contains('touch-none') ? 880 : 0 },
  })
})
afterAll(() => Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth))

// The track's pieces (inactive/active) and its end dots, in template order
const track = (w: VueWrapper) => w.find('.touch-none')
const bar = (w: VueWrapper) => track(w).element.firstElementChild as HTMLElement
const pieces = (w: VueWrapper) => [...bar(w).children].filter((c) => !c.classList.contains('rounded-full')) as HTMLElement[]
const endDot = (w: VueWrapper) => [...bar(w).children].filter((c) => c.classList.contains('rounded-full')).at(-1) as HTMLElement
const startDot = (w: VueWrapper) => [...bar(w).children].filter((c) => c.classList.contains('rounded-full'))[0] as HTMLElement

describe('MSlider', () => {
  it('shows the end dot while there is room for it in the inactive piece', async () => {
    wrapper = mount(MSlider, { props: { modelValue: 90 } })
    await nextTick()
    expect(endDot(wrapper).style.opacity).toBe('1')
    expect(pieces(wrapper)[1]!.style.width).not.toBe('0px')
  })

  it('hides the end dot once it no longer fits in the inactive piece, instead of leaving it in the thumb gap', async () => {
    // 98 of 880px: an 11.6px piece, shorter than the dot's 12px inset + its radius
    wrapper = mount(MSlider, { props: { modelValue: 98 } })
    await nextTick()
    expect(endDot(wrapper).style.opacity).toBe('0')
    // The piece itself is still longer than its corner, so it stays (Compose draws it too)
    expect(pieces(wrapper)[1]!.style.width).not.toBe('0px')
  })

  it('drops the inactive piece once it is shorter than its corner, like Compose', async () => {
    // 99: a 3.2px piece
    wrapper = mount(MSlider, { props: { modelValue: 99 } })
    await nextTick()
    expect(pieces(wrapper)[1]!.style.width).toBe('0px')
    expect(endDot(wrapper).style.opacity).toBe('0')
  })

  it('applies the same to both ends of a range slider', async () => {
    wrapper = mount(MSlider, { props: { variant: 'range', modelValue: [1, 99] } })
    await nextTick()
    const [before, , after] = pieces(wrapper)
    expect(before!.style.width).toBe('0px')
    expect(after!.style.width).toBe('0px')
    expect(startDot(wrapper).style.opacity).toBe('0')
    expect(endDot(wrapper).style.opacity).toBe('0')
  })

  it('keeps both dots of a range slider away from the ends', async () => {
    wrapper = mount(MSlider, { props: { variant: 'range', modelValue: [20, 80] } })
    await nextTick()
    expect(startDot(wrapper).style.opacity).toBe('1')
    expect(endDot(wrapper).style.opacity).toBe('1')
  })

  describe('range', () => {
    // The track is 100px long from 0 for the pointer
    const press = async (w: VueWrapper, at: number, moves: number[] = []) => {
      const el = track(w).element as HTMLElement
      el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 46, right: 100, bottom: 46, x: 0, y: 0, toJSON() {} })
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: at, bubbles: true }))
      await nextTick()
      for (const x of moves) {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x }))
        await nextTick()
      }
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: moves.at(-1) ?? at }))
    }
    // A v-model the component updates, as a parent would
    const mountRange = (value: [number, number]) => {
      const w = mount(MSlider, {
        props: { variant: 'range', modelValue: value, 'onUpdate:modelValue': (v: unknown) => w.setProps({ modelValue: v as [number, number] }) },
        attachTo: document.body,
      })
      return w
    }
    const last = (w: VueWrapper) => (w.emitted('update:modelValue') as unknown[][]).at(-1)![0]

    it('moves the end thumb for a press past two overlapping thumbs, keeping the pair ordered', async () => {
      wrapper = mountRange([50, 50])
      await press(wrapper, 70)
      expect(last(wrapper)).toEqual([50, 70])
      await press(wrapper, 30)
      expect(last(wrapper)).toEqual([30, 70])
    })

    it('picks the thumb by the drag direction on two overlapping thumbs', async () => {
      wrapper = mountRange([50, 50])
      await press(wrapper, 50, [40, 30])
      expect(last(wrapper)).toEqual([30, 50])
      await wrapper.setProps({ modelValue: [50, 50] })
      await press(wrapper, 50, [60, 75])
      expect(last(wrapper)).toEqual([50, 75])
    })

    it('never lets a dragged thumb pass the other one', async () => {
      wrapper = mountRange([20, 60])
      await press(wrapper, 22, [40, 90])
      expect(last(wrapper)).toEqual([60, 60])
      await wrapper.setProps({ modelValue: [20, 60] })
      await press(wrapper, 58, [10])
      expect(last(wrapper)).toEqual([20, 20])
    })

    it('makes each thumb a slider of its own, moved by its keys within the other', async () => {
      wrapper = mountRange([20, 60])
      const thumbs = wrapper.findAll('[role=slider]')
      expect(thumbs).toHaveLength(2)
      expect(thumbs.map((t) => t.attributes('aria-label'))).toEqual(['Range start', 'Range end'])
      expect(thumbs[0]!.attributes('aria-valuemax')).toBe('60')
      expect(thumbs[1]!.attributes('aria-valuemin')).toBe('20')
      await thumbs[1]!.trigger('keydown', { key: 'ArrowRight' })
      expect(last(wrapper)).toEqual([20, 61])
      await thumbs[1]!.trigger('keydown', { key: 'Home' })
      expect(last(wrapper)).toEqual([20, 20])
      await thumbs[0]!.trigger('keydown', { key: 'ArrowRight' })
      expect(last(wrapper)).toEqual([20, 20])
      await thumbs[0]!.trigger('keydown', { key: 'Home' })
      expect(last(wrapper)).toEqual([0, 20])
      expect(wrapper.find('[role=group]').exists()).toBe(true)
    })

    it('rings a thumb focused from the keyboard, not one a press focuses', async () => {
      wrapper = mountRange([20, 60])
      await press(wrapper, 70)
      await nextTick()
      const thumbs = wrapper.findAll('[role=slider]')
      expect(document.activeElement).toBe(thumbs[1]!.element)
      expect(thumbs[1]!.classes()).not.toContain('ring-2')
      // The keys after a press bring the ring back, as browsers do
      await thumbs[1]!.trigger('keydown', { key: 'ArrowLeft' })
      expect(thumbs[1]!.classes()).toContain('ring-2')
      // Tabbing to the other thumb
      ;(thumbs[0]!.element as HTMLElement).focus()
      await nextTick()
      expect(thumbs[0]!.classes()).toContain('ring-2')
      expect(thumbs[1]!.classes()).not.toContain('ring-2')
    })

    it('rings a thumb in the slider\'s own color', () => {
      wrapper = mount(MSlider, { props: { variant: 'range', modelValue: [20, 60], color: 'tertiary' } })
      const ring = (wrapper.find('[role=slider]').element as HTMLElement).style.getPropertyValue('--tw-ring-color')
      expect(ring).toBe('var(--color-tertiary)')
    })
  })
})
