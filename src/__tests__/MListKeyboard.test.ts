import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MList from '../components/MList.vue'
import MListItem from '../components/MListItem.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('MList and MListItem from the keyboard', () => {
  const selectableList = (selected: string | null) =>
    mount(MList, {
      props: { selectable: true, selected, 'onUpdate:selected': (v: string) => wrapper!.setProps({ selected: v }) },
      slots: { default: () => ['a', 'b', 'c'].map((v) => h(MListItem, { title: v.toUpperCase(), value: v, disabled: v === 'c' })) },
      attachTo: document.body,
    })

  it('makes a selectable list a listbox of options with one Tab stop, the selected one', async () => {
    wrapper = selectableList('b')
    await nextTick()
    expect(wrapper.find('ul').attributes('role')).toBe('listbox')
    const options = wrapper.findAll('[role="option"]')
    expect(options.map((o) => o.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(options.map((o) => o.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(options[2]!.attributes('aria-disabled')).toBe('true')
  })

  it('gives the Tab stop to the first option when nothing is selected', async () => {
    wrapper = selectableList(null)
    await nextTick()
    expect((wrapper.findAll('[role="option"]')[0]!.element as HTMLElement).tabIndex).toBe(0)
  })

  it('moves between options with the arrows (skipping disabled ones) and selects with Enter and Space', async () => {
    wrapper = selectableList('a')
    await nextTick()
    const options = wrapper.findAll('[role="option"]').map((o) => o.element as HTMLElement)
    options[0]!.focus()
    options[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(options[1])
    // c is disabled: nowhere further down
    options[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(options[1])
    options[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(wrapper.emitted('update:selected')?.[0]).toEqual(['b'])
    options[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(options[0])
    options[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(wrapper.emitted('update:selected')?.[1]).toEqual(['a'])
  })

  it('makes a clickable row a button inside its list item, operable from the keyboard', async () => {
    let clicks = 0
    wrapper = mount(MList, { slots: { default: () => h(MListItem, { title: 'Open', onClick: () => clicks++ }) }, attachTo: document.body })
    const li = wrapper.find('ul > li')
    expect(li.attributes('role')).toBe('listitem')
    const row = li.find('[role="button"]')
    expect(row.attributes('tabindex')).toBe('0')
    // @click alone makes it interactive (hover and press styles)
    expect(row.classes()).toContain('cursor-pointer')
    await row.trigger('keydown', { key: 'Enter' })
    await row.trigger('keydown', { key: ' ' })
    expect(clicks).toBe(2)
  })

  it('keeps a link a link, inside its list item', () => {
    wrapper = mount(MList, { slots: { default: () => h(MListItem, { title: 'Docs', href: '/docs' }) }, attachTo: document.body })
    const a = wrapper.find('ul > li[role="listitem"] > a')
    expect(a.attributes('href')).toBe('/docs')
    expect(a.attributes('role')).toBeUndefined()
  })

  it('leaves a plain row a plain list item, out of the tab order', () => {
    wrapper = mount(MList, { slots: { default: () => h(MListItem, { title: 'Info' }) }, attachTo: document.body })
    const li = wrapper.find('ul > li')
    expect(li.attributes('role')).toBe('listitem')
    expect(li.attributes('tabindex')).toBeUndefined()
    expect(li.classes()).toContain('mli-row')
  })

  it('puts the consumer\'s classes on the row', () => {
    wrapper = mount(MList, { slots: { default: () => h(MListItem, { title: 'Open', onClick: () => {}, class: 'mine' }) }, attachTo: document.body })
    expect(wrapper.find('[role="button"]').classes()).toContain('mine')
    expect(wrapper.find('ul > li').classes()).not.toContain('mine')
  })
})
