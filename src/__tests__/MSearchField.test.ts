import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSearchField from '../components/MSearchField.vue'

describe('MSearchField', () => {
  it('works with v-model and emits search on Enter', async () => {
    const w = mount(MSearchField, { props: { modelValue: '' } })
    const input = w.find('input')
    await input.setValue('lamp')
    expect(w.emitted('update:modelValue')).toEqual([['lamp']])
    await w.setProps({ modelValue: 'lamp' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('search')).toEqual([['lamp']])
  })

  it('clears with the button, which shows only while there is text', async () => {
    const w = mount(MSearchField, { props: { modelValue: '' } })
    expect(w.find('button').exists()).toBe(false)
    await w.setProps({ modelValue: 'x' })
    await w.find('button').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['']])
    expect(w.emitted('clear')).toHaveLength(1)
  })

  it('Escape empties it first and keeps the event from reaching the document', async () => {
    const w = mount(MSearchField, { props: { modelValue: 'x' }, attachTo: document.body })
    let reached = false
    const spy = () => (reached = true)
    document.addEventListener('keydown', spy)
    w.find('input').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    document.removeEventListener('keydown', spy)
    expect(w.emitted('update:modelValue')).toEqual([['']])
    expect(reached).toBe(false)
    w.unmount()
  })

  it('lets Escape through once the field is empty', () => {
    const w = mount(MSearchField, { props: { modelValue: '' }, attachTo: document.body })
    let reached = false
    const spy = () => (reached = true)
    document.addEventListener('keydown', spy)
    w.find('input').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    document.removeEventListener('keydown', spy)
    expect(reached).toBe(true)
    expect(w.emitted('clear')).toBeUndefined()
    w.unmount()
  })

  it('puts class and style on the pill, other attributes on the input', () => {
    const w = mount(MSearchField, { attrs: { class: 'bg-surface-container-highest', name: 'q', 'aria-describedby': 'hint' } })
    expect(w.classes()).toContain('bg-surface-container-highest')
    expect(w.classes()).toContain('m3-search-field-lg')
    const input = w.find('input')
    expect(input.attributes('name')).toBe('q')
    expect(input.attributes('aria-describedby')).toBe('hint')
    expect(w.attributes('name')).toBeUndefined()
  })

  it('defaults the placeholder and accessible name to the locale', () => {
    const input = mount(MSearchField).find('input')
    expect(input.attributes('placeholder')).toBe('Search...')
    expect(input.attributes('aria-label')).toBe('Search...')
  })

  it('spaces a slotted leading button like M3 (8px in), and keeps 16px with the default icon', () => {
    expect(mount(MSearchField).classes()).not.toContain('m3-search-field-slotted')
    const w = mount(MSearchField, { slots: { leading: '<button class="menu">m</button>' } })
    expect(w.classes()).toContain('m3-search-field-slotted')
    expect(w.find('.menu').element.parentElement!.className).toContain('-me-2')
  })
})
