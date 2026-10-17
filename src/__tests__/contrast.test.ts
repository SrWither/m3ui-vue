import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useColorPalette, palettes } from '../composables/useColorPalette'

function withSetup() {
  let result!: ReturnType<typeof useColorPalette>
  mount(defineComponent({
    setup() {
      result = useColorPalette()
      return () => h('div')
    },
  }))
  return result
}

describe('contrast levels', () => {
  afterEach(async () => {
    withSetup().setContrast('standard')
    await nextTick()
  })

  it('sets data-contrast on <html> and remembers the level', async () => {
    const { setContrast, contrast, activeContrast } = withSetup()
    setContrast('high')
    await nextTick()
    expect(contrast.value).toBe('high')
    expect(activeContrast.value).toBe('high')
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high')
    expect(localStorage.getItem('m3-contrast')).toBe('high')
    setContrast('standard')
    await nextTick()
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false)
  })

  it('resolves system to the OS preference (standard without prefers-contrast: more)', async () => {
    const { setContrast, activeContrast } = withSetup()
    setContrast('system')
    await nextTick()
    expect(activeContrast.value).toBe('standard')
  })
})

describe('palettes-contrast.css', () => {
  const css = readFileSync(resolve(__dirname, '../styles/palettes-contrast.css'), 'utf8')

  it('has medium and high, light and dark, for every built-in palette', () => {
    for (const { id } of palettes) {
      const base = id === 'purple' ? 'html:not([data-palette])' : `[data-palette='${id}']`
      for (const level of ['medium', 'high']) {
        expect(css).toContain(`${base}[data-contrast='${level}']:not(.dark) {`)
        expect(css).toContain(`${base}[data-contrast='${level}'].dark {`)
      }
    }
  })

  it('raises contrast: high-contrast on-surface is black in light and white in dark', () => {
    const block = (selector: string) => css.slice(css.indexOf(`${selector} {`)).split('}')[0]!
    expect(block("[data-palette='teal'][data-contrast='high']:not(.dark)")).toContain('--color-on-surface: #000000;')
    expect(block("[data-palette='teal'][data-contrast='high'].dark")).toContain('--color-on-surface: #FFFFFF;')
  })
})
