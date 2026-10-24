import { afterEach, describe, expect, it, vi } from 'vitest'
import { themeInitScript, type ThemeInitOptions } from '../composables/themeInitScript'

const html = document.documentElement

function run(options?: ThemeInitOptions) {
  new Function(themeInitScript(options))()
}

function matchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: !!matches[q], media: q }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  html.className = ''
  html.removeAttribute('data-palette')
  html.removeAttribute('data-contrast')
  document.getElementById('m3-dynamic-palette')?.remove()
})

describe('themeInitScript', () => {
  it('applies nothing on a first visit with no defaults', () => {
    matchMedia({})
    run()
    expect(html.classList.contains('dark')).toBe(false)
    expect(html.hasAttribute('data-palette')).toBe(false)
    expect(html.hasAttribute('data-contrast')).toBe(false)
  })

  it('follows the stored theme, and the OS for system', () => {
    matchMedia({ '(prefers-color-scheme: dark)': true })
    run()
    expect(html.classList.contains('dark')).toBe(true)
    localStorage.setItem('m3-theme', 'light')
    run()
    expect(html.classList.contains('dark')).toBe(false)
    matchMedia({})
    localStorage.setItem('m3-theme', 'dark')
    run()
    expect(html.classList.contains('dark')).toBe(true)
  })

  it('uses the palette default only on a first visit', () => {
    run({ palette: 'red' })
    expect(html.getAttribute('data-palette')).toBe('red')
    localStorage.setItem('m3-palette', 'blue')
    run({ palette: 'red' })
    expect(html.getAttribute('data-palette')).toBe('blue')
  })

  it('reads the keys under storagePrefix, not another app\'s', () => {
    matchMedia({})
    localStorage.setItem('m3-theme', 'dark')
    localStorage.setItem('m3-palette', 'blue')
    localStorage.setItem('shop-m3-palette', 'green')
    run({ storagePrefix: 'shop' })
    expect(html.classList.contains('dark')).toBe(false)
    expect(html.getAttribute('data-palette')).toBe('green')
  })

  it('forces the palette with persistPalette: false', () => {
    localStorage.setItem('m3-palette', 'blue')
    run({ palette: 'red', persistPalette: false })
    expect(html.getAttribute('data-palette')).toBe('red')
  })

  it('leaves purple as the baseline (no attribute)', () => {
    localStorage.setItem('m3-palette', 'purple')
    run({ palette: 'red' })
    expect(html.hasAttribute('data-palette')).toBe(false)
  })

  it('injects the cached CSS of a generated palette', () => {
    localStorage.setItem('m3-palette', 'seed')
    localStorage.setItem('m3-palette-css', JSON.stringify({ id: 'seed', css: '[data-palette=seed]{}' }))
    run()
    expect(html.getAttribute('data-palette')).toBe('seed')
    expect(document.getElementById('m3-dynamic-palette')?.textContent).toBe('[data-palette=seed]{}')
  })

  it('ignores cached CSS of another palette', () => {
    localStorage.setItem('m3-palette', 'red')
    localStorage.setItem('m3-palette-css', JSON.stringify({ id: 'seed', css: 'x' }))
    run()
    expect(document.getElementById('m3-dynamic-palette')).toBeNull()
  })

  it('applies the contrast level: stored, default, forced, system', () => {
    matchMedia({ '(prefers-contrast: more)': true })
    run({ contrast: 'medium' })
    expect(html.getAttribute('data-contrast')).toBe('medium')
    html.removeAttribute('data-contrast')
    localStorage.setItem('m3-contrast', 'standard')
    run({ contrast: 'medium' })
    expect(html.hasAttribute('data-contrast')).toBe(false)
    run({ contrast: 'medium', persistPalette: false })
    expect(html.getAttribute('data-contrast')).toBe('medium')
    localStorage.setItem('m3-contrast', 'system')
    run()
    expect(html.getAttribute('data-contrast')).toBe('high')
  })

  it('falls back to the cookies when storage has nothing', () => {
    document.cookie = 'm3-theme=dark; Path=/'
    document.cookie = 'm3-palette=blue; Path=/'
    try {
      matchMedia({})
      run({ palette: 'red' })
      expect(html.classList.contains('dark')).toBe(true)
      expect(html.getAttribute('data-palette')).toBe('blue')
      // Storage wins over a cookie
      localStorage.setItem('m3-theme', 'light')
      run()
      expect(html.classList.contains('dark')).toBe(false)
    } finally {
      document.cookie = 'm3-theme=; Max-Age=0; Path=/'
      document.cookie = 'm3-palette=; Max-Age=0; Path=/'
    }
  })

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(() => run({ palette: 'red' })).not.toThrow()
    expect(html.getAttribute('data-palette')).toBe('red')
  })

  it('escapes the options it inlines', () => {
    expect(themeInitScript({ palette: '</script><script>alert(1)' })).not.toContain('</script>')
  })
})
