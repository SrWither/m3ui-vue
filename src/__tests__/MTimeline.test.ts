import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import MTimeline from '../components/MTimeline.vue'

const items = [
  { title: 'Ordered', date: 'Mon', color: 'secondary' as const },
  { title: 'Shipped', date: 'Tue', color: 'tertiary' as const, description: 'On its way' },
  { title: 'Delivered', date: 'Wed', color: 'success' as const },
]

describe('MTimeline', () => {
  it('is an ordered list of entries', () => {
    const w = mount(MTimeline, { props: { items } })
    expect(w.element.tagName).toBe('OL')
    expect(w.findAll('li')).toHaveLength(3)
  })

  it('draws each line in its entry color as a literal class (secondary, tertiary… were invisible)', () => {
    const html = mount(MTimeline, { props: { items } }).html()
    expect(html).toContain('bg-secondary/30')
    expect(html).toContain('bg-tertiary/30')
    expect(html).not.toContain('bg-success/30') // the last entry has no line
  })

  it('#item gets each entry, and item-{index} still wins for its own entry', () => {
    const w = mount(MTimeline, {
      props: { items },
      slots: {
        item: ({ item, index }: any) => h('i', { class: 'generic' }, `${index}:${item.title}`),
        'item-1': () => h('b', { class: 'specific' }, 'only shipped'),
      },
    })
    expect(w.findAll('.generic').map((e) => e.text())).toEqual(['0:Ordered', '2:Delivered'])
    expect(w.find('li:nth-child(2) .specific').exists()).toBe(true)
  })

  it('#title, #dot and #opposite replace or add their parts', () => {
    const w = mount(MTimeline, {
      props: { items },
      slots: {
        title: ({ item }: any) => h('h4', item.title.toUpperCase()),
        dot: () => h('span', { class: 'my-dot' }),
        opposite: ({ item }: any) => h('time', item.date),
      },
    })
    expect(w.findAll('h4').map((e) => e.text())).toEqual(['ORDERED', 'SHIPPED', 'DELIVERED'])
    expect(w.findAll('.my-dot')).toHaveLength(3)
    expect(w.findAll('time').map((e) => e.text())).toEqual(['Mon', 'Tue', 'Wed'])
  })

  it('bare leaves the content to #item', () => {
    const w = mount(MTimeline, { props: { items, bare: true }, slots: { item: ({ item }: any) => h('div', { class: 'card' }, item.title) } })
    expect(w.findAll('.card')).toHaveLength(3)
    expect(w.text()).not.toContain('On its way')
  })

  it('alternating takes the slots too, with #opposite on the empty side', () => {
    const w = mount(MTimeline, {
      props: { items, alternating: true },
      slots: { item: () => h('i', { class: 'extra' }), opposite: ({ item }: any) => h('time', item.date) },
    })
    expect(w.findAll('.extra')).toHaveLength(3)
    expect(w.findAll('time')).toHaveLength(3)
  })

  it('lays entries side by side when horizontal', () => {
    const w = mount(MTimeline, { props: { items, orientation: 'horizontal' } })
    expect(w.classes()).toContain('overflow-x-auto')
    expect(w.findAll('li')).toHaveLength(3)
    expect(w.html()).toContain('bg-tertiary/30')
  })

  it('keys entries by their key when given', async () => {
    const w = mount(MTimeline, { props: { items: [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }] } })
    const second = w.findAll('li')[1]!.element
    await w.setProps({ items: [{ key: 'z', title: 'Z' }, { key: 'a', title: 'A' }, { key: 'b', title: 'B' }] })
    expect(w.findAll('li')[2]!.element).toBe(second)
  })
})
