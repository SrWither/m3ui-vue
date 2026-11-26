import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MFilterBuilder from '../components/MFilterBuilder.vue'
import MSelect from '../components/MSelect.vue'
import MNumberField from '../components/MNumberField.vue'
import MMultiSelect from '../components/MMultiSelect.vue'
import MDatePicker from '../components/MDatePicker.vue'
import MTextField from '../components/MTextField.vue'
import MSegmentedButton from '../components/MSegmentedButton.vue'
import type { FilterField, FilterGroup, FilterRule } from '../composables/filterBuilder'

const fields: FilterField[] = [
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'due', label: 'Due', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: [{ label: 'Open', value: 'open' }, { label: 'Done', value: 'done' }] },
  { key: 'urgent', label: 'Urgent', type: 'boolean' },
]

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function mountBuilder(props: Record<string, unknown> = {}, initial: FilterGroup | null = null) {
  const filter = ref<FilterGroup | null>(initial)
  const Host = defineComponent({
    setup: () => () => h(MFilterBuilder, { modelValue: filter.value, 'onUpdate:modelValue': (v: FilterGroup) => (filter.value = v), fields, ...props }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  return filter
}

const button = (text: string) => wrapper!.findAll('button').find((b) => b.text().includes(text))!
const rules = () => wrapper!.findAll('[data-filter-rule]')
/** The n-th rule's field and operator selects */
const selects = (n: number) => rules()[n]!.findAllComponents(MSelect)
const rule = (filter: { value: FilterGroup | null }, n: number) => filter.value!.rules[n] as FilterRule

describe('MFilterBuilder', () => {
  it('starts empty and adds a condition on the first field', async () => {
    const filter = mountBuilder()
    expect(wrapper!.text()).toContain('No conditions: every row matches')
    await button('Add condition').trigger('click')
    expect(filter.value!.rules).toHaveLength(1)
    expect(rule(filter, 0)).toMatchObject({ field: 'name', operator: 'contains' })
    expect(rules()[0]!.findComponent(MTextField).exists()).toBe(true)
  })

  it('switches the value input and operators with the field\'s type', async () => {
    const filter = mountBuilder()
    await button('Add condition').trigger('click')
    selects(0)[0]!.vm.$emit('update:modelValue', 'price')
    await nextTick()
    expect(rule(filter, 0)).toMatchObject({ field: 'price', operator: 'equals' })
    expect(rules()[0]!.findComponent(MNumberField).exists()).toBe(true)
    expect((selects(0)[1]!.props('options') as { value: string }[]).map((o) => o.value)).toContain('between')

    selects(0)[1]!.vm.$emit('update:modelValue', 'between')
    await nextTick()
    expect(rules()[0]!.findAllComponents(MNumberField)).toHaveLength(2)
    rules()[0]!.findAllComponents(MNumberField)[1]!.vm.$emit('update:modelValue', 99)
    await nextTick()
    expect(rule(filter, 0).value).toEqual([null, 99])

    selects(0)[0]!.vm.$emit('update:modelValue', 'status')
    await nextTick()
    expect(rule(filter, 0)).toMatchObject({ field: 'status', operator: 'in' })
    expect(rule(filter, 0).value).toBeUndefined()
    expect(rules()[0]!.findComponent(MMultiSelect).props('options')).toEqual(fields[3]!.options)

    selects(0)[0]!.vm.$emit('update:modelValue', 'due')
    await nextTick()
    expect(rules()[0]!.findComponent(MDatePicker).exists()).toBe(true)
    // Dates read greater / less as after / before
    expect((selects(0)[1]!.props('options') as { label: string }[]).map((o) => o.label)).toContain('is after')

    selects(0)[0]!.vm.$emit('update:modelValue', 'urgent')
    await nextTick()
    expect(rule(filter, 0).operator).toBe('isTrue')
    expect(rules()[0]!.findComponent(MTextField).exists()).toBe(false)
  })

  it('keeps a value that still fits a new operator, and drops one that doesn\'t', async () => {
    const filter = mountBuilder({}, { id: 'g', combinator: 'and', rules: [{ id: 'r', field: 'name', operator: 'contains', value: 'ab' }] })
    selects(0)[1]!.vm.$emit('update:modelValue', 'startsWith')
    await nextTick()
    expect(rule(filter, 0).value).toBe('ab')
    selects(0)[1]!.vm.$emit('update:modelValue', 'isEmpty')
    await nextTick()
    expect(rule(filter, 0).value).toBeUndefined()
  })

  it('shows all / any once there are two conditions, and removes them', async () => {
    const filter = mountBuilder()
    await button('Add condition').trigger('click')
    expect(wrapper!.findComponent(MSegmentedButton).exists()).toBe(false)
    await button('Add condition').trigger('click')
    const seg = wrapper!.findComponent(MSegmentedButton)
    seg.vm.$emit('update:modelValue', 'or')
    await nextTick()
    expect(filter.value!.combinator).toBe('or')
    await rules()[0]!.find('button[aria-label="Remove condition"]').trigger('click')
    expect(filter.value!.rules).toHaveLength(1)
  })

  it('nests a group up to maxDepth, with the other combinator, and removes it', async () => {
    const filter = mountBuilder()
    await button('Add group').trigger('click')
    const group = filter.value!.rules[0] as FilterGroup
    expect(group).toMatchObject({ combinator: 'or', rules: [{ field: 'name' }] })
    expect(wrapper!.findAll('[data-filter-group]')).toHaveLength(1)
    // maxDepth 1: no deeper groups
    expect(wrapper!.find('[data-filter-group]').findAll('button').some((b) => b.text().includes('Add group'))).toBe(false)
    await wrapper!.find('[data-filter-group] button[aria-label="Remove group"]').trigger('click')
    expect(filter.value!.rules).toEqual([])
  })

  it('offers no groups with maxDepth 0, and nothing to change when disabled', async () => {
    mountBuilder({ maxDepth: 0 })
    expect(button('Add group')).toBeUndefined()
    wrapper!.unmount()
    mountBuilder({ disabled: true }, { id: 'g', combinator: 'and', rules: [{ id: 'r', field: 'name', operator: 'contains', value: 'x' }] })
    expect(button('Add condition').attributes('disabled')).toBeDefined()
    expect(selects(0)[0]!.props('disabled')).toBe(true)
  })
})
