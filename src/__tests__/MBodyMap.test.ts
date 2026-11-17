import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MBodyMap from '../components/MBodyMap.vue'
import type { BodyMapValue } from '../components/MBodyMap.vue'

function setup(extra: Record<string, unknown> = {}) {
  const w = mount(MBodyMap, {
    props: { modelValue: {} as BodyMapValue, 'onUpdate:modelValue': (v: BodyMapValue) => w.setProps({ modelValue: v }), ...extra },
  })
  return w
}

describe('MBodyMap', () => {
  it('draws front and back with the patient’s sides', () => {
    const w = setup()
    expect(w.findAll('[data-view="front"] [data-region]')).toHaveLength(22)
    expect(w.findAll('[data-view="back"] [data-region]')).toHaveLength(23)
    // On the front view, the patient's right shoulder is on the viewer's left
    const right = w.find('[data-region="shoulder-right"]')
    expect(Number(right.attributes('cx'))).toBeLessThan(100)
    expect(right.attributes('aria-label')).toBe('Shoulder, right')
    // On the back view it is on the viewer's right
    expect(Number(w.find('[data-region="back-shoulder-right"]').attributes('cx'))).toBeGreaterThan(100)
    expect(w.find('[data-region="back-shoulder-right"]').attributes('aria-label')).toBe('Shoulder, right (back)')
    expect(w.find('[data-region="back-lower-back"]').attributes('aria-label')).toBe('Lower back')
  })

  it('toggles a region with one level', async () => {
    const w = setup()
    await w.find('[data-region="knee-left"]').trigger('click')
    expect(w.props('modelValue')).toEqual({ 'knee-left': 1 })
    expect(w.emitted('select')![0]![0]).toMatchObject({ id: 'knee-left', level: 1, view: 'front' })
    await w.find('[data-region="knee-left"]').trigger('click')
    expect(w.props('modelValue')).toEqual({})
  })

  it('cycles through levels and sets one with the number keys', async () => {
    const w = setup({ levels: 3, levelLabels: ['Mild', 'Moderate', 'Severe'] })
    const head = () => w.find('[data-region="head"]')
    await head().trigger('click')
    await head().trigger('click')
    expect(w.props('modelValue')).toEqual({ head: 2 })
    expect(head().attributes('aria-label')).toBe('Head: Moderate')
    await head().trigger('keydown', { key: '3' })
    expect(w.props('modelValue')).toEqual({ head: 3 })
    await head().trigger('click')
    expect(w.props('modelValue')).toEqual({})
    expect(w.find('[data-legend]').text()).toContain('Severe')
  })

  it('respects readonly, disabled regions and a single view', async () => {
    const w = setup({ view: 'back', disabledRegions: ['back-head'] })
    expect(w.find('[data-view="front"]').exists()).toBe(false)
    await w.find('[data-region="back-head"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.setProps({ readonly: true })
    await w.find('[data-region="back-neck"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
