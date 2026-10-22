import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vFocusRing, type FocusRingValue } from '../directives/vFocusRing'

function host(value: () => FocusRingValue) {
  return mount(defineComponent({
    setup: () => () => withDirectives(h('div', { tabindex: 0 }), [[vFocusRing, value()]]),
  }))
}

describe('vFocusRing', () => {
  it('marks the element for the ring, with no color or offset of its own by default', () => {
    const el = host(() => undefined).element as HTMLElement
    expect(el.dataset.m3FocusRing).toBe('')
    expect(el.style.getPropertyValue('--m3-focus-ring-color')).toBe('')
    expect(el.style.getPropertyValue('--m3-focus-ring-offset')).toBe('')
  })

  it('follows its value: a color, inset, within, off', async () => {
    const value = ref<FocusRingValue>('#e91e63')
    const w = host(() => value.value)
    const el = w.element as HTMLElement
    expect(el.style.getPropertyValue('--m3-focus-ring-color')).toBe('#e91e63')
    value.value = { inset: true, within: true }
    await nextTick()
    expect(el.dataset.m3FocusRing).toBe('within')
    expect(el.style.getPropertyValue('--m3-focus-ring-color')).toBe('')
    expect(el.style.getPropertyValue('--m3-focus-ring-offset')).toBe('-3px')
    value.value = false
    await nextTick()
    expect(el.dataset.m3FocusRing).toBe('off')
    w.unmount()
    expect(el.dataset.m3FocusRing).toBeUndefined()
  })
})
