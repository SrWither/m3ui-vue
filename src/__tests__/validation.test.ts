import { describe, expect, it } from 'vitest'
import { defaultLocale } from '../composables/useLocale'
import { email, isEmpty, max, maxLength, min, minLength, pattern, required, runRules, sameAs, url, type StandardSchemaV1 } from '../composables/validation'

const ctx = { locale: defaultLocale, values: {} as Record<string, unknown> }
const check = (rule: ReturnType<typeof required>, value: unknown, values = {}) => runRules([rule], value, { ...ctx, values })

/** A minimal Standard Schema, like zod's/valibot's */
function schema(test: (v: unknown) => string | null): StandardSchemaV1 {
  return { '~standard': { version: 1, vendor: 'test', validate: (v) => { const m = test(v); return m ? { issues: [{ message: m }] } : { value: v } } } }
}

describe('validators', () => {
  it('isEmpty', () => {
    for (const v of [null, undefined, '', '   ', [], false]) expect(isEmpty(v)).toBe(true)
    for (const v of [0, 'a', [1], true]) expect(isEmpty(v)).toBe(false)
  })

  it('required uses the locale message, or a custom one', async () => {
    expect(await check(required(), '')).toBe(defaultLocale.validationRequired)
    expect(await check(required('Hey'), ' ')).toBe('Hey')
    expect(await check(required(), 'x')).toBeNull()
    expect(await check(required(), 0)).toBeNull()
  })

  it('every other rule passes on an empty value', async () => {
    for (const rule of [email(), url(), minLength(3), maxLength(1), min(5), max(1), pattern(/x/), sameAs('a')]) {
      expect(await check(rule, '', { a: 'b' })).toBeNull()
    }
  })

  it('email and url', async () => {
    expect(await check(email(), 'a@b.co')).toBeNull()
    expect(await check(email(), 'a@b')).toBe(defaultLocale.validationEmail)
    expect(await check(url(), 'https://m3ui.dev/x')).toBeNull()
    expect(await check(url(), 'ftp://x.y')).toBe(defaultLocale.validationUrl)
    expect(await check(url(), 'nope')).toBe(defaultLocale.validationUrl)
  })

  it('lengths fill in {min}/{max}, with item wording for arrays', async () => {
    expect(await check(minLength(3), 'ab')).toBe('Enter at least 3 characters')
    expect(await check(maxLength(2), 'abc')).toBe('Enter at most 2 characters')
    expect(await check(minLength(2), ['a'])).toBe('Choose at least 2')
    expect(await check(maxLength(1), ['a', 'b'])).toBe('Choose at most 1')
  })

  it('min/max accept numeric strings', async () => {
    expect(await check(min(18), '17')).toBe('Must be at least 18')
    expect(await check(min(18), 18)).toBeNull()
    expect(await check(max(10), '11')).toBe('Must be at most 10')
  })

  it('pattern resets a global regex between calls', async () => {
    const rule = pattern(/^\d+$/g)
    expect(await check(rule, '12')).toBeNull()
    expect(await check(rule, '12')).toBeNull()
  })

  it('sameAs reads another field by name, or a getter', async () => {
    expect(await check(sameAs('password'), 'x', { password: 'y' })).toBe(defaultLocale.validationSameAs)
    expect(await check(sameAs('password'), 'x', { password: 'x' })).toBeNull()
    expect(await check(sameAs(() => 'x'), 'x')).toBeNull()
  })

  it('custom rules: false → generic message, string → that message, async works', async () => {
    expect(await runRules([() => false], 'a', ctx)).toBe(defaultLocale.validationInvalid)
    expect(await runRules([() => 'Nope'], 'a', ctx)).toBe('Nope')
    expect(await runRules([async () => 'Later'], 'a', ctx)).toBe('Later')
    expect(await runRules([() => true, () => 'Second'], 'a', ctx)).toBe('Second')
  })

  it('a Standard Schema works as a rule', async () => {
    const s = schema((v) => (String(v).length < 2 ? 'Too short' : null))
    expect(await runRules([s], 'a', ctx)).toBe('Too short')
    expect(await runRules([s], 'ab', ctx)).toBeNull()
  })
})
