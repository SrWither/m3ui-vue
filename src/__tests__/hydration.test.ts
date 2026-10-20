import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'

// Each test imports the whole library afresh: a cold import can take seconds when the suite runs in parallel
vi.setConfig({ testTimeout: 30_000 })

/** A fresh copy of the library seeing a window of this width (the window size is read when its modules load). */
async function load(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  vi.resetModules()
  return {
    createM3UI: (await import('../plugin')).createM3UI,
    useWindowSizeClass: (await import('../composables/useWindowSizeClass')).useWindowSizeClass,
    MNavigationSuite: (await import('../components/MNavigationSuite.vue')).default,
    MListDetail: (await import('../components/MListDetail.vue')).default,
    MSupportingPane: (await import('../components/MSupportingPane.vue')).default,
  }
}
type Lib = Awaited<ReturnType<typeof load>>

const items = [
  { value: 'a', label: 'A', icon: 'home' },
  { value: 'b', label: 'B', icon: 'search' },
]

const cases: [keyof Lib, Record<string, unknown>, Record<string, () => unknown>][] = [
  ['MNavigationSuite', { modelValue: 'a', items }, { default: () => 'content' }],
  ['MListDetail', {}, { list: () => 'list', detail: () => 'detail' }],
  ['MSupportingPane', {}, { default: () => 'main', supporting: () => 'supporting' }],
]

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/**
 * The server has no window, so it renders the adaptive layouts compact. The client (a 1024px wide window here) has to
 * hydrate that HTML without mismatches, then adapt to its real size.
 */
async function hydrate(name: keyof Lib, props: Record<string, unknown>, slots: Record<string, () => unknown>) {
  // What a server renders: no window to measure, so width 0
  const server = await load(0)
  const html = await renderToString(createSSRApp({ render: () => h(server[name] as Component, props, slots) }).use(server.createM3UI()))

  const lib = await load(1024)

  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  let hydrating = true
  const client = createSSRApp({ render: () => h(lib[name] as Component, props, slots) }).use(lib.createM3UI({ isHydrating: () => hydrating }))
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800)
  client.mount(container)
  hydrating = false
  await nextTick()
  return { container, mismatches: warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('Hydration')) }
}

describe('hydrating server-rendered adaptive layouts', () => {
  it.each(cases)('%s matches the server HTML, then adapts', async (name, props, slots) => {
    const { container, mismatches } = await hydrate(name, props, slots)
    expect(mismatches).toEqual([])
    expect(container.innerHTML).not.toBe('')
  })

  it('MNavigationSuite switches to the rail once mounted on a wide window', async () => {
    const { container } = await hydrate('MNavigationSuite', { modelValue: 'a', items }, { default: () => 'content' })
    // Compact (the server's) is a short navigation bar; at 1200px it's a rail, laid out in a row
    expect(container.firstElementChild!.className).toContain('flex-row')
    expect(container.textContent).toContain('content')
  })

  it('with a viewport (from a cookie), renders the right layout from the server on, without a jump', async () => {
    const props = { modelValue: 'a', items }
    const slots = { default: () => 'content' }
    const viewport = { width: 1200, height: 800 }
    const server = await load(0)
    // Under happy-dom there is a window, so the flag stands in for the server's (ssr.test.ts renders it without one)
    const html = await renderToString(createSSRApp({ render: () => h(server.MNavigationSuite, props, slots) }).use(server.createM3UI({ initialState: { viewport }, isHydrating: () => true })))
    expect(html).toMatch(/^<div class="[^"]*flex-row/)

    const lib = await load(1200)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const layouts: string[] = []
    const app = createSSRApp({
      render: () => h(lib.MNavigationSuite, { ...props, onVnodeUpdated: () => layouts.push(container.firstElementChild!.className) }, slots),
    })
    app.use(lib.createM3UI({ initialState: { viewport }, isHydrating: () => true }))
    // happy-dom has no layout: what the browser measures once mounted
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800)
    app.mount(container)
    await nextTick()
    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('Hydration'))).toEqual([])
    // Never compact on the client either
    expect(container.firstElementChild!.className).toContain('flex-row')
    expect(layouts.filter((c) => c.includes('flex-col'))).toEqual([])
  })

  it('without isHydrating, guesses from the window on the first render (client-only apps)', async () => {
    const { useWindowSizeClass } = await load(1024)
    let first = -1
    const app = createSSRApp({
      setup() {
        first = useWindowSizeClass(() => null).width.value
        return () => h('div')
      },
    })
    app.mount(document.createElement('div'))
    expect(first).toBe(1024)
  })
})
