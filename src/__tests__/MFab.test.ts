import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MFab from '../components/MFab.vue'

const fab = (props: Record<string, unknown>) => mount(MFab, { props: { icon: 'edit', ...props } })

describe('MFab', () => {
  it('keeps the baseline extended FAB for the regular size', () => {
    const b = fab({ label: 'Compose' }).find('button')
    expect(b.classes()).toEqual(expect.arrayContaining(['h-14', 'min-w-20', 'pl-4', 'pr-5']))
    expect(b.find('span.whitespace-nowrap').classes()).toContain('text-label-large')
  })

  it.each([
    ['small', 'h-14', 'text-title-medium', '8px'],
    ['medium', 'h-20', 'text-title-large', '12px'],
    ['large', 'h-24', 'text-headline-small', '16px'],
  ])('sizes the %s extended FAB from ExtendedFab tokens', (size, height, text, gap) => {
    const b = fab({ label: 'Compose', size }).find('button')
    expect(b.classes()).toContain(height)
    const label = b.find('span.whitespace-nowrap')
    expect(label.classes()).toContain(text)
    expect((label.element as HTMLElement).style.paddingLeft).toBe(gap)
  })

  it('collapses to the icon with expanded false, keeping the label as its accessible name', async () => {
    const w = fab({ label: 'Compose', expanded: false })
    await nextTick()
    const b = w.find('button')
    expect(b.attributes('aria-label')).toBe('Compose')
    const label = b.find('span.whitespace-nowrap').element as HTMLElement
    expect(label.style.display).toBe('none')
    expect((b.element as HTMLElement).style.width).toBe('56px')
  })
})
