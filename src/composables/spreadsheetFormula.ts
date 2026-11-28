// Spreadsheet formulas for MSpreadsheet: A1 references, ranges, the usual operators and functions. Pure functions,
// no Vue: also usable on their own (to evaluate a saved sheet on the server, say)

/** What a cell holds: what was typed. A string starting with `=` is a formula */
export type SpreadsheetCell = string | number | boolean | null

/** A formula error, shown in the cell as its code (`#DIV/0!`, `#REF!`…) */
export class FormulaError {
  constructor(public code: '#DIV/0!' | '#REF!' | '#NAME?' | '#VALUE!' | '#CIRC!' | '#ERROR!' | '#N/A') {}
  toString() { return this.code }
}

/** What a cell shows once its formula is worked out */
export type SpreadsheetValue = number | string | boolean | null | FormulaError

// ── A1 notation ──

/** `0 → A`, `25 → Z`, `26 → AA` */
export function columnName(index: number): string {
  let s = ''
  let n = index + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** `A → 0`, `AA → 26` */
export function columnIndex(name: string): number {
  let n = 0
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** `{ row: 0, col: 0 } → A1` */
export function cellName(row: number, col: number): string {
  return `${columnName(col)}${row + 1}`
}

/** `B3 → { row: 2, col: 1 }`, or null if it isn't a reference */
export function parseCellName(ref: string): { row: number; col: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim())
  if (!m) return null
  const row = Number(m[2]) - 1
  return row < 0 ? null : { row, col: columnIndex(m[1]!) }
}

// ── tokens ──

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; col: number; row: number; absCol: boolean; absRow: boolean; text: string; start: number; end: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }

const REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]!
    if (/\s/.test(ch)) { i++; continue }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))
      if (!m) throw new FormulaError('#ERROR!')
      out.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (ch === '"') {
      let s = ''
      i++
      for (;;) {
        if (i >= src.length) throw new FormulaError('#ERROR!')
        if (src[i] === '"') {
          if (src[i + 1] === '"') { s += '"'; i += 2; continue }
          i++
          break
        }
        s += src[i++]
      }
      out.push({ t: 'str', v: s })
      continue
    }
    if (/[A-Za-z$_]/.test(ch)) {
      const ref = REF.exec(src.slice(i))
      if (ref) {
        out.push({ t: 'ref', absCol: !!ref[1], col: columnIndex(ref[2]!), absRow: !!ref[3], row: Number(ref[4]) - 1, text: ref[0], start: i, end: i + ref[0].length })
        i += ref[0].length
        continue
      }
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))
      if (!m) throw new FormulaError('#ERROR!')
      out.push({ t: 'id', v: m[0].toUpperCase() })
      i += m[0].length
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: 'op', v: two }); i += 2; continue }
    if ('+-*/^&=<>(),;:%'.includes(ch)) { out.push({ t: 'op', v: ch === ';' ? ',' : ch }); i++; continue }
    throw new FormulaError('#ERROR!')
  }
  return out
}

// ── parse ──

type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'ref'; row: number; col: number }
  | { k: 'range'; r1: number; c1: number; r2: number; c2: number }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'pct'; a: Node }
  | { k: 'call'; name: string; args: Node[] }

function parse(tokens: Token[]): Node {
  let p = 0
  const peek = () => tokens[p]
  const isOp = (v: string) => { const t = tokens[p]; return t?.t === 'op' && t.v === v }
  const expect = (v: string) => { if (!isOp(v)) throw new FormulaError('#ERROR!'); p++ }

  const binary = (next: () => Node, ops: string[]) => (): Node => {
    let a = next()
    for (;;) {
      const t = peek()
      if (t?.t === 'op' && ops.includes(t.v)) { p++; a = { k: 'bin', op: t.v, a, b: next() } }
      else return a
    }
  }
  const primary = (): Node => {
    const t = tokens[p++]
    if (!t) throw new FormulaError('#ERROR!')
    if (t.t === 'num') return { k: 'num', v: t.v }
    if (t.t === 'str') return { k: 'str', v: t.v }
    if (t.t === 'ref') {
      if (isOp(':')) {
        p++
        const b = tokens[p++]
        if (b?.t !== 'ref') throw new FormulaError('#ERROR!')
        return { k: 'range', r1: Math.min(t.row, b.row), c1: Math.min(t.col, b.col), r2: Math.max(t.row, b.row), c2: Math.max(t.col, b.col) }
      }
      return { k: 'ref', row: t.row, col: t.col }
    }
    if (t.t === 'id') {
      if (isOp('(')) {
        p++
        const args: Node[] = []
        if (!isOp(')')) {
          for (;;) {
            args.push(expr())
            if (isOp(',')) { p++; continue }
            break
          }
        }
        expect(')')
        return { k: 'call', name: t.v, args }
      }
      if (t.v === 'TRUE' || t.v === 'FALSE') return { k: 'bool', v: t.v === 'TRUE' }
      throw new FormulaError('#NAME?')
    }
    if (t.t === 'op' && t.v === '(') {
      const e = expr()
      expect(')')
      return e
    }
    throw new FormulaError('#ERROR!')
  }
  const postfix = (): Node => {
    let a = primary()
    while (isOp('%')) { p++; a = { k: 'pct', a } }
    return a
  }
  const unary = (): Node => {
    if (isOp('-') || isOp('+')) {
      const op = (tokens[p++] as { v: string }).v
      return { k: 'un', op, a: unary() }
    }
    return postfix()
  }
  const power = binary(unary, ['^'])
  const term = binary(power, ['*', '/'])
  const additive = binary(term, ['+', '-'])
  const concat = binary(additive, ['&'])
  const comparison = binary(concat, ['=', '<>', '<', '>', '<=', '>='])
  const expr = comparison

  const node = expr()
  if (p < tokens.length) throw new FormulaError('#ERROR!')
  return node
}

const parsed = new Map<string, Node | FormulaError>()
function compile(formula: string): Node | FormulaError {
  let n = parsed.get(formula)
  if (!n) {
    try { n = parse(tokenize(formula)) } catch (e) { n = e instanceof FormulaError ? e : new FormulaError('#ERROR!') }
    if (parsed.size > 5000) parsed.clear()
    parsed.set(formula, n)
  }
  return n
}

// ── evaluate ──

type Val = SpreadsheetValue
type Arg = Val | Val[]

function num(v: Val): number {
  if (v instanceof FormulaError) throw v
  if (v == null || v === '') return 0
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const n = Number(v)
  if (Number.isNaN(n)) throw new FormulaError('#VALUE!')
  return n
}
function str(v: Val): string {
  if (v instanceof FormulaError) throw v
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return typeof v === 'number' ? formatNumber(v) : v
}
function bool(v: Val): boolean {
  if (v instanceof FormulaError) throw v
  if (typeof v === 'string') {
    const u = v.toUpperCase()
    if (u === 'TRUE') return true
    if (u === 'FALSE' || u === '') return false
    throw new FormulaError('#VALUE!')
  }
  return !!v
}
/** All the numbers in some arguments: a range's text and blanks are skipped, a direct argument is converted */
function numbers(args: Arg[]): number[] {
  const out: number[] = []
  for (const a of args) {
    if (Array.isArray(a)) for (const v of a) {
      if (v instanceof FormulaError) throw v
      if (typeof v === 'number') out.push(v)
    }
    else out.push(num(a))
  }
  return out
}
const flat = (args: Arg[]): Val[] => args.flatMap((a) => (Array.isArray(a) ? a : [a]))
const scalar = (a: Arg | undefined): Val => {
  if (a === undefined) throw new FormulaError('#VALUE!')
  if (Array.isArray(a)) throw new FormulaError('#VALUE!')
  return a
}

function compare(a: Val, b: Val): number {
  const ta = typeof a === 'number' || a == null ? 0 : typeof a === 'string' ? 1 : 2
  const tb = typeof b === 'number' || b == null ? 0 : typeof b === 'string' ? 1 : 2
  if (a == null && typeof b === 'string') return ''.localeCompare(b)
  if (b == null && typeof a === 'string') return a.localeCompare('')
  if (ta !== tb) return ta - tb
  if (ta === 1) return (a as string).toLowerCase().localeCompare((b as string).toLowerCase())
  return num(a) - num(b)
}

/** The functions a formula can call. Add your own with `functions` on MSpreadsheet */
export type SpreadsheetFunction = (args: Arg[]) => Val

const round = (n: number, d: number) => { const f = 10 ** d; return Math.round(n * f) / f }

export const spreadsheetFunctions: Record<string, SpreadsheetFunction> = {
  SUM: (a) => numbers(a).reduce((s, n) => s + n, 0),
  AVERAGE: (a) => { const n = numbers(a); if (!n.length) throw new FormulaError('#DIV/0!'); return n.reduce((s, x) => s + x, 0) / n.length },
  MIN: (a) => { const n = numbers(a); return n.length ? Math.min(...n) : 0 },
  MAX: (a) => { const n = numbers(a); return n.length ? Math.max(...n) : 0 },
  PRODUCT: (a) => numbers(a).reduce((s, n) => s * n, 1),
  COUNT: (a) => flat(a).filter((v) => typeof v === 'number').length,
  COUNTA: (a) => flat(a).filter((v) => v != null && v !== '').length,
  COUNTBLANK: (a) => flat(a).filter((v) => v == null || v === '').length,
  ROUND: (a) => round(num(scalar(a[0])), a[1] === undefined ? 0 : num(scalar(a[1]))),
  ABS: (a) => Math.abs(num(scalar(a[0]))),
  SQRT: (a) => { const n = num(scalar(a[0])); if (n < 0) throw new FormulaError('#VALUE!'); return Math.sqrt(n) },
  POWER: (a) => num(scalar(a[0])) ** num(scalar(a[1])),
  MOD: (a) => { const d = num(scalar(a[1])); if (d === 0) throw new FormulaError('#DIV/0!'); const n = num(scalar(a[0])); return n - d * Math.floor(n / d) },
  INT: (a) => Math.floor(num(scalar(a[0]))),
  IF: (a) => (bool(scalar(a[0])) ? (a[1] === undefined ? true : scalar(a[1])) : (a[2] === undefined ? false : scalar(a[2]))),
  IFERROR: (a) => { const v = a[0]; return v instanceof FormulaError ? scalar(a[1]) : scalar(v) },
  AND: (a) => flat(a).every((v) => bool(v)),
  OR: (a) => flat(a).some((v) => bool(v)),
  NOT: (a) => !bool(scalar(a[0])),
  CONCAT: (a) => flat(a).map(str).join(''),
  CONCATENATE: (a) => flat(a).map(str).join(''),
  LEN: (a) => str(scalar(a[0])).length,
  UPPER: (a) => str(scalar(a[0])).toUpperCase(),
  LOWER: (a) => str(scalar(a[0])).toLowerCase(),
  TRIM: (a) => str(scalar(a[0])).trim().replace(/\s+/g, ' '),
  LEFT: (a) => str(scalar(a[0])).slice(0, a[1] === undefined ? 1 : num(scalar(a[1]))),
  RIGHT: (a) => { const s = str(scalar(a[0])); const n = a[1] === undefined ? 1 : num(scalar(a[1])); return n ? s.slice(-n) : '' },
  SUMIF: (a) => {
    const range = Array.isArray(a[0]) ? a[0] : [scalar(a[0])]
    const sums = a[2] === undefined ? range : Array.isArray(a[2]) ? a[2] : [a[2]]
    const test = criterion(scalar(a[1]))
    let s = 0
    range.forEach((v, i) => { const x = sums[i]; if (test(v) && typeof x === 'number') s += x })
    return s
  },
  COUNTIF: (a) => { const range = Array.isArray(a[0]) ? a[0] : [scalar(a[0])]; const test = criterion(scalar(a[1])); return range.filter(test).length },
}

/** `">5"`, `"<>x"`, `"apple"`, `3`: a condition for SUMIF/COUNTIF */
function criterion(c: Val): (v: Val) => boolean {
  if (typeof c === 'string') {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(c)!
    const op = m[1] ?? '='
    const raw = m[2]!
    const target: Val = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw
    return (v) => {
      if (v instanceof FormulaError) return false
      const d = compare(v, target)
      return op === '=' ? d === 0 : op === '<>' ? d !== 0 : op === '<' ? d < 0 : op === '>' ? d > 0 : op === '<=' ? d <= 0 : d >= 0
    }
  }
  return (v) => !(v instanceof FormulaError) && compare(v, c) === 0
}

/** Where a formula reads cells from: their values (formulas already worked out) */
export interface FormulaContext {
  get(row: number, col: number): Val
  functions?: Record<string, SpreadsheetFunction>
  /** Rows and columns the sheet has: a reference outside them is `#REF!` */
  rows?: number
  cols?: number
}

function evalNode(n: Node, ctx: FormulaContext): Arg {
  switch (n.k) {
    case 'num': return n.v
    case 'str': return n.v
    case 'bool': return n.v
    case 'ref':
      if ((ctx.rows != null && n.row >= ctx.rows) || (ctx.cols != null && n.col >= ctx.cols)) throw new FormulaError('#REF!')
      return ctx.get(n.row, n.col)
    case 'range': {
      const out: Val[] = []
      const r2 = ctx.rows != null ? Math.min(n.r2, ctx.rows - 1) : n.r2
      const c2 = ctx.cols != null ? Math.min(n.c2, ctx.cols - 1) : n.c2
      for (let r = n.r1; r <= r2; r++) for (let c = n.c1; c <= c2; c++) out.push(ctx.get(r, c))
      return out
    }
    case 'pct': return num(scalar(evalNode(n.a, ctx))) / 100
    case 'un': { const v = num(scalar(evalNode(n.a, ctx))); return n.op === '-' ? -v : v }
    case 'bin': {
      const a = scalar(evalNode(n.a, ctx))
      const b = scalar(evalNode(n.b, ctx))
      switch (n.op) {
        case '+': return num(a) + num(b)
        case '-': return num(a) - num(b)
        case '*': return num(a) * num(b)
        case '/': { const d = num(b); if (d === 0) throw new FormulaError('#DIV/0!'); return num(a) / d }
        case '^': return num(a) ** num(b)
        case '&': return str(a) + str(b)
        default: {
          if (a instanceof FormulaError) throw a
          if (b instanceof FormulaError) throw b
          const d = compare(a, b)
          return n.op === '=' ? d === 0 : n.op === '<>' ? d !== 0 : n.op === '<' ? d < 0 : n.op === '>' ? d > 0 : n.op === '<=' ? d <= 0 : d >= 0
        }
      }
    }
    case 'call': {
      const fn = ctx.functions?.[n.name] ?? spreadsheetFunctions[n.name]
      if (!fn) throw new FormulaError('#NAME?')
      // IFERROR gets its first argument's error instead of failing with it
      const args = n.args.map((a, i) => {
        if (n.name === 'IFERROR' && i === 0) {
          try { return evalNode(a, ctx) } catch (e) { if (e instanceof FormulaError) return e; throw e }
        }
        return evalNode(a, ctx)
      })
      return fn(args)
    }
  }
}

/** Works out a formula (without its leading `=`). Errors come back as a `FormulaError`, never thrown */
export function evaluateFormula(formula: string, ctx: FormulaContext): SpreadsheetValue {
  const node = compile(formula)
  if (node instanceof FormulaError) return node
  try {
    const v = evalNode(node, ctx)
    if (Array.isArray(v)) return v.length === 1 ? v[0]! : new FormulaError('#VALUE!')
    if (typeof v === 'number' && !Number.isFinite(v)) return new FormulaError('#DIV/0!')
    return v
  } catch (e) {
    if (e instanceof FormulaError) return e
    if (e instanceof RangeError) return new FormulaError('#CIRC!')
    return new FormulaError('#ERROR!')
  }
}

/**
 * Evaluates a whole sheet lazily: `value(row, col)` works a cell out the first time it's asked for (and whatever it
 * reads), then remembers it. Circular references come out as `#CIRC!`. Make a new one when the cells change.
 */
export function createSheetEvaluator(cells: SpreadsheetCell[][], options: { functions?: Record<string, SpreadsheetFunction>; rows?: number; cols?: number } = {}) {
  const memo = new Map<number, SpreadsheetValue>()
  const busy = new Set<number>()
  const width = Math.max(options.cols ?? 0, ...cells.map((r) => r?.length ?? 0), 1)
  const ctx: FormulaContext = { get: (r, c) => value(r, c), functions: options.functions, rows: options.rows, cols: options.cols }
  function value(row: number, col: number): SpreadsheetValue {
    const raw = cells[row]?.[col] ?? null
    if (typeof raw !== 'string' || raw[0] !== '=') return raw === '' ? null : raw
    const key = row * width + col
    if (memo.has(key)) return memo.get(key)!
    if (busy.has(key)) throw new FormulaError('#CIRC!')
    busy.add(key)
    let v: SpreadsheetValue
    try { v = evaluateFormula(raw.slice(1), ctx) } finally { busy.delete(key) }
    // A cycle reached through this cell: everything in it is #CIRC!
    memo.set(key, v)
    return v
  }
  return {
    value(row: number, col: number): SpreadsheetValue {
      try { return value(row, col) } catch (e) { return e instanceof FormulaError ? e : new FormulaError('#ERROR!') }
    },
  }
}

/**
 * The formula moved by some rows and columns, as when it's copied or filled into another cell: relative references
 * move, `$`-locked parts stay. A reference pushed off the sheet becomes `#REF!`.
 */
export function shiftFormula(formula: string, dRow: number, dCol: number): string {
  if (formula[0] !== '=') return formula
  let tokens: Token[]
  try { tokens = tokenize(formula.slice(1)) } catch { return formula }
  let out = ''
  let last = 0
  const src = formula.slice(1)
  for (const t of tokens) {
    if (t.t !== 'ref') continue
    const row = t.absRow ? t.row : t.row + dRow
    const col = t.absCol ? t.col : t.col + dCol
    out += src.slice(last, t.start)
    out += row < 0 || col < 0 ? '#REF!' : `${t.absCol ? '$' : ''}${columnName(col)}${t.absRow ? '$' : ''}${row + 1}`
    last = t.end
  }
  return '=' + out + src.slice(last)
}

/** A number as a cell shows it: no float noise (`0.1 + 0.2` shows 0.3) */
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Number(n.toPrecision(12)))
}
