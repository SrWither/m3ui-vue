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

  describe('progress', () => {
    const steps = [
      { title: 'Ordered', icon: 'receipt' },
      { title: 'Preparing', icon: 'skillet' },
      { title: 'On the way', icon: 'two_wheeler' },
      { title: 'Delivered', icon: 'home' },
    ]
    const parts = (layout: Record<string, unknown> = {}) => {
      const w = mount(MTimeline, { props: { items: steps, current: 1, ...layout } })
      const lis = w.findAll('li')
      return {
        lis,
        dot: (i: number) => lis[i]!.find('.rounded-full'),
        line: (i: number) => lis[i]!.findAll('span').filter((s) => s.classes().includes('flex-1')).at(-1)!,
      }
    }

    it('fills done steps with a solid line, pulses the current one, outlines the rest', () => {
      const { lis, dot, line } = parts()
      expect(dot(0).classes()).toContain('bg-primary')
      expect(line(0).classes()).toContain('bg-primary')
      expect(line(0).classes()).not.toContain('bg-primary/30')
      expect(lis[1]!.attributes('aria-current')).toBe('step')
      expect(lis[1]!.find('.motion-safe\\:animate-ping').exists()).toBe(true)
      expect(line(1).classes()).toContain('border-dashed')
      expect(dot(2).classes()).toContain('border-outline-variant')
      expect(dot(2).classes()).not.toContain('bg-primary')
      expect(lis[2]!.find('p').classes()).toContain('text-on-surface-variant')
      expect(lis[0]!.attributes('aria-current')).toBeUndefined()
    })

    it('lets an item\'s status win, and works in every layout', () => {
      const w = mount(MTimeline, { props: { items: [steps[0]!, { ...steps[1]!, status: 'pending' as const }], current: 2 } })
      expect(w.findAll('li')[1]!.find('.rounded-full').classes()).toContain('border-outline-variant')
      for (const layout of [{ alternating: true }, { orientation: 'horizontal' }]) {
        const { lis, line } = parts(layout)
        expect(lis[1]!.attributes('aria-current')).toBe('step')
        expect(line(1).classes()).toContain('border-dashed')
      }
    })

    it('keeps the plain look without current or status', () => {
      const html = mount(MTimeline, { props: { items: steps } }).html()
      expect(html).not.toContain('border-dashed')
      expect(html).not.toContain('aria-current')
      expect(html).toContain('bg-primary/30')
    })
  })

  it('folds the alternating layout into a column on a narrow container, unless responsive is off', () => {
    const w = mount(MTimeline, { props: { items, alternating: true } })
    expect(w.classes()).toContain('@container')
    const li = w.findAll('li')[1]!
    // Narrow: a grid, line first; from @lg on, the row alternates as before
    expect(li.classes()).toEqual(expect.arrayContaining(['grid', '@lg:flex', '@lg:flex-row-reverse']))
    const [content, , opposite] = li.element.children
    expect(content!.className).toContain('col-start-2 row-start-1')
    expect(opposite!.className).toContain('row-start-2')

    const fixed = mount(MTimeline, { props: { items, alternating: true, responsive: false } })
    expect(fixed.classes()).not.toContain('@container')
    expect(fixed.findAll('li')[1]!.classes()).toEqual(expect.arrayContaining(['flex', 'flex-row-reverse']))
  })

  describe('groups', () => {
    const days = [
      { title: 'Coffee', group: 'Today' },
      { title: 'Gym', group: 'Today' },
      { title: 'Dinner', group: 'Yesterday' },
      { title: 'Cinema', group: 'Yesterday' },
    ]
    const lineOf = (li: ReturnType<ReturnType<typeof mount>['find']>) =>
      li.findAll('span').filter((s) => s.classes().includes('flex-1') && !s.classes().includes('min-w-0'))

    it('puts a header before each run, and ends the line with it', () => {
      const w = mount(MTimeline, { props: { items: days } })
      const lis = w.findAll('li')
      expect(lis.map((l) => l.text())).toEqual(['Today', 'Coffee', 'Gym', 'Yesterday', 'Dinner', 'Cinema'])
      expect(lineOf(lis[1]!)).toHaveLength(1) // Coffee → Gym
      expect(lineOf(lis[2]!)).toHaveLength(0) // Gym ends Today
      expect(lineOf(lis[4]!)).toHaveLength(1)
    })

    it('takes a #group slot with the run, in the alternating and horizontal layouts too', () => {
      for (const layout of [{}, { alternating: true }, { orientation: 'horizontal' }]) {
        const w = mount(MTimeline, {
          props: { items: days, ...layout },
          slots: { group: ({ group, items }: { group: string, items: unknown[] }) => h('b', `${group} (${items.length})`) },
        })
        expect(w.findAll('b').map((b) => b.text())).toEqual(['Today (2)', 'Yesterday (2)'])
      }
    })
  })
})
