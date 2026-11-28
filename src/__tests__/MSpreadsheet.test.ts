import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import MSpreadsheet from '../components/MSpreadsheet.vue'
import type { SpreadsheetCell } from '../composables/spreadsheetFormula'

afterEach(() => {
  document.body.innerHTML = ''
})

function setup(initial: SpreadsheetCell[][], props: Record<string, unknown> = {}) {
  const cells = ref<SpreadsheetCell[][]>(initial)
  const changes: unknown[] = []
  const wrapper = mount(() => h(MSpreadsheet, {
    modelValue: cells.value,
    'onUpdate:modelValue': (v: SpreadsheetCell[][]) => (cells.value = v),
    onChange: (c: unknown) => changes.push(c),
    rows: 20,
    cols: 6,
    ...props,
  }), { attachTo: document.body })
  const grid = () => wrapper.find('[role="grid"]')
  const cell = (r: number, c: number) => wrapper.find(`[data-row="${r}"][data-col="${c}"]`)
  const text = (r: number, c: number) => cell(r, c).find('span').text()
  const key = async (k: string, opts: Record<string, unknown> = {}) => { await grid().trigger('keydown', { key: k, ...opts }); await nextTick() }
  const click = async (r: number, c: number, opts: Record<string, unknown> = {}) => {
    cell(r, c).element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', ...opts }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
  }
  const name = () => wrapper.find('[role="status"]').text()
  return { wrapper, cells, changes, grid, cell, text, key, click, name }
}

function clipboardEvent(type: string, text = '') {
  const data = new Map<string, string>([['text/plain', text]])
  const e = new Event(type, { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(e, 'clipboardData', { value: { getData: (t: string) => data.get(t) ?? '', setData: (t: string, v: string) => data.set(t, v) } })
  return { e, data }
}

describe('MSpreadsheet', () => {
  it('shows values and works out formulas; numbers right-aligned, errors in the error color', () => {
    const { text, cell } = setup([[1, 2, '=A1+B1', '=1/0', 'hi']])
    expect(text(0, 2)).toBe('3')
    expect(cell(0, 0).classes()).toContain('text-right')
    expect(text(0, 3)).toBe('#DIV/0!')
    expect(cell(0, 3).classes()).toContain('text-error')
    expect(cell(0, 4).classes()).toContain('text-left')
  })

  it('typing replaces the cell; Enter stores it (a number as a number) and moves down', async () => {
    const { key, cells, wrapper, name, changes } = setup([[5]])
    ;(wrapper.find('[role="grid"]').element as HTMLElement).focus()
    await key('4')
    const input = wrapper.find('input[spellcheck="false"]:not([aria-label])')
    expect((input.element as HTMLInputElement).value).toBe('4')
    await input.setValue('42')
    await input.trigger('keydown', { key: 'Enter' })
    expect(cells.value[0]![0]).toBe(42)
    expect(name()).toBe('A2')
    expect(changes[0]).toEqual([{ row: 0, col: 0, value: 42, oldValue: 5 }])
  })

  it('a formula typed in recomputes the cells that read it', async () => {
    const { key, wrapper, text, click } = setup([[1, 2, '=A1*B1']])
    await click(0, 0)
    await key('7')
    const input = wrapper.find('input[spellcheck="false"]:not([aria-label])')
    await input.trigger('keydown', { key: 'Enter' })
    expect(text(0, 2)).toBe('14')
  })

  it('Escape cancels an edit; F2 edits keeping the contents', async () => {
    const { key, wrapper, cells, click } = setup([['abc']])
    await click(0, 0)
    await key('F2')
    const input = () => wrapper.find('input[spellcheck="false"]:not([aria-label])')
    expect((input().element as HTMLInputElement).value).toBe('abc')
    await input().setValue('zzz')
    await input().trigger('keydown', { key: 'Escape' })
    expect(cells.value[0]![0]).toBe('abc')
    expect(input().exists()).toBe(false)
  })

  it('arrows move, Shift+arrows extend the range, Delete clears it', async () => {
    const { key, click, name, cells } = setup([[1, 2], [3, 4]])
    await click(0, 0)
    await key('ArrowRight')
    expect(name()).toBe('B1')
    await key('ArrowLeft')
    await key('ArrowDown', { shiftKey: true })
    await key('ArrowRight', { shiftKey: true })
    expect(name()).toBe('A1:B2')
    await key('Delete')
    expect(cells.value.flat().every((v) => v == null)).toBe(true)
  })

  it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', async () => {
    const { key, click, cells } = setup([[1]])
    await click(0, 0)
    await key('Delete')
    expect(cells.value[0]![0]).toBeNull()
    await key('z', { ctrlKey: true })
    expect(cells.value[0]![0]).toBe(1)
    await key('z', { ctrlKey: true, shiftKey: true })
    expect(cells.value[0]![0]).toBeNull()
  })

  it('copies the selection as tab-separated values and pastes Excel text, quoted cells included', async () => {
    const { click, grid, cells } = setup([[1, '=A1*2'], ['a', 'b']])
    await click(0, 0)
    await click(1, 1, { shiftKey: true })
    ;(grid().element as HTMLElement).focus()
    const copy = clipboardEvent('copy')
    document.dispatchEvent(copy.e)
    expect(copy.data.get('text/plain')).toBe('1\t2\na\tb')
    await click(4, 0)
    ;(grid().element as HTMLElement).focus()
    document.dispatchEvent(clipboardEvent('paste', 'x\t"two\nlines"\r\n3\t4.5\r\n').e)
    await nextTick()
    expect(cells.value[4]).toEqual(['x', 'two\nlines'])
    expect(cells.value[5]).toEqual([3, 4.5])
  })

  it('pasting its own copy moves the formulas references', async () => {
    const { click, grid, cells } = setup([[1, '=A1*2'], [5]])
    await click(0, 1)
    ;(grid().element as HTMLElement).focus()
    const copy = clipboardEvent('copy')
    document.dispatchEvent(copy.e)
    await click(1, 1)
    ;(grid().element as HTMLElement).focus()
    document.dispatchEvent(clipboardEvent('paste', copy.data.get('text/plain')).e)
    await nextTick()
    expect(cells.value[1]![1]).toBe('=A2*2')
  })

  it('the fill handle continues a series, repeats text, counts "Item 1" on and moves formulas', async () => {
    const { wrapper, click, cells } = setup([[1, 'x', 'Item 1', '=A1*10'], [2]])
    const grid = wrapper.find('[role="grid"]').element as HTMLElement
    grid.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, x: 0, y: 0, toJSON() {} })
    // Select A1:A2 and drag the handle down to row 5
    await click(0, 0)
    await click(1, 0, { shiftKey: true })
    const handle = () => wrapper.find('.m3-spreadsheet-fill').element
    const rowHeader = 44
    const at = (row: number, col: number) => ({ clientX: rowHeader + col * 100 + 50, clientY: 32 + row * 32 + 16 })
    handle().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    window.dispatchEvent(new PointerEvent('pointermove', at(4, 0)))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
    expect(cells.value.slice(0, 5).map((r) => r[0])).toEqual([1, 2, 3, 4, 5])
    // B1:D1 down to row 3
    await click(0, 1)
    await click(0, 3, { shiftKey: true })
    handle().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    window.dispatchEvent(new PointerEvent('pointermove', at(2, 2)))
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
    expect(cells.value.slice(0, 3).map((r) => r[1])).toEqual(['x', 'x', 'x'])
    expect(cells.value.slice(0, 3).map((r) => r[2])).toEqual(['Item 1', 'Item 2', 'Item 3'])
    expect(cells.value.slice(0, 3).map((r) => r[3])).toEqual(['=A1*10', '=A2*10', '=A3*10'])
  })

  it('readonly: nothing is written', async () => {
    const { key, click, cells, wrapper } = setup([[1]], { readonly: true })
    await click(0, 0)
    await key('5')
    await key('Delete')
    expect(cells.value[0]![0]).toBe(1)
    expect(wrapper.find('[role="grid"]').attributes('aria-readonly')).toBe('true')
  })

  it('renders only the rows in view, plus frozen ones that stick', async () => {
    const { wrapper } = setup([], { rows: 1000, frozenRows: 1, frozenColumns: 1 })
    const rows = wrapper.findAll('[role="row"]')
    expect(rows.length).toBeLessThan(40)
    const frozenCell = wrapper.find('[data-row="5"][data-col="0"]')
    expect((frozenCell.element as HTMLElement).style.position).toBe('sticky')
    expect(wrapper.find('[data-row="0"][data-col="2"]').exists()).toBe(true)
  })

  it('clicking a cell while typing a formula inserts its reference', async () => {
    const { key, click, wrapper, cells } = setup([[3, 4]])
    await click(0, 2)
    await key('=')
    const input = () => wrapper.find('input[spellcheck="false"]:not([aria-label])')
    await input().setValue('=SUM(')
    await click(0, 0)
    expect((input().element as HTMLInputElement).value).toBe('=SUM(A1')
    await input().setValue('=SUM(A1,B1)')
    await input().trigger('keydown', { key: 'Enter' })
    expect(cells.value[0]![2]).toBe('=SUM(A1,B1)')
  })

  it('the formula bar shows the raw contents and edits the cell', async () => {
    const { click, wrapper, cells } = setup([['=1+1']])
    await click(0, 0)
    const bar = wrapper.find('input[aria-label="Formula"]')
    expect((bar.element as HTMLInputElement).value).toBe('=1+1')
    await bar.trigger('focus')
    await bar.setValue('=2+2')
    await bar.trigger('keydown', { key: 'Enter' })
    expect(cells.value[0]![0]).toBe('=2+2')
  })

  it('column header click selects the column; resizing emits widths', async () => {
    const widths: number[][] = []
    const { wrapper, name } = setup([], { 'onUpdate:columnWidths': (w: number[]) => widths.push(w) })
    const header = wrapper.findAll('[role="columnheader"]')[2]!
    header.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    await nextTick()
    expect(name()).toBe('B1:B20')
    const grip = header.find('span').element
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100 }))
    grip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 160 }))
    grip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(widths.at(-1)![1]).toBe(160)
  })

  vi.restoreAllMocks()
})
