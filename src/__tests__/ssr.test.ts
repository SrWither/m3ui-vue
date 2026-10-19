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

  it.each(['useTheme', 'useColorPalette', 'useDevice', 'useLocale', 'useWindowSizeClass', 'useToast', 'useNotification'] as const)(
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
