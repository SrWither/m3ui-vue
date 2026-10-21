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
    get(this: HTMLElement) { return this.getAttribute('role') === 'slider' ? 880 : 0 },
  })
})
afterAll(() => Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth))

// The track's pieces (inactive/active) and its end dots, in template order
const bar = (w: VueWrapper) => w.find('[role=slider]').element.firstElementChild as HTMLElement
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
})
