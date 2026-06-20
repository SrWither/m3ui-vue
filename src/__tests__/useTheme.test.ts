import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useTheme } from '../composables/useTheme'

function withSetup() {
  let result!: ReturnType<typeof useTheme>
  mount(defineComponent({
    setup() {
      result = useTheme()
      return () => h('div')
    },
  }))
  return result
}

describe('useTheme', () => {
  beforeEach(async () => {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('m3-theme', 'system')
  })

  it('returns theme ref', () => {
    const { theme } = withSetup()
    expect(['light', 'dark', 'system']).toContain(theme.value)
  })

  it('can set to dark and applies class', async () => {
    const { theme } = withSetup()
    theme.value = 'dark'
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('can set to light and removes dark class', async () => {
    document.documentElement.classList.add('dark')
    const { theme } = withSetup()
    theme.value = 'light'
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('cycle rotates through modes', async () => {
    const { theme, cycle } = withSetup()
    theme.value = 'light'
    await nextTick()
    cycle()
    expect(theme.value).toBe('dark')
    cycle()
    expect(theme.value).toBe('system')
    cycle()
    expect(theme.value).toBe('light')
  })

  it('persists to localStorage', async () => {
    const { theme } = withSetup()
    theme.value = 'dark'
    await nextTick()
    expect(localStorage.getItem('m3-theme')).toBe('dark')
  })
})
