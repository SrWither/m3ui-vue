import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MSelect from '../components/MSelect.vue'
import MAutocomplete from '../components/MAutocomplete.vue'

const options = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
]

// The clear (X) button must leave the v-model at null, not undefined: undefined drops the key
// from JSON.stringify, so a form sent to an API never told the backend the field was emptied.
describe.each([
  ['MSelect', MSelect],
  ['MAutocomplete', MAutocomplete],
])('%s clear button', (_name, Comp) => {
  it('emits null', async () => {
    const wrapper = mount(Comp as any, {
      props: { modelValue: 1, options, clearable: true, label: 'Field' },
      attachTo: document.body,
    })
    const clear = wrapper.find('button[aria-label="Clear"]')
    expect(clear.exists()).toBe(true)
    await clear.trigger('click')
    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted.at(-1)).toEqual([null])
    expect(emitted.at(-1)![0]).not.toBeUndefined()
    wrapper.unmount()
  })
})
