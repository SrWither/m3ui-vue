import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MCronField from '../components/MCronField.vue'
import MChip from '../components/MChip.vue'
import MNumberField from '../components/MNumberField.vue'
import MTimePicker from '../components/MTimePicker.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function mountCron(initial = '0 9 * * 1-5', props: Record<string, unknown> = {}) {
  const expr = ref(initial)
  const Host = defineComponent({
    setup: () => () => h(MCronField, { modelValue: expr.value, 'onUpdate:modelValue': (v: string) => (expr.value = v), ...props }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  return expr
}

const chips = () => wrapper!.findAllComponents(MChip)
// The text also carries the check icon's ligature
const chip = (label: string) => chips().find((c) => c.text().trim().endsWith(label))!
const input = () => wrapper!.find('input')

describe('MCronField', () => {
  it('shows the expression, what it means, and when it runs next', () => {
    mountCron()
    expect((input().element as HTMLInputElement).value).toBe('0 9 * * 1-5')
    expect(wrapper!.text()).toContain('Monday to Friday')
    expect(wrapper!.text()).toContain('Next runs')
    expect(wrapper!.findAll('li')).toHaveLength(3)
  })

  it('recognizes the schedule it is, and shows its controls', () => {
    mountCron()
    expect(chip('Weekly').props('selected')).toBe(true)
    expect(wrapper!.findComponent(MTimePicker).props('modelValue')).toBe('09:00')
    // Weekday chips, Monday first: Mon–Fri on
    const days = chips().slice(6)
    expect(days.map((c) => c.props('selected'))).toEqual([true, true, true, true, true, false, false])
  })

  it('builds expressions from the controls', async () => {
    const expr = mountCron()
    await chip('Daily').find('button').trigger('click')
    expect(expr.value).toBe('0 9 * * *')
    wrapper!.findComponent(MTimePicker).vm.$emit('update:modelValue', '18:30')
    await nextTick()
    expect(expr.value).toBe('30 18 * * *')
    await chip('Monthly').find('button').trigger('click')
    expect(expr.value).toBe('30 18 1 * *')
    wrapper!.findAllComponents(MNumberField).at(-1)!.vm.$emit('update:modelValue', 15)
    await nextTick()
    expect(expr.value).toBe('30 18 15 * *')
    await chip('Every few minutes').find('button').trigger('click')
    expect(expr.value).toBe('*/15 * * * *')
    wrapper!.findComponent(MNumberField).vm.$emit('update:modelValue', 5)
    await nextTick()
    expect(expr.value).toBe('*/5 * * * *')
    await chip('Hourly').find('button').trigger('click')
    expect(expr.value).toBe('0 * * * *')
  })

  it('toggles weekdays, keeping at least one, and writes ranges', async () => {
    const expr = mountCron('0 9 * * 1')
    const day = (i: number) => chips().slice(6)[i]!
    await day(1).find('button').trigger('click')
    await day(2).find('button').trigger('click')
    expect(expr.value).toBe('0 9 * * 1-3')
    await day(6).find('button').trigger('click') // Sunday
    expect(expr.value).toBe('0 9 * * 0-3')
    for (const i of [0, 1, 2, 6]) await day(i).find('button').trigger('click')
    // The last one stays
    expect(expr.value).toBe('0 9 * * 0') // Sunday, the last one left, can't go
  })

  it('takes typed expressions, emitting only valid ones', async () => {
    const expr = mountCron()
    await input().setValue('*/7 * * *')
    expect(expr.value).toBe('0 9 * * 1-5')
    expect(wrapper!.text()).toContain('Not a valid cron expression')
    await input().setValue('15 3 1 */3 *')
    expect(expr.value).toBe('15 3 1 */3 *')
    // Not one of the simple schedules
    expect(chip('Custom').props('selected')).toBe(true)
    expect(wrapper!.text()).toContain('in January, April, July, and October')
  })

  it('leaves the builder out, and the runs, when asked', () => {
    mountCron('@hourly', { builder: false, nextRuns: 0 })
    expect(chips()).toHaveLength(0)
    expect(wrapper!.findAll('li')).toHaveLength(0)
    expect(wrapper!.text()).toContain('At minute 0 of every hour')
  })
})
