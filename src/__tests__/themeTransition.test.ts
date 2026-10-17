import { describe, it, expect, vi, afterEach } from 'vitest'
import { themeTransition } from '../composables/_themeTransition'

const root = document.documentElement
const style = () => document.getElementById('m3-theme-transition') as HTMLStyleElement | null

function mockReducedMotion(reduce: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList)
}

// happy-dom answers every CSS.supports() with true and has no CSS.registerProperty
function mockBrowser(browser: 'chromium' | 'firefox' | 'old') {
  vi.stubGlobal('CSS', {
    supports: (prop: string) => browser === 'firefox' && prop.startsWith('-moz-'),
    registerProperty: browser === 'old' ? undefined : () => {},
  })
}

describe('themeTransition', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    root.classList.remove('theme-transitioning', 'theme-switching')
    style()?.remove()
  })

  it('transitions the registered color tokens on <html> in Chromium, with components\' own transitions off', () => {
    mockReducedMotion(false)
    mockBrowser('chromium')
    vi.useFakeTimers()
    const apply = vi.fn(() => {
      expect(root.classList.contains('theme-switching')).toBe(true)
      expect(root.classList.contains('theme-transitioning')).toBe(false)
      const css = style()!.textContent!
      expect(css).toContain("@property --color-primary { syntax: '<color>'")
      expect(css).toContain('@property --color-on-tertiary-fixed-variant')
      expect(css).toContain('html.theme-switching *, html.theme-switching *::before, html.theme-switching *::after { transition: none !important; }')
    })

    themeTransition(apply)
    expect(apply).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(300)
    // Unregistered afterwards, so the tokens read back as written
    expect(root.classList.contains('theme-switching')).toBe(false)
    expect(style()).toBeNull()
  })

  it('keeps one transition going when switches overlap', () => {
    mockReducedMotion(false)
    mockBrowser('chromium')
    vi.useFakeTimers()
    themeTransition(() => {})
    vi.advanceTimersByTime(200)
    themeTransition(() => {})
    vi.advanceTimersByTime(200)
    expect(root.classList.contains('theme-switching')).toBe(true)
    expect(document.querySelectorAll('#m3-theme-transition')).toHaveLength(1)
    vi.advanceTimersByTime(100)
    expect(root.classList.contains('theme-switching')).toBe(false)
  })

  for (const browser of ['firefox', 'old'] as const) {
    it(`uses the theme-transitioning class ${browser === 'firefox' ? 'in Firefox' : 'without @property'}`, () => {
      mockReducedMotion(false)
      mockBrowser(browser)
      vi.useFakeTimers()
      const apply = vi.fn(() => {
        expect(root.classList.contains('theme-transitioning')).toBe(true)
      })

      themeTransition(apply)
      expect(apply).toHaveBeenCalledOnce()
      expect(style()).toBeNull()
      vi.advanceTimersByTime(300)
      expect(root.classList.contains('theme-transitioning')).toBe(false)
    })
  }

  it('takes Firefox by its user agent too', () => {
    mockReducedMotion(false)
    mockBrowser('chromium')
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0')
    vi.useFakeTimers()
    themeTransition(() => {})
    expect(root.classList.contains('theme-transitioning')).toBe(true)
    expect(style()).toBeNull()
  })

  it('does not take Chrome\'s "like Gecko" for Firefox', () => {
    mockReducedMotion(false)
    mockBrowser('chromium')
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')
    vi.useFakeTimers()
    themeTransition(() => {})
    expect(root.classList.contains('theme-switching')).toBe(true)
  })

  it('applies directly with reduced motion', () => {
    mockReducedMotion(true)
    mockBrowser('chromium')
    const apply = vi.fn()

    themeTransition(apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(style()).toBeNull()
    expect(root.classList.contains('theme-switching')).toBe(false)
    expect(root.classList.contains('theme-transitioning')).toBe(false)
  })
})
