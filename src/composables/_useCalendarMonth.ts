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
  opts: {
    locale: () => string
    min: () => string | undefined
    max: () => string | undefined
    /** First and last year the year grid offers (DatePickerDefaults.YearRange: 1900–2100); min/max disable years in it */
    yearRange?: () => [number, number] | undefined
  },
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

  // The year grid (Compose's YearPicker): every year of yearRange, the ones min/max leave no day in disabled
  // (Compose's selectableDates.isSelectableYear)
  const years = computed(() => {
    const [from, to] = opts.yearRange?.() ?? [1900, 2100]
    const min = opts.min()
    const max = opts.max()
    const minYear = min ? Number(min.slice(0, 4)) : -Infinity
    const maxYear = max ? Number(max.slice(0, 4)) : Infinity
    const out: { year: number; disabled: boolean }[] = []
    for (let year = from; year <= to; year++) out.push({ year, disabled: year < minYear || year > maxYear })
    return out
  })

  // Shows a year keeping the month on view, as Compose's year grid does; brought inside min/max when that month
  // falls outside them (min 15 June 2020 and March on view: June 2020)
  function showYear(year: number) {
    let month = viewDate.value.getMonth()
    const min = opts.min()
    const max = opts.max()
    if (min && isoDate(year, month + 1, 0) < min && Number(min.slice(0, 4)) === year) month = Number(min.slice(5, 7)) - 1
    if (max && isoDate(year, month, 1) > max && Number(max.slice(0, 4)) === year) month = Number(max.slice(5, 7)) - 1
    viewDate.value = new Date(year, month, 1)
  }

  return { weekdays, monthLabel, days, isOutOfRange, isToday, prevMonth, nextMonth, years, showYear }
}
