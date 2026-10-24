import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, withDirectives } from 'vue'
import { vSparkle, type SparkleValue } from '../directives/vSparkle'

function host(value: SparkleValue) {
  return mount(defineComponent({
    setup() {
      return () => withDirectives(h('div', { class: 'host' }, 'New'), [[vSparkle, value]])
    },
  }), { attachTo: document.body })
}

const sparkles = (el: Element) => el.querySelectorAll('.m3-sparkle-layer svg')

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('vSparkle', () => {
  it('keeps adding sparkles over the element, in a layer hidden from assistive technology', () => {
    const w = host(undefined)
    vi.advanceTimersByTime(3000)
    const layer = w.element.querySelector('.m3-sparkle-layer')!
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect((layer as HTMLElement).style.pointerEvents).toBe('none')
    expect(sparkles(w.element).length).toBeGreaterThan(3)
    expect((w.element as HTMLElement).style.position).toBe('relative')
    w.unmount()
  })

  it('removes each sparkle when its animation ends, and the layer on unmount', () => {
    const w = host(true)
    vi.advanceTimersByTime(1000)
    const first = sparkles(w.element)[0]!
    first.getAnimations().forEach((a) => a.finish())
    expect(first.isConnected).toBe(false)
    const el = w.element
    w.unmount()
    expect(el.querySelector('.m3-sparkle-layer')).toBeNull()
  })

  it("'hover' sparkles only while the pointer is over it", () => {
    const w = host('hover')
    vi.advanceTimersByTime(2000)
    expect(sparkles(w.element)).toHaveLength(0)
    w.element.dispatchEvent(new PointerEvent('pointerenter'))
    // One right away
    expect(sparkles(w.element).length).toBe(1)
    vi.advanceTimersByTime(2000)
    const during = sparkles(w.element).length
    expect(during).toBeGreaterThan(1)
    w.element.dispatchEvent(new PointerEvent('pointerleave'))
    vi.advanceTimersByTime(2000)
    expect(sparkles(w.element).length).toBe(during)
    w.unmount()
  })

  it('uses the given color and shapes', () => {
    const w = host({ color: '#f5b400', shapes: ['Heart'] })
    vi.advanceTimersByTime(1500)
    const path = w.element.querySelector('.m3-sparkle-layer path') as SVGPathElement
    expect(path.style.fill).toBe('#f5b400')
    expect(path.getAttribute('d')).not.toContain('C54 34')
    w.unmount()
  })

  it('nothing when disabled or under reduced motion', () => {
    const off = host(false)
    vi.advanceTimersByTime(2000)
    expect(sparkles(off.element)).toHaveLength(0)
    off.unmount()
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    const reduced = host(true)
    vi.advanceTimersByTime(2000)
    expect(sparkles(reduced.element)).toHaveLength(0)
    reduced.unmount()
  })
})
