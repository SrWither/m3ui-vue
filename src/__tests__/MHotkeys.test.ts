import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MHotkeys from '../components/MHotkeys.vue'

let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null })

function press(key: string, mods: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }))
}

describe('MHotkeys', () => {
  it('fires a mod binding with Ctrl (not on a Mac)', () => {
    const handler = vi.fn()
    wrapper = mount(MHotkeys, { props: { bindings: [{ keys: 'mod+z', label: 'Undo', handler }] } })
    press('z', { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires mod+shift combos and not plain mod ones for them', () => {
    const undo = vi.fn()
    const redo = vi.fn()
    wrapper = mount(MHotkeys, {
      props: { bindings: [{ keys: 'mod+z', label: 'Undo', handler: undo }, { keys: 'mod+shift+z', label: 'Redo', handler: redo }] },
    })
    press('Z', { ctrlKey: true, shiftKey: true })
    expect(redo).toHaveBeenCalledTimes(1)
    expect(undo).not.toHaveBeenCalled()
  })

  it('fires an explicit ctrl binding', () => {
    const handler = vi.fn()
    wrapper = mount(MHotkeys, { props: { bindings: [{ keys: 'ctrl+k', label: 'Search', handler }] } })
    press('k', { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire when an extra modifier is held', () => {
    const handler = vi.fn()
    wrapper = mount(MHotkeys, { props: { bindings: [{ keys: 'mod+z', label: 'Undo', handler }] } })
    press('z', { ctrlKey: true, altKey: true })
    press('z')
    expect(handler).not.toHaveBeenCalled()
  })

  it('fires single keys, but not while typing', () => {
    const handler = vi.fn()
    wrapper = mount(MHotkeys, { props: { bindings: [{ keys: 'b', label: 'Brush', handler }] } })
    press('b')
    expect(handler).toHaveBeenCalledTimes(1)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))
    expect(handler).toHaveBeenCalledTimes(1)
    input.remove()
  })
})
