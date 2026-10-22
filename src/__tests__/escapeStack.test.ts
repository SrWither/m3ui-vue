import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Component } from 'vue'
import MDialog from '../components/MDialog.vue'
import MSelect from '../components/MSelect.vue'
import MAutocomplete from '../components/MAutocomplete.vue'
import MSearchBar from '../components/MSearchBar.vue'
import MBottomSheet from '../components/MBottomSheet.vue'
import MSideSheet from '../components/MSideSheet.vue'
import MCommandPalette from '../components/MCommandPalette.vue'
import MSpotlightSearch from '../components/MSpotlightSearch.vue'
import MNavigationRail from '../components/MNavigationRail.vue'

// Every case: the component sits in (or opens over) an open MDialog. One Escape closes the component alone; the
// next one closes the dialog. Before, both went at once (each component listened to Escape on its own, outside the
// library's escape stack MDialog uses).

let wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

function inDialog(child: () => unknown) {
  const w = mount(MDialog, { props: { modelValue: true, title: 'T' }, slots: { default: child }, attachTo: document.body })
  wrappers.push(w)
  return w
}
const press = (target: EventTarget = document) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
const dialogClosed = (w: VueWrapper) => (w.emitted('update:modelValue') ?? []).some((e) => e[0] === false)

describe('Escape closes the topmost surface only', () => {
  it('MSelect: an open list closes first', async () => {
    const d = inDialog(() => h(MSelect, { modelValue: 'a', label: 'L', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }))
    const trigger = document.querySelector<HTMLElement>('[role=combobox]')!
    trigger.click()
    await nextTick()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    press(trigger)
    await nextTick()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(dialogClosed(d)).toBe(false)
    press(trigger)
    expect(dialogClosed(d)).toBe(true)
  })

  it('MAutocomplete: an open list closes first', async () => {
    const d = inDialog(() => h(MAutocomplete, { modelValue: null, label: 'L', options: [{ value: 'a', label: 'Apple' }] }))
    const input = document.querySelector<HTMLInputElement>('input')!
    input.focus()
    input.dispatchEvent(new Event('focus'))
    input.value = 'a'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const expanded = () => document.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')
    expect(expanded()).toBe('true')
    press(input)
    await nextTick()
    expect(expanded()).toBe('false')
    expect(dialogClosed(d)).toBe(false)
  })

  it('MSearchBar: an expanded bar collapses first', async () => {
    const bar = defineComponent({ setup: () => () => h(MSearchBar, { modelValue: '', expanded: true }) })
    const d = inDialog(() => h(bar))
    await nextTick()
    const s = d.findComponent(MSearchBar)
    press()
    await nextTick()
    expect(s.emitted('update:expanded')).toEqual([[false]])
    expect(dialogClosed(d)).toBe(false)
  })

  const overDialog: [string, Component, Record<string, unknown>, string][] = [
    ['MBottomSheet', MBottomSheet, { modelValue: true, title: 'S' }, 'update:modelValue'],
    ['MSideSheet', MSideSheet, { modelValue: true, title: 'S' }, 'update:modelValue'],
    ['MCommandPalette', MCommandPalette, { modelValue: true, items: [] }, 'update:modelValue'],
    ['MSpotlightSearch', MSpotlightSearch, { modelValue: true, results: [] }, 'update:modelValue'],
    ['MNavigationRail (modal)', MNavigationRail, { modelValue: 'a', items: [{ value: 'a', label: 'A', icon: 'home' }], modal: true, expanded: true }, 'update:expanded'],
  ]
  it.each(overDialog)('%s opened over a dialog closes alone', async (_n, component, props, event) => {
    const d = inDialog(() => 'Dialog content')
    const top = mount(component, { props, attachTo: document.body, global: { stubs: { transition: false } } })
    wrappers.push(top)
    await nextTick()
    press()
    expect(top.emitted(event)?.[0]).toEqual([false])
    expect(dialogClosed(d)).toBe(false)
  })
})
