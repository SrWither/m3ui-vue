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
})
