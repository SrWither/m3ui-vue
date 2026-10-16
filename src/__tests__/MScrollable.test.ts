import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import MScrollable from '../components/MScrollable.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})


describe('MScrollable indicator', () => {
  it('hides the native scrollbar and sizes the thumb to the visible fraction', async () => {
    wrapper = mount(MScrollable, {
      props: { scrollbar: 'indicator', scrollbarFade: false },
      slots: { default: () => h('div', 'Long content') },
      attachTo: document.body,
    })
    const el = wrapper.element as HTMLElement
    expect(el.className).toContain('m3-scrollable-hidden')
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 800, configurable: true })
    el.scrollTop = 300
    el.dispatchEvent(new Event('scroll'))
    const thumb = wrapper.find('.m3-scrollable-thumb-v').element as HTMLElement
    // Track 196px (2px inset at each end), thumb 196 × 200/800 = 49px, offset 2 + 300/600 × (196 − 49)
    expect(thumb.style.height).toBe('49px')
    expect(thumb.style.transform).toBe('translate(0px, 375.5px)')
    expect(thumb.style.opacity).toBe('1')
  })

  it('draws nothing when the content fits', async () => {
    wrapper = mount(MScrollable, { props: { scrollbar: 'indicator' }, slots: { default: () => h('div', 'Short') } })
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 200, configurable: true })
    el.dispatchEvent(new Event('scroll'))
    expect((wrapper.find('.m3-scrollable-thumb-v').element as HTMLElement).style.display).toBe('none')
  })
})
