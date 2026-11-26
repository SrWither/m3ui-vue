import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MAddressField from '../components/MAddressField.vue'
import { nominatimProvider, type MapSearchResult } from '../composables/mapSearch'

const PLACES: MapSearchResult[] = [
  { label: 'Plaza San Martín, Centro, Córdoba, Argentina', lngLat: [-64.1836, -31.4166], type: 'park' },
  { label: 'San Martín 100, Córdoba, Argentina', lngLat: [-64.185, -31.415], type: 'house' },
]

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function mountField(props: Record<string, unknown> = {}) {
  const value = ref<MapSearchResult | null>(null)
  const provider = vi.fn(async (q: string) => PLACES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())))
  const onSelect = vi.fn()
  const Host = defineComponent({
    setup: () => () => h(MAddressField, {
      modelValue: value.value, 'onUpdate:modelValue': (v: MapSearchResult | null) => (value.value = v), provider, onSelect, ...props,
    }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  const input = wrapper.find('input')
  return { value, provider, onSelect, input }
}

const options = () => [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
const list = () => document.body.querySelector<HTMLElement>('[role="listbox"]')

describe('MAddressField', () => {
  it('is a labelled combobox, and hints Enter once enough is typed', async () => {
    const { input, provider } = await mountField()
    expect(wrapper!.find('label').text()).toBe('Address')
    expect(input.attributes('role')).toBe('combobox')
    await input.trigger('focusin')
    await input.setValue('Sa')
    expect(list()).toBeNull()
    await input.setValue('San Mar')
    expect(list()!.textContent).toContain('Press Enter to search')
    expect(provider).not.toHaveBeenCalled()
  })

  it('searches on Enter, lists results split in name and place, and picks with the keyboard', async () => {
    const { input, provider, value, onSelect } = await mountField()
    await input.trigger('focusin')
    await input.setValue('san martín')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(provider).toHaveBeenCalledWith('san martín', expect.any(AbortSignal))
    expect(options()).toHaveLength(2)
    expect(options()[0]!.textContent).toContain('Plaza San Martín')
    expect(options()[0]!.textContent).toContain('Centro, Córdoba, Argentina')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(input.attributes('aria-activedescendant')).toBe(options()[0]!.id)
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toBe(options()[1]!.id)
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toEqual(PLACES[1])
    expect(onSelect).toHaveBeenCalledWith(PLACES[1])
    expect((input.element as HTMLInputElement).value).toBe(PLACES[1]!.label)
    expect(list()).toBeNull()
  })

  it('picks with the pointer, and clears the place when the text is edited', async () => {
    const { input, value } = await mountField()
    await input.trigger('focusin')
    await input.setValue('plaza')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(value.value).toEqual(PLACES[0])
    await input.setValue('Plaza San Martín, Centro')
    expect(value.value).toBeNull()
  })

  it('says when nothing was found', async () => {
    const { input } = await mountField()
    await input.trigger('focusin')
    await input.setValue('nowhere at all')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(list()!.textContent).toContain('No places found')
  })

  it('searches while typing with instant, debounced, aborting the previous search', async () => {
    vi.useFakeTimers()
    const { input, provider } = await mountField({ instant: true, debounce: 300 })
    await input.trigger('focusin')
    await input.setValue('san')
    await input.setValue('san m')
    expect(provider).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(provider.mock.calls[0]![0]).toBe('san m')
  })

  it('shows a place set from outside, and empties when it is reset', async () => {
    const { input, value } = await mountField()
    value.value = PLACES[0]!
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe(PLACES[0]!.label)
    value.value = null
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('keeps room for its clear button from the start, so long text never runs under it', async () => {
    const { input } = await mountField()
    expect(input.classes()).toContain('pr-12')
  })

  it('clears from its button', async () => {
    const { input, value } = await mountField()
    value.value = PLACES[0]!
    await nextTick()
    await wrapper!.find('button[aria-label="Clear search"]').trigger('click')
    expect(value.value).toBeNull()
    expect((input.element as HTMLInputElement).value).toBe('')
  })
})

describe('nominatimProvider', () => {
  it('asks Nominatim with the options and reads its boxes', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ display_name: 'X', lat: '-31.4', lon: '-64.2', type: 'city', boundingbox: ['-31.5', '-31.3', '-64.3', '-64.1'] }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const results = await nominatimProvider({ countryCodes: ['ar'], language: 'es', limit: 3 })('córdoba', new AbortController().signal)
      const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0])
      expect(url.searchParams.get('q')).toBe('córdoba')
      expect(url.searchParams.get('countrycodes')).toBe('ar')
      expect(url.searchParams.get('accept-language')).toBe('es')
      expect(url.searchParams.get('limit')).toBe('3')
      expect(results).toEqual([{ label: 'X', lngLat: [-64.2, -31.4], bbox: [-64.3, -31.5, -64.1, -31.3], type: 'city' }])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
