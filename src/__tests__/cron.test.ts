import { describe, expect, it } from 'vitest'
import { describeCron, isValidCron, nextCronRuns, parseCron } from '../composables/cron'
import { defaultLocale } from '../composables/useLocale'
import { esLocale } from '../locales'

const en = { ...defaultLocale, lang: 'en-US' }
const es = { ...defaultLocale, ...esLocale, lang: 'es' }

describe('parseCron', () => {
  it('reads numbers, ranges, steps, lists, names and macros', () => {
    const s = parseCron('*/15 9-17 1,15 JAN-MAR mon-fri')!
    expect(s.minutes).toEqual([0, 15, 30, 45])
    expect(s.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect(s.days).toEqual([1, 15])
    expect(s.months).toEqual([1, 2, 3])
    expect(s.weekdays).toEqual([1, 2, 3, 4, 5])
    expect(parseCron('5/20 * * * *')!.minutes).toEqual([5, 25, 45])
    expect(parseCron('0 0 * * 7')!.weekdays).toEqual([0])
    expect(parseCron('@daily')!.fields).toEqual(['0', '0', '*', '*', '*'])
    expect(parseCron('@weekly')!.weekdays).toEqual([0])
  })

  it('rejects what crontab would', () => {
    for (const bad of ['', '* * * *', '60 * * * *', '* 24 * * *', '* * 0 * *', '* * * 13 *', '*/0 * * * *', '5-1 * * * *', 'x * * * *', '* * * * 8']) {
      expect(isValidCron(bad), bad).toBe(false)
    }
  })
})

describe('nextCronRuns', () => {
  const from = new Date(2026, 10, 26, 10, 30) // Thursday 26 Nov 2026, 10:30
  it('finds the next times, in local time', () => {
    expect(nextCronRuns('0 9 * * 1-5', 3, from)).toEqual([new Date(2026, 10, 27, 9, 0), new Date(2026, 10, 30, 9, 0), new Date(2026, 11, 1, 9, 0)])
    expect(nextCronRuns('*/20 * * * *', 2, from)).toEqual([new Date(2026, 10, 26, 10, 40), new Date(2026, 10, 26, 11, 0)])
    expect(nextCronRuns('0 0 29 2 *', 1, from)).toEqual([new Date(2028, 1, 29, 0, 0)])
  })

  it('runs on either day field when both are set (crontab\'s rule)', () => {
    // The 1st, or any Friday
    expect(nextCronRuns('0 12 1 * 5', 3, from)).toEqual([new Date(2026, 10, 27, 12, 0), new Date(2026, 11, 1, 12, 0), new Date(2026, 11, 4, 12, 0)])
  })

  it('gives nothing for an invalid or impossible expression', () => {
    expect(nextCronRuns('nope')).toEqual([])
    expect(nextCronRuns('0 0 31 2 *', 1, from)).toEqual([])
  })
})

describe('describeCron', () => {
  it('says it in English', () => {
    expect(describeCron('* * * * *', en)).toBe('Every minute')
    expect(describeCron('*/5 * * * *', en)).toBe('Every 5 minutes')
    expect(describeCron('30 * * * *', en)).toBe('At minute 30 of every hour')
    expect(describeCron('0 */2 * * *', en)).toBe('Every 2 hours, at minute 0')
    expect(describeCron('0 9 * * 1-5', en)).toBe('At 9:00 AM, Monday to Friday')
    expect(describeCron('30 8,18 * * 0,6', en)).toBe('At 8:30 AM and 6:30 PM, Sunday and Saturday')
    expect(describeCron('0 0 1 1 *', en)).toBe('At 12:00 AM, on day 1 of the month, in January')
    expect(describeCron('0 12 1 * 5', en)).toBe('At 12:00 PM, on day 1 of the month or Friday')
    expect(describeCron('0,30 9-17 * * *', en)).toBe('At minutes 0 and 30 of hours 9 to 17')
    expect(describeCron('bad', en)).toBeNull()
  })

  it('says it in the app\'s language', () => {
    expect(describeCron('0 9 * * 1-5', es)).toBe('A las 9:00, lunes a viernes')
    expect(describeCron('*/10 * * * *', es)).toBe('Cada 10 minutos')
    expect(describeCron('0 8 15 * *', es)).toBe('A las 8:00, el día 15 del mes')
  })
})
