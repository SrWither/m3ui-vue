import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MChip from '../components/MChip.vue'

const chip = (props: Record<string, unknown>, slots: Record<string, string> = {}) =>
  mount(MChip, { props, slots: { default: 'Label', ...slots } })

describe('MChip', () => {
  it('keeps the generic tone chip without a type', () => {
    const w = chip({ tone: 'primary' })
    expect(w.element.tagName).toBe('SPAN')
    expect(w.classes()).toContain('bg-primary-container')
    expect(w.find('button').exists()).toBe(false)
  })

  it('labels the generic remove button from the locale', () => {
    expect(chip({ removable: true }).find('button').attributes('aria-label')).toBe('Remove')
  })

  it('draws an outlined assist chip with a primary icon and 8px corners', () => {
    const w = chip({ type: 'assist', icon: 'event' })
    expect(w.classes()).toEqual(expect.arrayContaining(['border', 'border-outline-variant', 'text-on-surface', 'rounded-sm']))
    expect(w.find('.material-symbols-outlined').classes()).toContain('text-primary')
    expect(w.find('button').classes()).toContain('pl-2')
  })

  it('draws an elevated suggestion chip without an outline', () => {
    const w = chip({ type: 'suggestion', elevated: true })
    expect(w.classes()).toEqual(expect.arrayContaining(['bg-surface-container-low', 'shadow-elevation-1', 'text-on-surface-variant']))
    expect(w.classes()).not.toContain('border')
    expect(w.find('button').classes()).toEqual(expect.arrayContaining(['pl-4', 'pr-4']))
  })

  it('toggles a filter chip with v-model:selected, filling it and morphing to a pill', async () => {
    const w = chip({ type: 'filter', selected: false })
    await w.find('button').trigger('click')
    expect(w.emitted('update:selected')).toEqual([[true]])
    expect(w.emitted('click')).toHaveLength(1)
    await w.setProps({ selected: true })
    expect(w.classes()).toContain('bg-secondary-container')
    expect(w.find('button').attributes('aria-pressed')).toBe('true')
    expect(w.find('[aria-hidden="true"]').text()).toBe('check')
  })

  it('makes an input chip with an avatar and a separate remove button', async () => {
    const w = chip({ type: 'input', removable: true }, { avatar: '<img alt="" src="a.png">' })
    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.find('img').exists()).toBe(true)
    expect(buttons[0]!.classes()).toEqual(expect.arrayContaining(['pl-1', 'pr-2']))
    await buttons[1]!.trigger('click')
    expect(w.emitted('remove')).toHaveLength(1)
    expect(w.emitted('click')).toBeUndefined()
  })

  it('disables a typed chip', async () => {
    const w = chip({ type: 'filter', disabled: true })
    expect(w.find('button').attributes('disabled')).toBeDefined()
    expect(w.classes()).toContain('text-on-surface/38')
    await nextTick()
  })
})
