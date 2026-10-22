import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSkeleton from '../components/MSkeleton.vue'

// (the template starts with a comment, so the root is found by class, not wrapper.element)
const style = (props: Record<string, unknown>) => (mount(MSkeleton, { props }).find('.m3-skeleton').element as HTMLElement).style

describe('MSkeleton', () => {
  it('leaves its default size and corners to a base-layer class, so consumer classes win', () => {
    const w = mount(MSkeleton, { props: { variant: 'rounded' }, attrs: { class: 'w-40 rounded-xl' } })
    const root = w.find('.m3-skeleton')
    expect(root.classes()).toEqual(expect.arrayContaining(['m3-skeleton-rounded', 'w-40', 'rounded-xl']))
    const s = (root.element as HTMLElement).style
    expect(s.width).toBe('')
    expect(s.height).toBe('')
    expect(s.borderRadius).toBe('')
  })

  it('takes width and height props inline', () => {
    const s = style({ width: '120px', height: 'auto' })
    expect(s.width).toBe('120px')
    expect(s.height).toBe('auto')
  })

  it('takes a radius as a shape step or any CSS length', () => {
    expect(style({ radius: 'xl' }).borderRadius).toBe('var(--radius-xl)')
    expect(style({ radius: 'full' }).borderRadius).toBe('9999px')
    expect(style({ radius: 'none' }).borderRadius).toBe('0px')
    expect(style({ radius: '6px' }).borderRadius).toBe('6px')
  })

  it('rounds every line of a multi-line text skeleton with radius', () => {
    const w = mount(MSkeleton, { props: { lines: 3, radius: 'xs' } })
    const lines = w.findAll('.h-3\\.5')
    expect(lines).toHaveLength(3)
    lines.forEach((l) => expect((l.element as HTMLElement).style.borderRadius).toBe('var(--radius-xs)'))
  })
})
