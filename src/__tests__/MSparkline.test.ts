import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MSparkline from '../components/MSparkline.vue'

// happy-dom has no layout: give every element a 100×30 box
const size = { clientWidth: 100, clientHeight: 30 }
const saved: Record<string, PropertyDescriptor | undefined> = {}
beforeAll(() => {
  for (const [key, value] of Object.entries(size)) {
    saved[key] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value })
  }
})
afterAll(() => {
  for (const key of Object.keys(size)) if (saved[key]) Object.defineProperty(HTMLElement.prototype, key, saved[key]!)
})

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
const settle = () => new Promise((r) => setTimeout(r, 900))

describe('MSparkline', () => {
  it('is an image named by a summary of the data, in the app\'s language', () => {
    wrapper = mount(MSparkline, { props: { data: [12, 9, 21, 18] } })
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('From 12 to 18, low 9, high 21')
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('takes a label instead of the summary', () => {
    wrapper = mount(MSparkline, { props: { data: [1, 2], label: 'Visits this week' } })
    expect(wrapper.attributes('aria-label')).toBe('Visits this week')
  })

  it('draws the line through every point, at the box\'s real size', async () => {
    wrapper = mount(MSparkline, { props: { data: [1, 3, 2, 5], smooth: false, showLast: false }, attachTo: document.body })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('svg').attributes('viewBox')).toBe('0 0 100 30')
    const d = wrapper.find('path').attributes('d')!
    expect(d.match(/[ML]/g)).toHaveLength(4)
    const ys = numbers(d).filter((_, i) => i % 2 === 1)
    // Highest value on top (smallest y), lowest at the bottom
    expect(Math.min(...ys)).toBe(ys[3])
    expect(Math.max(...ys)).toBe(ys[0])
  })

  it('smooths without overshooting the points (monotone)', async () => {
    wrapper = mount(MSparkline, { props: { data: [0, 10, 10, 0], showLast: false }, attachTo: document.body })
    await wrapper.vm.$nextTick()
    const ys = numbers(wrapper.find('path').attributes('d')!).filter((_, i) => i % 2 === 1)
    const top = Math.min(...ys)
    const bottom = Math.max(...ys)
    // Every control point stays between the highest and lowest points
    expect(ys.every((v) => v >= top - 0.01 && v <= bottom + 0.01)).toBe(true)
    expect(top).toBeCloseTo(2, 0)
  })

  it('draws bars from zero, a dashed baseline, and an area fill', async () => {
    wrapper = mount(MSparkline, { props: { data: [3, -2, 5], type: 'bar', baseline: 4 }, attachTo: document.body })
    await wrapper.vm.$nextTick()
    const rects = wrapper.findAll('rect')
    expect(rects).toHaveLength(3)
    expect(rects.every((r) => Number(r.attributes('height')) > 0)).toBe(true)
    expect(wrapper.find('line').attributes('stroke-dasharray')).toBe('3 3')
    await wrapper.setProps({ type: 'area', baseline: undefined })
    expect(wrapper.find('linearGradient').exists()).toBe(true)
    expect(wrapper.findAll('path')).toHaveLength(2)
  })

  it('springs to new data and settles exactly where it would have jumped', async () => {
    const jumped = mount(MSparkline, { props: { data: [5, 1, 4], animate: false }, attachTo: document.body })
    await jumped.vm.$nextTick()
    const target = jumped.find('path').attributes('d')
    jumped.unmount()
    wrapper = mount(MSparkline, { props: { data: [1, 4, 2] }, attachTo: document.body })
    await wrapper.setProps({ data: [5, 1, 4] })
    await new Promise((r) => setTimeout(r, 60))
    expect(wrapper.find('path').attributes('d')).not.toBe(target)
    await settle()
    expect(wrapper.find('path').attributes('d')).toBe(target)
  })

  it('follows the pointer with interactive', async () => {
    wrapper = mount(MSparkline, { props: { data: [1, 2, 3, 4, 5], interactive: true }, attachTo: document.body })
    ;(wrapper.element as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 30 }) as DOMRect
    await wrapper.trigger('pointermove', { clientX: 99 })
    await wrapper.trigger('pointermove', { clientX: 1 })
    await wrapper.trigger('pointerleave')
    expect(wrapper.emitted('hover')).toEqual([[4], [0], [null]])
  })
})
