import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vScrollElevation, type ScrollElevationValue } from '../directives/vScrollElevation'

function scroller(top = 0) {
  const el = document.createElement('div')
  el.scrollTop = top
  document.body.appendChild(el)
  return {
    el,
    scrollTo(y: number) {
      el.scrollTop = y
      el.dispatchEvent(new Event('scroll'))
    },
  }
}

function host(value: () => ScrollElevationValue) {
  return mount(defineComponent({
    setup: () => () => withDirectives(h('header'), [[vScrollElevation, value()]]),
  }))
}

describe('vScrollElevation', () => {
  it('takes the scrolled color and data-scrolled once its target scrolls, and gives them back at the top', () => {
    const list = scroller()
    const onChange = vi.fn()
    const w = host(() => ({ target: list.el, onChange }))
    const el = w.element as HTMLElement
    expect(el.dataset.scrolled).toBeUndefined()
    list.scrollTo(30)
    expect(el.dataset.scrolled).toBe('')
    expect(el.style.backgroundColor).toBe('var(--color-surface-container)')
    list.scrollTo(0)
    expect(el.dataset.scrolled).toBeUndefined()
    expect(el.style.backgroundColor).toBe('')
    expect(onChange.mock.calls).toEqual([[true], [false]])
    w.unmount()
  })

  it('takes a selector, a threshold, its own color or none', async () => {
    const list = scroller()
    list.el.id = 'feed'
    const color = ref<string | false>('#123456')
    const w = host(() => ({ target: '#feed', threshold: 50, color: color.value }))
    const el = w.element as HTMLElement
    list.scrollTo(40)
    expect(el.dataset.scrolled).toBeUndefined()
    list.scrollTo(60)
    expect(el.style.backgroundColor).toMatch(/#123456|rgb\(18, 52, 86\)/)
    color.value = false
    await nextTick()
    expect(el.dataset.scrolled).toBe('')
    expect(el.style.backgroundColor).toBe('')
    w.unmount()
  })

  it('starts scrolled if its target already is, and stops following when disabled or unmounted', async () => {
    const list = scroller(100)
    const disabled = ref(false)
    const w = host(() => ({ target: list.el, disabled: disabled.value }))
    const el = w.element as HTMLElement
    expect(el.dataset.scrolled).toBe('')
    disabled.value = true
    await nextTick()
    expect(el.dataset.scrolled).toBeUndefined()
    list.scrollTo(200)
    expect(el.dataset.scrolled).toBeUndefined()
    w.unmount()
  })
})

describe('vScrollElevation target ref', () => {
  it('waits for a template ref that is still empty instead of following the window', async () => {
    const target = ref<HTMLElement | null>(null)
    const w = host(() => ({ target: target.value }))
    const el = w.element as HTMLElement
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    expect(el.dataset.scrolled).toBeUndefined()
    const list = scroller(80)
    target.value = list.el
    await nextTick()
    expect(el.dataset.scrolled).toBe('')
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    w.unmount()
  })
})
