import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MProgressBar from '../components/MProgressBar.vue'
import MCircleProgressBar from '../components/MCircleProgressBar.vue'

const vars = (el: Element) => {
  const s = (el as HTMLElement).style
  return { bar: s.getPropertyValue('--m3-progress-bar'), track: s.getPropertyValue('--m3-progress-track') }
}

describe('MProgressBar colors', () => {
  it('uses the role and its container by default', () => {
    const w = mount(MProgressBar, { props: { value: 40, color: 'tertiary' } })
    expect(vars(w.element)).toEqual({ bar: 'var(--color-tertiary)', track: 'var(--color-tertiary-container)' })
  })

  it('takes any CSS color, with a translucent track of it', () => {
    const w = mount(MProgressBar, { props: { value: 40, color: '#fff' } })
    expect(vars(w.element)).toEqual({ bar: '#fff', track: 'color-mix(in srgb, #fff 24%, transparent)' })
  })

  it('takes a track color as a role or a CSS color', () => {
    expect(vars(mount(MProgressBar, { props: { value: 40, trackColor: 'rgb(255 255 255 / 0.35)' } }).element).track).toBe('rgb(255 255 255 / 0.35)')
    expect(vars(mount(MProgressBar, { props: { value: 40, trackColor: 'secondary-container' } }).element).track).toBe('var(--color-secondary-container)')
  })

  it('paints the bar and track from those variables', () => {
    const w = mount(MProgressBar, { props: { value: 40 } })
    expect(w.find('.bg-\\(--m3-progress-bar\\)').exists()).toBe(true)
    expect(w.find('.bg-\\(--m3-progress-track\\)').exists()).toBe(true)
  })
})

describe('MCircleProgressBar colors', () => {
  it('takes any CSS color for the ring and track', () => {
    const w = mount(MCircleProgressBar, { props: { value: 40, color: '#fff', trackColor: 'transparent' } })
    const strokes = w.findAll('circle, path').map((c) => (c.element as SVGElement).style.stroke).filter(Boolean)
    expect(strokes).toContain('#fff')
    expect(strokes).toContain('transparent')
  })
})
