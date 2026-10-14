import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MKanban from '../components/MKanban.vue'
import type { KanbanColumn } from '../components/MKanban.vue'

const board = (): KanbanColumn[] => [
  { id: 'todo', title: 'To do', cards: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
  { id: 'doing', title: 'Doing', cards: [{ id: 'e' }], limit: 1 },
  { id: 'done', title: 'Done', cards: [] },
]

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} } as DOMRect
}

// happy-dom has no layout: columns 300px apart, card areas start at y=50, cards 56px + 8px gap.
function layout(w: ReturnType<typeof mount>) {
  w.findAll('section').forEach((col, ci) => {
    const left = ci * 300
    col.element.getBoundingClientRect = () => rect(left, 0, 288, 600)
    const area = col.find('[role="list"]').element as HTMLElement
    area.getBoundingClientRect = () => rect(left, 50, 288, 500)
    col.findAll('[role="listitem"]').forEach((card, i) => {
      Object.defineProperty(card.element, 'offsetTop', { value: i * 64, configurable: true })
      Object.defineProperty(card.element, 'offsetHeight', { value: 56, configurable: true })
      card.element.getBoundingClientRect = () => rect(left + 12, 50 + i * 64, 264, 56)
    })
  })
}

function pointer(target: Element | Window, type: string, x: number, y: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y }))
}

function mountBoard() {
  const w = mount(MKanban, {
    props: { modelValue: board(), 'onUpdate:modelValue': (v: KanbanColumn[]) => w.setProps({ modelValue: v }) },
    attachTo: document.body,
  })
  return w
}
const ids = (w: ReturnType<typeof mount>) =>
  (w.props('modelValue') as KanbanColumn[]).map((c) => c.cards.map((x) => x.id).join(''))
const card = (w: ReturnType<typeof mount>, id: string) =>
  w.findAll('[role="listitem"]').find((c) => c.text() === id)!

describe('MKanban', () => {
  it('drags a card to another column', async () => {
    const w = mountBoard()
    layout(w)
    pointer(card(w, 'a').element, 'pointerdown', 100, 70)
    pointer(window, 'pointermove', 110, 70)
    pointer(window, 'pointermove', 400, 70)
    pointer(window, 'pointerup', 400, 70)
    await nextTick()
    expect(ids(w)).toEqual(['bcd', 'ae', ''])
    expect(w.emitted('cardMove')![0]![0]).toEqual({ cardId: 'a', fromColumn: 'todo', toColumn: 'doing', toIndex: 0 })
    w.unmount()
  })

  it('reorders within a column without the old off-by-one', async () => {
    const w = mountBoard()
    layout(w)
    // Drag "a" down so its center sits just above "c"'s middle: it should land between b and c.
    pointer(card(w, 'a').element, 'pointerdown', 100, 70)
    pointer(window, 'pointermove', 100, 80)
    // The mock keeps b/c/d at their mount-time offsets (64/128/192, midpoints 92/156/220).
    // A drag of +100px puts a's center at 128: past b's middle, before c's -> between b and c.
    pointer(window, 'pointermove', 100, 170)
    pointer(window, 'pointerup', 100, 170)
    await nextTick()
    expect(ids(w)[0]).toBe('bacd')
    w.unmount()
  })

  it('does not emit when a card is dropped where it was', async () => {
    const w = mountBoard()
    layout(w)
    pointer(card(w, 'b').element, 'pointerdown', 100, 134)
    pointer(window, 'pointermove', 100, 140)
    pointer(window, 'pointerup', 100, 140)
    await nextTick()
    expect(w.emitted('cardMove')).toBeUndefined()
    w.unmount()
  })

  it('moves cards with the keyboard and announces the column', async () => {
    const w = mountBoard()
    await card(w, 'a').trigger('keydown', { key: ' ' })
    await card(w, 'a').trigger('keydown', { key: 'ArrowDown' })
    expect(ids(w)[0]).toBe('bacd')
    await card(w, 'a').trigger('keydown', { key: 'ArrowRight' })
    expect(ids(w)).toEqual(['bcd', 'ea', ''])
    expect(w.find('[aria-live]').text()).toBe('Moved to Doing, position 2 of 2.')
    await card(w, 'a').trigger('keydown', { key: 'Escape' })
    expect(ids(w)).toEqual(['abcd', 'e', ''])
    w.unmount()
  })

  it('emits cardClick on click and Enter, but not after a drag', async () => {
    const w = mountBoard()
    layout(w)
    await card(w, 'b').trigger('click')
    await card(w, 'c').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('cardClick')!.map((e) => (e[0] as { card: { id: string } }).card.id)).toEqual(['b', 'c'])
    const d = card(w, 'd').element
    pointer(d, 'pointerdown', 100, 250)
    pointer(window, 'pointermove', 100, 270)
    pointer(window, 'pointerup', 100, 270)
    d.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(w.emitted('cardClick')).toHaveLength(2)
    w.unmount()
  })

  it('shows the WIP limit and flags it when exceeded', async () => {
    const w = mountBoard()
    const doingHeader = () => w.findAll('section')[1]!.find('header')
    expect(doingHeader().text()).toContain('1/1')
    await card(w, 'a').trigger('keydown', { key: ' ' })
    await card(w, 'a').trigger('keydown', { key: 'ArrowRight' })
    expect(doingHeader().text()).toContain('2/1')
    expect(doingHeader().find('.bg-error-container').exists()).toBe(true)
    w.unmount()
  })
})

describe('MKanban card actions', () => {
  it('does not fire cardClick or start a drag from buttons or data-kanban-action areas', async () => {
    const w = mount(MKanban, {
      props: { modelValue: board() },
      slots: {
        card: `<template #card="{ card }"><span class="title">{{ card.id }}</span><button class="btn">menu</button><span class="act" data-kanban-action>copy</span></template>`,
      },
      attachTo: document.body,
    })
    layout(w)
    const first = w.findAll('[role="listitem"]')[0]!
    await first.find('.btn').trigger('click')
    await first.find('.act').trigger('click')
    expect(w.emitted('cardClick')).toBeUndefined()
    await first.find('.title').trigger('click')
    expect(w.emitted('cardClick')).toHaveLength(1)
    pointer(first.find('.act').element, 'pointerdown', 100, 70)
    pointer(window, 'pointermove', 400, 70)
    pointer(window, 'pointerup', 400, 70)
    expect(w.emitted('cardMove')).toBeUndefined()
    w.unmount()
  })
})
