import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useColorPalette, palettes } from '../composables/useColorPalette'

function withSetup() {
  let result!: ReturnType<typeof useColorPalette>
  mount(defineComponent({
    setup() {
      result = useColorPalette()
      return () => h('div')
    },
  }))
  return result
}

describe('useColorPalette', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-palette')
    localStorage.setItem('m3-palette', 'purple')
  })

  it('has 30 palettes', () => {
    expect(palettes).toHaveLength(30)
  })

  it('each palette has id, label, and seed', () => {
    for (const p of palettes) {
      expect(p.id).toBeTruthy()
      expect(p.label).toBeTruthy()
      expect(p.seed).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('includes monochromatic palettes', () => {
    const ids = palettes.map(p => p.id)
    expect(ids).toContain('graphite')
    expect(ids).toContain('charcoal')
    expect(ids).toContain('steel')
    expect(ids).toContain('ash')
    expect(ids).toContain('iron')
    expect(ids).toContain('fog')
    expect(ids).toContain('pewter')
    expect(ids).toContain('smoke')
    expect(ids).toContain('stone')
    expect(ids).toContain('zinc')
  })

  it('set() applies data-palette attribute', async () => {
    const { set } = withSetup()
    set('teal')
    await nextTick()
    expect(document.documentElement.getAttribute('data-palette')).toBe('teal')
  })

  it('set(purple) removes data-palette', async () => {
    const { set } = withSetup()
    set('teal')
    await nextTick()
    set('purple')
    await nextTick()
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false)
  })

  it('persists to localStorage', async () => {
    const { set } = withSetup()
    set('blue')
    await nextTick()
    expect(localStorage.getItem('m3-palette')).toBe('blue')
  })
})
