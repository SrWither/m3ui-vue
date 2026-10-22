import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MRichTextEditor from '../components/MRichTextEditor.vue'

describe('MRichTextEditor fill', () => {
  it('grows with its content by default, from minHeight', () => {
    const w = mount(MRichTextEditor, { props: { modelValue: '', minHeight: '120px' } })
    const content = w.find('.rte-content')
    expect((content.element as HTMLElement).style.minHeight).toBe('120px')
    expect(content.classes()).not.toContain('overflow-y-auto')
    w.unmount()
  })

  it('fills its height and scrolls the text inside with fill', () => {
    const w = mount(MRichTextEditor, { props: { modelValue: '', fill: true } })
    expect(w.classes()).toContain('flex-col')
    const content = w.find('.rte-content')
    expect(content.classes()).toEqual(expect.arrayContaining(['flex-1', 'min-h-0', 'overflow-y-auto']))
    expect((content.element as HTMLElement).style.minHeight).toBe('')
    w.unmount()
  })
})
