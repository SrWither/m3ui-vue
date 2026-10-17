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
  return document.body.querySelector<HTMLElement>('.wnr-panel')!
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
})
