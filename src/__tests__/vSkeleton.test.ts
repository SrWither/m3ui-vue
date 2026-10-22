import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vSkeleton, type SkeletonValue } from '../directives/vSkeleton'

function host(value: () => SkeletonValue) {
  return mount(defineComponent({
    setup: () => () => withDirectives(h('div', [h('p', 'Ada Lovelace')]), [[vSkeleton, value()]]),
  }), { attachTo: document.body })
}

describe('vSkeleton', () => {
  it('marks the element as a busy placeholder while loading, and clears it after', async () => {
    const loading = ref(true)
    const w = host(() => loading.value)
    const el = w.element as HTMLElement
    expect(el.dataset.m3Skeleton).toBe('pulse')
    expect(el.getAttribute('aria-busy')).toBe('true')
    loading.value = false
    await nextTick()
    expect(el.dataset.m3Skeleton).toBeUndefined()
    expect(el.hasAttribute('aria-busy')).toBe(false)
    w.unmount()
  })

  it('wave adds a shimmer layer (and positions a static element); switching away removes both', async () => {
    const value = ref<SkeletonValue>({ loading: true, animation: 'wave' })
    const w = host(() => value.value)
    const el = w.element as HTMLElement
    expect(el.dataset.m3Skeleton).toBe('wave')
    expect(el.querySelectorAll('.m3-skeleton-shimmer')).toHaveLength(1)
    expect(el.style.position).toBe('relative')
    value.value = { loading: true, animation: 'none' }
    await nextTick()
    expect(el.dataset.m3Skeleton).toBe('none')
    expect(el.querySelector('.m3-skeleton-shimmer')).toBeNull()
    value.value = false
    await nextTick()
    expect(el.style.position).toBe('')
    w.unmount()
  })

  it('keeps the content in the DOM (it sizes the placeholder)', () => {
    const w = host(() => true)
    expect(w.text()).toContain('Ada Lovelace')
    w.unmount()
  })
})
