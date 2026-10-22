import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MOverlay from '../components/MOverlay.vue'
import MDialog from '../components/MDialog.vue'

let wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})
const open = (props: Record<string, unknown> = {}) => {
  const w = mount(MOverlay, { props: { modelValue: true, ...props }, attachTo: document.body })
  wrappers.push(w)
  return w
}
const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))

describe('MOverlay', () => {
  it('ignores Escape and leaves the scroll alone by default', () => {
    const w = open()
    escape()
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(document.body.style.overflow).toBe('')
  })

  it('closes on Escape with closeOnEscape', () => {
    const w = open({ closeOnEscape: true })
    escape()
    expect(w.emitted('update:modelValue')).toEqual([[false]])
  })

  it('leaves Escape to a dialog opened over it', () => {
    const w = open({ closeOnEscape: true })
    const d = mount(MDialog, { props: { modelValue: true, title: 'T' }, attachTo: document.body })
    wrappers.push(d)
    escape()
    expect(d.emitted('update:modelValue')).toEqual([[false]])
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('locks the page scroll while open with lockScroll', async () => {
    const w = open({ lockScroll: true })
    expect(document.body.style.overflow).toBe('hidden')
    await w.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('')
  })
})
