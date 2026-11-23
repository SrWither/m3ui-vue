import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MSelect from '../components/MSelect.vue'
import MTextField from '../components/MTextField.vue'
import MAutocomplete from '../components/MAutocomplete.vue'
import MMultiSelect from '../components/MMultiSelect.vue'
import MTagInput from '../components/MTagInput.vue'
import MDatePicker from '../components/MDatePicker.vue'
import MDateRangePicker from '../components/MDateRangePicker.vue'

const LONG = 'No cumple, pendientes y en proceso (P, EP)'
const options = [{ value: 'x', label: LONG }]

function cls(el: Element | null | undefined) {
  return (el?.getAttribute('class') ?? '').split(/\s+/)
}

/** Simulates a value cut by overflow (happy-dom has no layout) */
function fakeOverflow(el: HTMLElement, cut: boolean) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: cut ? 300 : 100 })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 100 })
}

describe('long content in narrow fields', () => {
  it('MSelect keeps a long value on one line, cut with an ellipsis', () => {
    const w = mount(MSelect, { props: { modelValue: 'x', label: 'Estado', options } })
    const value = w.find('[role="combobox"] span')
    expect(value.text()).toBe(LONG)
    expect(cls(value.element)).toEqual(expect.arrayContaining(['truncate', 'min-w-0']))
  })

  it('MSelect reserves room for the clear button as well as the arrow', () => {
    const plain = mount(MSelect, { props: { modelValue: 'x', label: 'Estado', options } })
    expect(cls(plain.find('[role="combobox"]').element)).toContain('pr-10')
    const clearable = mount(MSelect, { props: { modelValue: 'x', label: 'Estado', options, clearable: true } })
    const trigger = clearable.find('[role="combobox"]')
    expect(cls(trigger.element)).toContain('pr-16')
    expect(cls(trigger.element)).not.toContain('pr-10')
    // The floated label stops there too (filled: it sits in the same row as the clear button)
    expect(cls(clearable.find('label').element)).toContain('right-16')
  })

  it('MSelect puts the whole value in a title only when it is cut', async () => {
    const w = mount(MSelect, { props: { modelValue: 'x', label: 'Estado', options }, attachTo: document.body })
    const value = w.find('[role="combobox"] span').element as HTMLElement
    fakeOverflow(value, false)
    value.dispatchEvent(new Event('pointerenter'))
    expect(value.hasAttribute('title')).toBe(false)
    fakeOverflow(value, true)
    value.dispatchEvent(new Event('pointerenter'))
    expect(value.getAttribute('title')).toBe(LONG)
    w.unmount()
  })

  it('MTextField: the label stops before a trailing button, and the outlined floated label before the corner', () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'Etiqueta larga', clearable: true } })
    expect(cls(w.find('label').element)).toContain('right-12')
    expect(cls(w.find('input').element)).toContain('pr-12')

    const icon = mount(MTextField, { props: { modelValue: '', label: 'Etiqueta', variant: 'outlined', leadingIcon: 'search' } })
    const label = cls(icon.find('label').element)
    expect(label).toContain('left-11')
    // left-11 (44px) + 12px from the far corner
    expect(label).toContain('peer-focus:max-w-[calc(100%-3.5rem)]')
    expect(label).not.toContain('peer-focus:max-w-[calc(100%-1.5rem)]')
  })

  it('MTextField puts a cut value in a title', () => {
    const w = mount(MTextField, { props: { modelValue: LONG, label: 'Nombre' }, attachTo: document.body })
    const input = w.find('input').element as HTMLInputElement
    fakeOverflow(input, true)
    input.dispatchEvent(new Event('pointerenter'))
    expect(input.getAttribute('title')).toBe(LONG)
    w.unmount()
  })

  it('MAutocomplete reserves room for the clear button', () => {
    const w = mount(MAutocomplete, { props: { modelValue: 'x', label: 'Estado', options, clearable: true } })
    expect(cls(w.find('input').element)).toContain('pr-16')
  })

  it('chip fields cut a long chip instead of overflowing the field', () => {
    const multi = mount(MMultiSelect, { props: { modelValue: ['x'], label: 'Estados', options } })
    const chip = multi.find('[role="button"] > span')
    expect(cls(chip.element)).toEqual(expect.arrayContaining(['max-w-full', 'min-w-0']))
    expect(cls(chip.find('span').element)).toContain('truncate')

    const tags = mount(MTagInput, { props: { modelValue: [LONG], label: 'Etiquetas' } })
    const tag = tags.find('span.rounded-full')
    expect(cls(tag.element)).toContain('max-w-full')
    expect(cls(tag.find('span').element)).toContain('truncate')
  })

  it('date pickers cut a long value and a long label', () => {
    for (const w of [
      mount(MDatePicker, { props: { modelValue: '2026-11-22', label: 'Fecha de inicio del período' } }),
      mount(MDateRangePicker, { props: { modelValue: { start: '2026-11-01', end: '2026-11-22' }, label: 'Período' } }),
    ]) {
      expect(cls(w.find('button span.flex-1').element)).toEqual(expect.arrayContaining(['truncate', 'min-w-0']))
      expect(cls(w.find('label').element)).toEqual(expect.arrayContaining(['truncate', 'max-w-[calc(100%-1.5rem)]']))
    }
  })

  it('keeps the title in step when the value changes while it is shown', async () => {
    const w = mount(MSelect, {
      props: { modelValue: 'x', label: 'Estado', options: [...options, { value: 'y', label: `${LONG} (2)` }] },
      attachTo: document.body,
    })
    const value = w.find('[role="combobox"] span').element as HTMLElement
    fakeOverflow(value, true)
    value.dispatchEvent(new Event('pointerenter'))
    await w.setProps({ modelValue: 'y' })
    await nextTick()
    expect(value.getAttribute('title')).toBe(`${LONG} (2)`)
    w.unmount()
  })
})
