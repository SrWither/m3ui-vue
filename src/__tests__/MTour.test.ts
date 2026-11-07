import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MTour, { type TourStep } from '../components/MTour.vue'

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
let wrapper: VueWrapper | null = null
const targets: HTMLElement[] = []

/** A laid-out element at a given place (happy-dom has no layout) */
function target(id: string, rect = { left: 100, top: 100, width: 80, height: 40 }) {
  const el = document.createElement('button')
  el.id = id
  document.body.appendChild(el)
  const at = { ...rect }
  el.getBoundingClientRect = () => ({ ...at, right: at.left + at.width, bottom: at.top + at.height, x: at.left, y: at.top, toJSON() {} }) as DOMRect
  el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList
  targets.push(el)
  return { el, at }
}
const tooltip = () => document.body.querySelector<HTMLElement>('.z-202')
const ring = () => document.body.querySelector<HTMLElement>('.m3-tour-ring')
const scrim = () => document.body.querySelector('.z-200')

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  targets.splice(0).forEach((el) => el.remove())
})

describe('MTour', () => {
  it('dims the page and lifts the target by default', async () => {
    const { el } = target('a')
    target('b')
    const steps: TourStep[] = [{ target: '#a', title: 'One', content: 'First' }, { target: '#b', title: 'Two', content: 'Second' }]
    wrapper = mount(MTour, { props: { modelValue: true, steps }, attachTo: document.body })
    await nextTick()
    await nextTick()
    expect(scrim()).not.toBeNull()
    expect(el.classList.contains('m3-tour-highlight')).toBe(true)
    expect(tooltip()!.textContent).toContain('First')
  })

  it('follows v-model:step and reports Next through it', async () => {
    target('a')
    target('b')
    const steps: TourStep[] = [{ target: '#a', title: 'One', content: 'First' }, { target: '#b', title: 'Two', content: 'Second' }]
    wrapper = mount(MTour, { props: { modelValue: true, steps, step: 1 }, attachTo: document.body })
    await nextTick()
    expect(tooltip()!.textContent).toContain('Second')
    await wrapper.setProps({ step: 0 })
    expect(tooltip()!.textContent).toContain('First')
    const next = [...tooltip()!.querySelectorAll('button')].find((b) => b.textContent?.includes('Next'))!
    next.click()
    expect(wrapper.emitted('update:step')).toEqual([[1]])
  })

  it('interactive: no scrim, the target left alone, a ring that follows it as it moves', async () => {
    const { el, at } = target('a')
    wrapper = mount(MTour, { props: { modelValue: true, interactive: true, steps: [{ target: () => document.getElementById('a'), title: 'One', content: 'First' }] }, attachTo: document.body })
    await nextTick()
    await frame()
    await frame()
    expect(scrim()).toBeNull()
    expect(el.classList.contains('m3-tour-highlight')).toBe(false)
    expect(ring()!.style.left).toBe('96px')
    expect(ring()!.style.width).toBe('88px')
    at.left = 300
    await frame()
    await frame()
    expect(ring()!.style.left).toBe('296px')
    // Clicking outside doesn't close it
    document.body.click()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('without a target found, sits on its placement side of the viewport and draws no ring', async () => {
    wrapper = mount(MTour, { props: { modelValue: true, interactive: true, steps: [{ target: '#missing', title: 'One', content: 'First', placement: 'bottom' }] }, attachTo: document.body })
    await nextTick()
    await frame()
    await frame()
    expect(tooltip()!.style.bottom).toBe('16px')
    expect(ring()).toBeNull()
  })

  it('takes its text and buttons from slots', async () => {
    target('a')
    wrapper = mount(MTour, {
      props: { modelValue: true, steps: [{ target: '#a', title: 'One', content: 'First' }] },
      slots: {
        content: ({ step, index }: { step: TourStep; index: number }) => h('p', { class: 'mine' }, `${index}:${step.title}`),
        actions: ({ close }: { close: () => void }) => h('button', { class: 'leave', onClick: close }, 'Leave'),
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(tooltip()!.querySelector('.mine')!.textContent).toBe('0:One')
    expect(tooltip()!.textContent).not.toContain('Finish')
    tooltip()!.querySelector<HTMLElement>('.leave')!.click()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
