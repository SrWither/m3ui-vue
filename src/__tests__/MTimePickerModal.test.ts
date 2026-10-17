import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MTimePickerModal from '../components/MTimePickerModal.vue'
import MTimeScroll from '../components/MTimeScroll.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

async function open(props: Record<string, unknown>) {
  wrapper = mount(MTimePickerModal, { props: { modelValue: null, ...props }, attachTo: document.body })
  await wrapper.setProps({ show: true })
  await nextTick()
  return wrapper
}

const button = (text: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!

describe('MTimePickerModal', () => {
  it('shows the clock dial by default', async () => {
    const w = await open({ modelValue: '09:30' })
    expect(w.findComponent(MTimeScroll).exists()).toBe(false)
    expect(document.body.textContent).toContain('09')
  })

  it('picks the time with scroll wheels in scroll mode and confirms it as 24-hour', async () => {
    const w = await open({ modelValue: '21:07', mode: 'scroll' })
    const scroll = w.findComponent(MTimeScroll)
    expect(scroll.exists()).toBe(true)
    // The minute wheel only shows multiples of minuteStep (5): it starts on 05
    expect(scroll.props('modelValue')).toBe('21:05')
    await scroll.vm.$emit('update:modelValue', '08:45')
    button('OK').click()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['08:45'])
  })

  it('switches between scroll and keyboard input', async () => {
    const w = await open({ modelValue: '14:00', mode: 'scroll', use24h: true })
    const toggle = document.body.querySelector<HTMLButtonElement>('[aria-label="Switch to text input mode"]')!
    toggle.click()
    await nextTick()
    expect(w.findComponent(MTimeScroll).exists()).toBe(false)
    expect(document.body.querySelectorAll('input')).toHaveLength(2)
    document.body.querySelector<HTMLButtonElement>('[aria-label="Switch to scroll mode"]')!.click()
    await nextTick()
    expect(w.findComponent(MTimeScroll).props('modelValue')).toBe('14:00')
  })
})
