import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MColorPicker from '../components/MColorPicker.vue'
import MColorPickerModal from '../components/MColorPickerModal.vue'
import { recentColors } from '../composables/_colorUtils'

let wrapper: VueWrapper | undefined

beforeEach(() => {
  localStorage.clear()
  recentColors.value = []
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const $ = <T extends Element = HTMLElement>(sel: string) => document.body.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.body.querySelectorAll<T>(sel)]
const slider = (label: string) => $(`[role="slider"][aria-label="${label}"]`)!
const lastEmit = (w: VueWrapper) => w.emitted<[string]>('update:modelValue')?.at(-1)?.[0]

function rect(el: Element, width: number, height: number) {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

async function openPicker(props: Record<string, unknown>) {
  wrapper = mount(MColorPicker, {
    props: { 'onUpdate:modelValue': (v: string) => wrapper!.setProps({ modelValue: v }), ...props },
    attachTo: document.body,
  })
  await wrapper.find('button').trigger('click')
  await nextTick()
  return wrapper
}

describe('MColorPicker', () => {
  it('keeps the hue when the color is dragged to black', async () => {
    const w = await openPicker({ modelValue: '#00ff00' })
    const area = slider('Saturation, Brightness')
    rect(area, 200, 100)
    area.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 100, button: 0, bubbles: true }))
    await nextTick()
    expect(lastEmit(w)).toBe('#000000')
    await nextTick()
    expect(slider('Hue').getAttribute('aria-valuenow')).toBe('120')
    expect(area.getAttribute('aria-valuenow')).toBe('100')
  })

  it('updates live while dragging the hue', async () => {
    const w = await openPicker({ modelValue: '#ff0000' })
    const hue = slider('Hue')
    rect(hue, 200, 24)
    // 10px inset on each side: the middle of the track is 180°
    hue.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 12, button: 0, bubbles: true }))
    await nextTick()
    expect(lastEmit(w)).toBe('#00ffff')
  })

  it('marks the selected preset regardless of case, with a readable check', async () => {
    await openPicker({ modelValue: '#FFEB3B' })
    const swatch = $('button[aria-label="#ffeb3b"]')!
    expect(swatch.getAttribute('aria-pressed')).toBe('true')
    expect(swatch.querySelector<HTMLElement>('.material-symbols-outlined')!.style.color).toMatch(/#000000|rgb\(0, 0, 0\)/)
  })

  it('accepts hex without # and in short form', async () => {
    const w = await openPicker({ modelValue: '#000000' })
    const input = $<HTMLInputElement>('input[aria-label="HEX"]')!
    input.value = 'f80'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(lastEmit(w)).toBe('#ff8800')
  })

  it('edits RGB channels', async () => {
    const w = await openPicker({ modelValue: '#000000' })
    $('button[aria-label="Color format: HEX"]')!.click()
    await nextTick()
    const r = $<HTMLInputElement>('input[aria-label="R"]')!
    r.value = '255'
    r.dispatchEvent(new Event('input'))
    await nextTick()
    expect(lastEmit(w)).toBe('#ff0000')
  })

  it('emits an 8-digit hex with the alpha slider', async () => {
    const w = await openPicker({ modelValue: '#ff0000', alpha: true })
    const alpha = slider('Opacity')
    alpha.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await nextTick()
    expect(lastEmit(w)).toBe('#ff000000')
  })

  it('closes on Escape and remembers the picked color', async () => {
    const w = await openPicker({ modelValue: '#ff0000' })
    slider('Hue').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    slider('Hue').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }))
    await nextTick()
    $('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect($('[role="dialog"]')).toBeNull()
    expect(recentColors.value).toEqual([lastEmit(w)])
    expect(JSON.parse(localStorage.getItem('m3-color-recent')!)).toEqual(recentColors.value)
  })
})

describe('MColorPickerModal', () => {
  it('only emits on confirm, and records the color as recent', async () => {
    wrapper = mount(MColorPickerModal, {
      props: { modelValue: '#ff0000', show: true },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.body.textContent).toContain('Select color')
    $('button[aria-label="#2196f3"]')!.click()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    // The preview shows the original next to the new color
    expect($('button[aria-label="Original color"]')).not.toBeNull()
    $$('button').find((b) => b.textContent?.trim() === 'Confirm')!.click()
    expect(lastEmit(wrapper)).toBe('#2196f3')
    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
    expect(recentColors.value).toEqual(['#2196f3'])
  })

  it('discards the draft on cancel', async () => {
    wrapper = mount(MColorPickerModal, {
      props: { modelValue: '#ff0000', show: true },
      attachTo: document.body,
    })
    await nextTick()
    $('button[aria-label="#2196f3"]')!.click()
    $$('button').find((b) => b.textContent?.trim() === 'Cancel')!.click()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('update:show')?.at(-1)).toEqual([false])
  })
})
