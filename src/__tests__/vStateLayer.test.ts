import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vStateLayer, type StateLayerValue } from '../directives/vStateLayer'

function host(value: () => StateLayerValue, children?: () => unknown) {
  return mount(defineComponent({
    setup() {
      return () => withDirectives(h('div', { class: 'host' }, children?.() as never), [[vStateLayer, value()]])
    },
  }), { attachTo: document.body })
}
const layerOf = (el: Element) => el.querySelector<HTMLElement>(':scope > .m3-state-layer')

describe('vStateLayer', () => {
  it('adds a hidden layer and makes a static host positioned', () => {
    const w = host(() => undefined)
    const el = w.element as HTMLElement
    expect(layerOf(el)).not.toBeNull()
    expect(layerOf(el)!.getAttribute('aria-hidden')).toBe('true')
    expect(el.dataset.m3StateLayer).toBe('')
    expect(el.style.position).toBe('relative')
    w.unmount()
  })

  it('follows its value: off, a color, dragged', async () => {
    const value = ref<StateLayerValue>(false)
    const w = host(() => value.value)
    const el = w.element as HTMLElement
    expect(el.dataset.m3StateLayer).toBe('off')
    value.value = '#e91e63'
    await nextTick()
    expect(el.dataset.m3StateLayer).toBe('')
    expect(layerOf(el)!.style.background).toContain('#e91e63')
    value.value = { dragged: true }
    await nextTick()
    expect(el.dataset.m3StateLayer).toBe('dragged')
    expect(layerOf(el)!.style.background).toBe('')
    w.unmount()
  })

  it('keeps one layer across re-renders of its children, and removes it on unmount', async () => {
    const items = ref(['a'])
    const w = host(() => true, () => items.value.map((t) => h('span', { key: t }, t)))
    const el = w.element as HTMLElement
    items.value = ['a', 'b', 'c']
    await nextTick()
    expect(el.querySelectorAll('.m3-state-layer')).toHaveLength(1)
    w.unmount()
    expect(el.querySelector('.m3-state-layer')).toBeNull()
    expect(el.dataset.m3StateLayer).toBeUndefined()
  })
})
