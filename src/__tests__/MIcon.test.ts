import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MIcon from '../components/MIcon.vue'

describe('MIcon', () => {
  // The glyph is a ligature: its text is the icon's name, which screen readers read aloud ("arrow_drop_down")
  it('is hidden from assistive technology by default', () => {
    const w = mount(MIcon, { props: { name: 'arrow_drop_down' } })
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.attributes('role')).toBeUndefined()
  })

  it('becomes a named image with label', () => {
    const w = mount(MIcon, { props: { name: 'trending_up', label: 'Up 4%' } })
    expect(w.attributes('role')).toBe('img')
    expect(w.attributes('aria-label')).toBe('Up 4%')
    expect(w.attributes('aria-hidden')).toBeUndefined()
  })
})
