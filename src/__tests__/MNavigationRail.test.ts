import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MNavigationRail from '../components/MNavigationRail.vue'

const items = [
  { value: 'inbox', label: 'Inbox', icon: 'inbox' },
  { value: 'sent', label: 'Sent', icon: 'send' },
]

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function open(props: Record<string, unknown> = {}) {
  wrapper = mount(MNavigationRail, {
    props: { modelValue: 'inbox', items, modal: true, hideOnCollapse: true, expanded: true, ...props },
    attachTo: document.body,
    global: { stubs: { transition: false } },
  })
  const panel = document.body.querySelector<HTMLElement>('.wnr-panel')!
  // The slide-in is a Web Animation, and happy-dom's timeline doesn't advance on its own
  panel?.getAnimations().forEach((a) => a.finish())
  return panel
}

// Moves 25px per step, `msPerStep` apart (the events' timeStamp is what the fling velocity is measured from)
function swipe(panel: HTMLElement, from: number, to: number, msPerStep = 100) {
  let t = 1000
  const send = (type: string, x: number) => {
    const e = new PointerEvent(type, { pointerId: 1, button: 0, bubbles: true, clientY: 300, clientX: x })
    Object.defineProperty(e, 'timeStamp', { value: t })
    panel.dispatchEvent(e)
  }
  send('pointerdown', from)
  for (let x = from; x >= to; x -= 25) {
    t += msPerStep
    send('pointermove', x)
  }
  send('pointerup', to)
}

describe('MNavigationRail', () => {
  it('shows no collapsed rail with hideOnCollapse, only the modal panel', () => {
    const panel = open()
    expect(panel).not.toBeNull()
    expect(wrapper!.find('nav').exists()).toBe(false)
  })

  it('slides the hideOnCollapse panel in as a Web Animation, the open state inline underneath', async () => {
    wrapper = mount(MNavigationRail, {
      props: { modelValue: 'inbox', items, modal: true, hideOnCollapse: true, expanded: false },
      attachTo: document.body,
      global: { stubs: { transition: false } },
    })
    await wrapper.setProps({ expanded: true })
    const panel = document.body.querySelector<HTMLElement>('.wnr-panel')!
    const [slide] = panel.getAnimations()
    expect((slide!.effect as KeyframeEffect).getKeyframes()[0]!.transform).toBe('translateX(-100%)')
    expect(panel.style.transform).toBe('translateX(0%)')
  })

  it('keeps the collapsed rail on screen in the default modal', () => {
    open({ hideOnCollapse: false })
    expect(wrapper!.find('nav').exists()).toBe(true)
  })

  it('closes when slowly swiped past half its width, and springs back from a short swipe', () => {
    const panel = open()
    swipe(panel, 200, 150, 400)
    expect(wrapper!.emitted('update:expanded')).toBeUndefined()
    swipe(panel, 200, 50, 400)
    expect(wrapper!.emitted('update:expanded')).toEqual([[false]])
  })

  it('closes on a quick flick even when it moved less than half', () => {
    const panel = open()
    swipe(panel, 200, 150, 16)
    expect(wrapper!.emitted('update:expanded')).toEqual([[false]])
  })

  it('ignores a vertical drag (the items scroll)', () => {
    const panel = open()
    const opts = { pointerId: 1, button: 0, bubbles: true, clientX: 200 }
    panel.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientY: 300 }))
    panel.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 190, clientY: 200 }))
    panel.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 40, clientY: 200 }))
    panel.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 40, clientY: 200 }))
    expect(wrapper!.emitted('update:expanded')).toBeUndefined()
  })

  describe('expanded width', () => {
    // happy-dom has no layout: give each label a natural width
    const labelWidths = (w: VueWrapper, widths: number[]) =>
      w.findAll('[data-rail-label]').forEach((l, i) => Object.defineProperty(l.element, 'scrollWidth', { configurable: true, get: () => widths[i] ?? 0 }))
    const mountInline = (labels: string[]) =>
      mount(MNavigationRail, { props: { modelValue: 'a', items: labels.map((label, i) => ({ value: String.fromCharCode(97 + i), label, icon: 'home' })) }, attachTo: document.body })

    it('fits the longest label between 220 and 360px, like Compose\'s WideNavigationRail', async () => {
      wrapper = mountInline(['Home', 'Notifications and alerts'])
      labelWidths(wrapper, [38, 180])
      // Labels change: remeasured
      await wrapper.setProps({ items: [{ value: 'a', label: 'Home', icon: 'home' }, { value: 'b', label: 'Notifications and alerts!', icon: 'notifications' }] })
      labelWidths(wrapper, [38, 180])
      await wrapper.setProps({ items: [{ value: 'a', label: 'Home', icon: 'home' }, { value: 'b', label: 'Notifications and alerts', icon: 'notifications' }] })
      await new Promise((r) => setTimeout(r))
      await wrapper.setProps({ expanded: true })
      expect((wrapper.find('nav').element as HTMLElement).style.width).toBe(`${180 + 88}px`)
    })

    it('never goes under 220px nor over 360px', async () => {
      wrapper = mountInline(['Home'])
      labelWidths(wrapper, [38])
      await wrapper.setProps({ items: [{ value: 'a', label: 'Home!', icon: 'home' }] })
      await new Promise((r) => setTimeout(r))
      await wrapper.setProps({ expanded: true })
      expect((wrapper.find('nav').element as HTMLElement).style.width).toBe('220px')
      labelWidths(wrapper, [900])
      await wrapper.setProps({ items: [{ value: 'a', label: 'A very long label', icon: 'home' }] })
      await new Promise((r) => setTimeout(r))
      expect((wrapper.find('nav').element as HTMLElement).style.width).toBe('360px')
    })
  })
})
