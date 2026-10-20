import { computed, type Ref } from 'vue'

/*
 * Internal (not exported from index.ts): the month grid MDatePicker, MDatePickerModal, MDateRangePicker and
 * MDateRangePickerModal each built by hand, line for line the same. Six weeks starting on Monday, the days of the
 * months around it included, as ISO dates (YYYY-MM-DD) with whether min/max leave them out.
 */

export interface CalendarDay {
  /** Day of the month */
  date: number
  /** In the month shown (not the neighbors' days filling its first and last week) */
  current: boolean
  iso: string
  disabled: boolean
}

/** YYYY-MM-DD for a year, a 0-based month and a day; months and days past their range roll over, as Date does */
export function isoDate(y: number, m: number, d: number) {
  const dt = new Date(y, m, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function useCalendarMonth(
  viewDate: Ref<Date>,
  opts: { locale: () => string; min: () => string | undefined; max: () => string | undefined },
) {
  // Narrow weekday names, Monday first (1 Jan 2024 was a Monday)
  const weekdays = computed(() => {
    const f = new Intl.DateTimeFormat(opts.locale(), { weekday: 'narrow' })
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, i + 1)))
  })

  const monthLabel = computed(() =>
    new Intl.DateTimeFormat(opts.locale(), { month: 'long', year: 'numeric' }).format(viewDate.value),
  )

  function isOutOfRange(iso: string) {
    const min = opts.min()
    const max = opts.max()
    return (!!min && iso < min) || (!!max && iso > max)
  }

  const days = computed(() => {
    const y = viewDate.value.getFullYear()
    const m = viewDate.value.getMonth()
    const startDay = (new Date(y, m, 1).getDay() + 6) % 7
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const out: CalendarDay[] = []
    const day = (yy: number, mm: number, d: number, current: boolean) => {
      const iso = isoDate(yy, mm, d)
      out.push({ date: d, current, iso, disabled: isOutOfRange(iso) })
    }
    const prevDays = new Date(y, m, 0).getDate()
    for (let i = startDay - 1; i >= 0; i--) day(y, m - 1, prevDays - i, false)
    for (let d = 1; d <= daysInMonth; d++) day(y, m, d, true)
    for (let d = 1; out.length < 42; d++) day(y, m + 1, d, false)
    return out
  })

  const isToday = (iso: string) => {
    const now = new Date()
    return iso === isoDate(now.getFullYear(), now.getMonth(), now.getDate())
  }

  // Through the 1st: setMonth(month ± 1) on the 31st rolled over (31 March + 1 month = 1 May, skipping April)
  function shiftMonth(by: number) {
    viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + by, 1)
  }
  const prevMonth = () => shiftMonth(-1)
  const nextMonth = () => shiftMonth(1)

  return { weekdays, monthLabel, days, isOutOfRange, isToday, prevMonth, nextMonth }
}
