import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MTopAppBar from '../components/MTopAppBar.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function bar(props: Record<string, unknown>) {
  wrapper = mount(MTopAppBar, { props: { title: 'Inbox', ...props }, attachTo: document.body })
  const bottomRow = () => wrapper!.find('.items-end').element as HTMLElement
  return { bar: wrapper.find('header').element as HTMLElement, bottomRow }
}

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

describe('MTopAppBar', () => {
  it.each([
    [{ variant: 'medium' }, '48px'],
    [{ variant: 'large' }, '88px'],
    [{ variant: 'medium', flexible: true }, '48px'],
    [{ variant: 'medium', flexible: true, subtitle: 'Work' }, '72px'],
    [{ variant: 'large', flexible: true }, '56px'],
    [{ variant: 'large', flexible: true, subtitle: 'Work' }, '88px'],
  ])('sizes the title row of %o from the app bar tokens', (props, height) => {
    expect(bar(props).bottomRow().style.height).toBe(height)
  })

  it('uses the flexible title and subtitle styles', () => {
    bar({ variant: 'large', flexible: true, subtitle: 'Work' })
    expect(wrapper!.find('h1').classes()).toContain('text-display-small')
    expect(wrapper!.find('.items-end p').classes()).toContain('text-title-medium')
  })

  it('shows a subtitle under a small title', () => {
    bar({ subtitle: '3 unread' })
    expect(wrapper!.find('p').text()).toBe('3 unread')
    expect(wrapper!.find('p').classes()).toContain('text-label-medium')
  })

  it('collapses a medium bar with the content and swaps the titles (exit-until-collapsed)', async () => {
    const s = scroller()
    const { bar: el, bottomRow } = bar({ variant: 'medium', scrollBehavior: 'exit-until-collapsed', scrollTarget: s.el })
    expect(wrapper!.find('header').classes()).toContain('sticky')
    s.to(30)
    expect(el.style.height).toBe('82px')
    // The bottom margin keeps the expanded 112px in the layout
    expect(el.style.marginBottom).toBe('30px')
    expect(bottomRow().style.height).toBe('18px')
    s.to(200)
    expect(el.style.height).toBe('64px')
    const [small, big] = wrapper!.findAll('.min-w-0').map((w) => w.element as HTMLElement)
    expect(small!.style.opacity).toBe('1')
    expect(big!.style.opacity).toBe('0')
    // Only back at the top does it expand again
    s.to(10)
    expect(el.style.height).toBe('102px')
  })

  it('hides a small bar while scrolling down and brings it back scrolling up (enter-always)', () => {
    const s = scroller()
    const { bar: el } = bar({ scrollBehavior: 'enter-always', scrollTarget: s.el })
    s.to(40)
    expect(el.style.height).toBe('24px')
    s.to(300)
    expect(el.style.height).toBe('0px')
    s.to(280)
    expect(el.style.height).toBe('20px')
  })

  it('keeps the navigation button a grandchild of the header (consumers select header > div > button)', () => {
    bar({ navigationIcon: 'menu' })
    expect(wrapper!.find('header > div > button').exists()).toBe(true)
  })

  it('takes the scrolled color when content moves under a pinned bar', async () => {
    const s = scroller()
    const { bar: el } = bar({ scrollBehavior: 'pinned', scrollTarget: s.el })
    expect(el.classList).toContain('bg-surface')
    s.to(5)
    await nextTick()
    expect(el.classList).toContain('bg-surface-container')
    expect(el.style.height).toBe('')
  })
})
