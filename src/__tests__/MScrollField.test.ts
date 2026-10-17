import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MScrollField from '../components/MScrollField.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms))

describe('MScrollField', () => {
  it('formats with two digits and moves with the arrow keys, wrapping around', async () => {
    wrapper = mount(MScrollField, {
      props: { modelValue: 0, count: 60, label: 'Minute', 'onUpdate:modelValue': (v: number) => wrapper!.setProps({ modelValue: v }) },
      attachTo: document.body,
    })
    const field = wrapper.find('[role="slider"]')
    expect(field.attributes('aria-valuetext')).toBe('00')
    await field.trigger('keydown', { key: 'ArrowUp' })
    await wait()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([59])
    expect(field.attributes('aria-valuetext')).toBe('59')
  })

  it('follows an outside change the short way around', async () => {
    wrapper = mount(MScrollField, { props: { modelValue: 58, count: 60 }, attachTo: document.body })
    await wrapper.setProps({ modelValue: 1 })
    await wait()
    // 58 → 59 → 0 → 1, never back through 57…2
    const seen = wrapper.emitted<[number]>('update:modelValue')!.map((e) => e[0])
    expect(seen).toEqual([59, 0, 1])
  })

  // Regression: the wheel took its own value, handed back through v-model mid-flight, for an outside change
  // and retargeted toward it, so it stopped short (and on a 4-item wheel scrolled back and forth forever)
  it('ignores its own value coming back through v-model while it is still moving (wheel)', async () => {
    wrapper = mount(MScrollField, {
      props: { modelValue: 0, count: 4, 'onUpdate:modelValue': (v: number) => wrapper!.setProps({ modelValue: v }) },
      attachTo: document.body,
    })
    const field = wrapper.find('[role="slider"]')
    // 120px = 3 steps in one go: 0 → 3
    await field.trigger('wheel', { deltaY: 120 })
    await wait(1000)
    const seen = wrapper.emitted<[number]>('update:modelValue')!.map((e) => e[0])
    expect(seen).toEqual([1, 2, 3])
    expect(field.attributes('aria-valuetext')).toBe('03')
  })

  it('ignores its own value coming back through v-model while it is still moving (keys)', async () => {
    wrapper = mount(MScrollField, {
      props: { modelValue: 10, count: 60, 'onUpdate:modelValue': (v: number) => wrapper!.setProps({ modelValue: v }) },
      attachTo: document.body,
    })
    const field = wrapper.find('[role="slider"]')
    for (let i = 0; i < 4; i++) await field.trigger('keydown', { key: 'ArrowDown' })
    await wait(1000)
    expect(wrapper.emitted<[number]>('update:modelValue')!.at(-1)).toEqual([14])
    expect(field.attributes('aria-valuetext')).toBe('14')
  })

  it('uses a custom format', () => {
    wrapper = mount(MScrollField, { props: { modelValue: 1, count: 2, format: (i: number) => ['L', 'oz'][i]! } })
    expect(wrapper.find('[role="slider"]').attributes('aria-valuetext')).toBe('oz')
  })
})
