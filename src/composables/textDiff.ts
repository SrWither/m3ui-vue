/*
 * Line and word diffs (Myers' O(ND) algorithm) behind MDiffViewer, usable on their own. `diffLines(a, b)` gives
 * every line as equal, removed or added with its line numbers; `diffWords(a, b)` splits two versions of one line
 * into the parts that stayed and changed, for highlighting inside a changed line.
 */

export type DiffOp = 'equal' | 'remove' | 'add'

/** One line of a diff. */
export interface DiffLine {
  op: DiffOp
  text: string
  /** Its number in the original (equal and removed lines) */
  oldLine?: number
  /** Its number in the modified version (equal and added lines) */
  newLine?: number
}

/** A run of a word diff. */
export interface DiffPart {
  op: DiffOp
  text: string
}

/** The edit script between two sequences: Myers' greedy diff, with the shortest middle snake left out (simple, O(ND)). */
function myers<T>(a: T[], b: T[]): DiffOp[] {
  const n = a.length
  const m = b.length
  const max = n + m
  const v = new Map<number, number>([[1, 0]])
  const trace: Map<number, number>[] = []
  outer: for (let d = 0; d <= max; d++) {
    trace.push(new Map(v))
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1)) ? v.get(k + 1) ?? 0 : (v.get(k - 1) ?? 0) + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) { x++; y++ }
      v.set(k, x)
      if (x >= n && y >= m) break outer
    }
  }
  // Walk back through the trace
  const ops: DiffOp[] = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vd = trace[d]!
    const k = x - y
    const down = k === -d || (k !== d && (vd.get(k - 1) ?? -1) < (vd.get(k + 1) ?? -1))
    const prevK = down ? k + 1 : k - 1
    const prevX = vd.get(prevK) ?? 0
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { ops.push('equal'); x--; y-- }
    if (d > 0) {
      if (down) { ops.push('add'); y-- } else { ops.push('remove'); x-- }
    }
  }
  while (x > 0 && y > 0) { ops.push('equal'); x--; y-- }
  return ops.reverse()
}

const lines = (s: string) => (s === '' ? [] : s.replace(/\r\n?/g, '\n').split('\n'))

/** Every line of `a` → `b` as equal, removed or added, with its line numbers. Removals come before additions. */
export function diffLines(a: string, b: string): DiffLine[] {
  const A = lines(a)
  const B = lines(b)
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  let removes: DiffLine[] = []
  let adds: DiffLine[] = []
  const flush = () => { out.push(...removes, ...adds); removes = []; adds = [] }
  for (const op of myers(A, B)) {
    if (op === 'equal') {
      flush()
      out.push({ op, text: A[i]!, oldLine: ++i, newLine: ++j })
    } else if (op === 'remove') removes.push({ op, text: A[i]!, oldLine: ++i })
    else adds.push({ op, text: B[j]!, newLine: ++j })
  }
  flush()
  return out
}

/** Two versions of a line split into words, spaces and punctuation, marked as kept, removed or added. */
export function diffWords(a: string, b: string): DiffPart[] {
  const split = (s: string) => s.match(/\w+|\s+|[^\w\s]/gu) ?? []
  const A = split(a)
  const B = split(b)
  const out: DiffPart[] = []
  let i = 0
  let j = 0
  for (const op of myers(A, B)) {
    const text = op === 'add' ? B[j++]! : A[i++]!
    if (op === 'equal') j++
    const lastPart = out[out.length - 1]
    if (lastPart && lastPart.op === op) lastPart.text += text
    else out.push({ op, text })
  }
  return out
}

/** How many lines were added and removed. */
export function diffStats(diff: DiffLine[]) {
  return { added: diff.filter((l) => l.op === 'add').length, removed: diff.filter((l) => l.op === 'remove').length }
}
