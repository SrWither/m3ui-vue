import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useAutoGrow } from '../composables/useAutoGrow'
import MTextField from '../components/MTextField.vue'

// happy-dom has no layout: give the textarea a 20px line height, 8px vertical padding (border-box) and a
// scrollHeight of 20px per line of text plus the padding
function fakeLayout(el: HTMLTextAreaElement) {
  el.style.lineHeight = '20px'
  el.style.padding = '4px 0'
  el.style.boxSizing = 'border-box'
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => el.value.split('\n').length * 20 + 8 })
}

let unmount: (() => void) | undefined
afterEach(() => unmount?.())

function mountArea(options: { minRows?: number; maxRows?: number }, initial = '') {
  const text = ref(initial)
  const area = ref<HTMLTextAreaElement>()
  const w = mount(
    defineComponent({
      setup() {
        useAutoGrow(area, { ...options, value: text })
        return () => h('textarea', { ref: (e: unknown) => {
          if (e && !area.value) fakeLayout(e as HTMLTextAreaElement)
          area.value = e as HTMLTextAreaElement
        }, value: text.value })
      },
    }),
    { attachTo: document.body },
  )
  unmount = () => w.unmount()
  return { text, el: () => area.value! }
}

describe('useAutoGrow', () => {
  it('starts at minRows', async () => {
    const { el } = mountArea({ minRows: 2 })
    await nextTick()
    expect(el().style.height).toBe('48px') // 2 × 20 + 8
  })

  it('grows with the text up to maxRows, then scrolls', async () => {
    const { text, el } = mountArea({ maxRows: 3 })
    text.value = 'a\nb'
    await nextTick()
    expect(el().style.height).toBe('48px')
    expect(el().style.overflowY).toBe('hidden')
    text.value = 'a\nb\nc\nd\ne'
    await nextTick()
    expect(el().style.height).toBe('68px') // capped at 3 × 20 + 8
    expect(el().style.overflowY).toBe('auto')
  })

  it('shrinks back when the text is cleared from code', async () => {
    const { text, el } = mountArea({}, 'a\nb\nc')
    await nextTick()
    expect(el().style.height).toBe('68px')
    text.value = ''
    await nextTick()
    expect(el().style.height).toBe('28px')
  })

  it('follows typing without a value source', async () => {
    const area = ref<HTMLTextAreaElement>()
    const w = mount(defineComponent({
      setup() {
        useAutoGrow(area)
        return () => h('textarea', { ref: (e: unknown) => {
          if (e && !area.value) fakeLayout(e as HTMLTextAreaElement)
          area.value = e as HTMLTextAreaElement
        } })
      },
    }))
    unmount = () => w.unmount()
    await nextTick()
    area.value!.value = 'a\nb\nc\nd'
    area.value!.dispatchEvent(new Event('input'))
    expect(area.value!.style.height).toBe('88px')
  })
})

describe('MTextField autoGrow', () => {
  it('drops the drag handle and sizes the textarea itself', async () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'Notes', multiline: true, autoGrow: true, rows: 1, maxRows: 4 } })
    unmount = () => w.unmount()
    await nextTick()
    const ta = w.find('textarea')
    expect(ta.classes()).toContain('resize-none')
    expect(ta.element.style.height).not.toBe('')
  })

  it('keeps the fixed, resizable textarea without autoGrow', async () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'Notes', multiline: true } })
    unmount = () => w.unmount()
    await nextTick()
    const ta = w.find('textarea')
    expect(ta.classes()).toContain('resize-y')
    expect(ta.element.style.height).toBe('')
  })
})
