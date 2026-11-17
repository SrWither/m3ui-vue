/** One payment of an amortization schedule. */
export interface AmortizationPayment {
  /** 1-based payment number */
  n: number
  payment: number
  principal: number
  interest: number
  /** Balance left after this payment */
  balance: number
}

export interface AmortizationOptions {
  /** Amount borrowed */
  principal: number
  /** Yearly nominal interest rate, in percent (e.g. 6.5) */
  rate: number
  /** Term in years */
  years: number
  /**
   * `french`: the same payment every period (most of the world's mortgages).
   * `german`: the same principal every period, so payments start higher and fall.
   */
  system?: 'french' | 'german'
  /** Payments per year */
  periodsPerYear?: number
}

export interface Amortization {
  payments: AmortizationPayment[]
  firstPayment: number
  lastPayment: number
  totalInterest: number
  totalPaid: number
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Builds the payment schedule of a loan. Amounts are rounded to cents per payment and the last payment absorbs the
 * rounding, so the balance ends at exactly 0.
 */
export function amortize({ principal, rate, years, system = 'french', periodsPerYear = 12 }: AmortizationOptions): Amortization {
  const count = Math.max(0, Math.round(years * periodsPerYear))
  const r = rate / 100 / periodsPerYear
  const payments: AmortizationPayment[] = []
  if (principal <= 0 || count === 0) return { payments, firstPayment: 0, lastPayment: 0, totalInterest: 0, totalPaid: 0 }

  const fixed = r === 0 ? principal / count : (principal * r) / (1 - (1 + r) ** -count)
  const fixedPrincipal = principal / count
  let balance = principal
  let totalInterest = 0
  let totalPaid = 0
  for (let n = 1; n <= count; n++) {
    const interest = round(balance * r)
    let part = system === 'german' ? round(fixedPrincipal) : round(fixed - interest)
    if (n === count || part > balance) part = round(balance)
    balance = round(balance - part)
    const payment = round(part + interest)
    totalInterest += interest
    totalPaid += payment
    payments.push({ n, payment, principal: part, interest, balance })
  }
  return {
    payments,
    firstPayment: payments[0]!.payment,
    lastPayment: payments.at(-1)!.payment,
    totalInterest: round(totalInterest),
    totalPaid: round(totalPaid),
  }
}
