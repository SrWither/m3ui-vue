import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MButton from '../components/MButton.vue'

const style = (props: Record<string, unknown>) => (mount(MButton, { props, slots: { default: 'Go' } }).element as HTMLElement).style

describe('MButton contentColor', () => {
  it('colors the label with a role or a CSS color', () => {
    expect(style({ variant: 'text', contentColor: 'on-surface' }).color).toBe('var(--color-on-surface)')
    expect(style({ color: '#fff', contentColor: '#000' }).color).toBe('#000')
  })

  it('keeps a custom color\'s variables alongside it', () => {
    const s = style({ color: '#fff', contentColor: '#000' })
    expect(s.getPropertyValue('--color-primary')).toBe('#fff')
  })

  it('leaves disabled and loading buttons their own colors', () => {
    expect(style({ contentColor: '#000', disabled: true }).color).toBe('')
    expect(style({ contentColor: '#000', loading: true }).color).toBe('')
  })
})
