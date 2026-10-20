import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import MFab from '../components/MFab.vue'

const fab = (props: Record<string, unknown>) => mount(MFab, { props: { icon: 'edit', ...props } })

describe('MFab', () => {
  it('keeps the baseline extended FAB for the regular size', () => {
    const b = fab({ label: 'Compose' }).find('button')
    expect(b.classes()).toEqual(expect.arrayContaining(['h-14', 'min-w-20', 'pl-4', 'pr-5']))
    expect(b.find('span.whitespace-nowrap').classes()).toContain('text-label-large')
  })

  it.each([
    ['small', 'h-14', 'text-title-medium', 'pl-2'],
    ['medium', 'h-20', 'text-title-large', 'pl-3'],
    ['large', 'h-24', 'text-headline-small', 'pl-4'],
  ])('sizes the %s extended FAB from ExtendedFab tokens', (size, height, text, gap) => {
    const b = fab({ label: 'Compose', size }).find('button')
    expect(b.classes()).toContain(height)
    const label = b.find('span.whitespace-nowrap')
    expect(label.classes()).toContain(text)
    // The icon-to-label space (8/12/16px)
    expect(label.classes()).toContain(gap)
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

  it.each([
    ['regular', '16px'],
    ['small', '16px'],
    ['medium', '26px'],
    // Compose's start padding (28) would leave the 32px icon 4px off center in the 96px square
    ['large', '32px'],
  ])('centers the icon of a collapsed %s extended FAB', async (size, lead) => {
    const w = fab({ label: 'Compose', size, expanded: false })
    await nextTick()
    const b = w.find('button').element as HTMLElement
    // An inline start padding only where the class's isn't the centered one
    expect(b.style.paddingLeft).toBe(size === 'large' ? lead : '')
  })

  it('renders collapsed on the server too, before any script runs', async () => {
    const large = await renderToString(createSSRApp({ render: () => h(MFab, { icon: 'edit', label: 'Compose', size: 'large', expanded: false }) }))
    expect(large).toMatch(/<button[^>]*style="width:96px;min-width:0;padding-left:32px;"/)
    const html = await renderToString(createSSRApp({ render: () => h(MFab, { icon: 'edit', label: 'Compose', expanded: false }) }))
    expect(html).toMatch(/<button[^>]*style="width:56px;min-width:0;"/)
    expect(html).toMatch(/<span[^>]*style="display:none;opacity:0;"[^>]*>Compose<\/span>/)
  })

  it('hydrates collapsed without mismatches, and still expands', async () => {
    const container = document.createElement('div')
    container.innerHTML = await renderToString(createSSRApp({ render: () => h(MFab, { icon: 'edit', label: 'Compose', expanded: false }) }))
    document.body.appendChild(container)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const expanded = { value: false }
    const app = createSSRApp({ render: () => h(MFab, { icon: 'edit', label: 'Compose', expanded: expanded.value }) })
    const vm = app.mount(container)
    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('Hydration'))).toEqual([])
    warn.mockRestore()

    expanded.value = true
    vm.$forceUpdate()
    const label = container.querySelector('span.whitespace-nowrap') as HTMLElement
    await vi.waitFor(() => {
      expect(label.style.display).toBe('')
      expect(label.style.opacity).toBe('1')
      expect((container.querySelector('button') as HTMLElement).style.width).toBe('')
    })
    container.remove()
  })
})
