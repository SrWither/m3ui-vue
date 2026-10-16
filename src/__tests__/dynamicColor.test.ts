import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { generateScheme, schemeRoles, schemeToCss } from '../composables/dynamicColor'

describe('generateScheme', () => {
  it('builds every role for light and dark, with the official tonal spot values', async () => {
    const scheme = await generateScheme('#6750A4')
    expect(Object.keys(scheme.light)).toEqual([...schemeRoles])
    expect(Object.keys(scheme.dark)).toEqual([...schemeRoles])
    // SchemeTonalSpot of the M3 baseline seed (material-color-utilities)
    expect(scheme.light.primary).toBe('#65558f')
    expect(scheme.light['primary-container']).toBe('#e9ddff')
  })

  it('keeps fixed roles the same in light and dark', async () => {
    const { light, dark } = await generateScheme('#0b57d0')
    for (const role of schemeRoles.filter((r) => r.includes('fixed'))) expect(dark[role]).toBe(light[role])
  })

  it('honors variant and contrast', async () => {
    const base = await generateScheme('#0b57d0')
    const mono = await generateScheme('#0b57d0', { variant: 'monochrome' })
    const high = await generateScheme('#0b57d0', { contrast: 1 })
    expect(mono.light.primary).not.toBe(base.light.primary)
    expect(high.light['on-surface-variant']).not.toBe(base.light['on-surface-variant'])
  })

  it('writes CSS blocks like palettes.css', async () => {
    const css = schemeToCss({ light: { primary: '#111111' }, dark: { primary: '#eeeeee' } }, 'brand')
    expect(css).toContain("[data-palette='brand'] {\n  --color-primary: #111111;\n}")
    expect(css).toContain("[data-palette='brand'].dark {\n  color-scheme: dark;\n  --color-primary: #eeeeee;\n}")
  })
})

// useColorPalette keeps module-level state: load a fresh copy of it (and the plugin) per test
async function fresh() {
  vi.resetModules()
  const palette = await import('../composables/useColorPalette')
  const plugin = await import('../plugin')
  return { ...palette, ...plugin }
}
function setup(useColorPalette: () => ReturnType<typeof import('../composables/useColorPalette')['useColorPalette']>) {
  let result!: ReturnType<typeof useColorPalette>
  mount(defineComponent({ setup() { result = useColorPalette(); return () => h('div') } }))
  return result
}
const generatedCss = () => document.getElementById('m3-dynamic-palette')?.textContent ?? ''
const settle = () => new Promise((r) => setTimeout(r, 50))

describe('seed palettes', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-palette')
    document.head.innerHTML = ''
  })
  afterEach(() => vi.resetModules())

  it('setSeed generates the scheme, switches to it and remembers it', async () => {
    const { useColorPalette } = await fresh()
    const p = setup(useColorPalette)
    await p.setSeed('#0b57d0', { variant: 'vibrant' })
    await nextTick()
    expect(p.palette.value).toBe('seed')
    expect(document.documentElement.getAttribute('data-palette')).toBe('seed')
    expect(generatedCss()).toContain("[data-palette='seed']")
    expect(p.seed.value).toEqual({ seed: '#0b57d0', variant: 'vibrant' })
    expect(JSON.parse(localStorage.getItem('m3-seed')!)).toEqual({ seed: '#0b57d0', variant: 'vibrant' })
    expect(JSON.parse(localStorage.getItem('m3-palette-css')!).id).toBe('seed')
  })

  it('the last choice wins: a palette after a seed, and the seed is kept', async () => {
    const { useColorPalette } = await fresh()
    const p = setup(useColorPalette)
    await p.setSeed('#0b57d0')
    p.set('teal')
    await nextTick()
    expect(p.palette.value).toBe('teal')
    expect(document.documentElement.getAttribute('data-palette')).toBe('teal')
    expect(p.seed.value?.seed).toBe('#0b57d0')
  })

  it('restores a generated palette on reload before the generator loads', async () => {
    localStorage.setItem('m3-palette', 'seed')
    localStorage.setItem('m3-palette-css', JSON.stringify({ id: 'seed', css: "[data-palette='seed'] { --color-primary: #123456; }" }))
    await fresh()
    expect(generatedCss()).toContain('#123456')
    expect(document.documentElement.getAttribute('data-palette')).toBe('seed')
  })

  it('generates a custom palette from its seed when it has no CSS of its own', async () => {
    const { useColorPalette, createM3UI } = await fresh()
    createApp({}).use(createM3UI({ customPalettes: [{ id: 'brand', label: 'Brand', seed: '#0b6e4f' }] }))
    const p = setup(useColorPalette)
    p.set('brand')
    await settle()
    expect(generatedCss()).toContain("[data-palette='brand']")
    expect(p.palette.value).toBe('brand')
  })

  it('keeps a custom palette\'s own CSS instead of generating it', async () => {
    const style = document.createElement('style')
    style.textContent = "[data-palette='brand'] { --color-primary: #ff0000; }"
    document.head.appendChild(style)
    const { useColorPalette, createM3UI } = await fresh()
    createApp({}).use(createM3UI({ customPalettes: [{ id: 'brand', label: 'Brand', seed: '#0b6e4f' }] }))
    const p = setup(useColorPalette)
    p.set('brand')
    await settle()
    expect(generatedCss()).toBe('')
    expect(p.palette.value).toBe('brand')
  })
})

describe('createM3UI seed', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-palette')
    document.head.innerHTML = ''
  })

  it('uses the seed on the first visit', async () => {
    const { createM3UI } = await fresh()
    createApp({}).use(createM3UI({ seed: '#0b57d0' }))
    await settle()
    expect(document.documentElement.getAttribute('data-palette')).toBe('seed')
    expect(localStorage.getItem('m3-palette')).toBe('seed')
  })

  it('prefers palette over seed', async () => {
    const { createM3UI } = await fresh()
    createApp({}).use(createM3UI({ palette: 'teal', seed: '#0b57d0' }))
    await settle()
    expect(document.documentElement.getAttribute('data-palette')).toBe('teal')
    expect(generatedCss()).toBe('')
  })

  it('leaves a stored choice alone', async () => {
    localStorage.setItem('m3-palette', 'iron')
    const { createM3UI } = await fresh()
    createApp({}).use(createM3UI({ seed: '#0b57d0' }))
    await settle()
    expect(localStorage.getItem('m3-palette')).toBe('iron')
  })

  it('a first-visit palette survives the first useColorPalette() call', async () => {
    const { createM3UI, useColorPalette } = await fresh()
    createApp({}).use(createM3UI({ palette: 'teal' }))
    const p = setup(useColorPalette)
    await nextTick()
    expect(p.palette.value).toBe('teal')
    expect(document.documentElement.getAttribute('data-palette')).toBe('teal')
    expect(localStorage.getItem('m3-palette')).toBe('teal')
  })
})

describe('createM3UI themeColor', () => {
  beforeEach(() => {
    localStorage.clear()
    document.head.innerHTML = ''
    document.documentElement.className = ''
    document.documentElement.style.setProperty('--color-surface', '#fef7ff')
  })

  it('creates the meta and follows the palette', async () => {
    const { createM3UI } = await fresh()
    createApp({}).use(createM3UI({ themeColor: 'surface' }))
    const meta = () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!
    expect(meta().content).toBe('#fef7ff')
    // Dark mode (or a palette switch) changes the variable and touches <html>
    document.documentElement.style.setProperty('--color-surface', '#141218')
    document.documentElement.classList.add('dark')
    await settle()
    expect(meta().content).toBe('#141218')
  })

  it('takes over an existing light/dark pair', async () => {
    document.head.innerHTML = '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">'
    const { createM3UI } = await fresh()
    createApp({}).use(createM3UI({ themeColor: 'surface' }))
    const all = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    expect(all.map((m) => [m.content, m.hasAttribute('media')])).toEqual([['#fef7ff', false], ['#fef7ff', false]])
  })

  it('leaves the meta alone by default', async () => {
    document.head.innerHTML = '<meta name="theme-color" content="#6750a4">'
    const { createM3UI } = await fresh()
    createApp({}).use(createM3UI({}))
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content).toBe('#6750a4')
  })
})
