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
    // Per-tab widths, editable mid-test to simulate a tab resizing after mount.
    let widths: number[] = []
    const tabIndex = (el: HTMLElement) => [...el.parentElement!.querySelectorAll(':scope > button')].indexOf(el)
    function mockLayout(w: number[] = Array(8).fill(120)) {
      widths = w
      Object.defineProperty(proto, 'offsetLeft', {
        configurable: true,
        get(this: HTMLElement) { return isTab(this) ? widths.slice(0, tabIndex(this)).reduce((a, b) => a + b, 0) : 0 },
      })
      Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isTab(this) ? widths[tabIndex(this)]! : 390 } })
      Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return 390 } })
      Object.defineProperty(proto, 'scrollWidth', {
        configurable: true,
        get(this: HTMLElement) { return this.querySelector('button') ? Math.max(390, widths.reduce((a, b) => a + b, 0)) : 390 },
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

    // A fake ResizeObserver the test can fire by hand (happy-dom's never reports).
    class FakeRO {
      static instances: FakeRO[] = []
      targets = new Set<Element>()
      disconnected = false
      constructor(public cb: ResizeObserverCallback) { FakeRO.instances.push(this) }
      observe(el: Element) { this.targets.add(el); this.fire([el]) }
      unobserve(el: Element) { this.targets.delete(el) }
      disconnect() { this.targets.clear(); this.disconnected = true }
      fire(els: Element[] = [...this.targets]) {
        const entries = els.map((target) => {
          const el = target as HTMLElement
          return { target, contentRect: { width: el.offsetWidth, height: 48 } } as unknown as ResizeObserverEntry
        })
        this.cb(entries, this as unknown as ResizeObserver)
      }
    }
    function stubRO() { FakeRO.instances = []; vi.stubGlobal('ResizeObserver', FakeRO) }
    const indicator = (w: ReturnType<typeof mount>) => {
      const el = w.find('button').element.parentElement!.querySelector(':scope > div') as HTMLElement
      return { left: parseFloat(el.style.left), width: parseFloat(el.style.width) }
    }
    // Icons drawn as their ligature names before the font loads: 300px tabs
    const wide = () => [300, 300, 300, 300]
    const iconTabs = Array.from({ length: 4 }, (_, i) => ({ value: i, label: `Tab ${i}`, icon: 'fact_check' }))

    it('moves the indicator and re-centers, without animation, when the tabs resize after mount', async () => {
      mockLayout(wide()); mockReducedMotion(false); stubRO()
      const calls = spyScroll()
      const w = mount(MTabs, { props: { modelValue: 3, tabs: iconTabs, scrollable: true } })
      await flushPromises()
      // tab 3 at 900–1200 (inset 16): indicator 916–1184; row scrolled to its end
      expect(indicator(w)).toEqual({ left: 916, width: 268 })
      expect(calls).toEqual([{ left: 1200 - 390, behavior: 'auto' }])

      widths = [108, 108, 108, 108] // the font loaded: tabs shrink
      FakeRO.instances[0]!.fire()
      await flushPromises()
      // tab 3 now at 324–432: indicator 340–416, row clamped to 432 - 390
      expect(indicator(w)).toEqual({ left: 340, width: 76 })
      expect(calls[1]).toEqual({ left: 42, behavior: 'auto' })
    })

    it('keeps the row where the user scrolled it by hand, but still moves the indicator', async () => {
      mockLayout(wide()); mockReducedMotion(false); stubRO()
      const calls = spyScroll()
      const w = mount(MTabs, { props: { modelValue: 3, tabs: iconTabs, scrollable: true } })
      await flushPromises()
      const row = w.find('button').element.parentElement!.parentElement!
      row.dispatchEvent(new Event('wheel'))
      widths = [108, 108, 108, 108]
      FakeRO.instances[0]!.fire()
      await flushPromises()
      expect(indicator(w)).toEqual({ left: 340, width: 76 })
      expect(calls).toHaveLength(1)
    })

    it('ignores the first report of a newly observed element (no snap of a running animation)', async () => {
      mockLayout(); mockReducedMotion(false); stubRO()
      const w = mount(MTabs, { props: { modelValue: 0, tabs: many, scrollable: true } })
      await flushPromises()
      const ro = FakeRO.instances[0]!
      widths = widths.map(() => 200)
      const report = (el: Element) => ro.cb([{ target: el, contentRect: { width: 200, height: 48 } } as unknown as ResizeObserverEntry], ro as unknown as ResizeObserver)
      report(document.createElement('button')) // first sight of an element
      await flushPromises()
      expect(indicator(w)).toEqual({ left: 16, width: 88 })
      report(w.find('button').element) // a known tab that changed size
      await flushPromises()
      expect(indicator(w)).toEqual({ left: 16, width: 168 })
    })

    it('re-measures once fonts are ready', async () => {
      mockLayout(wide()); mockReducedMotion(false)
      let resolveFonts!: () => void
      const ready = new Promise<void>((r) => { resolveFonts = r })
      Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } })
      try {
        const w = mount(MTabs, { props: { modelValue: 1, tabs: iconTabs, scrollable: true } })
        await flushPromises()
        expect(indicator(w)).toEqual({ left: 316, width: 268 })
        widths = [108, 108, 108, 108]
        resolveFonts()
        await flushPromises()
        expect(indicator(w)).toEqual({ left: 124, width: 76 })
      } finally {
        delete (document as unknown as Record<string, unknown>).fonts
      }
    })

    it('keeps the indicator inside a clipping box the width of the tabs, and disconnects on unmount', async () => {
      mockLayout(); mockReducedMotion(false); stubRO()
      const w = mount(MTabs, { props: { modelValue: 0, tabs: many, scrollable: true } })
      await flushPromises()
      const box = w.find('button').element.parentElement!
      expect(box.querySelector(':scope > div.absolute')).not.toBeNull()
      expect(box.classList).toContain('overflow-hidden')
      expect(box.classList).toContain('w-max')
      const ro = FakeRO.instances[0]!
      expect(ro.targets.size).toBe(9) // the row + 8 tabs
      w.unmount()
      expect(ro.disconnected).toBe(true)
    })
  })
})
