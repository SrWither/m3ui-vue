import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MCountrySelect from '../components/MCountrySelect.vue'
import MTimezoneSelect from '../components/MTimezoneSelect.vue'
import MAutocomplete from '../components/MAutocomplete.vue'
import { M3_LOCALE_KEY } from '../composables/useLocale'
import { esLocale } from '../locales'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

type Opt = { value: string; label: string }
const opts = () => wrapper!.findComponent(MAutocomplete).props('options') as Opt[]

describe('MCountrySelect', () => {
  it('lists every country by name, sorted, with flags, labelled Country', () => {
    wrapper = mount(MCountrySelect)
    const o = opts()
    expect(o.length).toBeGreaterThan(200)
    expect(new Set(o.map((x) => x.value)).size).toBe(o.length)
    const ar = o.find((x) => x.value === 'AR')!
    expect(ar.label).toBe('🇦🇷 Argentina')
    const names = o.map((x) => x.label.slice(5))
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(wrapper.find('label').text()).toBe('Country')
  })

  it('names them in the app\'s language, puts preferred ones first, and drops flags', () => {
    wrapper = mount(MCountrySelect, {
      props: { preferred: ['UY', 'AR'], flags: false },
      global: { provide: { [M3_LOCALE_KEY as symbol]: { ...esLocale, lang: 'es' } } },
    })
    const o = opts()
    expect(o.slice(0, 2)).toEqual([{ value: 'UY', label: 'Uruguay' }, { value: 'AR', label: 'Argentina' }])
    expect(o.find((x) => x.value === 'DE')!.label).toBe('Alemania')
    expect(wrapper.find('label').text()).toBe('País')
  })

  it('limits to `only`, in its order, and emits the code', async () => {
    wrapper = mount(MCountrySelect, { props: { only: ['CL', 'AR'], flags: false } })
    expect(opts().map((x) => x.value)).toEqual(['CL', 'AR'])
    wrapper.findComponent(MAutocomplete).vm.$emit('update:modelValue', 'AR')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['AR'])
  })
})

describe('MTimezoneSelect', () => {
  it('lists zones by offset with their city', () => {
    wrapper = mount(MTimezoneSelect, { props: { only: ['Asia/Tokyo', 'UTC', 'America/Argentina/Buenos_Aires'] } })
    expect(opts()).toEqual([
      { value: 'America/Argentina/Buenos_Aires', label: 'UTC−03:00 · Buenos Aires (America)' },
      { value: 'UTC', label: 'UTC+00:00 · UTC' },
      { value: 'Asia/Tokyo', label: 'UTC+09:00 · Tokyo (Asia)' },
    ])
    expect(wrapper.find('label').text()).toBe('Time zone')
  })

  it('starts on the user\'s own zone with detect', () => {
    wrapper = mount(MTimezoneSelect, { props: { detect: true } })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone])
    expect(opts().length).toBeGreaterThan(20)
  })
})
