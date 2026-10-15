import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MPagination from '../components/MPagination.vue'
import { M3_LOCALE_KEY } from '../composables/useLocale'
import { esLocale } from '../locales'

describe('MPagination', () => {
  it('uses English texts by default', () => {
    const w = mount(MPagination, { props: { page: 2, perPage: 10, total: 25 } })
    expect(w.text()).toContain('11–20 of 25')
    expect(w.text()).toContain('Page 2 of 3')
    expect(w.find('[aria-label="Previous page"]').exists()).toBe(true)
    expect(w.find('[aria-label="Next page"]').exists()).toBe(true)
  })

  it('shows the locale’s "no results" when empty', () => {
    const w = mount(MPagination, { props: { page: 1, perPage: 10, total: 0 } })
    expect(w.text()).toContain('No results')
  })

  it('follows the app’s locale', () => {
    const w = mount(MPagination, {
      props: { page: 1, perPage: 10, total: 25 },
      global: { provide: { [M3_LOCALE_KEY as symbol]: esLocale } },
    })
    expect(w.text()).toContain('1–10 de 25')
    expect(w.text()).toContain('Página 1 de 3')
    expect(w.find('[aria-label="Página siguiente"]').exists()).toBe(true)
  })

  it('emits the next and previous page', async () => {
    const w = mount(MPagination, { props: { page: 2, perPage: 10, total: 25 } })
    await w.find('[aria-label="Next page"]').trigger('click')
    await w.find('[aria-label="Previous page"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[3], [1]])
  })
})
