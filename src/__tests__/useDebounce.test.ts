import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useDebounce } from '../composables/useDebounce'

function withSetup<T>(fn: () => T): { result: T; unmount: () => void } {
  let result!: T
  const wrapper = mount(defineComponent({
    setup() {
      result = fn()
      return () => h('div')
    },
  }))
  return { result, unmount: () => wrapper.unmount() }
}

describe('useDebounce', () => {
  it('delays execution by the given ms', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    const { result } = withSetup(() => useDebounce(spy, 300))

    result.debounced('a')
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledWith('a')
    vi.useRealTimers()
  })

  it('resets the timer on subsequent calls', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    const { result } = withSetup(() => useDebounce(spy, 300))

    result.debounced('a')
    vi.advanceTimersByTime(200)
    result.debounced('b')
    vi.advanceTimersByTime(200)
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('b')
    vi.useRealTimers()
  })

  it('cancel prevents pending execution', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    const { result } = withSetup(() => useDebounce(spy, 300))

    result.debounced('a')
    vi.advanceTimersByTime(100)
    result.cancel()
    vi.advanceTimersByTime(300)
    expect(spy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cleans up on unmount', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    const { result, unmount } = withSetup(() => useDebounce(spy, 300))

    result.debounced('a')
    unmount()
    vi.advanceTimersByTime(300)
    expect(spy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
