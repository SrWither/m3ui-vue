import { describe, expect, it } from 'vitest'
import {
  FormulaError, cellName, columnIndex, columnName, createSheetEvaluator, formatNumber, parseCellName, shiftFormula,
  type SpreadsheetCell,
} from '../composables/spreadsheetFormula'

const sheet = (cells: SpreadsheetCell[][]) => createSheetEvaluator(cells)
const code = (v: unknown) => (v instanceof FormulaError ? v.code : v)

describe('A1 notation', () => {
  it('columns and cells', () => {
    expect([0, 25, 26, 51, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA'])
    expect(columnIndex('AA')).toBe(26)
    expect(cellName(2, 1)).toBe('B3')
    expect(parseCellName('$C$10')).toEqual({ row: 9, col: 2 })
    expect(parseCellName('hello')).toBeNull()
  })
})

describe('formulas', () => {
  it('arithmetic with precedence, unary minus, percent and power', () => {
    const s = sheet([['=1+2*3', '=(1+2)*3', '=-2^2', '=50%*10', '=2^3^2', '=0.1+0.2']])
    expect([0, 1, 2, 3, 4, 5].map((c) => s.value(0, c))).toEqual([7, 9, 4, 5, 64, 0.30000000000000004])
    expect(formatNumber(0.1 + 0.2)).toBe('0.3')
  })

  it('references, ranges and functions; text in a range is skipped', () => {
    const s = sheet([
      [1, 2, 'x', '=SUM(A1:C1)', '=AVERAGE(A1:B1)', '=COUNT(A1:C1)', '=COUNTA(A1:C1)'],
      ['=A1+B1', '=A2*10', '=MAX(A1:B2)', '=IF(A2>2,"big","small")', '=ROUND(2/3,2)', '=CONCAT(C1,"-",A1)', '=LEN("hello")'],
    ])
    expect([3, 4, 5, 6].map((c) => s.value(0, c))).toEqual([3, 1.5, 2, 3])
    expect([0, 1, 2, 3, 4, 5, 6].map((c) => s.value(1, c))).toEqual([3, 30, 30, 'big', 0.67, 'x-1', 5])
  })

  it('comparison, text joining, booleans and case-insensitive names', () => {
    const s = sheet([['="a"&"b"', '=1<2', '=sum(1,2)', '="A"="a"', '=AND(TRUE,1>0)', '=NOT(FALSE)']])
    expect([0, 1, 2, 3, 4, 5].map((c) => s.value(0, c))).toEqual(['ab', true, 3, true, true, true])
  })

  it('errors: #DIV/0!, #NAME?, #VALUE!, a syntax error, and IFERROR', () => {
    const s = sheet([['=1/0', '=NOPE(1)', '="a"*2', '=1+', '=IFERROR(A1,"none")', '=A1+1']])
    expect([0, 1, 2, 3, 4, 5].map((c) => code(s.value(0, c)))).toEqual(['#DIV/0!', '#NAME?', '#VALUE!', '#ERROR!', 'none', '#DIV/0!'])
  })

  it('a circular reference is #CIRC!, not a hang', () => {
    const s = sheet([['=B1', '=A1', '=C1+1']])
    expect(code(s.value(0, 0))).toBe('#CIRC!')
    expect(code(s.value(0, 1))).toBe('#CIRC!')
    expect(code(s.value(0, 2))).toBe('#CIRC!')
  })

  it('SUMIF and COUNTIF with conditions', () => {
    const s = sheet([['a', 'b', 'a'], [1, 2, 3], ['=SUMIF(A1:C1,"a",A2:C2)', '=COUNTIF(A2:C2,">1")', '=SUMIF(A2:C2,"<>2")']])
    expect([0, 1, 2].map((c) => s.value(2, c))).toEqual([4, 2, 4])
  })

  it('custom functions', () => {
    const s = createSheetEvaluator([['=DOUBLE(21)']], { functions: { DOUBLE: ([a]) => (a as number) * 2 } })
    expect(s.value(0, 0)).toBe(42)
  })

  it('a reference outside the sheet is #REF!', () => {
    const s = createSheetEvaluator([['=Z99']], { rows: 10, cols: 5 })
    expect(code(s.value(0, 0))).toBe('#REF!')
  })
})

describe('shiftFormula', () => {
  it('moves relative references, keeps $-locked parts and function names', () => {
    expect(shiftFormula('=A1+$B$2+C$3+$D4', 2, 1)).toBe('=B3+$B$2+D$3+$D6')
    expect(shiftFormula('=SUM(A1:A3)*LOG10(B1)', 1, 0)).toBe('=SUM(A2:A4)*LOG10(B2)')
    expect(shiftFormula('="A1"&A1', 1, 0)).toBe('="A1"&A2')
    expect(shiftFormula('=A1', -1, 0)).toBe('=#REF!')
    expect(shiftFormula('plain', 1, 1)).toBe('plain')
  })
})
