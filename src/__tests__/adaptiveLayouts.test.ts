import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { widthSizeClass, heightSizeClass } from '../composables/useWindowSizeClass'
import MNavigationSuite from '../components/MNavigationSuite.vue'
import MListDetail from '../components/MListDetail.vue'
import MSupportingPane from '../components/MSupportingPane.vue'

// happy-dom has no layout: every element reports the size below, and resizing fires the
// mocked ResizeObserver callbacks the way the browser would.
let size = { w: 1000, h: 800 }
const observers = new Set<() => void>()
class FakeResizeObserver {
  constructor(private cb: () => void) {}
  observe() { observers.add(this.cb) }
  disconnect() { observers.delete(this.cb) }
}
async function resize(w: number, h = 800) {
  size = { w, h }
  observers.forEach((cb) => cb())
  await nextTick()
}

beforeEach(() => {
  size = { w: 1000, h: 800 }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => size.w)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => size.h)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  observers.clear()
})

describe('window size classes', () => {
  it('uses the androidx WindowSizeClass breakpoints', () => {
    expect([599, 600, 839, 840, 1199, 1200, 1599, 1600].map(widthSizeClass)).toEqual([
      'compact', 'medium', 'medium', 'expanded', 'expanded', 'large', 'large', 'extra-large',
    ])
    expect([479, 480, 899, 900].map(heightSizeClass)).toEqual(['compact', 'medium', 'medium', 'expanded'])
  })
})

const navItems = [
  { value: 'home', label: 'Home', icon: 'home' },
  { value: 'search', label: 'Search', icon: 'search' },
]

describe('MNavigationSuite', () => {
  const setup = (props = {}) =>
    mount(MNavigationSuite, {
      props: { modelValue: 'home', items: navItems, ...props },
      slots: { default: `<template #default="{ layout }"><p class="content">{{ layout }}</p></template>` },
      attachTo: document.body,
    })

  it('picks bar, landscape bar or rail from its own size, keeping the content element', async () => {
    const w = setup()
    await nextTick()
    expect(w.find('.content').text()).toBe('rail')
    expect(w.findComponent({ name: 'MNavigationRail' }).exists()).toBe(true)
    const content = w.find('.content').element

    await resize(400)
    expect(w.find('.content').text()).toBe('bar')
    expect(w.findComponent({ name: 'MNavigationRail' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'MShortNavigationBar' }).props()).toMatchObject({ arrangement: 'equal', iconPosition: 'top' })

    await resize(800, 400)
    expect(w.find('.content').text()).toBe('bar-medium')
    expect(w.findComponent({ name: 'MShortNavigationBar' }).props()).toMatchObject({ arrangement: 'centered', iconPosition: 'start' })
    expect(w.find('.content').element).toBe(content)
    w.unmount()
  })

  it('layout forces a navigation and selection goes through v-model', async () => {
    const w = setup({ layout: 'rail-expanded' })
    await resize(400)
    expect(w.findComponent({ name: 'MNavigationRail' }).props('expanded')).toBe(true)
    w.findComponent({ name: 'MNavigationRail' }).vm.$emit('update:modelValue', 'search')
    expect(w.emitted('update:modelValue')![0]).toEqual(['search'])
    w.unmount()
  })
})

describe('MListDetail', () => {
  const setup = (props = {}) =>
    mount(MListDetail, {
      props: { ...props },
      slots: {
        list: `<template #list="{ twoPane }"><p class="list">{{ twoPane }}</p></template>`,
        detail: `<template #detail="{ back }"><button class="back" @click="back">back</button></template>`,
      },
      attachTo: document.body,
    })
  const panes = (w: ReturnType<typeof setup>) => w.element.children as HTMLCollectionOf<HTMLElement>

  it('shows both panes from 840px, with the list at 360px (412px from 1200px)', async () => {
    const w = setup()
    await nextTick()
    expect(w.find('.list').text()).toBe('true')
    expect(panes(w)[0]!.style.width).toBe('360px')
    expect(panes(w)[1]!.hasAttribute('inert')).toBe(false)
    await resize(1300)
    expect(panes(w)[0]!.style.width).toBe('412px')
    w.unmount()
  })

  it('one pane: shows the list or the detail, and back() returns to the list', async () => {
    const w = setup()
    await resize(700)
    expect(w.find('.list').text()).toBe('false')
    expect(panes(w)[1]!.hasAttribute('inert')).toBe(true)
    expect(panes(w)[0]!.hasAttribute('inert')).toBe(false)

    await w.setProps({ showDetail: true })
    expect(panes(w)[0]!.hasAttribute('inert')).toBe(true)
    expect(panes(w)[1]!.hasAttribute('inert')).toBe(false)
    await w.find('.back').trigger('click')
    expect(w.emitted('update:showDetail')![0]).toEqual([false])
    w.unmount()
  })
})

describe('MSupportingPane', () => {
  const setup = (props = {}) =>
    mount(MSupportingPane, {
      props: { ...props },
      slots: { main: '<p class="main">main</p>', supporting: '<p class="sup">sup</p>' },
      attachTo: document.body,
    })

  it('puts the supporting pane beside, then below the main one', async () => {
    const w = setup()
    await nextTick()
    expect(w.classes()).not.toContain('flex-col')
    expect((w.element.children[1] as HTMLElement).style.width).toBe('360px')
    await resize(500)
    expect(w.classes()).toContain('flex-col')
    expect(w.find('.sup').exists()).toBe(true)
    w.unmount()
  })

  it("singlePane='sheet' moves it into a bottom sheet and closes it once it fits again", async () => {
    const w = setup({ singlePane: 'sheet', open: true, 'onUpdate:open': (v: boolean) => w.setProps({ open: v }) })
    await resize(500)
    const sheet = w.findComponent({ name: 'MBottomSheet' })
    expect(sheet.exists()).toBe(true)
    expect(sheet.props('modelValue')).toBe(true)
    await resize(1000)
    expect(w.emitted('update:open')![0]).toEqual([false])
    expect(w.findComponent({ name: 'MBottomSheet' }).exists()).toBe(false)
    expect(w.find('.sup').exists()).toBe(true)
    w.unmount()
  })
})

describe('navigation items with `to`', () => {
  const linkItems = [
    { value: 'home', label: 'Home', icon: 'home', to: '/home' },
    { value: 'search', label: 'Search', icon: 'search' },
    { value: 'off', label: 'Off', icon: 'block', to: '/off', disabled: true },
  ]

  it('render as plain links without vue-router, buttons otherwise, and still update v-model', async () => {
    for (const [layout, name] of [['rail', 'MNavigationRail'], ['bar', 'MShortNavigationBar']] as const) {
      const w = mount(MNavigationSuite, { props: { modelValue: 'search', items: linkItems, layout } })
      const nav = w.findComponent({ name })
      const els = nav.findAll('nav a, nav button').filter((e) => e.text().match(/Home|Search|Off/))
      expect(els.map((e) => e.element.tagName)).toEqual(['A', 'BUTTON', 'BUTTON'])
      expect(els[0]!.attributes('href')).toBe('/home')
      await els[0]!.trigger('click')
      expect(w.emitted('update:modelValue')![0]).toEqual(['home'])
      w.unmount()
    }
  })

  it('render as RouterLink when vue-router is installed', () => {
    const RouterLink = { name: 'RouterLink', props: ['to'], template: '<a class="rl" :href="String(to)"><slot /></a>' }
    const w = mount(MNavigationSuite, {
      props: { modelValue: 'home', items: linkItems, layout: 'rail' },
      global: { components: { RouterLink } },
    })
    const links = w.findAllComponents({ name: 'RouterLink' })
    expect(links).toHaveLength(1)
    expect(links[0]!.props('to')).toBe('/home')
    w.unmount()
  })
})

