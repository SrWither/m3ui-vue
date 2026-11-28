<script lang="ts">
import type { SpreadsheetCell } from '../composables/spreadsheetFormula'

/** A cell's position, 0-based */
export interface SpreadsheetPosition {
  row: number
  col: number
}

/** A block of cells, corners included */
export interface SpreadsheetRange {
  start: SpreadsheetPosition
  end: SpreadsheetPosition
}

/** One cell written by an edit, a paste, a fill or a clear */
export interface SpreadsheetChange {
  row: number
  col: number
  value: SpreadsheetCell
  oldValue: SpreadsheetCell
}
</script>

<script setup lang="ts">
/**
 * An editable grid of cells, like a small Excel or Google Sheets: type into cells, select ranges with the mouse or
 * Shift+arrows, copy and paste to and from Excel/Sheets (tab-separated text), drag the fill handle to copy cells or
 * continue a series, formulas (`=SUM(A1:A10)`, `=IF(B2>0,"yes","no")`, relative and `$`-locked references), undo and
 * redo, frozen rows and columns, resizable columns. Only the rows in view are rendered, so thousands of rows stay
 * smooth. `v-model` is the cells as typed (a formula is a string starting with `=`); the values formulas work out to
 * are shown, not stored. Not an M3 spec component.
 *
 * @event change Cells were written (typing, paste, fill, clear, undo): `{ row, col, value, oldValue }[]`
 * @event selection-change The selection moved: `{ start, end }`
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import {
  FormulaError, cellName, columnName, createSheetEvaluator, formatNumber, shiftFormula,
  type SpreadsheetFunction, type SpreadsheetValue,
} from '../composables/spreadsheetFormula'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** The cells, row by row, as typed: numbers, text, booleans, `null` for empty, formulas as `'=…'` strings */
    modelValue?: SpreadsheetCell[][]
    /** Rows the grid shows at least (more when the data has more) */
    rows?: number
    /** Columns the grid shows at least (more when the data has more) */
    cols?: number
    /** Each column's width in px (`v-model:columnWidths`, updated when the user resizes one) */
    columnWidths?: number[]
    /** Width of columns without one in `columnWidths`, in px */
    defaultColumnWidth?: number
    /** Row height in px */
    rowHeight?: number
    /** Rows kept at the top while scrolling */
    frozenRows?: number
    /** Columns kept at the left while scrolling */
    frozenColumns?: number
    /** Cells can be selected and copied, not changed */
    readonly?: boolean
    /** Show the column letters and row numbers */
    headers?: boolean
    /** Column header text instead of A, B, C… (missing ones keep the letter) */
    columnLabels?: string[]
    /** Show the formula bar (the selected cell's name and its contents, editable) */
    formulaBar?: boolean
    /** Work formulas out. Off: `=…` is shown as typed */
    formulas?: boolean
    /** More functions for formulas, by upper-case name: `{ TAX: ([amount]) => amount * 0.21 }` */
    functions?: Record<string, SpreadsheetFunction>
    /** How a cell shows its value (currencies, dates…). Gets the worked-out value and where it is */
    format?: (value: SpreadsheetValue, cell: { row: number; col: number; raw: SpreadsheetCell }) => string
    /** Extra rows rendered above and below the ones in view */
    overscan?: number
    /** The grid's accessible name */
    label?: string
  }>(),
  {
    modelValue: () => [], rows: 100, cols: 26, defaultColumnWidth: 100, rowHeight: 32, frozenRows: 0, frozenColumns: 0,
    headers: true, formulaBar: true, formulas: true, overscan: 6,
  },
)

const emit = defineEmits<{
  'update:modelValue': [cells: SpreadsheetCell[][]]
  'update:columnWidths': [widths: number[]]
  change: [changes: SpreadsheetChange[]]
  'selection-change': [range: SpreadsheetRange]
}>()

const locale = useLocale()
const uid = useId()

// ── size ──
const rowCount = computed(() => Math.max(props.rows, props.modelValue.length))
const colCount = computed(() => Math.max(props.cols, ...props.modelValue.map((r) => r?.length ?? 0)))
const rowHeaderWidth = computed(() => (props.headers ? Math.max(44, String(rowCount.value).length * 9 + 20) : 0))
const headerHeight = computed(() => (props.headers ? props.rowHeight : 0))

const localWidths = ref<number[]>([])
watch(() => props.columnWidths, (w) => { localWidths.value = w ? [...w] : [] }, { immediate: true })
const widthOf = (c: number) => localWidths.value[c] ?? props.defaultColumnWidth
const colLeft = computed(() => {
  const out = [0]
  for (let c = 0; c < colCount.value; c++) out.push(out[c]! + widthOf(c))
  return out
})
const totalWidth = computed(() => colLeft.value[colCount.value]!)
const frozenCols = computed(() => Math.min(props.frozenColumns, colCount.value))
const frozenRowCount = computed(() => Math.min(props.frozenRows, rowCount.value))

// ── values ──
const raw = (r: number, c: number): SpreadsheetCell => props.modelValue[r]?.[c] ?? null
const evaluator = computed(() =>
  createSheetEvaluator(props.modelValue, { functions: props.functions, rows: rowCount.value, cols: colCount.value }),
)
function valueAt(r: number, c: number): SpreadsheetValue {
  const v = raw(r, c)
  if (!props.formulas && typeof v === 'string') return v
  return evaluator.value.value(r, c)
}
function display(r: number, c: number): string {
  const v = valueAt(r, c)
  if (props.format) return props.format(v, { row: r, col: c, raw: raw(r, c) })
  if (v == null) return ''
  if (v instanceof FormulaError) return v.code
  if (typeof v === 'number') return formatNumber(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return v
}
function align(r: number, c: number): string {
  const v = valueAt(r, c)
  return typeof v === 'number' ? 'text-right' : typeof v === 'boolean' || v instanceof FormulaError ? 'text-center' : 'text-left'
}

/** What a typed text is stored as: a number, a boolean, text, or null for nothing */
function parseInput(text: string): SpreadsheetCell {
  if (text === '') return null
  if (text[0] === '=') return text
  const t = text.trim()
  if (t !== '' && /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return Number(t)
  const u = t.toUpperCase()
  if (u === 'TRUE' || u === 'FALSE') return u === 'TRUE'
  return text
}
const rawText = (v: SpreadsheetCell) => (v == null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v))

// ── writing, undo ──
interface Snapshot { cells: SpreadsheetCell[][]; range: SpreadsheetRange }
const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []

function write(changes: { row: number; col: number; value: SpreadsheetCell }[]) {
  if (props.readonly) return
  const real: SpreadsheetChange[] = []
  const next = [...props.modelValue]
  for (const ch of changes) {
    const old = raw(ch.row, ch.col)
    if (old === ch.value || (old == null && ch.value == null)) continue
    while (next.length <= ch.row) next.push([])
    const row = next[ch.row] === props.modelValue[ch.row] ? [...(next[ch.row] ?? [])] : next[ch.row]!
    while (row.length <= ch.col) row.push(null)
    row[ch.col] = ch.value
    next[ch.row] = row
    real.push({ ...ch, oldValue: old })
  }
  if (!real.length) return
  undoStack.push({ cells: props.modelValue, range: currentRange() })
  if (undoStack.length > 100) undoStack.shift()
  redoStack.length = 0
  emit('update:modelValue', next)
  emit('change', real)
}

function diff(from: SpreadsheetCell[][], to: SpreadsheetCell[][]): SpreadsheetChange[] {
  const out: SpreadsheetChange[] = []
  const rows = Math.max(from.length, to.length)
  for (let r = 0; r < rows; r++) {
    if (from[r] === to[r]) continue
    const cols = Math.max(from[r]?.length ?? 0, to[r]?.length ?? 0)
    for (let c = 0; c < cols; c++) {
      const a = from[r]?.[c] ?? null
      const b = to[r]?.[c] ?? null
      if (a !== b) out.push({ row: r, col: c, value: b, oldValue: a })
    }
  }
  return out
}
function restore(from: Snapshot[], to: Snapshot[]) {
  const snap = from.pop()
  if (!snap || props.readonly) return
  to.push({ cells: props.modelValue, range: currentRange() })
  const changes = diff(props.modelValue, snap.cells)
  emit('update:modelValue', snap.cells)
  if (changes.length) emit('change', changes)
  anchor.value = { ...snap.range.start }
  head.value = { ...snap.range.end }
}
const undo = () => restore(undoStack, redoStack)
const redo = () => restore(redoStack, undoStack)

// ── selection ──
const anchor = ref<SpreadsheetPosition>({ row: 0, col: 0 })
const head = ref<SpreadsheetPosition>({ row: 0, col: 0 })
const range = computed(() => ({
  r1: Math.min(anchor.value.row, head.value.row), r2: Math.max(anchor.value.row, head.value.row),
  c1: Math.min(anchor.value.col, head.value.col), c2: Math.max(anchor.value.col, head.value.col),
}))
function currentRange(): SpreadsheetRange {
  const { r1, r2, c1, c2 } = range.value
  return { start: { row: r1, col: c1 }, end: { row: r2, col: c2 } }
}
const inRange = (r: number, c: number) => r >= range.value.r1 && r <= range.value.r2 && c >= range.value.c1 && c <= range.value.c2
const isActive = (r: number, c: number) => anchor.value.row === r && anchor.value.col === c
const clampPos = (p: SpreadsheetPosition) => ({
  row: Math.min(Math.max(p.row, 0), rowCount.value - 1),
  col: Math.min(Math.max(p.col, 0), colCount.value - 1),
})
watch(() => [range.value.r1, range.value.r2, range.value.c1, range.value.c2].join(), () => emit('selection-change', currentRange()))

function select(start: SpreadsheetPosition, end: SpreadsheetPosition = start) {
  commitEdit()
  anchor.value = clampPos(start)
  head.value = clampPos(end)
  nextTick(() => scrollIntoView(head.value))
}

const rangeName = computed(() => {
  const { r1, r2, c1, c2 } = range.value
  return r1 === r2 && c1 === c2 ? cellName(r1, c1) : `${cellName(r1, c1)}:${cellName(r2, c2)}`
})

// ── virtual rows ──
const scroller = ref<HTMLElement>()
const scrollTop = ref(0)
const viewHeight = ref(400)
const bodyRows = computed(() => rowCount.value - frozenRowCount.value)
const firstRow = computed(() => Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - props.overscan))
const lastRow = computed(() => Math.min(bodyRows.value, Math.ceil((scrollTop.value + viewHeight.value) / props.rowHeight) + props.overscan))
const visibleRows = computed(() => {
  const out: number[] = []
  for (let i = firstRow.value; i < lastRow.value; i++) out.push(frozenRowCount.value + i)
  return out
})
const frozenRowList = computed(() => Array.from({ length: frozenRowCount.value }, (_, i) => i))
const colList = computed(() => Array.from({ length: colCount.value }, (_, i) => i))

function onScroll() {
  if (scroller.value) scrollTop.value = scroller.value.scrollTop
}
let resize: ResizeObserver | undefined
onMounted(() => {
  if (!scroller.value) return
  viewHeight.value = scroller.value.clientHeight || 400
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(() => { if (scroller.value) viewHeight.value = scroller.value.clientHeight || viewHeight.value })
    resize.observe(scroller.value)
  }
})

function scrollIntoView(p: SpreadsheetPosition) {
  const el = scroller.value
  if (!el) return
  const frozenH = frozenRowCount.value * props.rowHeight
  if (p.row >= frozenRowCount.value) {
    const top = (p.row - frozenRowCount.value) * props.rowHeight
    const room = el.clientHeight - headerHeight.value - frozenH
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + props.rowHeight > el.scrollTop + room) el.scrollTop = top + props.rowHeight - room
  }
  if (p.col >= frozenCols.value) {
    const frozenW = colLeft.value[frozenCols.value]!
    const left = colLeft.value[p.col]! - frozenW
    const room = el.clientWidth - rowHeaderWidth.value - frozenW
    const w = widthOf(p.col)
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (left + w > el.scrollLeft + room) el.scrollLeft = left + w - room
  }
  onScroll()
}

// ── editing ──
const editing = ref(false)
/** `enter`: started by typing, arrows leave the cell. `edit`: F2/double-click/formula bar, arrows move the caret */
const editMode = ref<'enter' | 'edit'>('enter')
const editValue = ref('')
const cellInput = ref<HTMLInputElement>()
// The editor sits inside the v-for'd cells, so its ref comes through a function (a plain ref there is an array)
const setCellInput = (el: unknown) => { cellInput.value = (el as HTMLInputElement | null) ?? undefined }
const barInput = ref<HTMLInputElement>()
const editingIn = ref<'cell' | 'bar'>('cell')

function startEdit(initial?: string, mode: 'enter' | 'edit' = 'edit', where: 'cell' | 'bar' = 'cell') {
  if (props.readonly) return
  editing.value = true
  editMode.value = mode
  editingIn.value = where
  editValue.value = initial ?? rawText(raw(anchor.value.row, anchor.value.col))
  nextTick(() => {
    const input = where === 'bar' ? barInput.value : cellInput.value
    input?.focus()
    if (input && where === 'cell') input.setSelectionRange(input.value.length, input.value.length)
  })
}
function commitEdit() {
  if (!editing.value) return
  editing.value = false
  write([{ row: anchor.value.row, col: anchor.value.col, value: parseInput(editValue.value) }])
}
function cancelEdit() {
  editing.value = false
  scroller.value?.focus()
}
function move(dr: number, dc: number, extend = false) {
  const from = extend ? head.value : anchor.value
  const to = clampPos({ row: from.row + dr, col: from.col + dc })
  if (extend) head.value = to
  else {
    anchor.value = to
    head.value = to
  }
  nextTick(() => scrollIntoView(to))
}

function onEditorKeydown(e: KeyboardEvent) {
  const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    commitEdit()
    if (e.key === 'Enter') move(e.shiftKey ? -1 : 1, 0)
    else move(0, e.shiftKey ? -1 : 1)
    scroller.value?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  } else if (arrows[e.key] && editMode.value === 'enter' && editingIn.value === 'cell') {
    e.preventDefault()
    commitEdit()
    move(...arrows[e.key]!)
    scroller.value?.focus()
  } else if (e.key === 'F2') {
    editMode.value = editMode.value === 'enter' ? 'edit' : 'enter'
  }
}
function onEditorBlur(e: FocusEvent) {
  // Moving between the cell's editor and the formula bar keeps editing
  const to = e.relatedTarget as Node | null
  if (to && (to === cellInput.value || to === barInput.value)) return
  commitEdit()
}

// ── keyboard on the grid ──
function onKeydown(e: KeyboardEvent) {
  if (editing.value) return
  const mod = e.ctrlKey || e.metaKey
  const k = e.key
  const page = Math.max(1, Math.floor((viewHeight.value - headerHeight.value) / props.rowHeight) - 1)
  const lastR = rowCount.value - 1
  const lastC = colCount.value - 1
  const go = (row: number, col: number) => {
    e.preventDefault()
    const to = clampPos({ row, col })
    if (e.shiftKey) head.value = to
    else { anchor.value = to; head.value = to }
    nextTick(() => scrollIntoView(to))
  }
  const from = e.shiftKey ? head.value : anchor.value
  if (k === 'ArrowUp') return go(mod ? 0 : from.row - 1, from.col)
  if (k === 'ArrowDown') return go(mod ? lastDataRow(from.col) : from.row + 1, from.col)
  if (k === 'ArrowLeft') return go(from.row, mod ? 0 : from.col - 1)
  if (k === 'ArrowRight') return go(from.row, mod ? lastDataCol(from.row) : from.col + 1)
  if (k === 'Home') return go(mod ? 0 : from.row, 0)
  if (k === 'End') return go(mod ? lastR : from.row, lastC)
  if (k === 'PageDown') return go(from.row + page, from.col)
  if (k === 'PageUp') return go(from.row - page, from.col)
  if (k === 'Tab') {
    e.preventDefault()
    return move(0, e.shiftKey ? -1 : 1)
  }
  if (k === 'Enter' || k === 'F2') {
    e.preventDefault()
    return startEdit(undefined, 'edit')
  }
  if (k === 'Escape') {
    head.value = { ...anchor.value }
    return
  }
  if (k === 'Delete' || k === 'Backspace') {
    e.preventDefault()
    return clearRange()
  }
  if (mod && (k === 'z' || k === 'Z')) {
    e.preventDefault()
    return e.shiftKey ? redo() : undo()
  }
  if (mod && (k === 'y' || k === 'Y')) {
    e.preventDefault()
    return redo()
  }
  if (mod && (k === 'a' || k === 'A')) {
    e.preventDefault()
    anchor.value = { row: 0, col: 0 }
    head.value = { row: lastR, col: lastC }
    return
  }
  // A character starts typing into the cell, replacing it
  if (k.length === 1 && !mod && !e.altKey) {
    e.preventDefault()
    startEdit(k, 'enter')
  }
}
/** Ctrl+↓: the last filled row of the column (or the sheet's last one) */
function lastDataRow(col: number) {
  for (let r = props.modelValue.length - 1; r >= 0; r--) if (raw(r, col) != null && raw(r, col) !== '') return r
  return rowCount.value - 1
}
function lastDataCol(row: number) {
  const cells = props.modelValue[row] ?? []
  for (let c = cells.length - 1; c >= 0; c--) if (cells[c] != null && cells[c] !== '') return c
  return colCount.value - 1
}

function clearRange() {
  const { r1, r2, c1, c2 } = range.value
  const changes = []
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (raw(r, c) != null) changes.push({ row: r, col: c, value: null })
  write(changes)
}

// ── clipboard: tab-separated text, what Excel and Sheets put on it ──
/** The last copy from this grid: pasting it back moves its formulas' references like Excel does */
let lastCopy: { text: string; cells: SpreadsheetCell[][]; origin: SpreadsheetPosition } | null = null

function toTsv(rows: string[][]): string {
  const quote = (s: string) => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return rows.map((r) => r.map(quote).join('\t')).join('\n')
}
/** Tab-separated text into rows, quoted cells (with tabs, line breaks, `""`) included */
function parseTsv(text: string): string[][] {
  const rows: string[][] = [[]]
  let cell = ''
  let i = 0
  let quoted = false
  const t = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
  while (i < t.length) {
    const ch = t[i]!
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i += 2; continue }
      if (ch === '"') { quoted = false; i++; continue }
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') { quoted = true; i++; continue }
    if (ch === '\t') { rows.at(-1)!.push(cell); cell = ''; i++; continue }
    if (ch === '\n') { rows.at(-1)!.push(cell); rows.push([]); cell = ''; i++; continue }
    cell += ch
    i++
  }
  rows.at(-1)!.push(cell)
  return rows
}

function copySelection(): string {
  const { r1, r2, c1, c2 } = range.value
  const shown: string[][] = []
  const cells: SpreadsheetCell[][] = []
  for (let r = r1; r <= r2; r++) {
    const s: string[] = []
    const v: SpreadsheetCell[] = []
    for (let c = c1; c <= c2; c++) {
      s.push(display(r, c))
      v.push(raw(r, c))
    }
    shown.push(s)
    cells.push(v)
  }
  const text = toTsv(shown)
  lastCopy = { text, cells, origin: { row: r1, col: c1 } }
  return text
}

function paste(text: string) {
  const { r1, r2, c1, c2 } = range.value
  const internal = lastCopy && lastCopy.text === text ? lastCopy : null
  const cells = internal ? internal.cells : parseTsv(text).map((row) => row.map(parseInput))
  const h = cells.length
  const w = Math.max(...cells.map((r) => r.length))
  // One copied block repeated over a bigger selection, as Excel does when it fits a whole number of times
  const rowsOut = r2 > r1 && (r2 - r1 + 1) % h === 0 ? r2 - r1 + 1 : h
  const colsOut = c2 > c1 && (c2 - c1 + 1) % w === 0 ? c2 - c1 + 1 : w
  const changes = []
  for (let i = 0; i < rowsOut; i++) {
    for (let j = 0; j < colsOut; j++) {
      const r = r1 + i
      const c = c1 + j
      if (r >= rowCount.value || c >= colCount.value) continue
      let v = cells[i % h]?.[j % w] ?? null
      // Copied from this grid: a formula's references move by how far it travelled, as in Excel
      if (internal && typeof v === 'string' && v[0] === '=') v = shiftFormula(v, r - (internal.origin.row + (i % h)), c - (internal.origin.col + (j % w)))
      changes.push({ row: r, col: c, value: v })
    }
  }
  write(changes)
  anchor.value = { row: r1, col: c1 }
  head.value = clampPos({ row: r1 + rowsOut - 1, col: c1 + colsOut - 1 })
  nextTick(() => scrollIntoView(head.value))
}

const owns = () => !!scroller.value && document.activeElement === scroller.value && !editing.value
function onCopy(e: ClipboardEvent) {
  if (!owns()) return
  e.preventDefault()
  e.clipboardData?.setData('text/plain', copySelection())
}
function onCut(e: ClipboardEvent) {
  if (!owns()) return
  onCopy(e)
  clearRange()
}
function onPaste(e: ClipboardEvent) {
  if (!owns() || props.readonly) return
  const text = e.clipboardData?.getData('text/plain')
  if (text == null || text === '') return
  e.preventDefault()
  paste(text)
}
onMounted(() => {
  document.addEventListener('copy', onCopy)
  document.addEventListener('cut', onCut)
  document.addEventListener('paste', onPaste)
})

// ── pointer: select ranges, the fill handle, column widths ──
function cellFromPoint(x: number, y: number): SpreadsheetPosition | null {
  const el = scroller.value
  if (!el) return null
  const box = el.getBoundingClientRect()
  // From the grid's own geometry, so it works over headers, outside the grid (clamped) and under the finger
  const frozenW = colLeft.value[frozenCols.value]!
  const frozenH = frozenRowCount.value * props.rowHeight
  let cx = x - box.left - rowHeaderWidth.value
  let cy = y - box.top - headerHeight.value
  cx = cx < frozenW ? cx : cx + el.scrollLeft
  cy = cy < frozenH ? cy : cy + el.scrollTop
  const row = Math.floor(cy / props.rowHeight)
  let col = 0
  while (col < colCount.value - 1 && colLeft.value[col + 1]! <= cx) col++
  return clampPos({ row, col: cx < 0 ? 0 : col })
}

let dragging: 'select' | 'fill' | null = null
const fillTarget = ref<SpreadsheetPosition | null>(null)
let autoScroll = 0
let lastPointer = { x: 0, y: 0 }

function onCellPointerdown(e: PointerEvent, r: number, c: number) {
  if (e.button !== 0) return
  if (editing.value && isActive(r, c)) return
  // A formula being typed: a click inserts the cell's reference instead of moving away
  if (editing.value && editValue.value.startsWith('=') && /[=+\-*/^&(,;:<>]$/.test(editValue.value)) {
    e.preventDefault()
    editValue.value += cellName(r, c)
    ;(editingIn.value === 'bar' ? barInput.value : cellInput.value)?.focus()
    return
  }
  commitEdit()
  if (e.shiftKey) head.value = { row: r, col: c }
  else {
    anchor.value = { row: r, col: c }
    head.value = { row: r, col: c }
  }
  scroller.value?.focus({ preventScroll: true })
  // Touch scrolls the grid; mouse and pen drag out a range
  if (e.pointerType !== 'touch') startDrag('select', e)
}
function onFillPointerdown(e: PointerEvent) {
  if (props.readonly) return
  e.preventDefault()
  e.stopPropagation()
  commitEdit()
  fillTarget.value = null
  startDrag('fill', e)
}
function startDrag(kind: 'select' | 'fill', e: PointerEvent) {
  dragging = kind
  lastPointer = { x: e.clientX, y: e.clientY }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
  cancelAnimationFrame(autoScroll)
  autoScroll = requestAnimationFrame(scrollTick)
}
function onDragMove(e: PointerEvent) {
  lastPointer = { x: e.clientX, y: e.clientY }
  track()
}
function track() {
  const p = cellFromPoint(lastPointer.x, lastPointer.y)
  if (!p) return
  if (dragging === 'select') head.value = p
  else if (dragging === 'fill') {
    const { r1, r2, c1, c2 } = range.value
    // Along the axis the pointer has gone further out of the selection
    const down = p.row > r2 ? p.row - r2 : p.row < r1 ? p.row - r1 : 0
    const right = p.col > c2 ? p.col - c2 : p.col < c1 ? p.col - c1 : 0
    fillTarget.value = !down && !right ? null
      : Math.abs(down) >= Math.abs(right) ? { row: p.row, col: c2 } : { row: r2, col: p.col }
  }
}
/** Near the grid's edge while dragging, it scrolls that way */
function scrollTick() {
  const el = scroller.value
  if (!el || !dragging) return
  const box = el.getBoundingClientRect()
  const edge = 28
  const { x, y } = lastPointer
  const dy = y > box.bottom - edge ? 12 : y < box.top + headerHeight.value + edge ? -12 : 0
  const dx = x > box.right - edge ? 12 : x < box.left + rowHeaderWidth.value + edge ? -12 : 0
  if (dx || dy) {
    el.scrollTop += dy
    el.scrollLeft += dx
    onScroll()
    track()
  }
  autoScroll = requestAnimationFrame(scrollTick)
}
function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  cancelAnimationFrame(autoScroll)
  if (dragging === 'fill' && fillTarget.value) fill(fillTarget.value)
  fillTarget.value = null
  dragging = null
}

const fillRange = computed(() => {
  const t = fillTarget.value
  if (!t) return null
  const { r1, r2, c1, c2 } = range.value
  return { r1: Math.min(r1, t.row), r2: Math.max(r2, t.row), c1: Math.min(c1, t.col), c2: Math.max(c2, t.col) }
})
const inFill = (r: number, c: number) => {
  const f = fillRange.value
  return !!f && r >= f.r1 && r <= f.r2 && c >= f.c1 && c <= f.c2 && !inRange(r, c)
}

/**
 * Fills from the selection out to `target`: numbers that make a series (2 or more) go on with its step; anything
 * else repeats, a formula's references moving with it, a lone "Item 1" counting on
 */
function fill(target: SpreadsheetPosition) {
  const { r1, r2, c1, c2 } = range.value
  const vertical = target.row > r2 || target.row < r1
  const changes: { row: number; col: number; value: SpreadsheetCell }[] = []
  const lines = vertical ? [c1, c2] : [r1, r2]
  for (let line = lines[0]!; line <= lines[1]!; line++) {
    const src: SpreadsheetCell[] = []
    const from = vertical ? r1 : c1
    const to = vertical ? r2 : c2
    for (let i = from; i <= to; i++) src.push(vertical ? raw(i, line) : raw(line, i))
    const n = src.length
    const numeric = n >= 2 && src.every((v) => typeof v === 'number')
    const step = numeric ? ((src[n - 1] as number) - (src[0] as number)) / (n - 1) : 0
    const forward = vertical ? target.row > r2 : target.col > c2
    const count = vertical ? (forward ? target.row - r2 : r1 - target.row) : (forward ? target.col - c2 : c1 - target.col)
    for (let k = 1; k <= count; k++) {
      // Index into the source, cycling; and how far that copy moved
      const idx = forward ? (k - 1) % n : n - 1 - ((k - 1) % n)
      const offset = forward ? n - 1 - idx + k : -(idx + k)
      const at = forward ? to + k : from - k
      const v = src[idx]!
      let value: SpreadsheetCell = v
      if (numeric) value = forward ? (src[n - 1] as number) + step * k : (src[0] as number) - step * k
      else if (typeof v === 'string' && v[0] === '=') value = vertical ? shiftFormula(v, offset, 0) : shiftFormula(v, 0, offset)
      else if (n === 1 && typeof v === 'string') {
        const m = /^(.*?)(\d+)$/.exec(v)
        if (m) value = m[1]! + String(Number(m[2]) + (forward ? k : -k))
      }
      if (typeof value === 'number') value = Number(formatNumber(value))
      changes.push(vertical ? { row: at, col: line, value } : { row: line, col: at, value })
    }
  }
  write(changes.filter((ch) => ch.row >= 0 && ch.col >= 0 && ch.row < rowCount.value && ch.col < colCount.value))
  anchor.value = { row: Math.min(r1, target.row), col: Math.min(c1, target.col) }
  head.value = { row: Math.max(r2, target.row), col: Math.max(c2, target.col) }
}

// Headers: a click selects the column or row (Shift extends), the corner everything
function selectColumn(e: PointerEvent, c: number) {
  if (e.button !== 0) return
  commitEdit()
  if (!e.shiftKey) anchor.value = { row: 0, col: c }
  head.value = { row: rowCount.value - 1, col: c }
  scroller.value?.focus({ preventScroll: true })
}
function selectRow(e: PointerEvent, r: number) {
  if (e.button !== 0) return
  commitEdit()
  if (!e.shiftKey) anchor.value = { row: r, col: 0 }
  head.value = { row: r, col: colCount.value - 1 }
  scroller.value?.focus({ preventScroll: true })
}
function selectAll() {
  commitEdit()
  anchor.value = { row: 0, col: 0 }
  head.value = { row: rowCount.value - 1, col: colCount.value - 1 }
  scroller.value?.focus({ preventScroll: true })
}
const colSelected = (c: number) => c >= range.value.c1 && c <= range.value.c2
const rowSelected = (r: number) => r >= range.value.r1 && r <= range.value.r2

let resizing: { col: number; x: number; w: number } | null = null
function onResizeDown(e: PointerEvent, c: number) {
  e.preventDefault()
  e.stopPropagation()
  resizing = { col: c, x: e.clientX, w: widthOf(c) }
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return
  const next = [...localWidths.value]
  for (let i = 0; i <= resizing.col; i++) next[i] ??= props.defaultColumnWidth
  next[resizing.col] = Math.max(32, Math.round(resizing.w + e.clientX - resizing.x))
  localWidths.value = next
}
function onResizeUp() {
  if (!resizing) return
  resizing = null
  emit('update:columnWidths', [...localWidths.value])
}

onBeforeUnmount(() => {
  resize?.disconnect()
  document.removeEventListener('copy', onCopy)
  document.removeEventListener('cut', onCut)
  document.removeEventListener('paste', onPaste)
  onDragEnd()
})

// ── cell look ──
const frozenLeft = (c: number) => (c < frozenCols.value ? rowHeaderWidth.value + colLeft.value[c]! : undefined)
function cellStyle(r: number, c: number) {
  const s: Record<string, string> = { width: `${widthOf(c)}px`, height: `${props.rowHeight}px`, lineHeight: `${props.rowHeight - 1}px` }
  const left = frozenLeft(c)
  if (left != null) {
    s.position = 'sticky'
    s.left = `${left}px`
    s.zIndex = '1'
  }
  // The selection's outline: each edge cell draws its part
  const shadows: string[] = []
  const P = 'var(--color-primary)'
  if (inRange(r, c)) {
    const { r1, r2, c1, c2 } = range.value
    if (r === r1) shadows.push(`inset 0 2px 0 ${P}`)
    if (r === r2) shadows.push(`inset 0 -2px 0 ${P}`)
    if (c === c1) shadows.push(`inset 2px 0 0 ${P}`)
    if (c === c2) shadows.push(`inset -2px 0 0 ${P}`)
  }
  if (isActive(r, c) && (range.value.r1 !== range.value.r2 || range.value.c1 !== range.value.c2)) shadows.push(`inset 0 0 0 1px ${P}`)
  if (inFill(r, c)) shadows.push('inset 0 0 0 1px var(--color-outline)')
  if (shadows.length) s.boxShadow = shadows.join(', ')
  return s
}
const isFillCorner = (r: number, c: number) => !props.readonly && r === range.value.r2 && c === range.value.c2
const cellId = (r: number, c: number) => `${uid}-c${r}-${c}`
const activeId = computed(() => cellId(anchor.value.row, anchor.value.col))

function onBarFocus() {
  if (!editing.value) startEdit(undefined, 'edit', 'bar')
  else editingIn.value = 'bar'
}
const barValue = computed(() => (editing.value ? editValue.value : rawText(raw(anchor.value.row, anchor.value.col))))

defineExpose({
  /** Focuses the grid (keyboard, paste) */
  focus: () => scroller.value?.focus(),
  /** Selects a cell, or a range from `start` to `end`, and scrolls it into view */
  select,
  /** The selection now */
  selection: computed(currentRange),
  /** A cell's value, its formula worked out */
  value: valueAt,
  /** Undoes the last change made in the grid */
  undo,
  /** Redoes what undo undid */
  redo,
  /** Clears the selected cells */
  clear: clearRange,
})
</script>

<template>
  <div class="m3-spreadsheet rounded-md border border-outline-variant bg-surface text-on-surface">
    <div v-if="formulaBar" class="flex h-10 shrink-0 items-stretch border-b border-outline-variant bg-surface-container-low text-body-medium">
      <div
        class="flex w-24 shrink-0 items-center border-r border-outline-variant px-3 font-medium text-on-surface-variant"
        role="status"
        :aria-label="locale.spreadsheetName"
      >
        {{ rangeName }}
      </div>
      <span class="flex w-9 shrink-0 items-center justify-center font-mono text-label-large italic text-on-surface-variant" aria-hidden="true">fx</span>
      <input
        ref="barInput"
        class="min-w-0 flex-1 bg-transparent px-2 font-mono text-body-medium text-on-surface outline-none focus:bg-surface"
        :value="barValue"
        :readonly="readonly"
        :aria-label="locale.spreadsheetFormula"
        spellcheck="false"
        @focus="onBarFocus"
        @input="editValue = ($event.target as HTMLInputElement).value"
        @keydown="onEditorKeydown"
        @blur="onEditorBlur"
      >
    </div>

    <div
      ref="scroller"
      class="m3-spreadsheet-scroller relative min-h-0 flex-1 select-none overflow-auto overscroll-contain outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      tabindex="0"
      role="grid"
      :aria-label="label ?? locale.spreadsheet"
      :aria-rowcount="rowCount + (headers ? 1 : 0)"
      :aria-colcount="colCount + (headers ? 1 : 0)"
      aria-multiselectable="true"
      :aria-readonly="readonly || undefined"
      :aria-activedescendant="activeId"
      @scroll="onScroll"
      @keydown="onKeydown"
    >
      <div class="relative" :style="{ width: `${rowHeaderWidth + totalWidth}px`, height: `${headerHeight + rowCount * rowHeight}px` }">
        <!-- Column headers -->
        <div
          v-if="headers"
          class="sticky top-0 z-[3] flex"
          role="row"
          aria-rowindex="1"
          :style="{ height: `${headerHeight}px`, width: `${rowHeaderWidth + totalWidth}px` }"
        >
          <div
            class="sticky left-0 z-[4] flex-none border-r border-b border-outline-variant bg-surface-container"
            :style="{ width: `${rowHeaderWidth}px` }"
            role="columnheader"
            @pointerdown="selectAll"
          />
          <div
            v-for="c in colList"
            :key="c"
            role="columnheader"
            :aria-colindex="c + 2"
            class="relative flex-none select-none truncate border-r border-b border-outline-variant px-2 text-center text-label-medium"
            :class="colSelected(c) ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'"
            :style="{ width: `${widthOf(c)}px`, lineHeight: `${headerHeight - 1}px`, ...(frozenLeft(c) != null ? { position: 'sticky', left: `${frozenLeft(c)}px`, zIndex: 1 } : {}) }"
            @pointerdown="selectColumn($event, c)"
          >
            {{ columnLabels?.[c] ?? columnName(c) }}
            <span
              class="absolute inset-y-0 -right-1 z-[1] w-2 cursor-col-resize touch-none"
              aria-hidden="true"
              @pointerdown="onResizeDown($event, c)"
              @pointermove="onResizeMove"
              @pointerup="onResizeUp"
              @pointercancel="onResizeUp"
            />
          </div>
        </div>

        <!-- Frozen rows, then the rows in view (a spacer stands in for the ones above) -->
        <div
          v-if="frozenRowList.length"
          class="sticky z-[2]"
          :style="{ top: `${headerHeight}px`, width: `${rowHeaderWidth + totalWidth}px` }"
        >
          <template v-for="r in frozenRowList" :key="r">
            <div class="flex" role="row" :aria-rowindex="r + (headers ? 2 : 1)" :class="r === frozenRowList.length - 1 ? 'shadow-[0_1px_0_var(--color-outline)]' : ''">
              <div
                v-if="headers"
                role="rowheader"
                class="sticky left-0 z-[1] flex-none select-none border-r border-b border-outline-variant text-center text-label-medium"
                :class="rowSelected(r) ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'"
                :style="{ width: `${rowHeaderWidth}px`, height: `${rowHeight}px`, lineHeight: `${rowHeight - 1}px` }"
                @pointerdown="selectRow($event, r)"
              >{{ r + 1 }}</div>
              <div
                v-for="c in colList"
                :id="cellId(r, c)"
                :key="c"
                role="gridcell"
                :aria-colindex="c + (headers ? 2 : 1)"
                :aria-selected="inRange(r, c)"
                :data-row="r"
                :data-col="c"
                class="m3-spreadsheet-cell relative flex-none border-r border-b border-outline-variant px-2 text-body-medium"
                :class="[align(r, c), inRange(r, c) && !isActive(r, c) ? 'm3-spreadsheet-selected' : 'bg-surface', valueAt(r, c) instanceof FormulaError ? 'text-error' : '']"
                :style="cellStyle(r, c)"
                @pointerdown="onCellPointerdown($event, r, c)"
                @dblclick="startEdit(undefined, 'edit')"
              >
                <span class="block truncate">{{ display(r, c) }}</span>
                <input
                  v-if="editing && editingIn === 'cell' && isActive(r, c)"
                  :ref="setCellInput"
                  v-model="editValue"
                  class="absolute inset-0 z-[2] w-full select-text bg-surface px-2 text-body-medium text-on-surface shadow-[inset_0_0_0_2px_var(--color-primary)] outline-none"
                  spellcheck="false"
                  @keydown="onEditorKeydown"
                  @blur="onEditorBlur"
                >
                <span v-if="isFillCorner(r, c)" class="m3-spreadsheet-fill" aria-hidden="true" @pointerdown="onFillPointerdown" />
              </div>
            </div>
          </template>
        </div>

        <div :style="{ height: `${firstRow * rowHeight}px` }" />
        <div v-for="r in visibleRows" :key="r" class="flex" role="row" :aria-rowindex="r + (headers ? 2 : 1)" :style="{ height: `${rowHeight}px` }">
          <div
            v-if="headers"
            role="rowheader"
            class="sticky left-0 z-[1] flex-none select-none border-r border-b border-outline-variant text-center text-label-medium"
            :class="rowSelected(r) ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'"
            :style="{ width: `${rowHeaderWidth}px`, height: `${rowHeight}px`, lineHeight: `${rowHeight - 1}px` }"
            @pointerdown="selectRow($event, r)"
          >{{ r + 1 }}</div>
          <div
            v-for="c in colList"
            :id="cellId(r, c)"
            :key="c"
            role="gridcell"
            :aria-colindex="c + (headers ? 2 : 1)"
            :aria-selected="inRange(r, c)"
            :data-row="r"
            :data-col="c"
            class="m3-spreadsheet-cell relative flex-none border-r border-b border-outline-variant px-2 text-body-medium"
            :class="[align(r, c), inRange(r, c) && !isActive(r, c) ? 'm3-spreadsheet-selected' : 'bg-surface', valueAt(r, c) instanceof FormulaError ? 'text-error' : '']"
            :style="cellStyle(r, c)"
            @pointerdown="onCellPointerdown($event, r, c)"
            @dblclick="startEdit(undefined, 'edit')"
          >
            <span class="block truncate">{{ display(r, c) }}</span>
            <input
              v-if="editing && editingIn === 'cell' && isActive(r, c)"
              :ref="setCellInput"
              v-model="editValue"
              class="absolute inset-0 z-[2] w-full select-text bg-surface px-2 text-body-medium text-on-surface shadow-[inset_0_0_0_2px_var(--color-primary)] outline-none"
              spellcheck="false"
              @keydown="onEditorKeydown"
              @blur="onEditorBlur"
            >
            <span v-if="isFillCorner(r, c)" class="m3-spreadsheet-fill" aria-hidden="true" @pointerdown="onFillPointerdown" />
          </div>
        </div>
        <span class="sr-only" aria-live="polite">{{ rangeName }} {{ display(anchor.row, anchor.col) }}</span>
      </div>
    </div>
  </div>
</template>

<style>
@layer base {
  .m3-spreadsheet {
    display: flex;
    flex-direction: column;
    height: 24rem;
    overflow: hidden;
  }
}
.m3-spreadsheet-selected {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
}
.m3-spreadsheet-fill {
  position: absolute;
  right: -4px;
  bottom: -4px;
  z-index: 3;
  width: 8px;
  height: 8px;
  border: 1px solid var(--color-surface);
  background: var(--color-primary);
  cursor: crosshair;
  touch-action: none;
}
.m3-spreadsheet-cell:has(.m3-spreadsheet-fill) {
  z-index: 2;
}
</style>
