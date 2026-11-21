import { PHONE_COUNTRIES } from '../data/phone-countries'

/*
 * Phone numbers for MPhoneInput, also exported to show a stored number elsewhere. Not libphonenumber: masks for the
 * countries most used and E.164 rules (a calling code, then at most 15 digits in all) for the rest. A number is
 * "valid" when its length fits one of its country's masks, or any 4 to 14 national digits for a country without
 * masks.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 */
  iso2: string
  /** Calling code, without the + */
  dial: string
  /** National number masks, `#` a digit */
  masks: readonly string[]
}

export interface ParsedPhone {
  country: PhoneCountry
  /** National significant number: digits only, no trunk 0 */
  national: string
}

const BY_ISO = new Map<string, PhoneCountry>()
const BY_DIAL = new Map<string, PhoneCountry[]>()
for (const [iso2, dial, masks] of PHONE_COUNTRIES) {
  const c: PhoneCountry = { iso2, dial, masks: masks ?? [] }
  BY_ISO.set(iso2, c)
  BY_DIAL.set(dial, [...(BY_DIAL.get(dial) ?? []), c])
}

/** Every country, in the data's order */
export function phoneCountries(): PhoneCountry[] {
  return [...BY_ISO.values()]
}

export function phoneCountry(iso2: string): PhoneCountry | undefined {
  return BY_ISO.get(iso2.toUpperCase())
}

// Italy (and the Vatican, San Marino) keep the leading 0 of landlines in international numbers
const KEEPS_ZERO = new Set(['IT', 'VA', 'SM'])

/** Digits of a national number as typed: no formatting, no trunk 0 */
export function nationalDigits(input: string, country: PhoneCountry): string {
  let d = input.replace(/\D/g, '')
  if (!KEEPS_ZERO.has(country.iso2)) d = d.replace(/^0+/, '')
  return d.slice(0, 15 - country.dial.length)
}

/**
 * Splits an international number (`+541123456789`, `00 54 11...`, `+54 9 11 2345-6789`) into its country and
 * national digits. Where a calling code is shared (+1), `prefer` wins if it has it, else the first listed (US).
 */
export function parsePhone(value: string, prefer?: string): ParsedPhone | null {
  let d = value.trim()
  if (d.startsWith('00')) d = '+' + d.slice(2)
  if (!d.startsWith('+')) return null
  d = d.replace(/\D/g, '')
  for (let len = 4; len >= 1; len--) {
    const list = BY_DIAL.get(d.slice(0, len))
    if (!list) continue
    const country = list.find((c) => c.iso2 === prefer?.toUpperCase()) ?? list[0]!
    return { country, national: nationalDigits(d.slice(len), country) }
  }
  return null
}

// A mask may start with literal digits the number must start with (Argentina's mobiles: "9 ## ####-####")
const leadOf = (mask: string) => mask.match(/^\d+/)?.[0] ?? ''
const slots = (mask: string) => mask.split('#').length - 1
const sizeOf = (mask: string) => leadOf(mask).length + slots(mask)

function applyMask(mask: string, digits: string) {
  const lead = leadOf(mask)
  let out = lead
  let i = lead.length
  for (const ch of mask.slice(lead.length)) {
    if (i >= digits.length) break
    out += ch === '#' ? digits[i++] : ch
  }
  return out.trimEnd()
}

/**
 * National digits formatted with the country's masks: the one whose leading digits match (Argentina's 9 for
 * mobiles), else the shortest that holds them. Digits past every mask are appended; countries without masks get
 * groups of three with the last four together.
 */
export function formatNational(national: string, country: PhoneCountry): string {
  if (!national) return ''
  const matches = (m: string) => {
    const lead = leadOf(m)
    return national.startsWith(lead) || lead.startsWith(national)
  }
  const masks = [...country.masks].filter(matches).sort((a, b) => leadOf(b).length - leadOf(a).length || sizeOf(a) - sizeOf(b))
  const mask = masks.find((m) => sizeOf(m) >= national.length)
  if (mask) return applyMask(mask, national)
  const longest = masks.sort((a, b) => sizeOf(b) - sizeOf(a))[0]
  if (longest) return applyMask(longest, national) + ' ' + national.slice(sizeOf(longest))
  if (national.length <= 4) return national
  // Groups of three, a lone digit left over joining the group before it (3012 → "3012", not "301 2")
  const groups = national.slice(0, -4).match(/.{1,3}/g) ?? []
  if (groups.length > 1 && groups[groups.length - 1]!.length === 1) groups[groups.length - 2] += groups.pop()!
  return [...groups, national.slice(-4)].join(' ')
}

/** Whether national digits are a plausible full number for the country */
export function isValidNational(national: string, country: PhoneCountry): boolean {
  if (!national) return false
  if (country.masks.length) return country.masks.some((m) => sizeOf(m) === national.length && national.startsWith(leadOf(m)))
  return national.length >= 4 && national.length + country.dial.length <= 15
}

/** E.164 (`+541123456789`) from a country and national digits; null when there are none */
export function toE164(national: string, country: PhoneCountry): string | null {
  return national ? `+${country.dial}${national}` : null
}

/** A stored E.164 number for display: `+54 11 2345-6789`; the input back when it isn't one */
export function formatPhone(e164: string, prefer?: string): string {
  const p = parsePhone(e164, prefer)
  if (!p) return e164
  return `+${p.country.dial} ${formatNational(p.national, p.country)}`
}

/** Whether an E.164 number is a plausible full number for its country */
export function isValidPhone(e164: string, prefer?: string): boolean {
  const p = parsePhone(e164, prefer)
  return !!p && isValidNational(p.national, p.country)
}

/** The flag emoji of an ISO 3166-1 alpha-2 code (regional indicator letters) */
export function flagEmoji(iso2: string): string {
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}
