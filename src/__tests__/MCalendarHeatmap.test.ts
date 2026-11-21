import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MCalendarHeatmap from '../components/MCalendarHeatmap.vue'

afterEach(() => { document.body.innerHTML = '' })

const cells = (w: ReturnType<typeof mount>) => w.findAll('[role="gridcell"]')
const cell = (w: ReturnType<typeof mount>, date: string) => w.find(`[data-date="${date}"]`)

describe('MCalendarHeatmap', () => {
  it('lays out the range as weeks of 7 rows, Monday first, with the days outside it hidden', () => {
    // 2026-11-01 is a Sunday: its week starts on Monday 2026-10-26
    const w = mount(MCalendarHeatmap, { props: { data: {}, start: '2026-11-01', end: '2026-11-14', locale: 'en-US' } })
    expect(cells(w)).toHaveLength(14)
    expect(w.findAll('[role="row"]')).toHaveLength(7)
    // Sunday is the last row; its first column holds 1 Nov
    const rows = w.findAll('[role="row"]')
    expect(rows[6]!.findAll('[role="gridcell"]')[0]!.attributes('data-date')).toBe('2026-11-01')
    expect(rows[0]!.find('[role="presentation"]').exists()).toBe(true)
  })

  it('tints days by level, relative to the largest value or max', async () => {
    const w = mount(MCalendarHeatmap, {
      props: { data: [{ date: '2026-11-02', value: 1 }, { date: '2026-11-03', value: 4 }, { date: '2026-11-03', value: 4 }], start: '2026-11-02', end: '2026-11-08', locale: 'en-US' },
    })
    const level = (d: string) => cell(w, d).attributes('data-level')
    // 0 → empty; 1 of 8 → the first tint; 8 of 8 → the last (levels 5: 0..4)
    expect([level('2026-11-04'), level('2026-11-02'), level('2026-11-03')]).toEqual(['0', '1', '4'])
    await w.setProps({ max: 2 })
    expect(level('2026-11-02')).toBe('2')
  })

  it('selects with a click and moves with the arrows (a day up/down, a week left/right)', async () => {
    const w = mount(MCalendarHeatmap, { props: { data: { '2026-11-10': 3 }, start: '2026-11-02', end: '2026-11-22', locale: 'en-US', modelValue: '2026-11-10' }, attachTo: document.body })
    await cell(w, '2026-11-12').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['2026-11-12'])
    expect(w.emitted('select')![0]).toEqual([{ date: '2026-11-12', value: 0, level: 0 }])
    await w.setProps({ modelValue: '2026-11-12' })
    expect(cell(w, '2026-11-12').attributes('tabindex')).toBe('0')
    const grid = w.find('[role="grid"]')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-19')
    await grid.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-18')
    // Past the end: stays
    await grid.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-18')
    await grid.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['2026-11-18'])
    w.unmount()
  })

  it('names days for screen readers and the tooltip, with a custom format', async () => {
    const w = mount(MCalendarHeatmap, {
      props: { data: { '2026-11-10': 1234 }, start: '2026-11-09', end: '2026-11-15', locale: 'en-US' },
      attachTo: document.body,
    })
    expect(cell(w, '2026-11-10').attributes('aria-label')).toBe('1,234 · Tue, Nov 10, 2026')
    await cell(w, '2026-11-10').trigger('mouseenter')
    expect(w.text()).toContain('1,234 · Tue, Nov 10, 2026')
    await w.setProps({ formatTooltip: (c: { value: number }) => `${c.value} commits` })
    expect(cell(w, '2026-11-10').attributes('aria-label')).toBe('1234 commits')
    w.unmount()
  })

  it('labels months and Mon/Wed/Fri, in the locale given', () => {
    const w = mount(MCalendarHeatmap, { props: { data: {}, start: '2026-09-01', end: '2026-11-30', locale: 'es-ES' } })
    const text = w.text()
    expect(text).toMatch(/sept?/i)
    expect(text).toMatch(/oct/i)
    expect(text).toMatch(/nov/i)
    // The legend's words come from the app's locale strings
    expect(text).toContain('Less')
  })
})
