import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MTerminal from '../components/MTerminal.vue'

// xterm needs a real canvas; a stand-in records what the component hands it.
const instances: { options: Record<string, any> }[] = []
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options: Record<string, any>
    constructor(options: Record<string, any>) {
      this.options = options
      instances.push(this)
    }
    loadAddon() {}
    open() {}
    write() {}
    writeln() {}
    clear() {}
    focus() {}
    dispose() {}
    onData() {}
  },
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

const html = document.documentElement
afterEach(() => {
  instances.length = 0
  html.classList.remove('dark')
  html.removeAttribute('data-palette')
})

describe('MTerminal', () => {
  it('follows theme and palette changes', async () => {
    const wrapper = mount(MTerminal, { attachTo: document.body })
    // happy-dom doesn't inherit custom properties into getComputedStyle, so set them where the
    // component reads them (its container); the changes that trigger a re-read still happen on <html>.
    const container = wrapper.find('.bg-surface-container-lowest').element as HTMLElement
    container.style.setProperty('--color-surface-container-lowest', '#ffffff')
    await flushPromises()
    const term = instances[0]!
    expect(term.options.theme.background).toBe('#ffffff')

    container.style.setProperty('--color-surface-container-lowest', '#0f0d13')
    html.classList.add('dark')
    await flushPromises()
    expect(term.options.theme.background).toBe('#0f0d13')

    container.style.setProperty('--color-surface-container-lowest', '#101418')
    html.setAttribute('data-palette', 'teal')
    await flushPromises()
    expect(term.options.theme.background).toBe('#101418')
    wrapper.unmount()
  })

  it('does not create a terminal when unmounted while xterm loads', async () => {
    const wrapper = mount(MTerminal, { attachTo: document.body })
    wrapper.unmount()
    await flushPromises()
    expect(instances).toHaveLength(0)
  })
})
