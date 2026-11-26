/*
 * The model and the evaluation behind MFilterBuilder, usable on their own: a filter is a JSON tree of groups (all /
 * any of their rules) and rules (field · operator · value). `filterRows(rows, filter, fields)` applies it to an array
 * (a table's rows), `matchesFilter(row, filter, fields)` to one row. Rules that aren't complete yet (no value) match
 * everything, so a half-built filter never empties the table.
 */

/** How a field's values are compared, and which input `MFilterBuilder` shows for them. */
export type FilterFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export type FilterOperator =
  | 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
  | 'in' | 'notIn'
  | 'isTrue' | 'isFalse'
  | 'isEmpty' | 'isNotEmpty'

/** A field that can be filtered on. */
export interface FilterField {
  /** The row property (a dotted path reaches into nested objects: `address.city`) */
  key: string
  /** Its name in the UI */
  label: string
  /** Text by default */
  type?: FilterFieldType
  /** For `select`: the values to choose from */
  options?: { label: string; value: unknown }[]
  /** The operators offered, instead of the type's own */
  operators?: FilterOperator[]
  /** Reads the value from a row, instead of `key` */
  accessor?: (row: Record<string, unknown>) => unknown
}

/** One condition: field · operator · value (`[min, max]` for `between`, a list for `in` / `notIn`). */
export interface FilterRule {
  id: string
  field: string
  operator: FilterOperator
  value?: unknown
}

/** All (`and`) or any (`or`) of its rules and nested groups. */
export interface FilterGroup {
  id: string
  combinator: 'and' | 'or'
  rules: (FilterRule | FilterGroup)[]
}

/** The operators each type offers, in order (the first is the default for a new rule). */
export const FILTER_OPERATORS: Record<FilterFieldType, FilterOperator[]> = {
  text: ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
  number: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'isNotEmpty'],
  date: ['equals', 'gt', 'lt', 'between', 'isEmpty', 'isNotEmpty'],
  select: ['in', 'notIn', 'isEmpty', 'isNotEmpty'],
  boolean: ['isTrue', 'isFalse'],
}

/** Operators that take no value. */
export const VALUELESS: FilterOperator[] = ['isTrue', 'isFalse', 'isEmpty', 'isNotEmpty']

export const isGroup = (r: FilterRule | FilterGroup): r is FilterGroup => 'rules' in r

let seq = 0
const newId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`

/** An empty filter (a group matching every row), or one with these rules. */
export function createFilter(rules: Omit<FilterRule, 'id'>[] = [], combinator: 'and' | 'or' = 'and'): FilterGroup {
  return { id: newId(), combinator, rules: rules.map((r) => ({ ...r, id: newId() })) }
}

/** A new rule on a field, with its type's first operator. */
export function createRule(field: FilterField): FilterRule {
  return { id: newId(), field: field.key, operator: operatorsFor(field)[0]! }
}

/** A new nested group. */
export function createGroup(combinator: 'and' | 'or' = 'and'): FilterGroup {
  return { id: newId(), combinator, rules: [] }
}

/** The operators a field offers. */
export function operatorsFor(field: FilterField): FilterOperator[] {
  return field.operators ?? FILTER_OPERATORS[field.type ?? 'text']
}

const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/** Whether a rule has what it needs to filter (an operator that takes no value, or a value). */
export function isComplete(rule: FilterRule): boolean {
  if (VALUELESS.includes(rule.operator)) return true
  if (rule.operator === 'between') {
    const [a, b] = Array.isArray(rule.value) ? rule.value : []
    return !empty(a) || !empty(b)
  }
  return !empty(rule.value)
}

function read(row: Record<string, unknown>, field: FilterField | undefined, key: string): unknown {
  if (field?.accessor) return field.accessor(row)
  if (key in row) return row[key]
  return key.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), row)
}

/** A date (a Date, an ISO string, a timestamp) as `YYYY-MM-DD`, or null. */
function day(v: unknown): string | null {
  if (empty(v)) return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  const d = v instanceof Date ? v : new Date(v as string | number)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const same = (a: unknown, b: unknown) => a === b || (typeof a === 'object' && a !== null && JSON.stringify(a) === JSON.stringify(b))

function test(rule: FilterRule, raw: unknown, type: FilterFieldType): boolean {
  const op = rule.operator
  if (op === 'isEmpty') return empty(raw)
  if (op === 'isNotEmpty') return !empty(raw)
  if (op === 'isTrue') return !!raw
  if (op === 'isFalse') return !raw

  if (type === 'select' || op === 'in' || op === 'notIn') {
    const wanted = Array.isArray(rule.value) ? rule.value : [rule.value]
    const values = Array.isArray(raw) ? raw : [raw]
    const hit = values.some((v) => wanted.some((w) => same(v, w)))
    if (op === 'notIn') return !hit
    if (op === 'in') return hit
  }

  if (type === 'number' || type === 'date') {
    const val = type === 'date' ? day(raw) : empty(raw) ? null : Number(raw)
    const conv = (x: unknown) => (type === 'date' ? day(x) : empty(x) ? null : Number(x))
    if (val === null || (typeof val === 'number' && Number.isNaN(val))) return op === 'notEquals'
    if (op === 'between') {
      const [a, b] = (Array.isArray(rule.value) ? rule.value : []).map(conv)
      return (a === null || a === undefined || val >= a) && (b === null || b === undefined || val <= b)
    }
    const ref = conv(rule.value)
    if (ref === null) return true
    switch (op) {
      case 'equals': return val === ref
      case 'notEquals': return val !== ref
      case 'gt': return val > ref
      case 'gte': return val >= ref
      case 'lt': return val < ref
      case 'lte': return val <= ref
    }
  }

  const s = empty(raw) ? '' : String(raw).toLocaleLowerCase()
  const q = String(rule.value).toLocaleLowerCase()
  switch (op) {
    case 'contains': return s.includes(q)
    case 'notContains': return !s.includes(q)
    case 'equals': return s === q
    case 'notEquals': return s !== q
    case 'startsWith': return s.startsWith(q)
    case 'endsWith': return s.endsWith(q)
  }
  return true
}

/** Whether a row passes the filter. Incomplete rules, and groups with none complete, match everything. */
export function matchesFilter(row: Record<string, unknown>, filter: FilterGroup | null | undefined, fields: FilterField[] = []): boolean {
  if (!filter) return true
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const check = (group: FilterGroup): boolean | null => {
    const results: boolean[] = []
    for (const r of group.rules) {
      if (isGroup(r)) {
        const sub = check(r)
        if (sub !== null) results.push(sub)
      } else if (isComplete(r)) {
        const field = byKey.get(r.field)
        results.push(test(r, read(row, field, r.field), field?.type ?? 'text'))
      }
    }
    if (!results.length) return null
    return group.combinator === 'or' ? results.some(Boolean) : results.every(Boolean)
  }
  return check(filter) ?? true
}

/** The rows that pass the filter. */
export function filterRows<T extends Record<string, unknown>>(rows: T[], filter: FilterGroup | null | undefined, fields: FilterField[] = []): T[] {
  if (!filter || !filter.rules.length) return rows
  return rows.filter((row) => matchesFilter(row, filter, fields))
}

/** How many complete rules the filter has (for a "Filters (3)" button). */
export function countRules(filter: FilterGroup | null | undefined): number {
  if (!filter) return 0
  return filter.rules.reduce((n, r) => n + (isGroup(r) ? countRules(r) : isComplete(r) ? 1 : 0), 0)
}
