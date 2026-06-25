import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import { useLocale, defaultLocale, M3_LOCALE_KEY } from '../composables/useLocale'

function withSetup<T>(fn: () => T, provide?: Record<symbol, unknown>): T {
  let result!: T
  mount(defineComponent({
    setup() {
      result = fn()
      return () => h('div')
    },
  }), {
    global: provide ? { provide } : undefined,
  })
  return result
}

describe('useLocale', () => {
  it('returns English defaults without provider', () => {
    const locale = withSetup(() => useLocale())
    expect(locale.search).toBe('Search...')
    expect(locale.close).toBe('Close')
    expect(locale.cancel).toBe('Cancel')
    expect(locale.confirm).toBe('Confirm')
    expect(locale.previous).toBe('Previous')
    expect(locale.next).toBe('Next')
    expect(locale.finish).toBe('Finish')
    expect(locale.noResults).toBe('No results')
  })

  it('merges partial overrides from provider', () => {
    const locale = withSetup(
      () => useLocale(),
      { [M3_LOCALE_KEY as symbol]: { search: 'Buscar...', close: 'Cerrar' } },
    )
    expect(locale.search).toBe('Buscar...')
    expect(locale.close).toBe('Cerrar')
    expect(locale.cancel).toBe('Cancel')
    expect(locale.next).toBe('Next')
  })

  it('reacts to ref-based locale changes', async () => {
    const localeRef = ref<Partial<typeof defaultLocale>>({ search: 'Buscar...' })
    const locale = withSetup(
      () => useLocale(),
      { [M3_LOCALE_KEY as symbol]: localeRef },
    )
    expect(locale.search).toBe('Buscar...')
    expect(locale.close).toBe('Close')

    localeRef.value = { search: 'Rechercher...', close: 'Fermer' }
    await nextTick()
    expect(locale.search).toBe('Rechercher...')
    expect(locale.close).toBe('Fermer')
    expect(locale.cancel).toBe('Cancel')
  })

  it('defaultLocale has all keys defined', () => {
    const keys = Object.keys(defaultLocale)
    expect(keys.length).toBeGreaterThan(50)
    for (const key of keys) {
      expect((defaultLocale as unknown as Record<string, string>)[key]).toBeTruthy()
    }
  })
})
