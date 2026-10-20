import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MShape from '../components/MShape.vue'

describe('MShape', () => {
  it('renders a filled path when there is no default slot', () => {
    const wrapper = mount(MShape, { props: { shape: 'Heart' } })
    const path = wrapper.find('svg[viewBox] path')
    expect(path.exists()).toBe(true)
    expect(path.attributes('d')).toMatch(/^M/)
    expect(path.attributes('fill')).toBe('currentColor')
  })

  it('respects a custom fill color', () => {
    const wrapper = mount(MShape, { props: { shape: 'Circle', fill: 'red' } })
    expect(wrapper.find('svg[viewBox] path').attributes('fill')).toBe('red')
  })

  it('clips slot content instead of rendering a filled shape when a slot is given', () => {
    const wrapper = mount(MShape, {
      props: { shape: 'Pentagon' },
      slots: { default: '<img src="x.png" />' },
    })
    expect(wrapper.find('svg[viewBox]').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(true)
    const clipDiv = wrapper.find('img').element.parentElement as HTMLElement
    expect(clipDiv.style.clipPath).toMatch(/^url\(#m3-shape-/)
  })

  it('defines a clipPath element with a unique id', () => {
    const wrapper = mount(MShape, { props: { shape: 'Gem' } })
    const clipPath = wrapper.find('clipPath')
    expect(clipPath.exists()).toBe(true)
    expect(clipPath.attributes('clipPathUnits')).toBe('objectBoundingBox')
  })

  // A utility hardcoded on the root competes with the consumer's class by Tailwind's stylesheet
  // order, not by who set it: class="absolute inset-0" lost to the root's own `relative`.
  it('leaves position and display to the consumer\'s classes', () => {
    const wrapper = mount(MShape, { props: { shape: 'Sunny' }, attrs: { class: 'absolute inset-0 block' } })
    const classes = wrapper.classes()
    expect(classes).toEqual(expect.arrayContaining(['absolute', 'inset-0', 'block']))
    expect(classes).not.toContain('relative')
    expect(classes).not.toContain('inline-block')
  })

  // toSvgPath() rounds to 2 decimals: asked for a 0-1 path, every point snapped to 1% of the
  // shape's size (4px steps on a 400px shape), which drew visibly wobbly outlines.
  it('keeps the outline finer than 1% of the shape\'s size', () => {
    const wrapper = mount(MShape, { props: { shape: 'SoftBoom' } })
    const path = wrapper.find('clipPath path')
    const scale = Number(/scale\(([\d.]+)\)/.exec(path.attributes('transform') ?? '')?.[1] ?? 1)
    const coords = (path.attributes('d')!.match(/-?\d+(\.\d+)?/g) ?? []).map((n) => Number(n) * scale * 100)
    expect(coords.some((c) => Math.abs(c - Math.round(c)) > 1e-6)).toBe(true)
  })
})
