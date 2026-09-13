import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createM3UI } from '../plugin'
import { useColorPalette } from '../composables/useColorPalette'

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
})
