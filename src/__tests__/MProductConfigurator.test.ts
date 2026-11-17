import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MProductConfigurator from '../components/MProductConfigurator.vue'
import type { ProductOptionGroup, ProductSelection } from '../components/MProductConfigurator.vue'

const groups: ProductOptionGroup[] = [
  { key: 'size', label: 'Size', required: true, display: 'chips', options: [
    { value: 's', label: 'S' }, { value: 'm', label: 'M' }, { value: 'l', label: 'L', price: 2 },
  ] },
  { key: 'extras', label: 'Extras', type: 'multiple', max: 2, options: [
    { value: 'bacon', label: 'Bacon', price: 1.5 }, { value: 'egg', label: 'Egg', price: 1 }, { value: 'cheese', label: 'Cheese', price: 0.5 },
  ] },
  { key: 'dips', label: 'Dips', type: 'quantity', max: 3, options: [{ value: 'bbq', label: 'BBQ', price: 0.25 }, { value: 'mayo', label: 'Mayo' }] },
]


describe('MProductConfigurator', () => {
  it('keeps the action disabled until required groups are chosen', async () => {
    const w = mount(MProductConfigurator, { props: { groups, basePrice: 10, actionLabel: 'Add' } })
    expect(w.find('[data-action]').attributes('disabled')).toBeDefined()
    await w.setProps({ modelValue: { size: 'm' } })
    expect(w.find('[data-action]').attributes('disabled')).toBeUndefined()
  })

  it('picks a single option and prices it', async () => {
    const w = mount(MProductConfigurator, { props: { groups, basePrice: 10, actionLabel: 'Add' } })
    await w.find('[data-group="size"] [data-option="l"]').trigger('click')
    const v = w.emitted('update:modelValue')!.at(-1)![0] as ProductSelection
    expect(v.size).toBe('l')
    await w.setProps({ modelValue: v, quantity: 2 })
    expect((w.vm as any).unitPrice).toBe(12)
    expect((w.vm as any).total).toBe(24)
  })

  it('caps a multiple group at max', async () => {
    const w = mount(MProductConfigurator, { props: { groups, modelValue: { size: 's', extras: ['bacon', 'egg'] }, basePrice: 10 } })
    const cheese = w.find('[data-group="extras"] [data-option="cheese"] input')
    expect(cheese.attributes('disabled')).toBeDefined()
    expect((w.vm as any).unitPrice).toBe(12.5)
  })

  it('counts quantities up to the group max', async () => {
    const w = mount(MProductConfigurator, { props: { groups, modelValue: { size: 's', dips: { bbq: 2, mayo: 1 } }, basePrice: 10 } })
    expect((w.vm as any).unitPrice).toBe(10.5)
    const addMayo = w.findAll('[data-group="dips"] [data-option="mayo"] button').at(-1)!
    expect(addMayo.attributes('disabled')).toBeDefined()
    await w.findAll('[data-group="dips"] [data-option="bbq"] button')[0]!.trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toEqual({ size: 's', dips: { bbq: 1, mayo: 1 } })
  })

  it('crosses out combinations isAvailable rejects', () => {
    const w = mount(MProductConfigurator, {
      props: {
        groups,
        modelValue: { extras: ['egg'] },
        isAvailable: (g, o, s) => !(g.key === 'size' && o.value === 'l' && (s.extras as string[] | undefined)?.includes('egg')),
      },
    })
    expect(w.find('[data-group="size"] [data-option="l"]').attributes('disabled')).toBeDefined()
  })

  it('emits add with the selection and totals', async () => {
    const w = mount(MProductConfigurator, { props: { groups, modelValue: { size: 'm' }, basePrice: 10, quantity: 3, actionLabel: 'Add' } })
    await w.find('[data-action]').trigger('click')
    expect(w.emitted('add')![0]![0]).toEqual({ selection: { size: 'm' }, quantity: 3, unitPrice: 10, total: 30 })
  })

  it('shows the rule of each group', () => {
    const w = mount(MProductConfigurator, { props: { groups: [...groups, { key: 'x', label: 'X', type: 'multiple', min: 2, max: 2, options: [] }] } })
    const rules = w.findAll('[data-rule]').map((r) => r.text())
    expect(rules).toEqual(['Required', 'Choose up to 2', 'Choose up to 3', 'Choose 2'])
  })
})
