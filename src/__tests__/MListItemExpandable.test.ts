import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import MListItem from '../components/MListItem.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const mountExpandable = (props: Record<string, unknown> = {}) =>
  mount(MListItem, {
    props: { title: 'Settings', expandable: true, ...props },
    slots: { children: () => h('p', 'Wi-Fi') },
    global: { stubs: { transition: false } },
  })

describe('MListItem expandable', () => {
  it('makes its header a button that says whether its children are shown', async () => {
    wrapper = mountExpandable()
    const header = wrapper.find('[role=button]')
    expect(header.attributes('tabindex')).toBe('0')
    expect(header.attributes('aria-expanded')).toBe('false')
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find(`#${header.attributes('aria-controls')}`).text()).toBe('Wi-Fi')
  })

  it('toggles from the keyboard with Enter and Space', async () => {
    wrapper = mountExpandable()
    const header = wrapper.find('[role=button]')
    await header.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:expanded')).toEqual([[true]])
    expect(wrapper.text()).toContain('Wi-Fi')
    await header.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:expanded')).toEqual([[true], [false]])
    await header.trigger('keydown', { key: 'a' })
    expect(wrapper.emitted('update:expanded')).toHaveLength(2)
  })

  it('is out of the tab order while disabled', () => {
    wrapper = mountExpandable({ disabled: true })
    const header = wrapper.find('[role=button]')
    expect(header.attributes('tabindex')).toBe('-1')
    expect(header.attributes('aria-disabled')).toBe('true')
  })
})
