import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MTransition from '../components/MTransition.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms))

describe('MTransition', () => {
  it('overlaps both views while animating, then removes the old one', async () => {
    const page = ref('a')
    wrapper = mount(defineComponent({
      setup: () => () => h(MTransition, { type: 'fade-through' }, () => h('div', { key: page.value, class: 'page' }, page.value)),
    }), { attachTo: document.body, global: { stubs: { transition: false } } })
    page.value = 'b'
    await nextTick()
    expect(wrapper.findAll('.page').map((p) => p.text())).toEqual(['a', 'b'])
    await wait(800)
    expect(wrapper.findAll('.page').map((p) => p.text())).toEqual(['b'])
  })

  it('slides the entering view in from 20% of its width as a Web Animation', async () => {
    const page = ref('a')
    wrapper = mount(defineComponent({
      setup: () => () => h(MTransition, null, () => h('div', { key: page.value, class: 'page' }, page.value)),
    }), { attachTo: document.body, global: { stubs: { transition: false } } })
    page.value = 'b'
    await nextTick()
    const entering = wrapper.findAll('.page')[1]!.element as HTMLElement
    const slide = entering.getAnimations().find((a) => 'transform' in (a.effect as KeyframeEffect).getKeyframes()[0]!)
    expect((slide!.effect as KeyframeEffect).getKeyframes()[0]!.transform).toBe('translateX(20%)')
  })
})
