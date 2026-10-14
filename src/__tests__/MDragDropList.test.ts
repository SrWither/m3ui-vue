import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MDragDropList from '../components/MDragDropList.vue'
import type { DragDropItem } from '../components/MDragDropList.vue'

const items = (): DragDropItem[] => [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

// happy-dom has no layout: give each row a 56px slot.
function layout(w: ReturnType<typeof mount>) {
  w.findAll('[role="listitem"]').forEach((row, i) => {
    Object.defineProperty(row.element, 'offsetTop', { value: i * 56, configurable: true })
    Object.defineProperty(row.element, 'offsetHeight', { value: 56, configurable: true })
  })
}

function pointer(target: Element | Window, type: string, init: Partial<PointerEventInit> = {}) {
  const ev = new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: 'mouse', ...init })
  target.dispatchEvent(ev)
  return ev
}

function order(w: ReturnType<typeof mount>) {
  const e = w.emitted('update:modelValue')
  return e ? (e.at(-1)![0] as DragDropItem[]).map((i) => i.id) : null
}

afterEach(() => vi.useRealTimers())

describe('MDragDropList', () => {
  it('reorders with a mouse drag', () => {
    const w = mount(MDragDropList, { props: { modelValue: items() }, attachTo: document.body })
    layout(w)
    const first = w.findAll('[role="listitem"]')[0]!.element
    pointer(first, 'pointerdown', { clientX: 10, clientY: 20 })
    pointer(window, 'pointermove', { clientX: 10, clientY: 30 })
    pointer(window, 'pointermove', { clientX: 10, clientY: 20 + 120 })
    pointer(window, 'pointerup', { clientX: 10, clientY: 140 })
    expect(order(w)).toEqual(['b', 'c', 'a', 'd'])
    expect(w.emitted('reorder')![0]![0]).toMatchObject({ from: 0, to: 2 })
    w.unmount()
  })

  it('treats a click without movement as a click, not a drag', () => {
    const w = mount(MDragDropList, { props: { modelValue: items() }, attachTo: document.body })
    layout(w)
    const row = w.findAll('[role="listitem"]')[1]!.element
    pointer(row, 'pointerdown', { clientY: 80 })
    pointer(window, 'pointerup', { clientY: 80 })
    expect(order(w)).toBeNull()
    w.unmount()
  })

  it('lets a touch swipe scroll, and drags after a long press', () => {
    vi.useFakeTimers()
    const w = mount(MDragDropList, { props: { modelValue: items() }, attachTo: document.body })
    layout(w)
    const row = w.findAll('[role="listitem"]')[0]!.element
    // Swipe: moves before the long press fires
    pointer(row, 'pointerdown', { pointerType: 'touch', clientY: 20 })
    pointer(window, 'pointermove', { pointerType: 'touch', clientY: 60 })
    vi.advanceTimersByTime(400)
    pointer(window, 'pointermove', { pointerType: 'touch', clientY: 200 })
    pointer(window, 'pointerup', { pointerType: 'touch', clientY: 200 })
    expect(order(w)).toBeNull()
    // Long press, then drag
    pointer(row, 'pointerdown', { pointerType: 'touch', clientY: 20 })
    vi.advanceTimersByTime(400)
    pointer(window, 'pointermove', { pointerType: 'touch', clientY: 20 + 70 })
    pointer(window, 'pointerup', { pointerType: 'touch', clientY: 90 })
    expect(order(w)).toEqual(['b', 'a', 'c', 'd'])
    w.unmount()
  })

  it('does not start a drag from a control inside the row', () => {
    const w = mount(MDragDropList, {
      props: { modelValue: items() },
      slots: { default: '<input type="checkbox" class="cb" />' },
      attachTo: document.body,
    })
    layout(w)
    pointer(w.findAll('.cb')[0]!.element, 'pointerdown', { clientY: 20 })
    pointer(window, 'pointermove', { clientY: 200 })
    pointer(window, 'pointerup', { clientY: 200 })
    expect(order(w)).toBeNull()
    w.unmount()
  })

  it('only drags from the handle when handle is set', () => {
    const w = mount(MDragDropList, { props: { modelValue: items(), handle: true }, attachTo: document.body })
    layout(w)
    const row = w.findAll('[role="listitem"]')[0]!
    pointer(row.element, 'pointerdown', { clientY: 20 })
    pointer(window, 'pointermove', { clientY: 200 })
    pointer(window, 'pointerup', { clientY: 200 })
    expect(order(w)).toBeNull()
    pointer(row.find('[data-drag-handle]').element, 'pointerdown', { clientY: 20 })
    pointer(window, 'pointermove', { clientY: 30 })
    pointer(window, 'pointermove', { clientY: 200 })
    pointer(window, 'pointerup', { clientY: 200 })
    expect(order(w)).toEqual(['b', 'c', 'd', 'a'])
    w.unmount()
  })

  it('reorders with the keyboard and announces it', async () => {
    const w = mount(MDragDropList, { props: { modelValue: items() }, attachTo: document.body })
    const row = () => w.findAll('[role="listitem"]')[0]!
    await row().trigger('keydown', { key: ' ' })
    expect(w.find('[aria-live]').text()).toContain('position 1 of 4')
    await row().trigger('keydown', { key: 'ArrowDown' })
    expect(order(w)).toEqual(['b', 'a', 'c', 'd'])
    expect(w.find('[aria-live]').text()).toContain('Moved to position 2 of 4')
  })

  it('restores the original order on Escape', async () => {
    const w = mount(MDragDropList, {
      props: { modelValue: items(), 'onUpdate:modelValue': (v: DragDropItem[]) => w.setProps({ modelValue: v }) },
      attachTo: document.body,
    })
    const rowOf = (id: string) => w.findAll('[role="listitem"]').find((r) => r.text() === id)!
    await rowOf('a').trigger('keydown', { key: 'Enter' })
    await rowOf('a').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await rowOf('a').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(order(w)).toEqual(['b', 'c', 'a', 'd'])
    await rowOf('a').trigger('keydown', { key: 'Escape' })
    expect(order(w)).toEqual(['a', 'b', 'c', 'd'])
    expect(w.find('[aria-live]').text()).toBe('Reorder cancelled.')
    w.unmount()
  })
})

describe('MDragDropList ends', () => {
  it('can drag a row to the very top', () => {
    const w = mount(MDragDropList, { props: { modelValue: items() }, attachTo: document.body })
    layout(w)
    const last = w.findAll('[role="listitem"]')[3]!.element
    pointer(last, 'pointerdown', { clientY: 190 })
    pointer(window, 'pointermove', { clientY: 180 })
    pointer(window, 'pointermove', { clientY: -100 })
    pointer(window, 'pointerup', { clientY: -100 })
    expect(order(w)).toEqual(['d', 'a', 'b', 'c'])
    w.unmount()
  })
})

describe('MDragDropList bare', () => {
  it('drops the row styling but keeps dragging', () => {
    const w = mount(MDragDropList, {
      props: { modelValue: items(), bare: true },
      slots: { default: `<template #default="{ item }"><div class="card">{{ item.id }}</div></template>` },
      attachTo: document.body,
    })
    const row = w.findAll('[role="listitem"]')[0]!
    expect(row.classes()).not.toContain('min-h-14')
    expect(row.classes()).not.toContain('px-4')
    expect(w.find('.card').exists()).toBe(true)
    layout(w)
    pointer(row.element, 'pointerdown', { clientY: 20 })
    pointer(window, 'pointermove', { clientY: 30 })
    pointer(window, 'pointermove', { clientY: 90 })
    pointer(window, 'pointerup', { clientY: 90 })
    expect(order(w)).toEqual(['b', 'a', 'c', 'd'])
    w.unmount()
  })

  it('drags from a custom grip bound with handleProps, and exposes dragging', async () => {
    const w = mount(MDragDropList, {
      props: { modelValue: items(), bare: true, handle: true },
      slots: {
        default: `<template #default="{ item, dragging, handleProps }">
          <div class="card" :class="dragging && 'is-dragging'"><span class="grip" v-bind="handleProps">::</span>{{ item.id }}</div>
        </template>`,
      },
      attachTo: document.body,
    })
    expect(w.find('[data-drag-handle]').classes()).toContain('grip')
    expect(w.find('button[data-drag-handle]').exists()).toBe(false)
    layout(w)
    const grip = w.findAll('.grip')[0]!
    pointer(grip.element, 'pointerdown', { clientY: 20 })
    pointer(window, 'pointermove', { clientY: 30 })
    await nextTick()
    expect(w.findAll('.card')[0]!.classes()).toContain('is-dragging')
    pointer(window, 'pointermove', { clientY: 90 })
    pointer(window, 'pointerup', { clientY: 90 })
    expect(order(w)).toEqual(['b', 'a', 'c', 'd'])
    // keyboard on the custom grip
    await w.findAll('.grip')[1]!.trigger('keydown', { key: ' ' })
    expect(w.find('[aria-live]').text()).toContain('position 2 of 4')
    w.unmount()
  })
})
