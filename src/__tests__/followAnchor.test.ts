import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MSelect from '../components/MSelect.vue'
import MDatePicker from '../components/MDatePicker.vue'
import MPhoneInput from '../components/MPhoneInput.vue'
import { isAnchorHidden } from '../composables/_useFollowAnchor'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function setRect(el: Element, r: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) }) as DOMRect
}
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

describe('isAnchorHidden', () => {
  it('is false inside the window and true once outside it', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    setRect(el, { left: 10, top: 10, width: 100, height: 40 })
    expect(isAnchorHidden(el)).toBe(false)
    setRect(el, { left: 10, top: -60, width: 100, height: 40 })
    expect(isAnchorHidden(el)).toBe(true)
  })

  it('is true when a scroll container around it cuts it away', () => {
    const box = document.createElement('div')
    box.style.overflow = 'auto'
    const el = document.createElement('div')
    box.appendChild(el)
    document.body.appendChild(box)
    setRect(box, { left: 0, top: 100, width: 300, height: 200 })
    setRect(el, { left: 10, top: 150, width: 100, height: 40 })
    expect(isAnchorHidden(el)).toBe(false)
    setRect(el, { left: 10, top: 40, width: 100, height: 40 }) // above the box's top edge
    expect(isAnchorHidden(el)).toBe(true)
  })

  it('is true for a detached element', () => {
    expect(isAnchorHidden(document.createElement('div'))).toBe(true)
  })
})

const options = [
  { label: 'One', value: 1 },
  { label: 'Two', value: 2 },
]

async function openSelect() {
  wrapper = mount(MSelect, { props: { modelValue: null, options, label: 'Pick' }, attachTo: document.body })
  const fieldEl = wrapper.element.querySelector('[class*="relative"]')!
  setRect(fieldEl, { left: 20, top: 100, width: 200, height: 56 })
  await wrapper.find('[aria-haspopup], [role="combobox"]').trigger('click')
  await nextTick()
  return fieldEl
}

describe('MSelect dropdown follows its field', () => {
  it('moves with the page scroll instead of closing', async () => {
    const fieldEl = await openSelect()
    const list = document.body.querySelector<HTMLElement>('[role="listbox"]')!
    expect(list.style.top).toBe('160px')
    setRect(fieldEl, { left: 20, top: 40, width: 200, height: 56 })
    window.dispatchEvent(new Event('scroll'))
    await frame()
    await nextTick()
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()
    expect(list.style.top).toBe('100px')
  })

  it('follows a window resize (browser zoom)', async () => {
    const fieldEl = await openSelect()
    const list = document.body.querySelector<HTMLElement>('[role="listbox"]')!
    setRect(fieldEl, { left: 60, top: 100, width: 150, height: 56 })
    window.dispatchEvent(new Event('resize'))
    await frame()
    await nextTick()
    expect(list.style.left).toBe('60px')
    expect(list.style.width).toBe('150px')
  })

  it('closes once the field is scrolled out of sight', async () => {
    const fieldEl = await openSelect()
    setRect(fieldEl, { left: 20, top: -200, width: 200, height: 56 })
    window.dispatchEvent(new Event('scroll'))
    await frame()
    await nextTick()
    expect(wrapper!.find('[aria-expanded="true"]').exists()).toBe(false)
  })

  it('also drops focus then, so the field stops looking open', async () => {
    const fieldEl = await openSelect()
    const trigger = wrapper!.find<HTMLElement>('[aria-haspopup], [role="combobox"]').element
    trigger.focus()
    await nextTick()
    const label = () => wrapper!.find('label').exists() ? wrapper!.find('label').classes().join(' ') : ''
    const focusedLabel = label()
    setRect(fieldEl, { left: 20, top: -200, width: 200, height: 56 })
    window.dispatchEvent(new Event('scroll'))
    await frame()
    await nextTick()
    expect(document.activeElement).not.toBe(trigger)
    expect(label()).not.toBe(focusedLabel)
  })

  it('ignores scrolls inside the list', async () => {
    const fieldEl = await openSelect()
    const list = document.body.querySelector<HTMLElement>('[role="listbox"]')!
    setRect(fieldEl, { left: 20, top: -200, width: 200, height: 56 })
    list.dispatchEvent(new Event('scroll', { bubbles: false }))
    await frame()
    await nextTick()
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()
  })
})

describe('MDatePicker panel follows its field', () => {
  it('moves with a container scroll instead of closing', async () => {
    wrapper = mount(MDatePicker, { props: { modelValue: null, label: 'Date' }, attachTo: document.body })
    const trigger = wrapper.element.querySelector('.relative.mt-2')!
    setRect(trigger, { left: 20, top: 100, width: 200, height: 56 })
    await wrapper.find('.relative.mt-2 button').trigger('click')
    await nextTick()
    await nextTick()
    const panel = document.body.querySelector<HTMLElement>('.fixed.z-500')
    expect(panel).toBeTruthy()
    setRect(trigger, { left: 20, top: 50, width: 200, height: 56 })
    document.body.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    await frame()
    await nextTick()
    expect(document.body.contains(panel!)).toBe(true)
    expect(panel!.style.top).toBe('110px')
  })
})

describe('MPhoneInput list', () => {
  it('closes once its field is scrolled out of sight', async () => {
    wrapper = mount(MPhoneInput, { props: { modelValue: '', label: 'Phone' }, attachTo: document.body })
    const btn = wrapper.find('button[aria-haspopup]')
    await btn.trigger('click')
    await nextTick()
    await nextTick()
    expect(btn.attributes('aria-expanded')).toBe('true')
    // Every box around the button reports itself off-screen, whichever one is the field
    let el: Element | null = btn.element
    while (el) {
      setRect(el, { left: 0, top: -300, width: 200, height: 56 })
      el = el.parentElement === document.body ? null : el.parentElement
    }
    window.dispatchEvent(new Event('scroll'))
    await frame()
    await nextTick()
    expect(btn.attributes('aria-expanded')).toBe('false')
  })
})
