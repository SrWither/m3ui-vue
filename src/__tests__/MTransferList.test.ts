import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MTransferList from '../components/MTransferList.vue'
import type { TransferItem } from '../components/MTransferList.vue'

const items: TransferItem[] = [
  { value: 1, label: 'Ana', description: 'ana@acme.dev' },
  { value: 2, label: 'Luis', description: 'luis@acme.dev' },
  { value: 3, label: 'Marta', description: 'marta@acme.dev' },
]

function setup(modelValue: (string | number)[] = [], extra: Record<string, unknown> = {}) {
  const w = mount(MTransferList, {
    props: { modelValue, items, filterable: true, ...extra, 'onUpdate:modelValue': (v: (string | number)[]) => w.setProps({ modelValue: v }) },
    attachTo: document.body,
  })
  return w
}
const panes = (w: ReturnType<typeof setup>) => w.findAll('section')
const rows = (w: ReturnType<typeof setup>, pane: number) => panes(w)[pane]!.findAll('li')
const btn = (w: ReturnType<typeof setup>, label: string) => w.findAll('button').find((b) => b.attributes('aria-label') === label)!
const lastValue = (w: ReturnType<typeof setup>) => w.emitted('update:modelValue')!.at(-1)![0]

describe('MTransferList', () => {
  it('clicking a row checkbox checks it once (no double toggle)', async () => {
    const w = setup()
    await rows(w, 0)[0]!.find('input[type="checkbox"]').trigger('click')
    expect(btn(w, 'Move selected right').attributes('disabled')).toBeUndefined()
    await btn(w, 'Move selected right').trigger('click')
    expect(lastValue(w)).toEqual([1])
    w.unmount()
  })

  it('clicking anywhere else on the row toggles it', async () => {
    const w = setup()
    await rows(w, 0)[1]!.trigger('click')
    expect(rows(w, 0)[1]!.classes()).toContain('bg-secondary-container')
    await rows(w, 0)[1]!.trigger('click')
    expect(rows(w, 0)[1]!.classes()).not.toContain('bg-secondary-container')
    w.unmount()
  })

  it('select all checks every visible item and shows a count', async () => {
    const w = setup()
    await panes(w)[0]!.find('header input[type="checkbox"]').trigger('click')
    expect(panes(w)[0]!.find('header').text()).toContain('3/3')
    await btn(w, 'Move selected right').trigger('click')
    expect(lastValue(w)).toEqual([1, 2, 3])
    w.unmount()
  })

  it('search matches the description too', async () => {
    const w = setup()
    await panes(w)[0]!.find('input[type="text"]').setValue('marta@')
    expect(rows(w, 0)).toHaveLength(1)
    expect(rows(w, 0)[0]!.text()).toContain('Marta')
    w.unmount()
  })

  it('double-click and Enter move a single item across', async () => {
    const w = setup()
    await rows(w, 0)[0]!.trigger('dblclick')
    expect(lastValue(w)).toEqual([1])
    await rows(w, 1)[0]!.trigger('keydown', { key: 'Enter' })
    expect(lastValue(w)).toEqual([])
    w.unmount()
  })

  it('keeps the custom empty slots', () => {
    const w = mount(MTransferList, {
      props: { modelValue: [], items },
      slots: { 'target-empty': '<p class="custom-empty">Nobody yet</p>' },
    })
    expect(w.find('.custom-empty').text()).toBe('Nobody yet')
  })

  it('pins leaving rows at their own offset on "move all" instead of stacking them', async () => {
    const w = mount(MTransferList, {
      props: { modelValue: [], items, 'onUpdate:modelValue': (v: (string | number)[]) => w.setProps({ modelValue: v }) },
      attachTo: document.body,
      global: { stubs: { 'transition-group': false } },
    })
    // happy-dom has no layout: model the flow, where a row without a pinned `top` sits after
    // its in-flow (non-leaving) siblings, like the browser's static position does.
    for (const li of rows(w, 0).map((r) => r.element as HTMLElement)) {
      Object.defineProperty(li, 'offsetTop', {
        configurable: true,
        get() {
          if (this.style.top) return parseFloat(this.style.top)
          let n = 0
          for (let p = this.previousElementSibling; p; p = p.previousElementSibling) {
            if (![...p.classList].some((c: string) => c.endsWith('-leave-active'))) n++
          }
          return 4 + n * 56
        },
      })
    }
    const leaving = rows(w, 0).map((r) => r.element as HTMLElement)
    await btn(w, 'Move all right').trigger('click')
    expect(leaving.map((li) => li.style.top)).toEqual(['4px', '60px', '116px'])
    w.unmount()
  })

  it('#item replaces the row content, keeps the checkbox and tells each pane apart', () => {
    const w = mount(MTransferList, {
      props: { modelValue: [2], items },
      slots: { item: `<template #item="{ item, side, checked }"><b class="custom">{{ side }}:{{ item.label }}:{{ checked }}</b></template>` },
    })
    expect(rows(w, 0).map((r) => r.find('.custom').text())).toEqual(['source:Ana:false', 'source:Marta:false'])
    expect(rows(w, 1)[0]!.find('.custom').text()).toBe('target:Luis:false')
    expect(rows(w, 0)[0]!.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('controls inside #item keep their clicks instead of checking or moving the row', async () => {
    let hits = 0
    const w = mount(MTransferList, {
      props: { modelValue: [], items, 'onUpdate:modelValue': (v: (string | number)[]) => w.setProps({ modelValue: v }) },
      slots: { item: `<template #item="{ item }"><span>{{ item.label }}</span><button class="act">x</button><span data-transfer-action class="mark">m</span></template>` },
    })
    rows(w, 0)[0]!.find('.act').element.addEventListener('click', () => hits++)
    await rows(w, 0)[0]!.find('.act').trigger('click')
    await rows(w, 0)[0]!.find('.act').trigger('dblclick')
    await rows(w, 0)[0]!.find('.mark').trigger('click')
    await rows(w, 0)[0]!.find('.act').trigger('keydown', { key: 'Enter' })
    expect(hits).toBe(1)
    expect(rows(w, 0)[0]!.classes()).not.toContain('bg-secondary-container')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('bare rows are drawn by the slot and work as checkboxes', async () => {
    const w = mount(MTransferList, {
      props: { modelValue: [], items, bare: true, 'onUpdate:modelValue': (v: (string | number)[]) => w.setProps({ modelValue: v }) },
      slots: { item: `<template #item="{ item, checked, move }"><div class="card" :data-checked="checked">{{ item.label }}<button class="go" @click="move">go</button></div></template>` },
    })
    const row = rows(w, 0)[0]!
    expect(row.find('input[type="checkbox"]').exists()).toBe(false)
    expect(row.attributes('role')).toBe('checkbox')
    expect(row.attributes('tabindex')).toBe('0')
    await row.find('.card').trigger('click')
    expect(row.attributes('aria-checked')).toBe('true')
    expect(row.find('.card').attributes('data-checked')).toBe('true')
    await row.trigger('keydown', { key: ' ' })
    expect(row.attributes('aria-checked')).toBe('false')
    await row.trigger('keydown', { key: 'Enter' })
    expect(lastValue(w)).toEqual([1])
    await rows(w, 0)[0]!.find('.go').trigger('click')
    expect(lastValue(w)).toEqual([1, 2])
  })
})
