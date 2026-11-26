import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MCollapse from '../components/MCollapse.vue'
import MExpansionPanel from '../components/MExpansionPanel.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const end = (el: Element) => {
  const e = new Event('transitionend') as TransitionEvent
  Object.defineProperty(e, 'propertyName', { value: 'grid-template-rows' })
  el.dispatchEvent(e)
}

describe('MCollapse', () => {
  it('opens and closes, inert while closed, with after-open / after-close', async () => {
    wrapper = mount(MCollapse, { props: { open: false }, slots: { default: () => h('button', 'Inside') } })
    const body = wrapper.find('.m3-collapse__body')
    expect(body.attributes('inert')).toBeDefined()
    expect(wrapper.find('button').exists()).toBe(true) // kept mounted by default
    await wrapper.setProps({ open: true })
    expect(wrapper.classes()).toContain('m3-collapse--open')
    expect(body.attributes('inert')).toBeUndefined()
    end(wrapper.element)
    expect(wrapper.emitted('after-open')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    end(wrapper.element)
    expect(wrapper.emitted('after-close')).toHaveLength(1)
  })

  it('unmounts the content once closed with unmountOnClose, and mounts it on open', async () => {
    wrapper = mount(MCollapse, { props: { open: false, unmountOnClose: true }, slots: { default: () => h('p', 'Inside') } })
    expect(wrapper.find('p').exists()).toBe(false)
    await wrapper.setProps({ open: true })
    expect(wrapper.find('p').exists()).toBe(true)
    await wrapper.setProps({ open: false })
    // Still there while closing
    expect(wrapper.find('p').exists()).toBe(true)
    end(wrapper.element)
    await nextTick()
    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('settles by itself when no transition runs', async () => {
    vi.useFakeTimers()
    wrapper = mount(MCollapse, { props: { open: false, duration: 200 } })
    await wrapper.setProps({ open: true })
    vi.advanceTimersByTime(260)
    expect(wrapper.emitted('after-open')).toHaveLength(1)
  })
})

describe('MExpansionPanel', () => {
  it('toggles uncontrolled, linking its header to the body', async () => {
    wrapper = mount(MExpansionPanel, { props: { title: 'Details' }, slots: { default: () => 'Body' } })
    const header = wrapper.find('button')
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find(`#${header.attributes('aria-controls')}`).exists()).toBe(true)
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findComponent(MCollapse).props('open')).toBe(true)
  })

  it('emits v-model when controlled', async () => {
    wrapper = mount(MExpansionPanel, { props: { title: 'Details', modelValue: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([true])
    expect(wrapper.findComponent(MCollapse).props('open')).toBe(false)
  })

  it('takes header slots instead of the text props', () => {
    wrapper = mount(MExpansionPanel, {
      slots: {
        leading: () => h('i', { class: 'lead' }, 'L'),
        title: () => [h('span', 'Obra '), h('mark', 'Norte')],
        subtitle: () => 'Started today',
        trailing: () => h('b', { class: 'count' }, '3'),
      },
    })
    expect(wrapper.find('.lead').exists()).toBe(true)
    expect(wrapper.find('mark').text()).toBe('Norte')
    expect(wrapper.text()).toContain('Started today')
    // The trailing slot sits before the chevron
    const header = wrapper.find('button').element
    expect(header.lastElementChild!.textContent).toBe('expand_more')
    expect(header.lastElementChild!.previousElementSibling!.className).toBe('count')
  })

  it('is a plain row with expandable false: no button, chevron or body', async () => {
    wrapper = mount(MExpansionPanel, { props: { title: 'Nothing inside', expandable: false } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[aria-expanded]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('expand_more')
    expect(wrapper.findComponent(MCollapse).exists()).toBe(false)
    expect(wrapper.find('.opacity-\\[0\\.38\\]').exists()).toBe(false)
  })

  it('drops the body padding with flush', () => {
    wrapper = mount(MExpansionPanel, { props: { title: 'List', flush: true }, slots: { default: () => h('ul', { class: 'list' }) } })
    expect(wrapper.find('.list').element.parentElement!.className).not.toContain('px-5')
  })
})
