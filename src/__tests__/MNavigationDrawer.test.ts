import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MNavigationDrawer from '../components/MNavigationDrawer.vue'

const sections = [{ items: [{ value: 'inbox', label: 'Inbox', icon: 'inbox' }, { value: 'sent', label: 'Sent', icon: 'send' }] }]

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function open(props: Record<string, unknown> = {}) {
  wrapper = mount(MNavigationDrawer, {
    props: { modelValue: true, sections, ...props },
    attachTo: document.body,
    global: { stubs: { transition: false } },
  })
  const panel = document.body.querySelector<HTMLElement>('.nd-panel')!
  // The open is a Web Animation, and happy-dom's timeline doesn't advance on its own
  panel.getAnimations().forEach((a) => a.finish())
  // happy-dom has no layout
  Object.defineProperty(panel, 'offsetWidth', { value: 300 })
  Object.defineProperty(panel, 'offsetHeight', { value: 300 })
  return panel
}

// Moves 25px per step toward `to`, `msPerStep` apart (the events' timeStamp is what the fling velocity is measured
// from), along x, or along y with `vertical`, starting on `target` (the panel by default)
function swipe(panel: HTMLElement, from: number, to: number, msPerStep = 100, vertical = false, target: HTMLElement = panel) {
  let t = 1000
  const send = (type: string, p: number) => {
    const e = new PointerEvent(type, { pointerId: 1, button: 0, bubbles: true, clientX: vertical ? 150 : p, clientY: vertical ? p : 300 })
    Object.defineProperty(e, 'timeStamp', { value: t })
    ;(type === 'pointerdown' ? target : panel).dispatchEvent(e)
  }
  const dir = Math.sign(to - from)
  send('pointerdown', from)
  for (let x = from; dir * (to - x) >= 0; x += dir * 25) {
    t += msPerStep
    send('pointermove', x)
  }
  send('pointerup', to)
}

describe('MNavigationDrawer swipe to close', () => {
  it('opens as a Web Animation (compositor-run), with the open state inline underneath', () => {
    wrapper = mount(MNavigationDrawer, {
      props: { modelValue: true, sections },
      attachTo: document.body,
      global: { stubs: { transition: false } },
    })
    const panel = document.body.querySelector<HTMLElement>('.nd-panel')!
    expect(panel.getAnimations()).toHaveLength(1)
    expect(panel.style.transform).toBe('translateX(0%)')
    expect(document.body.querySelector<HTMLElement>('.nd-scrim')!.getAnimations()).toHaveLength(1)
  })

  it('closes when slowly swiped past half its width, and springs back from a short swipe', () => {
    const panel = open()
    swipe(panel, 250, 175, 400)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    swipe(panel, 250, 50, 400)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('closes on a quick flick even when it moved less than half', () => {
    const panel = open()
    swipe(panel, 250, 175, 16)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('swipes toward its own side when it opens from the right', () => {
    const panel = open({ side: 'right' })
    swipe(panel, 100, 25, 16)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    swipe(panel, 100, 300, 400)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('ignores a vertical drag (the items scroll)', () => {
    const panel = open()
    const opts = { pointerId: 1, button: 0, bubbles: true, clientX: 250 }
    panel.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientY: 300 }))
    panel.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 240, clientY: 200 }))
    panel.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 40, clientY: 200 }))
    panel.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 40, clientY: 200 }))
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not swipe with swipeEnabled false', () => {
    swipe(open({ swipeEnabled: false }), 250, 0, 16)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
  })

  it('closes a bottom drawer swiped down and a top drawer swiped up', () => {
    let panel = open({ side: 'bottom' })
    swipe(panel, 100, 175, 400, true)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    swipe(panel, 100, 300, 400, true)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
    wrapper!.unmount()
    panel = open({ side: 'top' })
    swipe(panel, 250, 175, 16, true)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('lets a vertical drawer\'s list scroll first: the drawer follows only once the list is at its edge', () => {
    const panel = open({ side: 'bottom' })
    const list = panel.querySelector<HTMLElement>('[data-nd-list]')!
    Object.defineProperty(list, 'scrollHeight', { value: 600 })
    Object.defineProperty(list, 'clientHeight', { value: 200 })
    list.scrollTop = 50
    swipe(panel, 100, 300, 16, true, list)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    // Swiping up never moves it: there's nothing further to open
    list.scrollTop = 0
    swipe(panel, 300, 100, 16, true, list)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
    swipe(panel, 100, 300, 16, true, list)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('claims a top/bottom touch swipe on its first move, so the browser never starts its own pan', () => {
    const panel = open({ side: 'bottom' })
    const list = panel.querySelector<HTMLElement>('[data-nd-list]')!
    let ts = 1000
    const touch = (type: string, y: number) => {
      const t = { identifier: 1, clientX: 150, clientY: y, target: list }
      const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>
      Object.assign(ev, { touches: type === 'touchend' ? [] : [t], changedTouches: [t] })
      Object.defineProperty(ev, 'timeStamp', { value: (ts += 400) })
      list.dispatchEvent(ev)
      return ev
    }
    touch('touchstart', 100)
    expect(touch('touchmove', 103).defaultPrevented).toBe(true)
    touch('touchmove', 300)
    touch('touchend', 300)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })

  it('leaves a top/bottom touch swipe toward the open side to the list', () => {
    const panel = open({ side: 'bottom' })
    const list = panel.querySelector<HTMLElement>('[data-nd-list]')!
    const touch = (type: string, y: number) => {
      const t = { identifier: 1, clientX: 150, clientY: y, target: list }
      const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>
      Object.assign(ev, { touches: type === 'touchend' ? [] : [t], changedTouches: [t] })
      list.dispatchEvent(ev)
      return ev
    }
    touch('touchstart', 300)
    expect(touch('touchmove', 297).defaultPrevented).toBe(false)
    expect(touch('touchmove', 100).defaultPrevented).toBe(false)
    touch('touchend', 100)
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps a top/bottom swipe out of the list\'s touch-action while the list is at that edge', async () => {
    vi.stubGlobal('CSS', { supports: (p: string, v: string) => p === 'touch-action' && v === 'pan-down' })
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r))
    let panel = open({ side: 'bottom' })
    let list = panel.querySelector<HTMLElement>('[data-nd-list]')!
    Object.defineProperty(list, 'scrollHeight', { value: 600 })
    Object.defineProperty(list, 'clientHeight', { value: 200 })
    await nextFrame()
    // At the top only the finger moving up scrolls natively; down is the drawer's
    expect(list.style.touchAction).toBe('pan-down')
    expect(panel.classList.contains('touch-none')).toBe(true)
    list.scrollTop = 50
    list.dispatchEvent(new Event('scroll'))
    expect(list.style.touchAction).toBe('pan-y')
    wrapper!.unmount()

    panel = open({ side: 'top' })
    list = panel.querySelector<HTMLElement>('[data-nd-list]')!
    Object.defineProperty(list, 'scrollHeight', { value: 200 })
    Object.defineProperty(list, 'clientHeight', { value: 200 })
    await nextFrame()
    expect(list.style.touchAction).toBe('pan-up')
    vi.unstubAllGlobals()
  })
})

describe('MNavigationDrawer open groups', () => {
  const groups = [{
    items: [
      { value: 'mail', label: 'Mail', children: [{ value: 'inbox', label: 'Inbox' }, { value: 'sent', label: 'Sent' }] },
      { value: 'files', label: 'Files', children: [
        { value: 'docs', label: 'Docs', children: [{ value: 'report', label: 'Report' }] },
      ] },
    ],
  }]
  const openItems = () => (wrapper!.vm as unknown as { openItems: Record<string, boolean> }).openItems

  function inline(props: Record<string, unknown> = {}) {
    wrapper = mount(MNavigationDrawer, { props: { modelValue: true, modal: false, sections: groups, ...props } })
  }

  it('opens every group that holds the selected item', () => {
    inline({ selected: 'report' })
    expect(openItems()).toMatchObject({ files: true, docs: true })
    expect(openItems().mail).toBeFalsy()
  })

  it('follows selected, leaving other groups open unless accordion', async () => {
    inline({ selected: 'inbox' })
    await wrapper!.setProps({ selected: 'report' })
    expect(openItems()).toMatchObject({ mail: true, files: true, docs: true })

    wrapper!.unmount()
    inline({ selected: 'inbox', accordion: true })
    await wrapper!.setProps({ selected: 'report' })
    expect(openItems()).toMatchObject({ mail: false, files: true, docs: true })
  })

  it('accordion closes the siblings of a group opened by hand', async () => {
    inline({ accordion: true, selected: 'inbox' })
    const files = wrapper!.findAll('button').find((b) => b.text().includes('Files'))!
    await files.trigger('click')
    expect(openItems()).toMatchObject({ mail: false, files: true })
  })

  it('leaves groups alone with expandSelected false', () => {
    inline({ selected: 'report', expandSelected: false })
    expect(openItems().files).toBeFalsy()
  })
})
