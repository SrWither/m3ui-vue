import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import MDialog from '../components/MDialog.vue'
import MSelect from '../components/MSelect.vue'

const locked = () => document.body.style.overflow === 'hidden'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('the page scroll lock shared by modal surfaces', () => {
  it('stacked dialogs: closing the inner one keeps the page locked under the outer one', async () => {
    const outer = ref(true)
    const inner = ref(true)
    const w = mount(defineComponent({
      setup: () => () => [
        h(MDialog, { modelValue: outer.value, title: 'Outer' }, () => 'outer'),
        h(MDialog, { modelValue: inner.value, title: 'Inner' }, () => 'inner'),
      ],
    }), { attachTo: document.body })
    await nextTick()
    expect(locked()).toBe(true)
    inner.value = false
    await nextTick()
    expect(locked()).toBe(true)
    outer.value = false
    await nextTick()
    expect(locked()).toBe(false)
    w.unmount()
  })

  it('a dialog removed while open releases the page', async () => {
    const show = ref(true)
    const w = mount(defineComponent({
      setup: () => () => (show.value ? h(MDialog, { modelValue: true }, () => 'content') : null),
    }), { attachTo: document.body })
    await nextTick()
    expect(locked()).toBe(true)
    show.value = false
    await nextTick()
    expect(locked()).toBe(false)
    w.unmount()
  })

  it('a select unmounting inside an open dialog leaves it locked', async () => {
    const field = ref(true)
    const w = mount(defineComponent({
      setup: () => () => h(MDialog, { modelValue: true }, () =>
        field.value ? h(MSelect, { modelValue: null, options: [{ value: 1, label: 'One' }] }) : 'gone'),
    }), { attachTo: document.body })
    await nextTick()
    expect(locked()).toBe(true)
    field.value = false
    await nextTick()
    expect(locked()).toBe(true)
    w.unmount()
    expect(locked()).toBe(false)
  })

  it('keeps an overflow the app had set before', async () => {
    document.body.style.overflow = 'clip'
    const open = ref(true)
    const w = mount(defineComponent({ setup: () => () => h(MDialog, { modelValue: open.value }, () => 'x') }), { attachTo: document.body })
    await nextTick()
    expect(locked()).toBe(true)
    open.value = false
    await nextTick()
    expect(document.body.style.overflow).toBe('clip')
    w.unmount()
  })
})

describe('Escape with stacked dialogs', () => {
  const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  const stacked = (innerProps: Record<string, unknown> = {}) => {
    const outer = ref(true)
    const inner = ref(true)
    const w = mount(defineComponent({
      setup: () => () => [
        h(MDialog, { modelValue: outer.value, 'onUpdate:modelValue': (v: boolean) => (outer.value = v) }, () => 'outer'),
        h(MDialog, { modelValue: inner.value, 'onUpdate:modelValue': (v: boolean) => (inner.value = v), ...innerProps }, () => 'inner'),
      ],
    }), { attachTo: document.body })
    return { w, outer, inner }
  }

  it('closes the one on top only, then the next', async () => {
    const { w, outer, inner } = stacked()
    await nextTick()
    esc()
    await nextTick()
    expect([outer.value, inner.value]).toEqual([true, false])
    esc()
    await nextTick()
    expect(outer.value).toBe(false)
    w.unmount()
  })

  it('a persistent dialog on top keeps the one under it open', async () => {
    const { w, outer, inner } = stacked({ persistent: true })
    await nextTick()
    esc()
    await nextTick()
    expect([outer.value, inner.value]).toEqual([true, true])
    w.unmount()
  })
})
