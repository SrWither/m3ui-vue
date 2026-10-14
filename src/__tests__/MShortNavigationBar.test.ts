import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MShortNavigationBar from '../components/MShortNavigationBar.vue'

const items = [
  { value: 'home', label: 'Home', icon: 'home' },
  { value: 'off', label: 'Off', icon: 'block', disabled: true },
]

describe('MShortNavigationBar', () => {
  it.each(['top', 'start'] as const)('disabled items look disabled and never select (iconPosition %s)', async (iconPosition) => {
    const w = mount(MShortNavigationBar, { props: { modelValue: 'home', items, iconPosition } })
    const [home, off] = w.findAll('button')
    expect(off!.attributes('disabled')).toBeDefined()
    expect(off!.classes()).toContain('cursor-not-allowed')
    expect(off!.html()).toContain('text-on-surface-variant/38')
    expect(off!.html()).not.toContain('group-hover:')
    expect(home!.html()).not.toContain('/38')

    // Even if the click reaches it (e.g. the disabled attribute is stripped), nothing is emitted.
    off!.element.removeAttribute('disabled')
    await off!.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
