import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MPhoneInput from '../components/MPhoneInput.vue'
import { formatPhone, isValidPhone, parsePhone } from '../composables/phoneNumber'

afterEach(() => { document.body.innerHTML = '' })

describe('phoneNumber', () => {
  it('formats stored numbers with the country mask, or groups without one', () => {
    expect(formatPhone('+541123456789')).toBe('+54 11 2345-6789')
    expect(formatPhone('+5491123456789')).toBe('+54 9 11 2345-6789')
    expect(formatPhone('+12125551234')).toBe('+1 (212) 555-1234')
    expect(formatPhone('+5511987654321')).toBe('+55 (11) 98765-4321')
    expect(formatPhone('+4930123456')).toBe('+49 3012 3456')
    expect(formatPhone('not a number')).toBe('not a number')
  })

  it('parses 00 prefixes, shared calling codes and the trunk 0', () => {
    expect(parsePhone('0034 612 34 56 78')!.country.iso2).toBe('ES')
    expect(parsePhone('+14165551234')!.country.iso2).toBe('US')
    expect(parsePhone('+14165551234', 'CA')!.country.iso2).toBe('CA')
    expect(parsePhone('+44 07911 123456')!.national).toBe('7911123456')
    // Italy keeps its 0
    expect(parsePhone('+39 06 1234 5678')!.national).toBe('0612345678')
  })

  it('validates lengths against the masks', () => {
    expect(isValidPhone('+541123456789')).toBe(true)
    expect(isValidPhone('+54112345678')).toBe(false)
    expect(isValidPhone('+4930123456')).toBe(true)
  })
})

describe('MPhoneInput', () => {
  const input = (w: ReturnType<typeof mount>) => w.find('input[type="tel"]')

  it('formats while typing and binds E.164', async () => {
    const w = mount(MPhoneInput, { props: { label: 'Phone', country: 'AR', modelValue: null } })
    await input(w).setValue('01123456789')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['+541123456789'])
    expect((input(w).element as HTMLInputElement).value).toBe('11 2345-6789')
    expect(w.emitted('update:valid')!.at(-1)).toEqual([true])
  })

  it('shows a bound number formatted and its country', () => {
    const w = mount(MPhoneInput, { props: { label: 'Phone', modelValue: '+5511987654321' } })
    expect((input(w).element as HTMLInputElement).value).toBe('(11) 98765-4321')
    expect(w.text()).toContain('+55')
  })

  it('switches country when a full international number is pasted', async () => {
    const w = mount(MPhoneInput, { props: { label: 'Phone', country: 'AR', modelValue: null } })
    await input(w).setValue('+34 612345678')
    expect(w.emitted('update:country')!.at(-1)).toEqual(['ES'])
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['+34612345678'])
  })

  it('backspace after a separator deletes the digit before it', async () => {
    const w = mount(MPhoneInput, { props: { label: 'Phone', country: 'US', modelValue: '+12125' }, attachTo: document.body })
    const el = input(w).element as HTMLInputElement
    expect(el.value).toBe('(212) 5')
    el.setSelectionRange(5, 5) // after "(212)"
    await input(w).trigger('keydown', { key: 'Backspace' })
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['+1215'])
    w.unmount()
  })

  it('flags an incomplete number after leaving the field', async () => {
    const w = mount(MPhoneInput, { props: { label: 'Phone', country: 'AR', modelValue: '+54112', locale: 'en' } })
    expect(w.text()).not.toContain('Incomplete')
    await input(w).trigger('blur')
    expect(w.text()).toContain('Incomplete phone number')
  })

  it('picks a country from the searchable list', async () => {
    const w = mount(MPhoneInput, { props: { label: 'Phone', country: 'AR', modelValue: '+541123456789', locale: 'en', preferred: ['MX'] }, attachTo: document.body })
    await w.find('button[aria-haspopup="listbox"]').trigger('click')
    await nextTick()
    const opts = document.querySelectorAll('[role="option"]')
    // Preferred first, then a separator, then everything
    expect(opts[0]!.textContent).toContain('Mexico')
    const search = document.querySelector<HTMLInputElement>('[role="combobox"]')!
    search.value = 'spai'
    search.dispatchEvent(new Event('input'))
    await nextTick()
    const found = document.querySelectorAll('[role="option"]')
    expect(found).toHaveLength(1)
    expect(found[0]!.textContent).toContain('Spain')
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await nextTick()
    expect(w.emitted('update:country')!.at(-1)).toEqual(['ES'])
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['+341123456789'])
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    w.unmount()
  })
})
