import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import MFileUpload from '../components/MFileUpload.vue'
import type { UploadFile } from '../components/MFileUpload.vue'

function pick(wrapper: ReturnType<typeof mount>, files: File[]) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  return input.trigger('change')
}

const pdf = (name = 'a.pdf') => new File(['x'], name, { type: 'application/pdf' })
const png = (name = 'a.png') => new File(['x'], name, { type: 'image/png' })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('MFileUpload', () => {
  it('reflects status/progress set on the entries emitted by select', async () => {
    const w = mount(MFileUpload)
    await pick(w, [pdf()])
    const [entry] = w.emitted('select')![0]![0] as UploadFile[]
    entry!.status = 'uploading'
    entry!.progress = 40
    await nextTick()
    expect(w.find('.bg-primary').attributes('style')).toContain('width: 40%')
    entry!.status = 'done'
    await nextTick()
    expect(w.text()).toContain('check_circle')
  })

  it('works as v-model and can be cleared by the parent', async () => {
    const files = ref<UploadFile[]>([])
    const w = mount(MFileUpload, {
      props: { multiple: true, modelValue: files.value, 'onUpdate:modelValue': (v: UploadFile[]) => { files.value = v; w.setProps({ modelValue: v }) } },
    })
    await pick(w, [pdf('one.pdf'), pdf('two.pdf')])
    expect(files.value.map((f) => f.file.name)).toEqual(['one.pdf', 'two.pdf'])
    expect(w.text()).toContain('two.pdf')
    await w.setProps({ modelValue: [] })
    expect(w.text()).not.toContain('one.pdf')
  })

  it('exposes clear() and revokes image previews', async () => {
    const w = mount(MFileUpload, { props: { multiple: true } })
    await pick(w, [png()])
    expect(w.text()).toContain('a.png')
    ;(w.vm as unknown as { clear: () => void }).clear()
    await nextTick()
    expect(w.text()).not.toContain('a.png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('renders #actions only while there are files, with files and clear', async () => {
    const w = mount(MFileUpload, {
      props: { multiple: true },
      slots: {
        actions: `<template #actions="{ files, clear }"><button class="clear-btn" @click="clear">Clear {{ files.length }}</button></template>`,
      },
    })
    expect(w.find('.clear-btn').exists()).toBe(false)
    await pick(w, [pdf('one.pdf'), pdf('two.pdf')])
    expect(w.find('.clear-btn').text()).toBe('Clear 2')
    await w.find('.clear-btn').trigger('click')
    expect(w.find('.clear-btn').exists()).toBe(false)
  })

  it('keeps a single file when multiple is off', async () => {
    const w = mount(MFileUpload)
    await pick(w, [pdf('one.pdf')])
    await pick(w, [pdf('two.pdf')])
    expect(w.text()).not.toContain('one.pdf')
    expect(w.text()).toContain('two.pdf')
  })
})
