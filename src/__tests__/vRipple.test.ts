import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, withDirectives } from 'vue'
import { vRipple, type RippleValue } from '../directives/vRipple'
import MButton from '../components/MButton.vue'

function host(value: RippleValue | (() => RippleValue)) {
  return mount(defineComponent({
    setup() {
      return () => withDirectives(h('div', { class: 'host' }), [[vRipple, typeof value === 'function' ? value() : value]])
    },
  }))
}

function press(el: Element, button = 0) {
  el.dispatchEvent(new PointerEvent('pointerdown', { button, clientX: 10, clientY: 10, bubbles: true }))
}

describe('vRipple', () => {
  it('spawns a ripple inside a clipping layer on press', () => {
    const w = host(undefined)
    press(w.element)
    const layer = w.element.querySelector('.m3-ripple-layer')
    expect(layer).not.toBeNull()
    expect(layer!.querySelector('.m3-ripple')).not.toBeNull()
  })

  it('removes the layer when the animation ends', () => {
    const w = host(true)
    press(w.element)
    w.element.querySelector('.m3-ripple')!.dispatchEvent(new Event('animationend'))
    expect(w.element.querySelector('.m3-ripple-layer')).toBeNull()
  })

  it('makes a statically positioned host relative', () => {
    const w = mount(defineComponent({
      setup: () => () => withDirectives(h('div'), [[vRipple, true]]),
    }), { attachTo: document.body })
    press(w.element)
    expect((w.element as HTMLElement).style.position).toBe('relative')
    w.unmount()
  })

  it('does nothing when false or disabled', () => {
    for (const value of [false, { disabled: true }] as RippleValue[]) {
      const w = host(value)
      press(w.element)
      expect(w.element.querySelector('.m3-ripple')).toBeNull()
    }
  })

  it('ignores secondary buttons', () => {
    const w = host(true)
    press(w.element, 2)
    expect(w.element.querySelector('.m3-ripple')).toBeNull()
  })

  it('takes a color as a string or an option', () => {
    for (const value of ['rgb(255, 0, 0)', { color: 'rgb(255, 0, 0)' }] as RippleValue[]) {
      const w = host(value)
      press(w.element)
      expect((w.element.querySelector('.m3-ripple') as HTMLElement).style.background).toBe('rgb(255, 0, 0)')
    }
  })

  it('follows binding updates', async () => {
    const disabled = ref(true)
    const w = mount(defineComponent({
      setup() {
        return () => withDirectives(h('div'), [[vRipple, { disabled: disabled.value }]])
      },
    }))
    press(w.element)
    expect(w.element.querySelector('.m3-ripple')).toBeNull()
    disabled.value = false
    await w.vm.$nextTick()
    press(w.element)
    expect(w.element.querySelector('.m3-ripple')).not.toBeNull()
  })
})

describe('MButton ripple', () => {
  it('uses rippleColor and skips the ripple while loading', async () => {
    const w = mount(MButton, { props: { rippleColor: 'rgb(0, 0, 255)' }, slots: { default: 'Go' } })
    press(w.element)
    expect((w.element.querySelector('.m3-ripple') as HTMLElement).style.background).toBe('rgb(0, 0, 255)')
    await w.setProps({ loading: true })
    w.element.querySelectorAll('.m3-ripple-layer').forEach((l) => l.remove())
    press(w.element)
    expect(w.element.querySelector('.m3-ripple')).toBeNull()
  })
})
