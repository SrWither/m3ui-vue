import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MTabs from '../components/MTabs.vue'

const tabs = [
  { value: 'flights', label: 'Flights', icon: 'flight' },
  { value: 'hotels', label: 'Hotels', icon: 'hotel' },
]

const firstTab = (props: Record<string, unknown>) =>
  mount(MTabs, { props: { modelValue: 'flights', tabs, ...props } }).find('button').classes()

describe('MTabs', () => {
  it('stacks primary icons above the label in a 64px tab by default', () => {
    const c = firstTab({})
    expect(c).toContain('flex-col')
    expect(c).toContain('h-16')
  })

  it('puts the icon beside the label in a 48px tab with iconPosition="leading" (LeadingIconTab)', () => {
    const c = firstTab({ iconPosition: 'leading' })
    expect(c).toContain('flex-row')
    expect(c).toContain('h-12')
    expect(c).toContain('gap-2')
  })

  it('keeps secondary icons beside the label by default and stacks them with iconPosition="top"', () => {
    expect(firstTab({ variant: 'secondary' })).toContain('flex-row')
    const c = firstTab({ variant: 'secondary', iconPosition: 'top' })
    expect(c).toContain('flex-col')
    expect(c).toContain('h-16')
  })

  it('emits the picked tab', async () => {
    const w = mount(MTabs, { props: { modelValue: 'flights', tabs } })
    await w.findAll('button')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['hotels']])
  })

  describe('scrollable: keeps the active tab in view (ScrollableTabRow)', () => {
    // A 390px row holding eight 120px tabs (960px of content): happy-dom has
    // no layout, so the geometry is mocked on the prototype.
    const many = Array.from({ length: 8 }, (_, i) => ({ value: i, label: `Tab ${i}` }))
    const proto = HTMLElement.prototype
    const saved = ['offsetLeft', 'offsetWidth', 'clientWidth', 'scrollWidth'].map(
      (k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const,
    )
    const isTab = (el: HTMLElement) => el.tagName === 'BUTTON'
    function mockLayout() {
      Object.defineProperty(proto, 'offsetLeft', {
        configurable: true,
        get(this: HTMLElement) { return isTab(this) ? [...this.parentElement!.children].indexOf(this) * 120 : 0 },
      })
      Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isTab(this) ? 120 : 390 } })
      Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return 390 } })
      Object.defineProperty(proto, 'scrollWidth', {
        configurable: true,
        get(this: HTMLElement) { return this.querySelector(':scope > button') ? this.querySelectorAll(':scope > button').length * 120 : 390 },
      })
    }
    function spyScroll() {
      const calls: ScrollToOptions[] = []
      vi.spyOn(proto, 'scrollTo').mockImplementation(function (this: HTMLElement, opts?: ScrollToOptions | number) {
        if (typeof opts === 'object') { calls.push(opts); this.scrollLeft = opts.left ?? 0 }
      } as typeof proto.scrollTo)
      return calls
    }
    function mockReducedMotion(reduce: boolean) {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))
    }

    afterEach(() => {
      for (const [k, d] of saved) {
        if (d) Object.defineProperty(proto, k, d)
        else delete (proto as unknown as Record<string, unknown>)[k]
      }
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('scrolls the row (not the page) to the active tab on mount, without animation', async () => {
      mockLayout(); mockReducedMotion(false)
      const calls = spyScroll()
      const intoView = vi.fn()
      vi.spyOn(proto, 'scrollIntoView').mockImplementation(intoView)
      mount(MTabs, { props: { modelValue: 4, tabs: many, scrollable: true } })
      await flushPromises()
      // tab 4 spans 480–600: centered → 540 - 195 = 345
      expect(calls).toEqual([{ left: 345, behavior: 'auto' }])
      expect(intoView).not.toHaveBeenCalled()
    })

    it('smooth-scrolls to the new tab when modelValue changes, clamped to the row ends', async () => {
      mockLayout(); mockReducedMotion(false)
      const calls = spyScroll()
      const w = mount(MTabs, { props: { modelValue: 0, tabs: many, scrollable: true } })
      await flushPromises()
      expect(calls).toEqual([]) // first tab already in view
      await w.setProps({ modelValue: 7 })
      await flushPromises()
      expect(calls).toEqual([{ left: 960 - 390, behavior: 'smooth' }])
      await w.setProps({ modelValue: 1 })
      await flushPromises()
      expect(calls[1]).toEqual({ left: 0, behavior: 'smooth' })
    })

    it('jumps instead of animating with prefers-reduced-motion', async () => {
      mockLayout(); mockReducedMotion(true)
      const calls = spyScroll()
      const w = mount(MTabs, { props: { modelValue: 0, tabs: many, scrollable: true } })
      await flushPromises()
      await w.setProps({ modelValue: 5 })
      await flushPromises()
      expect(calls).toEqual([{ left: 465, behavior: 'auto' }])
    })

    it('does not pull the row back when an unchanged tabs array is passed again', async () => {
      mockLayout(); mockReducedMotion(false)
      const calls = spyScroll()
      const w = mount(MTabs, { props: { modelValue: 4, tabs: many, scrollable: true } })
      await flushPromises()
      await w.setProps({ tabs: many.map((t) => ({ ...t })) })
      await flushPromises()
      expect(calls).toHaveLength(1)
    })

    it('never scrolls a fixed (non-scrollable) row', async () => {
      mockLayout(); mockReducedMotion(false)
      const calls = spyScroll()
      const w = mount(MTabs, { props: { modelValue: 4, tabs: many } })
      await flushPromises()
      await w.setProps({ modelValue: 7 })
      await flushPromises()
      expect(calls).toEqual([])
    })
  })
})
