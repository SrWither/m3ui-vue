import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createM3UI } from '../plugin'
import { useColorPalette, palettes } from '../composables/useColorPalette'
import { useTheme } from '../composables/useTheme'
import { recentColors } from '../composables/_colorUtils'
import { setStoragePrefix } from '../composables/_storageKeys'

describe('createM3UI', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-palette')
    localStorage.removeItem('m3-palette')
  })

  afterEach(() => {
    useColorPalette().setPersistPalette(true)
  })

  it('installs without options', () => {
    const app = createApp(defineComponent({ render: () => h('div') }))
    expect(() => app.use(createM3UI())).not.toThrow()
  })

  it('sets palette on install', () => {
    const app = createApp(defineComponent({ render: () => h('div') }))
    app.use(createM3UI({ palette: 'teal' }))
    expect(document.documentElement.getAttribute('data-palette')).toBe('teal')
  })

  it('does not set attribute for purple (default)', () => {
    const app = createApp(defineComponent({ render: () => h('div') }))
    app.use(createM3UI({ palette: 'purple' }))
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false)
  })

  it('does not override a palette the user already picked', () => {
    localStorage.setItem('m3-palette', 'teal')
    document.documentElement.setAttribute('data-palette', 'teal')
    const app = createApp(defineComponent({ render: () => h('div') }))
    app.use(createM3UI({ palette: 'iron' }))
    expect(document.documentElement.getAttribute('data-palette')).toBe('teal')
    expect(localStorage.getItem('m3-palette')).toBe('teal')
  })

  it('persistPalette: false forces the palette even over a stored value', () => {
    localStorage.setItem('m3-palette', 'teal')
    document.documentElement.setAttribute('data-palette', 'teal')
    const app = createApp(defineComponent({ render: () => h('div') }))
    app.use(createM3UI({ palette: 'iron', persistPalette: false }))
    expect(document.documentElement.getAttribute('data-palette')).toBe('iron')
  })

  it('persistPalette: false does not write the forced palette to localStorage', () => {
    const app = createApp(defineComponent({ render: () => h('div') }))
    app.use(createM3UI({ palette: 'iron', persistPalette: false }))
    expect(localStorage.getItem('m3-palette')).toBeNull()
  })

  describe('customPalettes', () => {
    const builtIn = palettes.map((p) => ({ ...p }))
    afterEach(() => {
      palettes.splice(0, palettes.length, ...builtIn)
    })

    it('adds custom palettes to the list useColorPalette returns', () => {
      const app = createApp(defineComponent({ render: () => h('div') }))
      app.use(createM3UI({ customPalettes: [{ id: 'brand', label: 'Brand', seed: '#0b6e4f' }] }))
      expect(useColorPalette().palettes).toHaveLength(builtIn.length + 1)
      expect(useColorPalette().palettes.at(-1)).toEqual({ id: 'brand', label: 'Brand', seed: '#0b6e4f' })
    })

    it('replaces a built-in palette with the same id instead of duplicating it', () => {
      const app = createApp(defineComponent({ render: () => h('div') }))
      app.use(createM3UI({ customPalettes: [{ id: 'teal', label: 'Our teal', seed: '#008080' }] }))
      expect(palettes).toHaveLength(builtIn.length)
      expect(palettes.filter((p) => p.id === 'teal')).toEqual([{ id: 'teal', label: 'Our teal', seed: '#008080' }])
    })

    it('can be selected as the starting palette', () => {
      const app = createApp(defineComponent({ render: () => h('div') }))
      app.use(createM3UI({ palette: 'brand', customPalettes: [{ id: 'brand', label: 'Brand', seed: '#0b6e4f' }] }))
      expect(document.documentElement.getAttribute('data-palette')).toBe('brand')
    })
  })

  describe('storagePrefix', () => {
    afterEach(() => {
      setStoragePrefix('')
      localStorage.clear()
      document.documentElement.classList.remove('dark')
    })

    function mountWith(options: Parameters<typeof createM3UI>[0]) {
      let result!: { theme: ReturnType<typeof useTheme>; palette: ReturnType<typeof useColorPalette> }
      const app = createApp(defineComponent({
        setup() {
          result = { theme: useTheme(), palette: useColorPalette() }
          return () => h('div')
        },
      }))
      app.use(createM3UI(options))
      app.mount(document.createElement('div'))
      return { app, ...result }
    }

    it("ignores another app's choices on the same origin and stores its own under the prefix", async () => {
      localStorage.setItem('m3-theme', 'dark')
      localStorage.setItem('m3-palette', 'teal')
      localStorage.setItem('m3-color-recent', '["#ff0000"]')
      const { app, theme, palette } = mountWith({ storagePrefix: 'shop', palette: 'red' })
      expect(theme.theme.value).toBe('system')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(palette.palette.value).toBe('red')
      expect(document.documentElement.getAttribute('data-palette')).toBe('red')
      expect(recentColors.value).toEqual([])
      theme.theme.value = 'light'
      await nextTick()
      expect(localStorage.getItem('shop-m3-theme')).toBe('light')
      expect(localStorage.getItem('shop-m3-palette')).toBe('red')
      expect(localStorage.getItem('m3-theme')).toBe('dark')
      expect(localStorage.getItem('m3-palette')).toBe('teal')
      app.unmount()
    })

    it("applies the app's own stored choices", () => {
      localStorage.setItem('m3-palette', 'teal')
      localStorage.setItem('admin-m3-theme', 'dark')
      localStorage.setItem('admin-m3-palette', 'green')
      const { app, theme, palette } = mountWith({ storagePrefix: 'admin', palette: 'red' })
      expect(theme.theme.value).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(palette.palette.value).toBe('green')
      expect(document.documentElement.getAttribute('data-palette')).toBe('green')
      app.unmount()
    })
  })
})
