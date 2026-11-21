import { describe, it, expect, afterEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { isoDate, useCalendarMonth } from '../composables/_useCalendarMonth'
import MDatePickerModal from '../components/MDatePickerModal.vue'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('useCalendarMonth (the date pickers\' shared month grid)', () => {
  const month = (date: string, min?: string, max?: string) =>
    useCalendarMonth(ref(new Date(date + 'T00:00:00')), { locale: () => 'en-US', min: () => min, max: () => max })

  it('lays out six weeks from Monday, with the neighbors\' days around the month', () => {
    // October 2026 starts on a Thursday
    const { days, monthLabel, weekdays } = month('2026-10-20')
    expect(days.value).toHaveLength(42)
    expect(days.value[0]).toEqual({ date: 28, current: false, iso: '2026-09-28', disabled: false })
    expect(days.value[3]).toEqual({ date: 1, current: true, iso: '2026-10-01', disabled: false })
    expect(days.value.filter((d) => d.current)).toHaveLength(31)
    expect(days.value[41]!.iso).toBe('2026-11-08')
    expect(monthLabel.value).toBe('October 2026')
    expect(weekdays.value).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('disables the days outside min and max', () => {
    const { days } = month('2026-10-20', '2026-10-10', '2026-10-15')
    const disabled = (iso: string) => days.value.find((d) => d.iso === iso)!.disabled
    expect([disabled('2026-10-09'), disabled('2026-10-10'), disabled('2026-10-15'), disabled('2026-10-16')]).toEqual([true, false, false, true])
  })

  it('moves a month at a time from the 31st without skipping one', () => {
    const view = ref(new Date('2026-03-31T00:00:00'))
    const { nextMonth, prevMonth, monthLabel } = useCalendarMonth(view, { locale: () => 'en-US', min: () => undefined, max: () => undefined })
    nextMonth()
    expect(monthLabel.value).toBe('April 2026')
    prevMonth()
    prevMonth()
    expect(monthLabel.value).toBe('February 2026')
  })

  it('isoDate rolls months and days over like Date', () => {
    expect(isoDate(2026, -1, 31)).toBe('2025-12-31')
    expect(isoDate(2026, 1, 29)).toBe('2026-03-01')
  })

  it('the modal date picker opened on the 31st goes to the next month, not the one after', async () => {
    const w = mount(MDatePickerModal, { props: { modelValue: '2026-03-31', show: false, locale: 'en-US' }, attachTo: document.body })
    await w.setProps({ show: true })
    await nextTick()
    const next = document.querySelector<HTMLElement>('[aria-label="Next month"]')!
    next.click()
    await nextTick()
    expect(document.body.textContent).toContain('April 2026')
    w.unmount()
  })

  it('lists every year of the range, disabling the ones min/max leave no day in (as Compose)', () => {
    const view = ref(new Date('2026-03-10T00:00:00'))
    const all = useCalendarMonth(view, { locale: () => 'en-US', min: () => undefined, max: () => undefined })
    expect(all.years.value[0]).toEqual({ year: 1900, disabled: false })
    expect(all.years.value.at(-1)).toEqual({ year: 2100, disabled: false })
    const narrow = useCalendarMonth(view, { locale: () => 'en-US', min: () => '2020-06-15', max: () => '2030-02-01', yearRange: () => [2018, 2032] })
    expect(narrow.years.value.filter((y) => !y.disabled).map((y) => y.year)).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030])
    expect(narrow.years.value.filter((y) => y.disabled).map((y) => y.year)).toEqual([2018, 2019, 2031, 2032])
  })

  it('showYear keeps the month on view, brought inside min/max', () => {
    const view = ref(new Date('2026-03-10T00:00:00'))
    const { showYear, monthLabel } = useCalendarMonth(view, { locale: () => 'en-US', min: () => '2020-06-15', max: () => '2030-02-01' })
    showYear(2023)
    expect(monthLabel.value).toBe('March 2023')
    showYear(2020)
    expect(monthLabel.value).toBe('June 2020')
    showYear(2030)
    expect(monthLabel.value).toBe('February 2030')
  })

  it('the modal date picker jumps to a year from the grid its month title opens', async () => {
    const w = mount(MDatePickerModal, { props: { modelValue: '2026-03-12', show: false, locale: 'en-US', max: '2026-12-31' }, attachTo: document.body })
    await w.setProps({ show: true })
    await nextTick()
    const toggle = document.querySelector<HTMLElement>('[aria-expanded]')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    toggle.click()
    await nextTick()
    await nextTick()
    const grid = document.querySelector<HTMLElement>('[role="radiogroup"]')!
    expect(grid).toBeTruthy()
    // The arrows hide while the grid is open
    expect(document.querySelector('[aria-label="Next month"]')).toBeNull()
    const checked = grid.querySelector<HTMLElement>('[aria-checked="true"]')!
    // The whole range, the years after max disabled
    const yearBtn = (y: string) => Array.from(grid.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.trim() === y)!
    expect(yearBtn('2100').disabled).toBe(true)
    expect(yearBtn('2026').disabled).toBe(false)
    expect(checked.textContent!.trim()).toBe('2026')
    expect(document.activeElement).toBe(checked)
    // Arrow up: three years back (one row)
    checked.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement!.textContent!.trim()).toBe('2023')
    const y1995 = Array.from(grid.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent!.trim() === '1995')!
    y1995.click()
    await nextTick()
    expect(document.querySelector('[role="radiogroup"]')).toBeNull()
    expect(document.body.textContent).toContain('March 1995')
    expect(document.querySelector('[aria-label="Next month"]')).toBeTruthy()
    // Picking a day there and confirming
    const day = Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent!.trim() === '20')!
    day.click()
    await nextTick()
    Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent!.trim() === 'OK')!.click()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['1995-03-20'])
    w.unmount()
  })

  // The other three pickers share the grid (_MYearGrid) and the menu button (_MMonthYearButton)
  const openYearsAndPick = async (year: string) => {
    const toggle = document.querySelector<HTMLElement>('[aria-expanded]')!
    toggle.click()
    await nextTick()
    await nextTick()
    const grid = document.querySelector<HTMLElement>('[role="radiogroup"]')!
    expect(grid).toBeTruthy()
    expect(document.querySelector('[aria-label="Next month"]')).toBeNull()
    const btn = Array.from(grid.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.trim() === year)!
    btn.click()
    await nextTick()
    expect(document.querySelector('[role="radiogroup"]')).toBeNull()
    return grid
  }

  it.each([
    ['MDatePicker', () => import('../components/MDatePicker.vue'), { modelValue: '2026-03-12' }],
    ['MDateRangePicker', () => import('../components/MDateRangePicker.vue'), { modelValue: { start: '2026-03-12', end: null } }],
  ])('%s (docked) jumps to a year from its month title', async (_name, load, extra) => {
    const C = (await load()).default
    const w = mount(C as never, { props: { locale: 'en-US', ...extra }, attachTo: document.body })
    await w.find('button').trigger('click')
    await nextTick()
    await openYearsAndPick('1995')
    expect(document.body.textContent).toContain('March 1995')
    w.unmount()
  })

  it('MDateRangePickerModal jumps to a year from its month title, disabling the years past max', async () => {
    const C = (await import('../components/MDateRangePickerModal.vue')).default
    const w = mount(C, { props: { modelValue: { start: '2026-03-12', end: null }, show: false, locale: 'en-US', max: '2026-12-31' }, attachTo: document.body })
    await w.setProps({ show: true })
    await nextTick()
    document.querySelector<HTMLElement>('[aria-expanded]')!.click()
    await nextTick()
    const later = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((b) => b.textContent!.trim() === '2027')!
    expect(later.disabled).toBe(true)
    document.querySelector<HTMLElement>('[aria-expanded]')!.click()
    await nextTick()
    await openYearsAndPick('2001')
    expect(document.body.textContent).toContain('March 2001')
    w.unmount()
  })
})
