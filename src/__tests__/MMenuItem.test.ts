import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide } from 'vue'
import MMenuItem from '../components/MMenuItem.vue'

// Mounts the item inside a stand-in for MMenu that records close() calls
function inMenu(props: Record<string, unknown>) {
  const closes: number[] = []
  const Host = defineComponent({
    setup() {
      provide('m-menu-close', () => closes.push(1))
      return () => h(MMenuItem, props, () => 'Item')
    },
  })
  const w = mount(Host)
  return { item: w.findComponent(MMenuItem), button: w.find('button'), closes }
}

describe('MMenuItem', () => {
  it('stays a plain item without selected or checked', () => {
    const { button } = inMenu({})
    expect(button.attributes('role')).toBeUndefined()
    expect(button.attributes('aria-checked')).toBeUndefined()
  })

  it('is a radio item with selected, closing the menu on click', async () => {
    const { button, closes } = inMenu({ selected: true })
    expect(button.attributes('role')).toBe('menuitemradio')
    expect(button.attributes('aria-checked')).toBe('true')
    expect(button.classes()).toContain('bg-tertiary-container')
    await button.trigger('click')
    expect(closes).toHaveLength(1)
  })

  it('is a checkbox item with checked, toggling v-model:checked and keeping the menu open', async () => {
    const { item, button, closes } = inMenu({ checked: false })
    expect(button.attributes('role')).toBe('menuitemcheckbox')
    expect(button.attributes('aria-checked')).toBe('false')
    await button.trigger('click')
    expect(item.emitted('update:checked')).toEqual([[true]])
    expect(item.emitted('click')).toHaveLength(1)
    expect(closes).toHaveLength(0)
  })

  it('closes after a checked item when keepOpen is false', async () => {
    const { button, closes } = inMenu({ checked: true, keepOpen: false })
    await button.trigger('click')
    expect(closes).toHaveLength(1)
  })

  it('rounds the outer corners of a run of selectable items, and all corners of the selected one', async () => {
    const w = mount(defineComponent({
      setup: () => () => h('div', [
        h(MMenuItem, { selected: false }, () => 'A'),
        h(MMenuItem, { selected: true }, () => 'B'),
        h(MMenuItem, { selected: false }, () => 'C'),
        h(MMenuItem, { selected: false }, () => 'D'),
        h('hr'),
        h(MMenuItem, { checked: false }, () => 'E'),
        h(MMenuItem, {}, () => 'Plain'),
      ]),
    }), { attachTo: document.body })
    await nextTick()
    // (the DOM shortens four equal corners to one value)
    const radius = w.findAll('button').map((b) => b.element.style.borderRadius)
    expect(radius).toEqual([
      '12px 12px 4px 4px', // first
      '12px', // selected
      '4px', // middle
      '4px 4px 12px 12px', // last
      '4px', // alone after the divider
      '', // plain items keep their own shape
    ])
    w.unmount()
  })

  it('shows a sliding check without an icon, and swaps or fills the icon with one', () => {
    expect(inMenu({ checked: true }).button.find('span.overflow-hidden').text()).toBe('check')
    const swapped = inMenu({ selected: true, icon: 'play_arrow', selectedIcon: 'pause' }).button
    expect(swapped.text()).toContain('pause')
    const filled = inMenu({ selected: true, icon: 'star' }).button.find('.material-symbols-outlined')
    expect(filled.attributes('style')).toContain('FILL')
  })
})
