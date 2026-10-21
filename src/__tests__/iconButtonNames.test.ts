import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Component } from 'vue'
import MSelect from '../components/MSelect.vue'
import MAutocomplete from '../components/MAutocomplete.vue'
import MMultiSelect from '../components/MMultiSelect.vue'
import MMultiAutocomplete from '../components/MMultiAutocomplete.vue'
import MTagInput from '../components/MTagInput.vue'
import MTextField from '../components/MTextField.vue'
import MMaskField from '../components/MMaskField.vue'
import MSearchBar from '../components/MSearchBar.vue'
import MSimpleCarousel from '../components/MSimpleCarousel.vue'
import MSplitButton from '../components/MSplitButton.vue'
import MTree from '../components/MTree.vue'
import MTreeTable from '../components/MTreeTable.vue'

// A button's accessible name, roughly as a browser computes it: aria-label, else its text without what's hidden from
// assistive technology (MIcon's ligature text), else its title
function accessibleName(el: Element): string {
  const label = el.getAttribute('aria-label')
  if (label) return label
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
  return clone.textContent?.trim() || el.getAttribute('title') || ''
}

const options = [{ label: 'Lo-fi', value: 'lofi' }, { label: 'Jazz', value: 'jazz' }]

const cases: [string, Component, Record<string, unknown>][] = [
  ['MSelect', MSelect, { modelValue: 'lofi', options, label: 'Genre', clearable: true }],
  ['MAutocomplete', MAutocomplete, { modelValue: 'lofi', options, label: 'Genre', clearable: true }],
  ['MMultiSelect', MMultiSelect, { modelValue: ['lofi', 'jazz'], options, label: 'Genres', clearable: true }],
  ['MMultiAutocomplete', MMultiAutocomplete, { modelValue: ['lofi'], options, label: 'Genres', clearable: true }],
  ['MTagInput', MTagInput, { modelValue: ['vue', 'm3'], label: 'Tags', clearable: true }],
  ['MTextField', MTextField, { modelValue: 'hello', label: 'Name', clearable: true }],
  ['MMaskField', MMaskField, { modelValue: '123', label: 'Phone', clearable: true, mask: '###' }],
  ['MSearchBar', MSearchBar, { modelValue: 'tea', clearable: true }],
  ['MSimpleCarousel', MSimpleCarousel, { items: [{ src: 'a.jpg' }, { src: 'b.jpg' }] }],
  ['MSplitButton', MSplitButton, { label: 'Save', items: [{ label: 'Save as', value: 'as' }] }],
  ['MTree', MTree, { nodes: [{ id: 1, label: 'src', children: [{ id: 2, label: 'App.vue' }] }] }],
  ['MTreeTable', MTreeTable, { columns: [{ key: 'name', label: 'Name' }], rows: [{ id: 1, name: 'src', children: [{ id: 2, name: 'App.vue' }] }] }],
]

describe('icon-only buttons have an accessible name', () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  for (const [name, component, props] of cases) {
    it(name, async () => {
      wrapper = mount(component, { props, attachTo: document.body })
      await nextTick()
      const buttons = [...document.body.querySelectorAll('button')]
      expect(buttons.length).toBeGreaterThan(0)
      const unnamed = buttons.filter((b) => !accessibleName(b)).map((b) => b.outerHTML.slice(0, 120))
      expect(unnamed).toEqual([])
    })
  }
})

describe('MSelect listbox semantics', () => {
  it('names the combobox by its label and exposes the open list and its options', async () => {
    const wrapper = mount(MSelect, { props: { modelValue: 'jazz', options, label: 'Genre' }, attachTo: document.body })
    const combo = wrapper.find('[role="combobox"]')
    expect(document.getElementById(combo.attributes('aria-labelledby')!)?.textContent?.trim()).toBe('Genre')
    expect(combo.attributes('aria-expanded')).toBe('false')
    await combo.trigger('click')
    const list = document.getElementById(combo.attributes('aria-controls')!)!
    expect(list.getAttribute('role')).toBe('listbox')
    const opts = [...list.querySelectorAll('[role="option"]')]
    expect(opts.map((o) => accessibleName(o))).toEqual(['Lo-fi', 'Jazz'])
    expect(opts.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(combo.attributes('aria-activedescendant')).toBe(opts[1]!.id)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})

describe('MAutocomplete listbox semantics', () => {
  it('points the input at the open list and the option the arrow keys are on', async () => {
    const wrapper = mount(MAutocomplete, { props: { modelValue: null, options, label: 'Genre' }, attachTo: document.body })
    const input = wrapper.find('input[role="combobox"]')
    await input.trigger('focus')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const list = document.getElementById(input.attributes('aria-controls')!)!
    expect(list.getAttribute('role')).toBe('listbox')
    const opts = [...list.querySelectorAll('[role="option"]')]
    expect(opts).toHaveLength(2)
    expect(input.attributes('aria-activedescendant')).toBe(opts[0]!.id)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})

describe('MMultiSelect trigger', () => {
  it('is named by its label', () => {
    const wrapper = mount(MMultiSelect, { props: { modelValue: [], options, label: 'Genres' }, attachTo: document.body })
    const trigger = wrapper.find('[role="button"]')
    expect(document.getElementById(trigger.attributes('aria-labelledby')!)?.textContent?.trim()).toBe('Genres')
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})

describe('MSelect keyboard focus', () => {
  // The trigger had no focus style of its own, so the browser drew its outline (white in dark, black in light)
  it('shows M3\'s focused field instead of the browser outline', async () => {
    const wrapper = mount(MSelect, { props: { modelValue: null, options, label: 'Genre', variant: 'outlined' }, attachTo: document.body })
    const combo = wrapper.find('[role="combobox"]')
    expect(combo.classes()).toContain('outline-none')
    expect(combo.classes()).not.toContain('border-primary')
    await combo.trigger('focus')
    expect(combo.classes()).toEqual(expect.arrayContaining(['border-2', 'border-primary']))
    expect(wrapper.find('label').classes()).toContain('text-primary')
    await combo.trigger('blur')
    expect(combo.classes()).not.toContain('border-primary')
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
