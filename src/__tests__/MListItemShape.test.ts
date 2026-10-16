import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h } from 'vue'
import MList from '../components/MList.vue'
import MListItem from '../components/MListItem.vue'
import MListSubheader from '../components/MListSubheader.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

// Springs run on rAF; give them time to settle
const settle = () => new Promise((r) => setTimeout(r, 600))
const radius = (el: Element) => (el as HTMLElement).style.borderRadius

describe('MListItem shape morph', () => {
  it('rests at 4px and grows on hover and press when clickable', async () => {
    wrapper = mount(MListItem, { props: { title: 'A', clickable: true }, attachTo: document.body })
    const row = wrapper.element
    await settle()
    expect(radius(row)).toBe('4px')
    row.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await settle()
    expect(radius(row)).toBe('8px')
    row.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerType: 'mouse' }))
    await settle()
    expect(radius(row)).toBe('16px')
  })

  it('ignores hover when not interactive, but morphs when selected', async () => {
    wrapper = mount(MListItem, { props: { title: 'A' }, attachTo: document.body })
    wrapper.element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await settle()
    expect(radius(wrapper.element)).toBe('4px')
    await wrapper.setProps({ active: true })
    await settle()
    expect(radius(wrapper.element)).toBe('16px')
  })

  it('rounds the outer corners of each segmented run', async () => {
    wrapper = mount(MList, {
      props: { segmented: true },
      slots: {
        default: () => [
          h(MListItem, { title: 'A' }),
          h(MListItem, { title: 'B' }),
          h(MListItem, { title: 'C' }),
          h(MListSubheader, { title: 'More' }),
          h(MListItem, { title: 'D' }),
        ],
      },
      attachTo: document.body,
    })
    await settle()
    const rows = wrapper.findAll('[role="listitem"]').map((w) => w.element)
    expect(rows.map(radius)).toEqual([
      '16px 16px 4px 4px',
      '4px',
      '4px 4px 16px 16px',
      '16px',
    ])
  })

  it('keeps the pill in nav lists', async () => {
    wrapper = mount(MList, {
      props: { nav: true },
      slots: { default: () => h(MListItem, { title: 'A', clickable: true }) },
      attachTo: document.body,
    })
    await settle()
    expect(radius(wrapper.find('[role="listitem"]').element)).toBe('')
  })
})
