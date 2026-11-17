import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MCreditCardInput from '../components/MCreditCardInput.vue'
import { detectCardBrand, formatCardNumber, isValidCardNumber, isValidExpiry, luhnCheck } from '../composables/cardBrand'

const empty = { number: '', expiry: '', cvc: '' }

describe('card helpers', () => {
  it('detects networks', () => {
    expect(detectCardBrand('4242').brand).toBe('visa')
    expect(detectCardBrand('5555 5555').brand).toBe('mastercard')
    expect(detectCardBrand('2223').brand).toBe('mastercard')
    expect(detectCardBrand('3782').brand).toBe('amex')
    expect(detectCardBrand('6011').brand).toBe('discover')
    expect(detectCardBrand('3530').brand).toBe('jcb')
    expect(detectCardBrand('589562').brand).toBe('naranja')
    expect(detectCardBrand('9999').brand).toBe('unknown')
  })

  it('checks Luhn and lengths', () => {
    expect(luhnCheck('4242424242424242')).toBe(true)
    expect(luhnCheck('4242424242424241')).toBe(false)
    expect(isValidCardNumber('4242 4242 4242 4242')).toBe(true)
    expect(isValidCardNumber('424242424242')).toBe(false)
    expect(isValidCardNumber('378282246310005')).toBe(true)
  })

  it('groups numbers the way the network prints them', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242')
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005')
  })

  it('accepts only future expiries', () => {
    const now = new Date(2026, 10, 17)
    expect(isValidExpiry('11/26', now)).toBe(true)
    expect(isValidExpiry('10/26', now)).toBe(false)
    expect(isValidExpiry('13/27', now)).toBe(false)
    expect(isValidExpiry('1/27', now)).toBe(false)
  })
})

describe('MCreditCardInput', () => {
  function inputs(w: ReturnType<typeof mount>) {
    return w.findAll('input')
  }

  it('keeps digits only in the value and shows them grouped', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    await inputs(w)[0]!.setValue('4242-4242 4242a4242')
    const v = w.emitted('update:modelValue')!.at(-1)![0] as typeof empty
    expect(v.number).toBe('4242424242424242')
    await w.setProps({ modelValue: v })
    expect((inputs(w)[0]!.element as HTMLInputElement).value).toBe('4242 4242 4242 4242')
  })

  it('caps the number at the network length', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    await inputs(w)[0]!.setValue('37828224631000599')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).number).toBe('378282246310005')
  })

  it('stops a Visa or an unknown network at 16 digits', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    await inputs(w)[0]!.setValue('4242424242424242123')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).number).toBe('4242424242424242')
    await inputs(w)[0]!.setValue('9999999999999999123')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).number).toBe('9999999999999999')
  })

  it('formats the expiry and pads a single-digit month', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    await inputs(w)[1]!.setValue('4')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).expiry).toBe('04')
    await inputs(w)[1]!.setValue('1229')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).expiry).toBe('12/29')
  })

  it('limits the security code to the network length', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: { ...empty, number: '4242' } } })
    await inputs(w)[2]!.setValue('12345')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).cvc).toBe('123')
    await w.setProps({ modelValue: { ...empty, number: '3782' } })
    await inputs(w)[2]!.setValue('12345')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as typeof empty).cvc).toBe('1234')
  })

  it('shows an error only after a field is left', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: { ...empty, number: '4242424242424241' } } })
    expect(w.text()).not.toContain('Invalid card number')
    await inputs(w)[0]!.trigger('focusout')
    expect(w.text()).toContain('Invalid card number')
  })

  it('validate() marks every field and reports validity', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    expect((w.vm as any).validate()).toBe(false)
    await w.vm.$nextTick()
    expect(w.text()).toContain('Invalid or expired date')
    await w.setProps({ modelValue: { number: '4242424242424242', expiry: '12/40', cvc: '123' } })
    expect((w.vm as any).validate()).toBe(true)
  })

  it('emits complete once every field is valid', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    await w.setProps({ modelValue: { number: '4242424242424242', expiry: '12/40', cvc: '123' } })
    expect(w.emitted('complete')).toHaveLength(1)
    expect(w.emitted('brand')?.[0]).toEqual(['visa'])
  })

  it('shows external errors', () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty, errors: { number: 'Card declined' } } })
    expect(w.text()).toContain('Card declined')
  })

  it('flips the preview while the security code is focused', async () => {
    const w = mount(MCreditCardInput, { props: { modelValue: empty } })
    await inputs(w)[2]!.trigger('focusin')
    expect(w.find('.m3-cc-preview__inner').classes()).toContain('is-flipped')
    await inputs(w)[2]!.trigger('focusout')
    expect(w.find('.m3-cc-preview__inner').classes()).not.toContain('is-flipped')
  })
})
