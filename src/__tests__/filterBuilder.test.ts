import { describe, expect, it } from 'vitest'
import {
  countRules, createFilter, filterRows, matchesFilter, operatorsFor,
  type FilterField, type FilterGroup,
} from '../composables/filterBuilder'

const fields: FilterField[] = [
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'due', label: 'Due', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Open', value: 'open' }, { label: 'Done', value: 'done' }] },
  { key: 'urgent', label: 'Urgent', type: 'boolean' },
  { key: 'address.city', label: 'City' },
  { key: 'tags', label: 'Tags', type: 'select' },
]
const rows = [
  { id: 1, name: 'Fix login', price: 120, due: '2026-11-20', status: 'open', urgent: true, address: { city: 'Córdoba' }, tags: ['web', 'auth'] },
  { id: 2, name: 'Write docs', price: 40, due: '2026-12-02T10:00:00Z', status: 'done', urgent: false, address: { city: 'Rosario' }, tags: ['docs'] },
  { id: 3, name: 'Deploy', price: null, due: null, status: 'open', urgent: false, address: { city: 'córdoba' }, tags: [] },
]
const ids = (filter: FilterGroup) => filterRows(rows, filter, fields).map((r) => r.id)
const one = (field: string, operator: string, value?: unknown) => createFilter([{ field, operator: operator as never, value }])

describe('filterBuilder', () => {
  it('compares text case-insensitively, through dotted paths', () => {
    expect(ids(one('name', 'contains', 'DO'))).toEqual([2])
    expect(ids(one('name', 'notContains', 'login'))).toEqual([2, 3])
    expect(ids(one('name', 'startsWith', 'fix'))).toEqual([1])
    expect(ids(one('name', 'endsWith', 'docs'))).toEqual([2])
    expect(ids(one('address.city', 'equals', 'CÓRDOBA'))).toEqual([1, 3])
    expect(ids(one('address.city', 'notEquals', 'córdoba'))).toEqual([2])
  })

  it('compares numbers, ranges and emptiness', () => {
    expect(ids(one('price', 'gt', 50))).toEqual([1])
    expect(ids(one('price', 'lte', 40))).toEqual([2])
    expect(ids(one('price', 'between', [30, 100]))).toEqual([2])
    expect(ids(one('price', 'between', [50, null]))).toEqual([1])
    expect(ids(one('price', 'isEmpty'))).toEqual([3])
    expect(ids(one('price', 'isNotEmpty'))).toEqual([1, 2])
  })

  it('compares dates by day, whatever their form', () => {
    expect(ids(one('due', 'equals', '2026-12-02'))).toEqual([2])
    expect(ids(one('due', 'lt', '2026-12-01'))).toEqual([1])
    expect(ids(one('due', 'between', ['2026-11-01', '2026-11-30']))).toEqual([1])
  })

  it('matches select values and lists, and booleans', () => {
    expect(ids(one('status', 'in', ['open']))).toEqual([1, 3])
    expect(ids(one('status', 'notIn', ['open']))).toEqual([2])
    expect(ids(one('tags', 'in', ['docs', 'auth']))).toEqual([1, 2])
    expect(ids(one('urgent', 'isTrue'))).toEqual([1])
    expect(ids(one('urgent', 'isFalse'))).toEqual([2, 3])
  })

  it('combines with and / or, and nests groups', () => {
    const filter: FilterGroup = {
      id: 'g', combinator: 'and',
      rules: [
        { id: 'r1', field: 'status', operator: 'in', value: ['open'] },
        { id: 'g2', combinator: 'or', rules: [
          { id: 'r2', field: 'urgent', operator: 'isTrue' },
          { id: 'r3', field: 'price', operator: 'isEmpty' },
        ] },
      ],
    }
    expect(ids(filter)).toEqual([1, 3])
    expect(ids({ ...filter, combinator: 'or' })).toEqual([1, 3])
    expect(countRules(filter)).toBe(3)
  })

  it('lets incomplete rules and empty groups match everything', () => {
    expect(ids(one('name', 'contains', ''))).toEqual([1, 2, 3])
    expect(ids(one('price', 'between', [null, null]))).toEqual([1, 2, 3])
    expect(ids({ id: 'g', combinator: 'and', rules: [{ id: 'e', combinator: 'or', rules: [] }] })).toEqual([1, 2, 3])
    expect(matchesFilter(rows[0]!, null)).toBe(true)
    expect(countRules(one('name', 'contains', ''))).toBe(0)
  })

  it('offers each type its operators, or the field\'s own', () => {
    expect(operatorsFor({ key: 'x', label: 'X' })[0]).toBe('contains')
    expect(operatorsFor({ key: 'x', label: 'X', type: 'boolean' })).toEqual(['isTrue', 'isFalse'])
    expect(operatorsFor({ key: 'x', label: 'X', operators: ['equals'] })).toEqual(['equals'])
  })

  it('reads through an accessor', () => {
    const f: FilterField[] = [{ key: 'total', label: 'Total', type: 'number', accessor: (r) => (r.price as number ?? 0) * 2 }]
    expect(filterRows(rows, one('total', 'gte', 200), f).map((r) => r.id)).toEqual([1])
  })
})
