import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MOdontogram from '../components/MOdontogram.vue'
import type { OdontogramValue } from '../components/MOdontogram.vue'

function setup(extra: Record<string, unknown> = {}) {
  const w = mount(MOdontogram, {
    props: {
      modelValue: {} as OdontogramValue,
      'onUpdate:modelValue': (v: OdontogramValue) => w.setProps({ modelValue: v }),
      'onUpdate:tool': (t: string) => w.setProps({ tool: t }),
      ...extra,
    },
  })
  return w
}
const teeth = (w: ReturnType<typeof setup>) => w.findAll('[data-tooth]').map((t) => t.attributes('data-tooth'))
const surface = (w: ReturnType<typeof setup>, tooth: string, s: string) => w.find(`[data-tooth="${tooth}"] [data-surface="${s}"]`)

describe('MOdontogram', () => {
  it('lays out FDI teeth from the patient’s upper right', () => {
    const w = setup()
    const t = teeth(w)
    expect(t).toHaveLength(32)
    expect(t.slice(0, 3)).toEqual(['18', '17', '16'])
    expect(t.slice(7, 9)).toEqual(['11', '21'])
    expect(t.slice(16, 18)).toEqual(['48', '47'])
    expect(t.at(-1)).toBe('38')
  })

  it('numbers Universal and primary teeth', async () => {
    const w = setup({ numbering: 'universal' })
    expect(teeth(w).slice(0, 2)).toEqual(['1', '2'])
    expect(teeth(w)[16]).toBe('32')
    expect(teeth(w).at(-1)).toBe('17')
    await w.setProps({ dentition: 'primary' })
    expect(teeth(w)).toHaveLength(20)
    expect(teeth(w).slice(0, 2)).toEqual(['A', 'B'])
    await w.setProps({ numbering: 'fdi' })
    expect(teeth(w).slice(0, 5)).toEqual(['55', '54', '53', '52', '51'])
  })

  it('points mesial at the midline and buccal outward', () => {
    const w = setup()
    // Tooth 16 sits left of the midline: its mesial side is the box's right side
    expect(surface(w, '16', 'mesial').attributes('points')).toBe('40,0 28,12 28,28 40,40')
    expect(surface(w, '26', 'mesial').attributes('points')).toBe('0,0 12,12 12,28 0,40')
    expect(surface(w, '16', 'buccal').attributes('points')).toBe('0,0 40,0 28,12 12,12')
    expect(surface(w, '46', 'buccal').attributes('points')).toBe('0,40 40,40 28,28 12,28')
  })

  it('charts a surface with the picked condition and clears it on a second tap', async () => {
    const w = setup()
    await surface(w, '36', 'occlusal').trigger('click')
    expect(w.props('modelValue')).toEqual({ 36: { surfaces: { occlusal: 'caries' } } })
    expect(w.emitted('change')![0]![0]).toEqual({ tooth: '36', surface: 'occlusal', condition: 'caries' })
    await w.find('[data-tool="filling"]').trigger('click')
    await surface(w, '36', 'occlusal').trigger('click')
    expect(w.props('modelValue')).toEqual({ 36: { surfaces: { occlusal: 'filling' } } })
    await surface(w, '36', 'occlusal').trigger('click')
    expect(w.props('modelValue')).toEqual({})
  })

  it('charts whole-tooth conditions from the number', async () => {
    const w = setup({ tool: 'missing' })
    await w.find('[data-tooth="18"] [data-number]').trigger('click')
    expect(w.props('modelValue')).toEqual({ 18: { conditions: ['missing'] } })
    expect(w.find('[data-tooth="18"] [data-mark="missing"]').exists()).toBe(true)
    await w.setProps({ tool: 'rootCanal' })
    await w.find('[data-tooth="11"] [data-surface="buccal"]').trigger('click')
    expect(w.props('modelValue')['11']).toEqual({ conditions: ['rootCanal'] })
    await w.setProps({ tool: 'eraser' })
    await w.find('[data-tooth="18"] [data-number]').trigger('click')
    expect(w.props('modelValue')['18']).toBeUndefined()
  })

  it('charts surfaces from the keyboard', async () => {
    const w = setup()
    const first = w.find('[data-tooth="18"]')
    await first.trigger('keydown', { key: 'o' })
    await first.trigger('keydown', { key: 'M' })
    expect(w.props('modelValue')['18']).toEqual({ surfaces: { occlusal: 'caries', mesial: 'caries' } })
    expect(first.attributes('aria-label')).toBe('Tooth 18, Occlusal: Caries, Mesial: Caries')
    await first.trigger('keydown', { key: 'Delete' })
    expect(w.props('modelValue')).toEqual({})
  })

  it('does nothing when readonly', async () => {
    const w = setup({ readonly: true })
    await surface(w, '36', 'occlusal').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
