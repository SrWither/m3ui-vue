import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { useScrollReveal } from '../composables/useScrollReveal'
import { vReveal } from '../directives/vReveal'

// A controllable IntersectionObserver: tests decide which elements enter or leave
const observers: FakeIO[] = []
class FakeIO {
  targets = new Set<Element>()
  constructor(public cb: IntersectionObserverCallback, public opts?: IntersectionObserverInit) { observers.push(this) }
  observe(el: Element) { this.targets.add(el) }
  unobserve(el: Element) { this.targets.delete(el) }
  disconnect() { this.targets.clear() }
  fire(els: Element[], isIntersecting = true) {
    this.cb(els.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry), this as unknown as IntersectionObserver)
  }
}
const delays: number[] = []
beforeEach(() => {
  observers.length = 0
  delays.length = 0
  vi.stubGlobal('IntersectionObserver', FakeIO)
  // Record each reveal's delay (happy-dom's animate() runs but we only need what was asked)
  const real = HTMLElement.prototype.animate
  vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement, k, o) {
    delays.push(typeof o === 'object' ? (o.delay ?? 0) : 0)
    return real.call(this, k, o)
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function list(n: number, options = {}) {
  const els = ref<HTMLElement[]>([])
  const w = mount(defineComponent({
    setup() {
      useScrollReveal(els, options)
      return () => h('ul', Array.from({ length: n }, (_, i) => h('li', { ref: (e: any) => { if (e) els.value[i] = e } }, `#${i}`)))
    },
  }), { attachTo: document.body })
  return { w, items: () => w.findAll('li').map((l) => l.element as HTMLElement) }
}

describe('useScrollReveal', () => {
  it('hides the elements until they enter, then plays them in, cascading', async () => {
    const { w, items } = list(3, { stagger: 50 })
    await nextTick()
    expect(items().every((el) => el.style.opacity === '0')).toBe(true)
    observers[0]!.fire(items())
    expect(items().every((el) => el.style.opacity === '')).toBe(true)
    expect(delays).toEqual([0, 50, 100])
    w.unmount()
  })

  it('stops watching an element once revealed, unless once is false', async () => {
    const { w, items } = list(1)
    await nextTick()
    observers[0]!.fire(items())
    expect(observers[0]!.targets.size).toBe(0)
    w.unmount()

    const again = list(1, { once: false })
    await nextTick()
    const io = observers[1]!
    io.fire(again.items())
    io.fire(again.items(), false)
    expect(again.items()[0]!.style.opacity).toBe('0')
    again.w.unmount()
  })

  it('leaves everything visible with reduced motion', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    const { w, items } = list(2)
    await nextTick()
    expect(items().every((el) => el.style.opacity === '')).toBe(true)
    expect(observers).toHaveLength(0)
    w.unmount()
  })
})

describe('v-reveal', () => {
  it('reveals the items of a list together, sharing one observer per options', () => {
    const app = mount(defineComponent({
      setup: () => () => h('div', [1, 2, 3].map((i) => withDirectives(h('p', { key: i }, String(i)), [[vReveal, { effect: 'scale', stagger: 40 }]]))),
    }), { attachTo: document.body })
    const ps = app.findAll('p').map((p) => p.element as HTMLElement)
    expect(observers).toHaveLength(1)
    expect(ps.every((p) => p.style.opacity === '0')).toBe(true)
    observers[0]!.fire(ps)
    expect(delays).toEqual([0, 40, 80])
    app.unmount()
  })

  it('does nothing with false', () => {
    const app = mount(defineComponent({ setup: () => () => withDirectives(h('p', 'x'), [[vReveal, false]]) }))
    expect((app.element as HTMLElement).style.opacity).toBe('')
    app.unmount()
  })
})
