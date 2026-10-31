import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MTextField from '../components/MTextField.vue'
import MNumberField from '../components/MNumberField.vue'
import MMaskField from '../components/MMaskField.vue'
import MTagInput from '../components/MTagInput.vue'

describe('text fields expose focus and selection', () => {
  it('MTextField focuses and selects part of its text, input or textarea', async () => {
    for (const multiline of [false, true]) {
      const w = mount(MTextField, { props: { modelValue: 'report.pdf', label: 'Name', multiline }, attachTo: document.body })
      const vm = w.vm as any
      vm.focus()
      expect(document.activeElement).toBe(vm.inputEl)
      vm.setSelectionRange(0, 6)
      expect([vm.inputEl.selectionStart, vm.inputEl.selectionEnd]).toEqual([0, 6])
      vm.blur()
      expect(document.activeElement).not.toBe(vm.inputEl)
      w.unmount()
    }
  })
  it('MNumberField, MMaskField and MTagInput focus their input', () => {
    for (const [C, props] of [[MNumberField, { modelValue: 3 }], [MMaskField, { modelValue: '', mask: '##' }], [MTagInput, { modelValue: [] }]] as const) {
      const w = mount(C as any, { props, attachTo: document.body })
      ;(w.vm as any).focus()
      expect(document.activeElement).toBe((w.vm as any).inputEl)
      w.unmount()
    }
  })
})
