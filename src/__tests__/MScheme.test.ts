import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MScheme from '../components/MScheme.vue'
import { generateScheme, seedFromPixels } from '../composables/dynamicColor'

const pixels = (colors: [number, number, number, number][]) => colors.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat())

describe('seedFromPixels', () => {
  it('returns the color of a single-color image', async () => {
    expect(await seedFromPixels(pixels([[200, 50, 40, 400]]))).toBe('#c83228')
  })

  it('picks the dominant colorful color and skips transparent pixels', async () => {
    const rgba = [...pixels([[200, 50, 40, 700], [40, 160, 70, 300]]), ...Array.from({ length: 2000 }, (_, i) => (i % 4 === 3 ? 0 : 30))]
    expect(await seedFromPixels(rgba)).toBe('#c83228')
  })

  // QuantizerWsmeans seeds its clusters with Math.random(); Android's Java version uses a fixed seed. Two reads of
  // the same photo gave different seeds (#236493, then #497caa in Chrome).
  it('gives the same seed every time for the same pixels', async () => {
    let a = 7
    const rand = () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648)
    const rgba: number[] = []
    for (let i = 0; i < 4000; i++) {
      const base = i % 3 === 0 ? [40, 90, 150] : i % 3 === 1 ? [110, 150, 200] : [200, 120, 60]
      rgba.push(...base.map((c) => Math.max(0, Math.min(255, Math.round(c + (rand() - 0.5) * 120)))), 255)
    }
    const seeds = new Set<string>()
    for (let i = 0; i < 8; i++) seeds.add(await seedFromPixels(rgba))
    expect(seeds.size).toBe(1)
  })
})

describe('MScheme', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.documentElement.classList.remove('dark')
  })

  it('sets the seed\'s scheme on itself, light or dark like the app', async () => {
    const expected = await generateScheme('#c83228', { variant: 'content' })
    wrapper = mount(MScheme, { props: { seed: '#c83228', variant: 'content' }, slots: { default: '<p>hi</p>' } })
    const el = wrapper.element as HTMLElement
    await vi.waitFor(() => expect(el.style.getPropertyValue('--color-primary')).toBe(expected.light.primary))
    expect(el.classList.contains('m3-scheme')).toBe(true)

    document.documentElement.classList.add('dark')
    await vi.waitFor(() => expect(el.style.getPropertyValue('--color-primary')).toBe(expected.dark.primary))
  })

  it('tells its slot the seed and when the scheme is applied, and drops it when the seed goes', async () => {
    const seen: { seed?: string; ready: boolean }[] = []
    wrapper = mount(MScheme, {
      props: { seed: '#3b4ca0' },
      slots: { default: (scope: { seed?: string; ready: boolean }) => (seen.push({ ...scope }), h('span')) },
    })
    expect(seen[0]).toEqual({ seed: '#3b4ca0', ready: false })
    await vi.waitFor(() => expect(seen.at(-1)).toEqual({ seed: '#3b4ca0', ready: true }))

    await wrapper.setProps({ seed: undefined })
    await nextTick()
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--color-primary')).toBe('')
    expect(seen.at(-1)).toEqual({ seed: undefined, ready: false })
  })

  it('applies a palette with CSS through its attribute, dark included', async () => {
    const css = document.createElement('style')
    css.textContent = "[data-palette='teal'] { --color-primary: #00696b; }"
    document.head.appendChild(css)
    try {
      wrapper = mount(MScheme, { props: { palette: 'teal' } })
      const el = wrapper.element as HTMLElement
      expect(el.getAttribute('data-palette')).toBe('teal')
      expect(el.style.getPropertyValue('--color-primary')).toBe('')
      document.documentElement.classList.add('dark')
      await vi.waitFor(() => expect(el.classList.contains('dark')).toBe(true))
      await wrapper.setProps({ seed: '#c83228' })
      expect(el.hasAttribute('data-palette')).toBe(false)
    } finally {
      css.remove()
    }
  })

  it('builds purple (the :root baseline, no [data-palette] block) from its seed', async () => {
    const expected = await generateScheme('#6750A4')
    wrapper = mount(MScheme, { props: { palette: 'purple' } })
    const el = wrapper.element as HTMLElement
    expect(el.hasAttribute('data-palette')).toBe(false)
    await vi.waitFor(() => expect(el.style.getPropertyValue('--color-primary')).toBe(expected.light.primary))
  })
})
