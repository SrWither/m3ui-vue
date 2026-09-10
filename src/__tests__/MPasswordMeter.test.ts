import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MPasswordMeter from '../components/MPasswordMeter.vue'

describe('MPasswordMeter', () => {
  it('shows no label and no filled segments for an empty value', () => {
    const wrapper = mount(MPasswordMeter, { props: { value: '' } })
    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('rates a short lowercase-only password as very weak', () => {
    const wrapper = mount(MPasswordMeter, { props: { value: 'abc' } })
    expect(wrapper.text()).toBe('Very weak')
  })

  it('rates a long, varied password as strong', () => {
    const wrapper = mount(MPasswordMeter, { props: { value: 'Sup3r$ecureLongPass!' } })
    expect(wrapper.text()).toBe('Strong')
  })

  it('emits score whenever the value changes', async () => {
    const wrapper = mount(MPasswordMeter, { props: { value: '' } })
    expect(wrapper.emitted('score')![0]).toEqual([-1])

    await wrapper.setProps({ value: 'Sup3r$ecureLongPass!' })
    expect(wrapper.emitted('score')!.at(-1)).toEqual([4])
  })

  it('supports custom labels', () => {
    const wrapper = mount(MPasswordMeter, {
      props: { value: 'abc', labels: ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'] },
    })
    expect(wrapper.text()).toBe('Muy débil')
  })

  it('respects a custom minLength when scoring', () => {
    const short = mount(MPasswordMeter, { props: { value: '1234', minLength: 4 } })
    const shortScore = short.emitted('score')![0]![0]
    const long = mount(MPasswordMeter, { props: { value: '123', minLength: 4 } })
    const longScore = long.emitted('score')![0]![0]
    expect(shortScore).toBeGreaterThan(longScore as number)
  })
})
