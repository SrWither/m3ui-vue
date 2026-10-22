import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MIconButton from '../components/MIconButton.vue'

describe('MIconButton', () => {
  it('is a plain button without checked', async () => {
    const w = mount(MIconButton, { props: { icon: 'favorite' } })
    expect(w.attributes('aria-pressed')).toBeUndefined()
    await w.trigger('click')
    expect(w.emitted('update:checked')).toBeUndefined()
    expect(w.find('.material-symbols-outlined').attributes('style')).not.toContain('FILL')
  })

  it('toggles through v-model:checked', async () => {
    const w = mount(MIconButton, { props: { icon: 'favorite', checked: false } })
    expect(w.attributes('aria-pressed')).toBe('false')
    await w.trigger('click')
    expect(w.emitted('update:checked')).toEqual([[true]])
  })

  it('does not toggle while disabled', async () => {
    const w = mount(MIconButton, { props: { icon: 'favorite', checked: false, disabled: true } })
    await w.trigger('click')
    expect(w.emitted('update:checked')).toBeUndefined()
  })

  it('fills the icon and swaps to checkedIcon when checked', () => {
    const w = mount(MIconButton, { props: { icon: 'play_arrow', checkedIcon: 'pause', checked: true } })
    const icon = w.find('.material-symbols-outlined')
    expect(icon.text()).toBe('pause')
    expect(icon.attributes('style')).toContain("'FILL' 1")
  })

  it('uses the selected colors of each variant', () => {
    const cases: [string, string, string][] = [
      ['standard', 'text-on-surface-variant', 'text-primary'],
      ['filled', 'bg-surface-container', 'bg-primary'],
      ['tonal', 'bg-secondary-container', 'bg-secondary'],
      ['outlined', 'border-current', 'bg-inverse-surface'],
    ]
    for (const [variant, off, on] of cases) {
      expect(mount(MIconButton, { props: { icon: 'x', variant: variant as any, checked: false } }).classes()).toContain(off)
      expect(mount(MIconButton, { props: { icon: 'x', variant: variant as any, checked: true } }).classes()).toContain(on)
    }
  })

  it('renders a button, not a link, when it is a toggle', () => {
    const w = mount(MIconButton, { props: { icon: 'x', checked: false, to: '/somewhere' } })
    expect(w.element.tagName).toBe('BUTTON')
  })

  it('sets the toggle shape on mount: round squares off when checked', () => {
    const off = mount(MIconButton, { props: { icon: 'x', checked: false } })
    expect((off.element as HTMLElement).style.borderRadius).toBe('20px')
    const on = mount(MIconButton, { props: { icon: 'x', checked: true } })
    expect((on.element as HTMLElement).style.borderRadius).toBe('12px')
    const square = mount(MIconButton, { props: { icon: 'x', checked: true, shape: 'squared' } })
    expect((square.element as HTMLElement).style.borderRadius).toBe('20px')
  })

  describe('color', () => {
    const style = (props: Record<string, unknown>) => (mount(MIconButton, { props: { icon: 'close', ...props } }).element as HTMLElement).style

    it('colors the icon of standard and outlined buttons', () => {
      expect(style({ color: '#fff' }).color).toBe('#fff')
      expect(style({ color: 'primary', variant: 'outlined' }).color).toBe('var(--color-primary)')
    })

    it('fills a filled button with the color, white or the on-role on it', () => {
      const s = style({ color: 'rgb(0 0 0 / 0.3)', variant: 'filled' })
      expect(s.backgroundColor).toBe('rgb(0 0 0 / 0.3)')
      expect(s.color).toBe('#fff')
      expect(style({ color: 'tertiary', variant: 'filled' }).color).toBe('var(--color-on-tertiary)')
    })

    it('gives a tonal button a container of the color', () => {
      expect(style({ color: 'error', variant: 'tonal' }).backgroundColor).toBe('var(--color-error-container)')
      // (happy-dom drops color-mix() backgrounds, so only the content color is checked for a CSS color)
      expect(style({ color: '#e8590c', variant: 'tonal' }).color).toBe('#e8590c')
    })

    it('leaves disabled buttons and toggles to their own colors', () => {
      expect(style({ color: 'primary', disabled: true }).color).toBe('')
      expect(style({ color: 'primary', checked: false }).color).toBe('')
    })
  })
})
