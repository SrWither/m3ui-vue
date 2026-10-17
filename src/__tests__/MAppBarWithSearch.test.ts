import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MAppBarWithSearch from '../components/MAppBarWithSearch.vue'
import MSearchBar from '../components/MSearchBar.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

function scroller() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return {
    el,
    to(y: number) {
      el.scrollTop = y
      el.dispatchEvent(new Event('scroll'))
    },
  }
}

const pill = () => wrapper!.find('.rounded-full.h-14')

describe('MSearchBar fullscreen-contained', () => {
  it('expands full screen on surface-container-low, keeping the pill input and no divider', async () => {
    wrapper = mount(MSearchBar, { props: { variant: 'fullscreen-contained', expanded: true }, attachTo: document.body })
    await nextTick()
    const panel = document.body.querySelector('.fixed.inset-0')!
    expect(panel.classList).toContain('bg-surface-container-low')
    expect(panel.querySelector('.rounded-full.bg-surface-container-high')).not.toBeNull()
    expect(panel.querySelector('.h-px')).toBeNull()
  })

  it('keeps the plain fullscreen look', async () => {
    wrapper = mount(MSearchBar, { props: { variant: 'fullscreen', expanded: true }, attachTo: document.body })
    await nextTick()
    const panel = document.body.querySelector('.fixed.inset-0')!
    expect(panel.classList).toContain('bg-surface-container-high')
    expect(panel.querySelector('.h-px')).not.toBeNull()
  })
})

describe('MSearchBar elevation', () => {
  it('is flat standalone and docked, as Compose (ShadowElevation = Level0)', async () => {
    wrapper = mount(MSearchBar, { props: { variant: 'docked' }, attachTo: document.body })
    expect(pill().classes().some((c) => c.startsWith('shadow-'))).toBe(false)
    await wrapper.setProps({ expanded: true })
    await nextTick()
    const panel = document.body.querySelector('.fixed.rounded-\\[28px\\]')!
    expect(panel).not.toBeNull()
    expect([...panel.classList].some((c) => c.startsWith('shadow-'))).toBe(false)
  })
})

describe('MAppBarWithSearch', () => {
  it('lays out navigation, a flat search bar and actions', () => {
    wrapper = mount(MAppBarWithSearch, {
      props: { navigationIcon: 'menu' },
      slots: { actions: '<button class="act">A</button>' },
    })
    expect(wrapper.findAll('button')[0]!.attributes('aria-label')).toBe('Menu')
    expect(wrapper.find('.act').exists()).toBe(true)
    expect(pill().classes()).toContain('bg-surface-container-high')
    expect(pill().classes()).not.toContain('shadow-elevation-3')
  })

  it('takes the scrolled colors once content is under it', async () => {
    const s = scroller()
    wrapper = mount(MAppBarWithSearch, { props: { scrollBehavior: 'pinned', scrollTarget: s.el }, attachTo: document.body })
    s.to(10)
    await nextTick()
    expect(wrapper.find('header').classes()).toContain('bg-surface-container')
    expect(pill().classes()).toContain('bg-surface-container-highest')
  })

  it('stays transparent as a top search bar', async () => {
    const s = scroller()
    wrapper = mount(MAppBarWithSearch, { props: { transparent: true, scrollBehavior: 'pinned', scrollTarget: s.el }, attachTo: document.body })
    s.to(10)
    await nextTick()
    expect(wrapper.find('header').classes()).toContain('bg-transparent')
    expect(pill().classes()).toContain('bg-surface-container-high')
  })

  it('hides while scrolling down and returns scrolling up (enter-always)', () => {
    const s = scroller()
    wrapper = mount(MAppBarWithSearch, { props: { scrollBehavior: 'enter-always', scrollTarget: s.el }, attachTo: document.body })
    const header = wrapper.find('header').element as HTMLElement
    s.to(40)
    expect(header.style.height).toBe('24px')
    expect(header.style.marginBottom).toBe('40px')
    s.to(200)
    expect(header.style.height).toBe('0px')
    s.to(170)
    expect(header.style.height).toBe('30px')
  })

  it('passes the query through', async () => {
    wrapper = mount(MAppBarWithSearch, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('pizza')
    expect(wrapper.emitted('update:modelValue')).toEqual([['pizza']])
  })
})
