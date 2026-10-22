import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Ref } from 'vue'
import { useThemeTokens } from '../composables/useThemeTokens'

const root = document.documentElement
afterEach(() => {
  root.style.removeProperty('--color-primary')
  root.className = ''
  vi.useRealTimers()
})

function use(live = false) {
  let tokens!: Ref<Record<'primary', string>>
  const w = mount(defineComponent({ setup: () => { tokens = useThemeTokens(['primary'] as const, { live }); return () => h('div') } }))
  return { tokens: () => tokens.value, w }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('useThemeTokens', () => {
  it('reads the tokens from <html>', () => {
    root.style.setProperty('--color-primary', '#6750a4')
    const { tokens, w } = use()
    expect(tokens().primary).toBe('#6750a4')
    w.unmount()
  })

  it('re-reads on a theme change, and again once the transition settles', async () => {
    root.style.setProperty('--color-primary', '#6750a4')
    const { tokens, w } = use()
    await nextTick()
    root.style.setProperty('--color-primary', '#d0bcff')
    root.classList.add('dark')
    await flush()
    expect(tokens().primary).toBe('#d0bcff')

    vi.useFakeTimers()
    root.style.setProperty('--color-primary', '#ffffff')
    root.classList.remove('dark')
    await vi.advanceTimersByTimeAsync(0)
    root.style.setProperty('--color-primary', '#000000') // the value the transition lands on
    await vi.advanceTimersByTimeAsync(300)
    expect(tokens().primary).toBe('#000000')
    w.unmount()
  })

  describe('live', () => {
    // A fake clock drives both performance.now() and requestAnimationFrame (16ms frames)
    const frames = (ms: number) => vi.advanceTimersByTimeAsync(ms)

    it('replays the fade from the old colors when the tokens jump (Firefox\'s theme-transitioning)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      root.style.setProperty('--color-primary', '#000000')
      const { tokens, w } = use(true)
      await nextTick()
      root.classList.add('theme-transitioning')
      root.style.setProperty('--color-primary', '#ffffff')
      await frames(0)
      expect(tokens().primary).toBe('#000000')
      await frames(130)
      const mid = /^rgba\((\d+), (\d+), (\d+), 1\)$/.exec(tokens().primary)
      expect(mid).not.toBeNull()
      expect(Number(mid![1])).toBeGreaterThan(60)
      expect(Number(mid![1])).toBeLessThan(250)
      await frames(200)
      expect(tokens().primary).toBe('#ffffff')
      w.unmount()
    })

    // A token animating through @property changes its computed value with no DOM mutation: a stylesheet outside
    // <head> (which isn't observed) stands in for that
    function animatedToken() {
      const sheet = document.createElement('style')
      document.body.appendChild(sheet)
      return { to: (v: string) => { sheet.textContent = `:root { --color-primary: ${v} }` }, remove: () => sheet.remove() }
    }

    it('reads the tokens every frame while they animate themselves (Chromium\'s theme-switching)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      const token = animatedToken()
      token.to('#000000')
      const { tokens, w } = use(true)
      await nextTick()
      root.classList.add('theme-switching')
      await frames(0)
      token.to('rgb(40, 40, 40)')
      await frames(50)
      expect(tokens().primary).toBe('rgb(40, 40, 40)')
      token.to('rgb(90, 90, 90)')
      await frames(50)
      expect(tokens().primary).toBe('rgb(90, 90, 90)')
      w.unmount()
      token.remove()
    })

    it('without live, waits for the switch to settle', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      const token = animatedToken()
      token.to('#000000')
      const { tokens, w } = use(false)
      await nextTick()
      root.classList.add('theme-switching')
      await frames(0)
      token.to('rgb(40, 40, 40)')
      await frames(100)
      expect(tokens().primary).toBe('#000000')
      token.to('#ffffff')
      await frames(300)
      expect(tokens().primary).toBe('#ffffff')
      w.unmount()
      token.remove()
    })
  })
})
