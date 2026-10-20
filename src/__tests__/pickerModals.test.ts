import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MDialog from '../components/MDialog.vue'
import MDatePickerModal from '../components/MDatePickerModal.vue'
import MDateRangePickerModal from '../components/MDateRangePickerModal.vue'
import MTimePickerModal from '../components/MTimePickerModal.vue'
import { M3_LOCALE_KEY } from '../composables/useLocale'
import { esLocale } from '../locales'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

const locked = () => document.body.style.overflow === 'hidden'
const box = () => document.querySelector<HTMLElement>('[role="dialog"]')

// The three modal pickers are MDialog's bare box now: its scrim, Escape, scroll lock and dialog semantics
describe.each([
  ['MDatePickerModal', MDatePickerModal, null, 'Select date'],
  ['MDateRangePickerModal', MDateRangePickerModal, { start: null, end: null }, 'Select range'],
  ['MTimePickerModal', MTimePickerModal, null, 'Select time'],
] as const)('%s', (_, Comp, value, title) => {
  const open = () => mount(Comp as any, { props: { modelValue: value, show: true, title }, attachTo: document.body })

  it('is a modal dialog named by its title, and locks the page', async () => {
    const w = open()
    await nextTick()
    expect(box()?.getAttribute('aria-modal')).toBe('true')
    expect(box()?.getAttribute('aria-label')).toBe(title)
    expect(locked()).toBe(true)
    w.unmount()
    expect(locked()).toBe(false)
  })

  it('Escape cancels without a value', async () => {
    const w = open()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:show')?.[0]).toEqual([false])
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('a click on the scrim cancels', async () => {
    const w = open()
    await nextTick()
    box()!.parentElement!.click()
    expect(w.emitted('update:show')?.[0]).toEqual([false])
    w.unmount()
  })

  it('opened from a dialog, closing it leaves the page locked under the dialog', async () => {
    const show = ref(true)
    const w = mount(defineComponent({
      setup: () => () => h(MDialog, { modelValue: true, title: 'Booking' }, () =>
        h(Comp as any, { modelValue: value, show: show.value })),
    }), { attachTo: document.body })
    await nextTick()
    show.value = false
    await nextTick()
    expect(locked()).toBe(true)
    w.unmount()
  })
})

describe('the picker dialogs\' text comes from the locale', () => {
  const withLocale = (locale: Record<string, string>) => ({ global: { provide: { [M3_LOCALE_KEY as symbol]: locale } } })

  it('OK, the input toggle and the date input follow the app\'s language and date order', async () => {
    const w = mount(MDatePickerModal, {
      props: { modelValue: '2026-03-04', show: false },
      attachTo: document.body,
      ...withLocale(esLocale as unknown as Record<string, string>),
    })
    await w.setProps({ show: true })
    await nextTick()
    expect(document.body.textContent).toContain('Aceptar')
    const toggle = document.querySelector<HTMLElement>('[aria-label="Cambiar a entrada de texto"]')!
    toggle.click()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('input[type="text"]')!
    // Spain: DD/MM/YYYY
    expect(input.value).toBe('04/03/2026')
    expect(input.placeholder).toBe('DD/MM/YYYY')
    expect(document.body.textContent).toContain('Fecha (DD/MM/YYYY)')
    input.value = '31/02/2026'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('blur'))
    await nextTick()
    // Not a date: nothing changes
    expect(document.body.textContent).toContain('4 mar')
    input.value = '9/3/2026'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(document.body.textContent).toContain('9 mar')
    w.unmount()
  })

  it('reads the US order with an English locale', async () => {
    const w = mount(MDatePickerModal, { props: { modelValue: '2026-03-04', show: false, locale: 'en-US' }, attachTo: document.body })
    await w.setProps({ show: true })
    await nextTick()
    document.querySelector<HTMLElement>('[aria-label="Switch to text input"]')!.click()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('input[type="text"]')!
    expect(input.value).toBe('03/04/2026')
    expect(input.placeholder).toBe('MM/DD/YYYY')
    w.unmount()
  })

  it('the time picker\'s AM/PM and OK are in the app\'s language', async () => {
    const w = mount(MTimePickerModal, {
      props: { modelValue: '09:30', show: false },
      attachTo: document.body,
      ...withLocale(esLocale as unknown as Record<string, string>),
    })
    await w.setProps({ show: true })
    await nextTick()
    const text = document.body.textContent!
    expect(text).toContain('Aceptar')
    expect(text).not.toMatch(/\bAM\b/)
    expect(text).toMatch(/a\.\s?m\./)
    w.unmount()
  })
})
