import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MButtonGroup from '../components/MButtonGroup.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

// Springs run on rAF; give them time to settle
const settle = () => new Promise((r) => setTimeout(r, 600))
const radius = (el: Element) => (el as HTMLElement).style.borderRadius

describe('MButtonGroup', () => {
  const options = [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }, { value: 'c', label: 'Three' }]

  it('connected: 8px inner corners, 4px while pressed, a pill when selected', async () => {
    wrapper = mount(MButtonGroup, { props: { modelValue: 'c', options, variant: 'connected' }, attachTo: document.body })
    const [a, b, c] = wrapper.findAll('button').map((x) => x.element)
    await settle()
    expect(radius(a!)).toBe('20px 8px 8px 20px')
    expect(radius(b!)).toBe('8px')
    expect(radius(c!)).toBe('20px')
    b!.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))
    await settle()
    expect(radius(b!)).toBe('4px')
  })

  it('standard: a selected button squares off', async () => {
    wrapper = mount(MButtonGroup, { props: { modelValue: 'a', options }, attachTo: document.body })
    const [a, b] = wrapper.findAll('button').map((x) => x.element)
    await settle()
    expect(radius(a!)).toBe('12px')
    expect(radius(b!)).toBe('20px')
  })

  it('standard: the pressed button grows into its neighbors', async () => {
    wrapper = mount(MButtonGroup, { props: { modelValue: null, options }, attachTo: document.body })
    const buttons = wrapper.findAll('button').map((x) => x.element as HTMLElement)
    buttons.forEach((el) => Object.defineProperty(el, 'offsetWidth', { value: 100, configurable: true }))
    buttons[1]!.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))
    await settle()
    // Middle: 15% of 100 split over both sides (7.5 → 8 each, rounded), capped by the 16px padding
    expect(buttons.map((el) => el.style.width)).toEqual(['92px', '116px', '92px'])
    buttons[1]!.dispatchEvent(new PointerEvent('pointerup'))
    await settle()
    expect(buttons.map((el) => el.style.width)).toEqual(['', '', ''])
  })
})
