import type { M3Locale } from './useLocale'

/**
 * The Standard Schema interface (https://standardschema.dev), implemented by zod (3.24+), valibot (1.0+),
 * arktype, yup (1.7+) and others. A copy of the spec's types, so the lib doesn't depend on any of them:
 * pass a schema straight to a field's `rules` or to `MForm`'s `schema`.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output }
  }
}

export interface StandardSchemaIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardSchemaIssue> }

/** What a rule receives besides the value */
export interface ValidationContext {
  /** The active locale, for messages */
  locale: M3Locale
  /** The values of every named field of the surrounding `MForm` (empty outside one) */
  values: Record<string, unknown>
}

/**
 * `true`, `undefined` or `null` = valid; a string = invalid with that message; `false` = invalid with the
 * locale's generic `validationInvalid` message
 */
export type ValidationResult = boolean | string | null | undefined

/** A function `(value, ctx) => true | 'message'` (may be async), or a Standard Schema (zod, valibot…) */
export type ValidationRule<T = any> =
  | ((value: T, ctx: ValidationContext) => ValidationResult | Promise<ValidationResult>)
  | StandardSchemaV1

/** When a field checks its rules and shows the result */
export type ValidateOn = 'blur' | 'input' | 'submit'

export function isStandardSchema(rule: unknown): rule is StandardSchemaV1 {
  return typeof rule === 'object' && rule !== null && '~standard' in rule
}

/** The key of a Standard Schema issue path segment */
export function issueKey(segment: PropertyKey | { readonly key: PropertyKey }): PropertyKey {
  return typeof segment === 'object' && segment !== null ? segment.key : segment
}

/** Runs one rule: the error message, or null when it passes */
export async function runRule(rule: ValidationRule, value: unknown, ctx: ValidationContext): Promise<string | null> {
  if (isStandardSchema(rule)) {
    const result = await rule['~standard'].validate(value)
    const issue = result.issues?.[0]
    return issue ? issue.message || ctx.locale.validationInvalid : null
  }
  const result = await rule(value, ctx)
  if (result === true || result === undefined || result === null) return null
  if (result === false) return ctx.locale.validationInvalid
  return result || ctx.locale.validationInvalid
}

/** Runs rules in order and stops at the first that fails */
export async function runRules(rules: ValidationRule[], value: unknown, ctx: ValidationContext): Promise<string | null> {
  for (const rule of rules) {
    const message = await runRule(rule, value, ctx)
    if (message) return message
  }
  return null
}

/** Whether a value counts as "not filled in": null/undefined, blank string, empty array, `false` (an unticked checkbox) */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (value instanceof Set || value instanceof Map) return value.size === 0
  return false
}

function lengthOf(value: unknown): number {
  if (typeof value === 'string' || Array.isArray(value)) return value.length
  if (value instanceof Set || value instanceof Map) return value.size
  return String(value).length
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(String(value).trim())
}

// Built-in rules. Every one but `required` passes on an empty value, so an optional field stays optional:
// `[email()]` accepts '' and `[required(), email()]` doesn't.

/** The value must be filled in (see `isEmpty`) */
export function required(message?: string): ValidationRule {
  return (value, { locale }) => !isEmpty(value) || message || locale.validationRequired
}

// Same pattern as the browser's own <input type="email"> check (WHATWG), which is what users expect
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/** An email address (the browser's own rule, plus a dot in the domain) */
export function email(message?: string): ValidationRule {
  return (value, { locale }) => isEmpty(value) || EMAIL_RE.test(String(value).trim()) || message || locale.validationEmail
}

/** An absolute http(s) URL */
export function url(message?: string): ValidationRule {
  return (value, { locale }) => {
    if (isEmpty(value)) return true
    try {
      const u = new URL(String(value).trim())
      if (u.protocol === 'http:' || u.protocol === 'https:') return true
    } catch { /* invalid */ }
    return message || locale.validationUrl
  }
}

/** At least `min` characters (strings) or items (arrays) */
export function minLength(min: number, message?: string): ValidationRule {
  return (value, { locale }) =>
    isEmpty(value) || lengthOf(value) >= min ||
    message || (Array.isArray(value) ? locale.validationMinItems : locale.validationMinLength).replace('{min}', String(min))
}

/** At most `max` characters (strings) or items (arrays) */
export function maxLength(max: number, message?: string): ValidationRule {
  return (value, { locale }) =>
    isEmpty(value) || lengthOf(value) <= max ||
    message || (Array.isArray(value) ? locale.validationMaxItems : locale.validationMaxLength).replace('{max}', String(max))
}

/** A number (or numeric string) of at least `min` */
export function min(min: number, message?: string): ValidationRule {
  return (value, { locale }) => isEmpty(value) || toNumber(value) >= min || message || locale.validationMin.replace('{min}', String(min))
}

/** A number (or numeric string) of at most `max` */
export function max(max: number, message?: string): ValidationRule {
  return (value, { locale }) => isEmpty(value) || toNumber(value) <= max || message || locale.validationMax.replace('{max}', String(max))
}

/** Matches a regular expression */
export function pattern(re: RegExp, message?: string): ValidationRule {
  return (value, { locale }) => {
    if (isEmpty(value)) return true
    re.lastIndex = 0 // a /g or /y regex keeps state between test() calls
    return re.test(String(value)) || message || locale.validationPattern
  }
}

/**
 * Equals another value: the name of a field in the same `MForm` (e.g. 'password' for a confirmation field),
 * or a getter
 */
export function sameAs(other: string | (() => unknown), message?: string): ValidationRule {
  return (value, { locale, values }) => {
    if (isEmpty(value)) return true
    const target = typeof other === 'function' ? other() : values[other]
    return value === target || message || locale.validationSameAs
  }
}
