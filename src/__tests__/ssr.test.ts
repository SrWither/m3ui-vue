// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'

// What Nuxt's server sees: no window, no document, no localStorage. The import itself has to work, since
// one bundle carries every module (and its module-level code) whatever the app imports.
vi.stubGlobal('localStorage', undefined)

let lib: typeof import('../index')

beforeAll(async () => {
  expect(typeof window).toBe('undefined')
  expect(typeof document).toBe('undefined')
  lib = await import('../index')
})

const items = [{ src: 'a.jpg', alt: 'a' }, { src: 'b.jpg', alt: 'b' }]

// Props for components that need some to render at all; everything else gets the generic set below.
const props: Record<string, Record<string, unknown>> = {
  MDataTable: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] },
  MTable: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] },
  MVirtualTable: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] },
  MTreeTable: { columns: [{ key: 'a', label: 'A' }], rows: [] },
  MTree: { nodes: [{ id: 1, label: 'a' }] },
  MKbd: { keys: 'Ctrl+K' },
  MPasswordMeter: { value: 'abc' },
  MRelativeTime: { value: new Date(0) },
  MResult: { status: 'success', title: 't' },
  MShape: { shape: 'Circle' },
  MTour: { steps: [{ target: '#x', title: 't' }] },
}

// Overlays rendered open, where the open/scroll-lock code runs
const open = ['MDialog', 'MConfirmDialog', 'MBottomSheet', 'MSideSheet', 'MNavigationDrawer', 'MDatePickerModal',
  'MTimePickerModal', 'MColorPickerModal', 'MDateRangePickerModal', 'MLightbox', 'MCommandPalette',
  'MSpotlightSearch', 'MOverlay', 'MLoadingOverlay', 'MWindow', 'MMenu', 'MSnackbar', 'MNavigationRail']

async function render(component: Component, componentProps: Record<string, unknown>, options?: object) {
  const app = createSSRApp({ render: () => h(component, componentProps, { default: () => 'x' }) })
  if (options) app.use(lib.createM3UI(options))
  return renderToString(app)
}

describe('SSR', () => {
  it('renders every component without a DOM', async () => {
    const failed: string[] = []
    const names = Object.keys(lib).filter((k) => /^M[A-Z]/.test(k))
    expect(names.length).toBeGreaterThan(100)
    for (const name of names) {
      try {
        await render((lib as Record<string, Component>)[name]!, props[name] ?? { modelValue: '', label: 'x', items: [], options: [] })
      } catch (e) {
        failed.push(`${name}: ${(e as Error).message}`)
      }
    }
    expect(failed).toEqual([])
  })

  it.each(open)('renders %s open', async (name) => {
    const html = await render((lib as Record<string, Component>)[name]!, { modelValue: true, open: true, items, title: 't', message: 'm' })
    expect(typeof html).toBe('string')
  })

  // Components living in their own entry (heavy optional peers)
  it.each([
    ['chart', 'MChart', { type: 'bar', data: { labels: ['a'], datasets: [{ data: [1] }] } }],
    ['code-editor', 'MCodeEditor', { modelValue: 'x' }],
    ['code-editor', 'MJsonEditor', { modelValue: '{}' }],
    ['markdown', 'MMarkdown', { source: '# hi' }],
    ['rich-text-editor', 'MRichTextEditor', { modelValue: '<p>x</p>' }],
    ['terminal', 'MTerminal', {}],
    ['qrcode', 'MQRCode', { value: 'x' }],
    ['barcode', 'MBarcode', { value: '123456' }],
    // The empty container: MapLibre only loads in the browser
    ['map', 'MMap', { mapStyle: 'https://tiles.test/style.json' }],
  ] as const)('renders %s/%s', async (entry, name, componentProps) => {
    const mod = await import(`../${entry}.ts`)
    await expect(render(mod[name], componentProps)).resolves.toBeTypeOf('string')
  })

  it.each([
    {},
    { palette: 'red' },
    { palette: 'red', persistPalette: false },
    { seed: '#6750a4' },
    { contrast: 'high' },
    { themeColor: 'surface' },
    { locale: { close: 'Cerrar' } },
    { customPalettes: [{ id: 'mine', label: 'Mine', seed: '#ff0000' }] },
  ])('installs createM3UI(%o)', async (options) => {
    await expect(render(lib.MButton, {}, options)).resolves.toContain('button')
  })

  it('applies the app locale', async () => {
    expect(await render(lib.MPagination, { modelValue: 1, total: 50 }, { locale: lib.defaultLocale })).toBeTruthy()
  })

  describe('initialState', () => {
    // What a component renders from the composables, server-side
    async function state(options: object) {
      const app = createSSRApp({
        setup() {
          const { theme } = lib.useTheme()
          const { palette, contrast, activeContrast } = lib.useColorPalette()
          return () => h('p', `${theme.value} ${palette.value} ${contrast.value} ${activeContrast.value}`)
        },
      })
      app.use(lib.createM3UI(options))
      return (await renderToString(app)).replace(/<\/?p>/g, '')
    }

    it('reports the user\'s choice on the server', async () => {
      expect(await state({ initialState: { theme: 'dark', palette: 'blue', contrast: 'high' } })).toBe('dark blue high high')
    })

    it('falls back to the plugin\'s defaults, like a first visit', async () => {
      expect(await state({ palette: 'red', contrast: 'medium', initialState: {} })).toBe('system red medium medium')
      expect(await state({ seed: '#6750a4', initialState: {} })).toBe('system seed standard standard')
    })

    it('resolves system contrast to standard (the server can\'t know the OS preference)', async () => {
      expect(await state({ initialState: { contrast: 'system' } })).toBe('system purple system standard')
    })

    it('lets persistPalette: false win over the stored choice', async () => {
      expect(await state({ palette: 'red', contrast: 'high', persistPalette: false, initialState: { palette: 'blue', contrast: 'medium' } }))
        .toBe('system red high high')
    })

    it('ignores invalid values (cookies are user input)', async () => {
      expect(await state({ initialState: { theme: 'pink', contrast: 'max' } as object })).toBe('system purple standard standard')
    })

    it('renders the adaptive layouts for the given viewport', async () => {
      const suite = (options: object) => render(lib.MNavigationSuite, { modelValue: 'a', items: [{ value: 'a', label: 'A', icon: 'home' }] }, options)
      // A desktop window: a rail beside the content (a row); none known: compact, a bar under it (a column)
      expect(await suite({ initialState: { viewport: { width: 1280, height: 800 } } })).toMatch(/^<div class="[^"]*flex-row/)
      expect(await suite({ initialState: {} })).toMatch(/^<div class="[^"]*flex-col/)
      expect(await suite({ initialState: { viewport: { width: -1, height: 800 } } })).toMatch(/^<div class="[^"]*flex-col/)
    })

    it('reports the viewport through useWindowSizeClass()', async () => {
      const app = createSSRApp({
        setup() {
          const { widthClass, heightClass } = lib.useWindowSizeClass()
          return () => h('p', `${widthClass.value} ${heightClass.value}`)
        },
      })
      app.use(lib.createM3UI({ initialState: { viewport: { width: 1280, height: 800 } } }))
      expect(await renderToString(app)).toBe('<p>large medium</p>')
    })

    it('without it, keeps reporting the module defaults', async () => {
      expect(await state({ palette: 'red' })).toBe('system purple standard standard')
    })
  })

  it.each(['useTheme','useColorPalette', 'useDevice', 'useLocale', 'useWindowSizeClass', 'useToast', 'useNotification'] as const)(
    '%s() works in setup', async (name) => {
      const app = createSSRApp({
        setup() {
          ;(lib[name] as () => unknown)()
          return () => h('div')
        },
      })
      await expect(renderToString(app)).resolves.toBe('<div></div>')
    },
  )
})
