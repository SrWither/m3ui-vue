import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MTimeScroll from '../components/MTimeScroll.vue'
import MScrollField from '../components/MScrollField.vue'

describe('MTimeScroll', () => {
  it('maps a 12-hour time onto the wheels (12 o\'clock is the last hour item)', () => {
    const w = mount(MTimeScroll, { props: { modelValue: '00:30' } })
    const [hours, minutes] = w.findAllComponents(MScrollField)
    expect(hours!.props('count')).toBe(12)
    expect(hours!.props('modelValue')).toBe(11)
    expect(minutes!.props('modelValue')).toBe(30)
    expect(w.find('[role="radio"][aria-checked="true"]').text()).toMatch(/AM/i)
  })

  it('keeps AM/PM when the hour wheel turns', async () => {
    const w = mount(MTimeScroll, { props: { modelValue: '15:00' } })
    await w.findAllComponents(MScrollField)[0]!.vm.$emit('update:modelValue', 0)
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['13:00'])
  })

  it('switches period with the toggle', async () => {
    const w = mount(MTimeScroll, { props: { modelValue: '09:15' } })
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['21:15'])
  })

  it('uses a 24-hour wheel without the toggle', async () => {
    const w = mount(MTimeScroll, { props: { modelValue: '18:40', use24h: true } })
    const [hours] = w.findAllComponents(MScrollField)
    expect(hours!.props('count')).toBe(24)
    expect(hours!.props('modelValue')).toBe(18)
    expect(w.find('[role="radiogroup"]').exists()).toBe(false)
  })

  it('steps minutes by minuteStep', async () => {
    const w = mount(MTimeScroll, { props: { modelValue: '10:07', minuteStep: 5 } })
    const minutes = w.findAllComponents(MScrollField)[1]!
    expect(minutes.props('count')).toBe(12)
    expect(minutes.props('modelValue')).toBe(1)
    await minutes.vm.$emit('update:modelValue', 3)
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['10:15'])
  })
})
