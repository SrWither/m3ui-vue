import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MDiffViewer from '../components/MDiffViewer.vue'
import MSegmentedButton from '../components/MSegmentedButton.vue'

let width = 1000
let wrapper: VueWrapper | undefined
beforeEach(() => {
  width = 1000
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return (this as HTMLElement).classList.contains('m3-diff') ? width : 0 } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n')
const after = before.replace('line 10', 'line ten').replace('line 20', 'line 20\nline 21')

describe('MDiffViewer', () => {
  it('counts changes and folds long unchanged stretches around them', async () => {
    wrapper = mount(MDiffViewer, { props: { original: before, modified: after, mode: 'unified', originalLabel: 'a.txt', modifiedLabel: 'b.txt' } })
    expect(wrapper.text()).toContain('a.txt')
    expect(wrapper.text()).toContain('+2')
    expect(wrapper.text()).toContain('−1')
    // Lines 1–6 fold (3 kept before line 10), 14–16 fold too (3 after, 3 before line 21's add)
    const folds = wrapper.findAll('button').filter((b) => b.text().includes('unchanged'))
    expect(folds.map((b) => b.text())).toEqual(['⋯ Show 6 unchanged lines', '⋯ Show 4 unchanged lines'])
    await folds[0]!.trigger('click')
    expect(wrapper.findAll('button').filter((b) => b.text().includes('unchanged'))).toHaveLength(1)
    expect(wrapper.text()).toContain('line 1')
  })

  it('highlights the changed words inside a changed line', () => {
    wrapper = mount(MDiffViewer, { props: { original: 'const total = price * qty', modified: 'const total = price * quantity', mode: 'unified' } })
    const marks = wrapper.findAll('span.rounded-xs')
    expect(marks.map((m) => m.text())).toEqual(['qty', 'quantity'])
    expect(marks[0]!.classes()).toContain('bg-error-container')
    expect(marks[1]!.classes()).toContain('bg-success-container')
  })

  it('shows removed and added lines facing each other side by side', () => {
    wrapper = mount(MDiffViewer, { props: { original: 'a\nb\nc', modified: 'a\nB\nc\nd', context: -1 } })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    const cells = (i: number) => rows[i]!.findAll('td').map((c) => c.text())
    expect(cells(1)).toEqual(['2', 'b', '2', 'B'])
    expect(cells(3)).toEqual(['', '', '4', 'd'])
  })

  it('switches view from its toggle, and goes unified when narrow', async () => {
    wrapper = mount(MDiffViewer, { props: { original: 'a', modified: 'b' } })
    await new Promise((r) => setTimeout(r))
    wrapper.findComponent(MSegmentedButton).vm.$emit('update:modelValue', 'unified')
    expect(wrapper.emitted('update:mode')![0]).toEqual(['unified'])
    wrapper.unmount()
    width = 400
    wrapper = mount(MDiffViewer, { props: { original: 'a', modified: 'b' } })
    await new Promise((r) => setTimeout(r))
    expect(wrapper.findComponent(MSegmentedButton).exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('says when nothing changed', () => {
    wrapper = mount(MDiffViewer, { props: { original: 'same', modified: 'same' } })
    expect(wrapper.text()).toContain('No changes')
  })
})
