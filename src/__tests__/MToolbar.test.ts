import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MToolbar from '../components/MToolbar.vue'
import MFab from '../components/MFab.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

// happy-dom has no layout: give the unclipped content natural widths
function sizes(w: VueWrapper, widths: Record<string, number>) {
  for (const [selector, width] of Object.entries(widths)) {
    const el = w.find(selector).element
    Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => width })
  }
}
const reduceMotion = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList)
const button = (text: string) => () => h('button', text)

describe('MToolbar', () => {
  it('collapses a floating toolbar without a FAB to its center, closing #leading and #trailing', async () => {
    reduceMotion()
    wrapper = mount(MToolbar, {
      props: { variant: 'floating' },
      slots: { leading: button('back'), default: button('add'), trailing: button('more') },
    })
    const [lead, , trail] = wrapper.findAll('.overflow-hidden, .gap-1.flex-row:not(.shrink-0)').map((x) => x.element as HTMLElement)
    expect(wrapper.text()).toBe('backaddmore')
    expect(lead!.style.width).toBe('')
    await wrapper.setProps({ expanded: false })
    expect(lead!.style.width).toBe('0px')
    expect(trail!.style.width).toBe('0px')
    expect(lead!.hasAttribute('inert')).toBe(true)
    expect(trail!.hasAttribute('inert')).toBe(true)
    // The center stays reachable
    expect(wrapper.findAll('button').filter((b) => !b.element.closest('[inert]')).map((b) => b.text())).toEqual(['add'])
    await wrapper.setProps({ expanded: true })
    expect(lead!.style.width).toBe('')
    expect(lead!.hasAttribute('inert')).toBe(false)
  })

  it('collapses into its FAB, keeping its footprint, while the FAB grows from 56 to 80px', async () => {
    reduceMotion()
    wrapper = mount(MToolbar, {
      props: { variant: 'floating', fabPosition: 'end' },
      slots: { default: button('add'), fab: () => h(MFab, { icon: 'edit', label: 'Edit' }) },
    })
    sizes(wrapper, { '.w-max': 200 })
    const fabBox = wrapper.find('.absolute').element as HTMLElement
    const body = wrapper.find('.rounded-full.overflow-hidden').element as HTMLElement
    const region = body.parentElement!
    expect(fabBox.style.width).toBe('56px')
    await wrapper.setProps({ expanded: false })
    expect(body.style.width).toBe('0px')
    expect(region.style.width).toBe('200px')
    expect(fabBox.style.width).toBe('80px')
    expect(fabBox.style.height).toBe('80px')
    expect(body.hasAttribute('inert')).toBe(true)
    // The toolbar sizes the FAB, square even with a label (which names it), in the standard toolbar FAB's color
    const fab = wrapper.findComponent(MFab).find('button')
    expect(fab.classes()).toContain('w-full')
    expect(fab.attributes('aria-label')).toBe('Edit')
    expect(fab.text()).toBe('edit')
    expect(fab.classes()).toContain('bg-primary-container')
    await wrapper.setProps({ expanded: true })
    expect(body.style.width).toBe('')
    expect(region.style.width).toBe('')
    expect(fabBox.style.width).toBe('56px')
  })

  it('gives the FAB of a colored toolbar the vibrant FAB color', () => {
    wrapper = mount(MToolbar, {
      props: { variant: 'floating', fabPosition: 'end', color: 'primary' },
      slots: { default: button('add'), fab: () => h(MFab, { icon: 'edit', label: 'Edit' }) },
    })
    expect(wrapper.findComponent(MFab).find('button').classes()).toContain('bg-tertiary-container')
  })

  it('springs closed and settles', async () => {
    wrapper = mount(MToolbar, {
      props: { variant: 'floating' },
      slots: { leading: button('back'), default: button('add') },
    })
    sizes(wrapper, { '.pe-1': 96 })
    const lead = wrapper.find('.overflow-hidden').element as HTMLElement
    await wrapper.setProps({ expanded: false })
    await new Promise((r) => setTimeout(r, 120))
    const mid = parseFloat(lead.style.width)
    expect(mid).toBeGreaterThan(-1)
    expect(mid).toBeLessThan(96)
    await new Promise((r) => setTimeout(r, 900))
    expect(lead.style.width).toBe('0px')
  })

  it('starts collapsed when rendered with expanded false', () => {
    wrapper = mount(MToolbar, {
      props: { variant: 'floating', expanded: false },
      slots: { leading: button('back'), default: button('add') },
    })
    expect((wrapper.find('.overflow-hidden').element as HTMLElement).style.width).toBe('0px')
  })

  it('collapses on scroll down and expands on scroll up, 40px each way, when asked', async () => {
    reduceMotion()
    const list = document.createElement('div')
    document.body.appendChild(list)
    wrapper = mount(MToolbar, {
      props: { variant: 'floating', collapseOnScroll: list, 'onUpdate:expanded': (v: boolean) => wrapper!.setProps({ expanded: v }) },
      slots: { leading: button('back'), default: button('add') },
    })
    const scrollTo = async (top: number) => {
      list.scrollTop = top
      list.dispatchEvent(new Event('scroll'))
      await nextTick()
    }
    await scrollTo(30)
    expect(wrapper.props('expanded')).toBe(true)
    await scrollTo(50)
    expect(wrapper.props('expanded')).toBe(false)
    // Back up less than 40px: stays collapsed
    await scrollTo(20)
    expect(wrapper.props('expanded')).toBe(false)
    await scrollTo(5)
    expect(wrapper.props('expanded')).toBe(true)
    expect(wrapper.emitted('update:expanded')).toEqual([[false], [true]])
    list.remove()
  })

  it('does not collapse on scroll unless asked', async () => {
    wrapper = mount(MToolbar, { props: { variant: 'floating' }, slots: { leading: button('back'), default: button('add') } })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 300 })
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.emitted('update:expanded')).toBeUndefined()
  })

  it('never collapses a docked toolbar', async () => {
    reduceMotion()
    wrapper = mount(MToolbar, {
      props: { variant: 'docked', expanded: false },
      slots: { leading: button('back'), default: button('add'), trailing: button('more') },
    })
    const lead = wrapper.find('.overflow-hidden').element as HTMLElement
    expect(lead.style.width).toBe('')
    expect(lead.hasAttribute('inert')).toBe(false)
  })

  it('renders the items directly in the body without #leading or #trailing, as before', () => {
    wrapper = mount(MToolbar, { slots: { default: () => [h('button', 'a'), h('button', 'b')] } })
    expect(wrapper.find('.h-16').element.children).toHaveLength(2)
  })
})
