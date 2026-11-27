import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, type Component } from 'vue'
import MForm from '../components/MForm.vue'
import MNumberField from '../components/MNumberField.vue'
import MMaskField from '../components/MMaskField.vue'
import MTagInput from '../components/MTagInput.vue'
import MPinInput from '../components/MPinInput.vue'
import MSelect from '../components/MSelect.vue'
import MMultiSelect from '../components/MMultiSelect.vue'
import MAutocomplete from '../components/MAutocomplete.vue'
import MMultiAutocomplete from '../components/MMultiAutocomplete.vue'
import MDatePicker from '../components/MDatePicker.vue'
import MDateRangePicker from '../components/MDateRangePicker.vue'
import MTimePicker from '../components/MTimePicker.vue'
import MColorPicker from '../components/MColorPicker.vue'
import MPhoneInput from '../components/MPhoneInput.vue'
import MCountrySelect from '../components/MCountrySelect.vue'
import MTimezoneSelect from '../components/MTimezoneSelect.vue'
import MMentionField from '../components/MMentionField.vue'
import MAddressField from '../components/MAddressField.vue'
import { defaultLocale } from '../composables/useLocale'

const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]

/** Every form field of phase 2, empty, with what it needs to mount */
const cases: [string, Component, Record<string, unknown>][] = [
  ['MNumberField', MNumberField, { modelValue: null }],
  ['MMaskField', MMaskField, { modelValue: '', mask: '###' }],
  ['MTagInput', MTagInput, { modelValue: [] }],
  ['MPinInput', MPinInput, { modelValue: '12', length: 4 }], // partly filled counts as empty
  ['MSelect', MSelect, { modelValue: undefined, options }],
  ['MMultiSelect', MMultiSelect, { modelValue: [], options }],
  ['MAutocomplete', MAutocomplete, { modelValue: undefined, options }],
  ['MMultiAutocomplete', MMultiAutocomplete, { modelValue: [], options }],
  ['MDatePicker', MDatePicker, { modelValue: null }],
  ['MDateRangePicker', MDateRangePicker, { modelValue: { start: '2026-01-01', end: null } }], // half a range is empty
  ['MTimePicker', MTimePicker, { modelValue: null }],
  ['MColorPicker', MColorPicker, { modelValue: '' }],
  ['MPhoneInput', MPhoneInput, { modelValue: null, country: 'AR' }],
  ['MCountrySelect', MCountrySelect, { modelValue: null }],
  ['MTimezoneSelect', MTimezoneSelect, { modelValue: null }],
  ['MMentionField', MMentionField, { modelValue: '', sources: [] }],
  ['MAddressField', MAddressField, { modelValue: null }],
]

async function submit(field: Component, props: Record<string, unknown>) {
  const onSubmit = vi.fn()
  const onInvalid = vi.fn()
  const w = mount(() => h(MForm, { onSubmit, onInvalid }, () => h(field, { label: 'Field', name: 'f', ...props })), { attachTo: document.body })
  await flushPromises()
  await w.find('form').trigger('submit')
  await flushPromises()
  return { w, onSubmit, onInvalid }
}

describe('form fields in an MForm', () => {
  it.each(cases)('%s: required blocks submit, shows the message and takes the focus', async (_, field, props) => {
    const { w, onSubmit, onInvalid } = await submit(field, { ...props, required: true })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onInvalid).toHaveBeenCalledWith({ f: defaultLocale.validationRequired })
    expect(w.findAll('[role="alert"]').map((p) => p.text())).toEqual([defaultLocale.validationRequired])
    expect(w.element.contains(document.activeElement)).toBe(true)
    w.unmount()
  })

  it.each(cases)('%s: a string error is the message', async (_, field, props) => {
    const w = mount(field, { props: { label: 'Field', ...props, error: 'From the server' } })
    await flushPromises()
    expect(w.findAll('[role="alert"]').map((p) => p.text())).toEqual(['From the server'])
  })

  it.each(cases)('%s: required outside an MForm keeps quiet', async (_, field, props) => {
    const w = mount(field, { props: { label: 'Field', ...props, required: true }, attachTo: document.body })
    await flushPromises()
    w.element.dispatchEvent?.(new FocusEvent('focusout', { bubbles: true }))
    await new Promise((r) => setTimeout(r))
    await flushPromises()
    expect(w.findAll('[role="alert"]')).toHaveLength(0)
    w.unmount()
  })
})

describe('leaving a field', () => {
  it("MNumberField: the stepper buttons aren't leaving it", async () => {
    const onBlur = vi.fn()
    const w = mount(MNumberField, { props: { label: 'Qty', modelValue: null, rules: [() => 'Bad'], onBlur }, attachTo: document.body })
    const input = w.find('input').element as HTMLInputElement
    const plus = w.findAll('button')[1].element as HTMLButtonElement
    input.focus()
    plus.focus() // focus moves inside the field
    await new Promise((r) => setTimeout(r))
    await flushPromises()
    expect(onBlur).not.toHaveBeenCalled()
    plus.blur() // now it really leaves
    await new Promise((r) => setTimeout(r))
    await flushPromises()
    expect(onBlur).toHaveBeenCalledTimes(1)
    expect(w.find('[role="alert"]').text()).toBe('Bad')
    w.unmount()
  })

  it("MDatePicker: opening the calendar isn't leaving it; closing it with focus outside is", async () => {
    const onBlur = vi.fn()
    const w = mount(MDatePicker, { props: { label: 'Date', modelValue: null, rules: [() => 'Pick one'], onBlur }, attachTo: document.body })
    const trigger = w.find('button')
    trigger.element.focus()
    await trigger.trigger('click') // opens the teleported panel
    ;(document.activeElement as HTMLElement | null)?.blur()
    w.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await new Promise((r) => setTimeout(r))
    expect(onBlur).not.toHaveBeenCalled()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) // a click outside closes it
    await flushPromises()
    await new Promise((r) => setTimeout(r))
    await flushPromises()
    expect(onBlur).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('MPhoneInput: an incomplete number blocks an MForm submit', async () => {
    const { onSubmit, onInvalid, w } = await submit(MPhoneInput, { modelValue: '+54112', country: 'AR' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(Object.keys(onInvalid.mock.calls[0][0])).toEqual(['f'])
    w.unmount()
  })

  it('MAddressField: validates the picked place, and its inner text field stays out of the form', async () => {
    const { onInvalid, w } = await submit(MAddressField, { modelValue: null, required: true })
    // One field in the form (the address), not two
    expect(onInvalid).toHaveBeenCalledWith({ f: defaultLocale.validationRequired })
    expect(w.findAll('[role="alert"]')).toHaveLength(1)
    w.unmount()
  })
})

// ── Phase 3: controls that had no error state ─────────────────────────
import MCheckbox from '../components/MCheckbox.vue'
import MSwitch from '../components/MSwitch.vue'
import MRadioGroup from '../components/MRadioGroup.vue'
import MRating from '../components/MRating.vue'
import MSegmentedButton from '../components/MSegmentedButton.vue'
import MCronField from '../components/MCronField.vue'
import MFileUpload from '../components/MFileUpload.vue'
import MSignaturePad from '../components/MSignaturePad.vue'
import MCreditCardInput from '../components/MCreditCardInput.vue'
import MJsonEditor from '../components/MJsonEditor.vue'
import MSlider from '../components/MSlider.vue'
import { min } from '../composables/validation'

const blankCard = { number: '', expiry: '', cvc: '' }
/** [name, component, empty props, can it take focus] */
const groupB: [string, Component, Record<string, unknown>, boolean][] = [
  ['MCheckbox', MCheckbox, { modelValue: false }, true],
  ['MSwitch', MSwitch, { modelValue: false }, true],
  ['MRadioGroup', MRadioGroup, { modelValue: null, options }, true],
  ['MRating', MRating, { modelValue: 0 }, true],
  ['MSegmentedButton', MSegmentedButton, { modelValue: undefined, options }, true],
  ['MCronField', MCronField, { modelValue: '' }, true],
  ['MFileUpload', MFileUpload, { modelValue: [] }, true],
  ['MSignaturePad', MSignaturePad, {}, false],
  ['MCreditCardInput', MCreditCardInput, { modelValue: blankCard, preview: false }, true],
  ['MJsonEditor', MJsonEditor, { modelValue: null }, false],
]

describe('group B fields in an MForm', () => {
  it.each(groupB)('%s: required blocks submit and shows the message', async (_, field, props, focusable) => {
    const { w, onSubmit, onInvalid } = await submit(field, { ...props, required: true })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(Object.keys(onInvalid.mock.calls[0][0])).toEqual(['f'])
    const alerts = [...document.body.querySelectorAll('[role="alert"]')].map((p) => p.textContent?.trim())
    // The card shows its fields' own messages instead of a general one
    if (field !== MCreditCardInput) expect(alerts).toEqual([defaultLocale.validationRequired])
    else expect(alerts.length).toBeGreaterThan(0)
    if (focusable) expect(w.element.contains(document.activeElement)).toBe(true)
    w.unmount()
  })

  it.each(groupB)('%s: a string error is the message', async (_, field, props) => {
    const w = mount(field, { props: { label: 'Field', ...props, error: 'From the server' }, attachTo: document.body })
    await flushPromises()
    expect([...document.body.querySelectorAll('[role="alert"]')].map((p) => p.textContent?.trim())).toEqual(['From the server'])
    w.unmount()
  })

  it('MCheckbox takes the M3 error colors (Error outline unticked, Error container ticked)', async () => {
    const w = mount(MCheckbox, { props: { modelValue: false, label: 'Terms', error: true } })
    const box = () => w.findAll('span').find((s) => s.classes().includes('h-4.5'))!
    expect(box().classes()).toContain('border-error')
    await w.setProps({ modelValue: true })
    expect(box().classes()).toEqual(expect.arrayContaining(['bg-error', 'text-on-error']))
  })

  it('MSlider: rules (not required) set its limits', async () => {
    const { onInvalid, w } = await submit(MSlider, { modelValue: 0, rules: [min(10)] })
    expect(onInvalid).toHaveBeenCalledWith({ f: 'Must be at least 10' })
    w.unmount()
  })

  it('MCreditCardInput: an optional empty card passes, a half-typed one does not', async () => {
    const ok = await submit(MCreditCardInput, { modelValue: blankCard, preview: false })
    expect(ok.onSubmit).toHaveBeenCalled()
    ok.w.unmount()
    const bad = await submit(MCreditCardInput, { modelValue: { number: '4242', expiry: '', cvc: '' }, preview: false })
    expect(bad.onSubmit).not.toHaveBeenCalled()
    expect(bad.onInvalid).toHaveBeenCalledWith({ f: defaultLocale.cardInvalidNumber })
    bad.w.unmount()
  })

  it("MJsonEditor: required alone (no form, no rules) keeps quiet", async () => {
    const w = mount(MJsonEditor, { props: { modelValue: null, required: true } })
    await flushPromises()
    expect(w.findAll('[role="alert"]')).toHaveLength(0)
  })

  it('MForm disabled disables div-based fields too (MSelect)', async () => {
    const w = mount(() => h(MForm, { disabled: true }, () => h(MSelect, { label: 'Room', modelValue: undefined, options })))
    await flushPromises()
    expect(w.find('[role="combobox"]').attributes('tabindex')).toBe('-1')
  })
})
