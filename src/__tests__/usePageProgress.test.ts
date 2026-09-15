import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePageProgress } from '../composables/usePageProgress'

describe('usePageProgress', () => {
  beforeEach(() => {
    const { done } = usePageProgress()
    done()
    vi.useRealTimers()
  })

  it('start() activates the bar with an initial value', () => {
    const { progress, isActive, start } = usePageProgress()
    start()
    expect(isActive.value).toBe(true)
    expect(progress.value).toBeGreaterThan(0)
    expect(progress.value).toBeLessThan(100)
  })

  it('start() trickles progress toward 90% over time without reaching it', () => {
    vi.useFakeTimers()
    const { progress, start } = usePageProgress()
    start()
    vi.advanceTimersByTime(2000)
    expect(progress.value).toBeGreaterThan(50)
    expect(progress.value).toBeLessThan(90)
    vi.useRealTimers()
  })

  it('set() jumps straight to the given percentage, clamped to [0, 100]', () => {
    const { progress, isActive, set } = usePageProgress()
    set(150)
    expect(progress.value).toBe(100)
    expect(isActive.value).toBe(true)

    set(-10)
    expect(progress.value).toBe(0)
  })

  it('done() completes the bar then fades it out and resets', () => {
    vi.useFakeTimers()
    const { progress, isActive, start, done } = usePageProgress()
    start()
    done()
    expect(progress.value).toBe(100)
    expect(isActive.value).toBe(true)

    vi.advanceTimersByTime(200)
    expect(isActive.value).toBe(false)
    expect(progress.value).toBe(0)
    vi.useRealTimers()
  })
})
