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

function use() {
  let tokens!: Ref<Record<'primary', string>>
  const w = mount(defineComponent({ setup: () => { tokens = useThemeTokens(['primary'] as const); return () => h('div') } }))
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
})
