import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSegmentedButton from '../components/MSegmentedButton.vue'

describe('MSegmentedButton', () => {
  it('lets the segments share the width when the group is stretched (a flex column, w-full)', () => {
    const w = mount(MSegmentedButton, { props: { modelValue: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } })
    for (const b of w.findAll('button')) expect(b.classes()).toContain('grow')
  })
})
