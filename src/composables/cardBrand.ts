/** Card networks recognized by `detectCardBrand()` and `MCreditCardInput`. */
export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'maestro'
  | 'naranja'
  | 'cabal'
  | 'unknown'

export interface CardBrandInfo {
  brand: CardBrand
  /** Display name, e.g. "Mastercard" */
  name: string
  /** Valid lengths of the number, in digits */
  lengths: number[]
  /** Digit counts after which a space is shown, e.g. [4, 8, 12] → `4242 4242 4242 4242` */
  gaps: number[]
  /** Length of the security code */
  cvcLength: number
  /** Whether the number has to pass the Luhn checksum */
  luhn: boolean
}

const BRANDS: (CardBrandInfo & { pattern: RegExp })[] = [
  // Specific local networks go before the broad ranges they sit in
  { brand: 'naranja', name: 'Naranja', pattern: /^589562/, lengths: [16], gaps: [4, 8, 12], cvcLength: 3, luhn: false },
  { brand: 'cabal', name: 'Cabal', pattern: /^(60420[1-9]|6042[1-9]\d|6043\d\d|604400|589657)/, lengths: [16], gaps: [4, 8, 12], cvcLength: 3, luhn: true },
  { brand: 'visa', name: 'Visa', pattern: /^4/, lengths: [13, 16], gaps: [4, 8, 12], cvcLength: 3, luhn: true },
  { brand: 'mastercard', name: 'Mastercard', pattern: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/, lengths: [16], gaps: [4, 8, 12], cvcLength: 3, luhn: true },
  { brand: 'amex', name: 'American Express', pattern: /^3[47]/, lengths: [15], gaps: [4, 10], cvcLength: 4, luhn: true },
  { brand: 'diners', name: 'Diners Club', pattern: /^(36|38|30[0-5])/, lengths: [14, 16, 19], gaps: [4, 10], cvcLength: 3, luhn: true },
  { brand: 'jcb', name: 'JCB', pattern: /^35(2[89]|[3-8])/, lengths: [16, 17, 18, 19], gaps: [4, 8, 12], cvcLength: 3, luhn: true },
  { brand: 'discover', name: 'Discover', pattern: /^(6011|65|64[4-9])/, lengths: [16, 19], gaps: [4, 8, 12], cvcLength: 3, luhn: true },
  { brand: 'unionpay', name: 'UnionPay', pattern: /^62/, lengths: [16, 17, 18, 19], gaps: [4, 8, 12], cvcLength: 3, luhn: false },
  { brand: 'maestro', name: 'Maestro', pattern: /^(5018|5020|5038|5893|6304|6759|676[1-3])/, lengths: [12, 13, 14, 15, 16, 17, 18, 19], gaps: [4, 8, 12], cvcLength: 3, luhn: true },
]

const UNKNOWN: CardBrandInfo = { brand: 'unknown', name: '', lengths: [12, 13, 14, 15, 16], gaps: [4, 8, 12], cvcLength: 3, luhn: true }

/** Card network of a (partial) number, from its leading digits. Spaces and dashes are ignored. */
export function detectCardBrand(number: string): CardBrandInfo {
  const digits = number.replace(/\D/g, '')
  if (!digits) return UNKNOWN
  const hit = BRANDS.find((b) => b.pattern.test(digits))
  if (!hit) return UNKNOWN
  const { pattern: _pattern, ...info } = hit
  return info
}

/** Luhn (mod 10) checksum of a card number. Spaces and dashes are ignored. */
export function luhnCheck(number: string): boolean {
  const digits = number.replace(/\D/g, '')
  if (!digits) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** Formats digits with the brand's gaps: `"4242424242424242"` → `"4242 4242 4242 4242"`. */
export function formatCardNumber(number: string): string {
  const digits = number.replace(/\D/g, '')
  const { gaps } = detectCardBrand(digits)
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && gaps.includes(i)) out += ' '
    out += digits[i]
  }
  return out
}

/** Whether a card number is complete and valid for its brand (length, plus Luhn where the network uses it). */
export function isValidCardNumber(number: string): boolean {
  const digits = number.replace(/\D/g, '')
  const info = detectCardBrand(digits)
  if (!info.lengths.includes(digits.length)) return false
  return !info.luhn || luhnCheck(digits)
}

/** Whether an `MM/YY` expiry is well formed and not in the past (a card is valid through its expiry month). */
export function isValidExpiry(expiry: string, now: Date = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry.trim())
  if (!m) return false
  const month = Number(m[1])
  const year = 2000 + Number(m[2])
  if (month < 1 || month > 12) return false
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  if (year > thisYear + 20) return false
  return year > thisYear || (year === thisYear && month >= thisMonth)
}
