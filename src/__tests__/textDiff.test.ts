import { describe, expect, it } from 'vitest'
import { diffLines, diffStats, diffWords } from '../composables/textDiff'

const compact = (a: string, b: string) => diffLines(a, b).map((l) => `${l.op === 'equal' ? ' ' : l.op === 'add' ? '+' : '-'}${l.text}`)

describe('diffLines', () => {
  it('finds equal, removed and added lines with their numbers', () => {
    const d = diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne')
    expect(d.map((l) => `${l.op === 'equal' ? ' ' : l.op === 'add' ? '+' : '-'}${l.text}`)).toEqual([' a', '-b', '+B', ' c', ' d', '+e'])
    expect(d[1]).toMatchObject({ oldLine: 2 })
    expect(d[2]).toMatchObject({ newLine: 2 })
    expect(d[5]).toMatchObject({ newLine: 5 })
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 })
  })

  it('handles empty sides, identical texts and line endings', () => {
    expect(compact('', 'x\ny')).toEqual(['+x', '+y'])
    expect(compact('x\ny', '')).toEqual(['-x', '-y'])
    expect(compact('same\ntext', 'same\ntext')).toEqual([' same', ' text'])
    expect(compact('a\r\nb', 'a\nb')).toEqual([' a', ' b'])
  })

  it('is minimal on a moved block', () => {
    const d = diffLines('1\n2\n3\n4\n5', '1\n4\n5\n2\n3')
    expect(diffStats(d).added + diffStats(d).removed).toBe(4)
  })
})

describe('diffWords', () => {
  it('marks the changed words of a line', () => {
    expect(diffWords('const total = price * qty', 'const total = price * quantity + tax')).toEqual([
      { op: 'equal', text: 'const total = price * ' },
      { op: 'remove', text: 'qty' },
      { op: 'add', text: 'quantity + tax' },
    ])
  })
})
