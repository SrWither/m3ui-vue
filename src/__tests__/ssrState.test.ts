import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'

// Each test imports the whole library afresh: a cold import can take seconds when the suite runs in parallel
vi.setConfig({ testTimeout: 30_000 })

// Fresh modules per test: the theme, palette and cookie switch live at module level
async function load() {
  vi.resetModules()
  return await import('../index')
}

function cookie(name: string) {
  return document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1)
}

beforeEach(() => {
  localStorage.clear()
  for (const name of ['m3-theme', 'm3-palette', 'm3-contrast', 'm3-viewport']) document.cookie = `${name}=; Max-Age=0; Path=/`
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('initialState while hydrating', () => {
  it('renders the server\'s values first (no mismatch), then the stored ones', async () => {
    // The browser holds other values than the cookies the server read (a user from before the cookies)
    localStorage.setItem('m3-theme', 'light')
    localStorage.setItem('m3-palette', 'green')
    const lib = await load()
    const container = document.createElement('div')
    // What the server rendered from the cookies (see ssr.test.ts)
    container.innerHTML = '<p>dark blue</p>'
    document.body.appendChild(container)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let hydrating = true
    const app = createSSRApp({
      setup() {
        const { theme } = lib.useTheme()
        const { palette } = lib.useColorPalette()
        return () => h('p', `${theme.value} ${palette.value}`)
      },
    })
    app.use(lib.createM3UI({ initialState: { theme: 'dark', palette: 'blue' }, isHydrating: () => hydrating }))
    app.mount(container)
    hydrating = false
    await nextTick()

    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('Hydration'))).toEqual([])
    expect(container.textContent).toBe('light green')
  })

  it('stays writable during hydration', async () => {
    const lib = await load()
    let theme!: ReturnType<typeof lib.useTheme>['theme']
    const app = createSSRApp({
      setup() {
        theme = lib.useTheme().theme
        return () => h('p', theme.value)
      },
    })
    const container = document.createElement('div')
    container.innerHTML = '<p>dark</p>'
    app.use(lib.createM3UI({ initialState: { theme: 'dark' }, isHydrating: () => true })).mount(container)
    theme.value = 'light'
    await nextTick()
    expect(localStorage.getItem('m3-theme')).toBe('light')
  })
})

describe('cookies', () => {
  it('copies what is already stored when the plugin installs', async () => {
    localStorage.setItem('m3-theme', 'dark')
    localStorage.setItem('m3-palette', 'teal')
    const lib = await load()
    createSSRApp({ render: () => null }).use(lib.createM3UI({ cookies: true }))
    expect(cookie('m3-theme')).toBe('dark')
    expect(cookie('m3-palette')).toBe('teal')
  })

  it('writes the first-visit default palette', async () => {
    const lib = await load()
    createSSRApp({ render: () => null }).use(lib.createM3UI({ cookies: true, palette: 'red' }))
    expect(cookie('m3-palette')).toBe('red')
  })

  it('follows changes to the theme, the palette and the contrast', async () => {
    const lib = await load()
    let api!: { theme: ReturnType<typeof lib.useTheme>, palette: ReturnType<typeof lib.useColorPalette> }
    const app = createSSRApp({
      setup() {
        api = { theme: lib.useTheme(), palette: lib.useColorPalette() }
        return () => null
      },
    })
    app.use(lib.createM3UI({ cookies: true })).mount(document.createElement('div'))
    api.theme.theme.value = 'dark'
    api.palette.set('blue')
    api.palette.setContrast('high')
    await nextTick()
    await vi.waitFor(() => expect(cookie('m3-palette')).toBe('blue'))
    expect(cookie('m3-theme')).toBe('dark')
    expect(cookie('m3-contrast')).toBe('high')
  })

  it('keeps the window size, following resizes', async () => {
    vi.useFakeTimers()
    try {
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
      const lib = await load()
      createSSRApp({ render: () => null }).use(lib.createM3UI({ cookies: true }))
      expect(cookie('m3-viewport')).toBe('1280x800')
      Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
      window.dispatchEvent(new Event('resize'))
      // Debounced: not on every resize event
      expect(cookie('m3-viewport')).toBe('1280x800')
      vi.advanceTimersByTime(300)
      expect(cookie('m3-viewport')).toBe('390x800')
    } finally {
      vi.useRealTimers()
    }
  })

  it('writes none without the option', async () => {
    localStorage.setItem('m3-theme', 'dark')
    const lib = await load()
    createSSRApp({ render: () => null }).use(lib.createM3UI({ palette: 'red' }))
    expect(cookie('m3-theme')).toBeUndefined()
    expect(cookie('m3-palette')).toBeUndefined()
    expect(cookie('m3-viewport')).toBeUndefined()
  })
})
