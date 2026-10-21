import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import MContainerTransform from '../components/MContainerTransform.vue'
import { useContainerTransform } from '../composables/useContainerTransform'
import { containerFrame, emphasized } from '../composables/_containerTransform'

let wrapper: VueWrapper | undefined
const boundingRect = HTMLElement.prototype.getBoundingClientRect
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = boundingRect
  wrapper?.unmount()
  wrapper = undefined
  document.body.style.overflow = ''
})

const card = { left: 20, top: 300, width: 160, height: 200 }
const page = { left: 0, top: 0, width: 400, height: 800 }

const flush = async () => { await nextTick(); await nextTick() }
const panel = () => document.body.querySelector('[role=dialog]') as HTMLElement | null
const animations = () => [...document.body.querySelectorAll('*')].flatMap((el) => (el as HTMLElement).getAnimations?.() ?? [])
const running = () => animations().filter((a) => a.playState === 'running')
const finishAll = async () => { animations().forEach((a) => a.playState !== 'finished' && a.finish()); await new Promise((r) => setTimeout(r)); await flush() }

describe('container transform engine', () => {
  it('starts on the source box and ends on the destination box', () => {
    const first = containerFrame(0, card, page, 12, 0, true)
    expect(first.clip).toEqual(card)
    expect(first.radius).toBe(12)
    expect(first.end.opacity).toBe(0)
    expect(first.scrim).toBe(0)
    const last = containerFrame(1, card, page, 12, 0, true)
    expect(last.clip).toEqual(page)
    expect(last.radius).toBe(0)
    expect(last.end).toEqual({ x: 0, y: 0, scale: 1, opacity: 1 })
  })

  it('scales both views uniformly to the same width (fit to width), so nothing stretches', () => {
    const f = containerFrame(0.5, card, page, 12, 0, true)
    expect(card.width * f.start.scale).toBeCloseTo(page.width * f.end.scale)
  })

  it('fades the detail in over the first quarter opening, out late closing (Android thresholds)', () => {
    expect(containerFrame(0.25, card, page, 12, 0, true).end.opacity).toBe(1)
    expect(containerFrame(0.125, card, page, 12, 0, true).end.opacity).toBeCloseTo(0.5)
    expect(containerFrame(0.5, page, card, 0, 12, false).start.opacity).toBe(1)
    expect(containerFrame(0.75, page, card, 0, 12, false).start.opacity).toBeCloseTo(0.5)
    expect(containerFrame(0.95, page, card, 0, 12, false).start.opacity).toBe(0)
  })

  it('follows Android\'s emphasized path through its control points', () => {
    expect(emphasized(0)).toBe(0)
    expect(emphasized(0.166666)).toBeCloseTo(0.4, 3)
    expect(emphasized(1)).toBe(1)
  })
})

describe('MContainerTransform', () => {
  const mountCard = (props: Record<string, unknown> = {}) =>
    mount(MContainerTransform, {
      props,
      slots: {
        default: ({ open }: { open: () => void }) => h('button', { class: 'card', onClick: open }, 'Card'),
        expanded: ({ close }: { close: () => void }) => h('div', [h('p', 'Detail'), h('button', { class: 'back', onClick: close }, 'Back')]),
      },
      attachTo: document.body,
    })

  it('grows the element into the expanded view and shrinks it back', async () => {
    wrapper = mountCard()
    const source = wrapper.find('.card').element as HTMLElement
    // The card has its box, everything else (the panel) fills the screen
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const b = this === source ? card : page
      return { ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top, toJSON() {} } as DOMRect
    }
    await wrapper.find('.card').trigger('click')
    await flush()
    expect(panel()?.textContent).toContain('Detail')
    expect(wrapper.emitted('update:open')).toEqual([[true]])
    // The element hides while its clone plays the transition, then the clone goes
    expect(source.style.visibility).toBe('hidden')
    expect(document.body.querySelector('[aria-hidden=true].card')).not.toBeNull()
    expect(running().length).toBeGreaterThan(0)
    expect(document.body.style.overflow).toBe('hidden')
    await finishAll()
    expect(document.body.querySelector('[aria-hidden=true].card')).toBeNull()

    ;(document.body.querySelector('.back') as HTMLElement).click()
    await flush()
    expect(panel()).not.toBeNull()
    await finishAll()
    expect(panel()).toBeNull()
    expect(source.style.visibility).toBe('')
    expect(document.activeElement).toBe(source)
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.emitted('update:open')).toEqual([[true], [false]])
  })

  it('survives rapid opening and closing, ending in the last state asked', async () => {
    wrapper = mountCard({ 'onUpdate:open': (v: boolean) => wrapper!.setProps({ open: v }) })
    const source = wrapper.find('.card').element as HTMLElement
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const b = this === source ? card : page
      return { ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top, toJSON() {} } as DOMRect
    }
    // Open and close over and over without letting a transition finish
    for (let i = 0; i < 4; i++) {
      await wrapper.setProps({ open: true })
      await flush()
      await wrapper.setProps({ open: false })
      await flush()
    }
    await wrapper.setProps({ open: true })
    await flush()
    await finishAll()
    expect(panel()).not.toBeNull()
    expect(running()).toHaveLength(0)
    // And it still closes
    await wrapper.setProps({ open: false })
    await flush()
    await finishAll()
    expect(panel()).toBeNull()
    expect(source.style.visibility).toBe('')
  })

  it('closes when closed mid-opening, instead of jumping open and staying there', async () => {
    wrapper = mountCard({ 'onUpdate:open': (v: boolean) => wrapper!.setProps({ open: v }) })
    const source = wrapper.find('.card').element as HTMLElement
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const b = this === source ? card : page
      return { ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top, toJSON() {} } as DOMRect
    }
    await wrapper.find('.card').trigger('click')
    await flush()
    expect(running().length).toBeGreaterThan(0)
    // The back button inside, before the opening ends: the run turns around
    ;(document.body.querySelector('.back') as HTMLElement).click()
    await flush()
    await finishAll()
    expect(panel()).toBeNull()
    expect(source.style.visibility).toBe('')
    // And it opens again normally
    await wrapper.find('.card').trigger('click')
    await flush()
    await finishAll()
    expect(panel()).not.toBeNull()
  })

  it('closes on Escape', async () => {
    wrapper = mountCard({ open: true })
    await flush()
    expect(panel()).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await finishAll()
    expect(panel()).toBeNull()
  })

  it('closes on a scrim click in dialog mode, unless persistent', async () => {
    wrapper = mountCard({ open: true, mode: 'dialog', 'onUpdate:open': (v: boolean) => wrapper!.setProps({ open: v }) })
    await flush()
    ;(document.body.querySelector('.bg-black') as HTMLElement).click()
    await finishAll()
    expect(panel()).toBeNull()
    await wrapper.setProps({ open: true, persistent: true })
    await flush()
    ;(document.body.querySelector('.bg-black') as HTMLElement).click()
    await finishAll()
    expect(panel()).not.toBeNull()
  })

  it('leaves placing the expanded view to the consumer\'s classes in custom mode', async () => {
    wrapper = mount(MContainerTransform, {
      props: { open: true, mode: 'custom' },
      attrs: { class: 'bottom-4 right-4 w-80 bg-primary-container' },
      slots: { default: () => h('button', 'Card'), expanded: () => h('p', 'Chat') },
      attachTo: document.body,
    })
    await flush()
    const cls = panel()!.className
    expect(cls).toContain('bottom-4 right-4 w-80 bg-primary-container')
    expect(cls).not.toContain('inset-0')
    // Its default look is in the base layer (a class of its own), so the consumer's bg-* wins
    expect(cls).toContain('m3-ct-panel')
    expect(cls).not.toMatch(/(^|\s)bg-surface/)
  })

  it('without a scrim, leaves the page usable and closes on a press outside, unless persistent', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    wrapper = mountCard({ open: true, mode: 'custom', scrim: false, 'onUpdate:open': (v: boolean) => wrapper!.setProps({ open: v }) })
    await flush()
    expect(panel()!.hasAttribute('aria-modal')).toBe(false)
    expect(document.body.style.overflow).toBe('')
    // A press inside stays open
    panel()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(panel()).not.toBeNull()
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await finishAll()
    expect(panel()).toBeNull()
    await wrapper.setProps({ open: true, persistent: true })
    await flush()
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await finishAll()
    expect(panel()).not.toBeNull()
    outside.remove()
  })

  describe('Android\'s back', () => {
    // The platform's close requests (CloseWatcher, Chrome/Edge): a fake one we can fire
    class FakeWatcher {
      static all: FakeWatcher[] = []
      onclose: (() => void) | null = null
      destroyed = false
      constructor() { FakeWatcher.all.push(this) }
      destroy() { this.destroyed = true }
      requestClose() { if (!this.destroyed) this.onclose?.() }
    }
    afterEach(() => {
      FakeWatcher.all = []
      delete (window as { CloseWatcher?: unknown }).CloseWatcher
    })

    it('closes it through a CloseWatcher, without touching the history', async () => {
      ;(window as { CloseWatcher?: unknown }).CloseWatcher = FakeWatcher
      const push = vi.spyOn(history, 'pushState')
      const back = vi.spyOn(history, 'back')
      wrapper = mountCard({ 'onUpdate:open': (v: boolean) => wrapper!.setProps({ open: v }) })
      await wrapper.find('.card').trigger('click')
      await flush()
      expect(FakeWatcher.all).toHaveLength(1)
      FakeWatcher.all[0]!.requestClose()
      await finishAll()
      expect(panel()).toBeNull()
      expect(push).not.toHaveBeenCalled()
      expect(back).not.toHaveBeenCalled()
      push.mockRestore()
      back.mockRestore()
    })

    it('lets go of its watcher when closed some other way', async () => {
      ;(window as { CloseWatcher?: unknown }).CloseWatcher = FakeWatcher
      wrapper = mountCard({ 'onUpdate:open': (v: boolean) => wrapper!.setProps({ open: v }) })
      await wrapper.find('.card').trigger('click')
      await flush()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await finishAll()
      expect(FakeWatcher.all[0]!.destroyed).toBe(true)
    })

    it('makes no watcher with closeOnBack off', async () => {
      ;(window as { CloseWatcher?: unknown }).CloseWatcher = FakeWatcher
      wrapper = mountCard({ closeOnBack: false })
      await wrapper.find('.card').trigger('click')
      await flush()
      expect(FakeWatcher.all).toHaveLength(0)
    })
  })

  it('opens from elements elsewhere through a controller, with their item', async () => {
    const Page = defineComponent({
      setup() {
        const detail = useContainerTransform<{ name: string }>()
        return () => [
          h('button', { class: 'a', onClick: (e: Event) => detail.open(e, { name: 'Alpha' }) }, 'A'),
          h('button', { class: 'b', onClick: (e: Event) => detail.open(e, { name: 'Beta' }) }, 'B'),
          h(MContainerTransform, { controller: detail }, { expanded: ({ item }: { item?: { name: string } }) => h('p', item?.name) }),
        ]
      },
    })
    wrapper = mount(Page, { attachTo: document.body })
    await wrapper.find('.b').trigger('click')
    await flush()
    expect(panel()?.textContent).toBe('Beta')
    expect((wrapper.find('.b').element as HTMLElement).style.visibility).toBe('hidden')
  })
})
