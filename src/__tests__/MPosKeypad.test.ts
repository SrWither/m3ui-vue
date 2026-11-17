import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MPosKeypad from '../components/MPosKeypad.vue'

type Props = InstanceType<typeof MPosKeypad>['$props']

// Mounts with a working v-model so each key sees the previous value
function mountKeypad(props: Partial<Props> = {}) {
  const w = mount(MPosKeypad, {
    props: {
      modelValue: '',
      ...props,
      'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }),
    } as any,
  })
  return w
}

async function type(w: ReturnType<typeof mount>, keys: string[]) {
  for (const k of keys) await w.find(`[data-key="${k}"]`).trigger('click')
}

describe('MPosKeypad', () => {
  it('types a free amount with a decimal point', async () => {
    const w = mountKeypad()
    await type(w, ['0', '1', '2', '.', '5', '0', '9'])
    expect(w.props('modelValue')).toBe('12.50')
  })

  it('enters cash-register style in shift mode', async () => {
    const w = mountKeypad({ entry: 'shift' })
    await type(w, ['1', '2', '5'])
    expect(w.props('modelValue')).toBe('1.25')
    await type(w, ['00'])
    expect(w.props('modelValue')).toBe('125.00')
    await type(w, ['backspace'])
    expect(w.props('modelValue')).toBe('12.50')
  })

  it('formats with a currency', async () => {
    const w = mountKeypad({ currency: 'USD', modelValue: '1234.5' })
    expect(w.text()).toContain('$1,234.5')
  })

  it('respects max and maxLength', async () => {
    const w = mountKeypad({ max: 100 })
    await type(w, ['9', '9', '9'])
    expect(w.props('modelValue')).toBe('99')
    const p = mountKeypad({ mode: 'pin', maxLength: 4 })
    await type(p, ['0', '0', '1', '2', '3'])
    expect(p.props('modelValue')).toBe('0012')
    expect(p.emitted('submit')).toEqual([['0012']])
  })

  it('shows remaining and change against the amount due', async () => {
    const w = mountKeypad({ due: 20, modelValue: '15' })
    expect(w.text()).toContain('Remaining: 5.00')
    await w.setProps({ modelValue: '50' })
    expect(w.text()).toContain('Change: 30.00')
  })

  it('disables the action until the amount covers what is due', async () => {
    const w = mountKeypad({ due: 20, modelValue: '15', actionLabel: 'Charge' })
    const btn = () => w.findAll('button').find((b) => b.text() === 'Charge')!
    expect(btn().attributes('disabled')).toBeDefined()
    await w.setProps({ modelValue: '20' })
    expect(btn().attributes('disabled')).toBeUndefined()
    await btn().trigger('click')
    expect(w.emitted('submit')).toEqual([['20']])
  })

  it('sets or adds quick amounts', async () => {
    const w = mountKeypad({ quickAmounts: [10, 20], modelValue: '5' })
    await w.findAll('button').find((b) => b.text().includes('20'))!.trigger('click')
    expect(w.props('modelValue')).toBe('20')
    const a = mountKeypad({ quickAmounts: [10], quickMode: 'add', modelValue: '5' })
    await a.findAll('button').find((b) => b.text().includes('+10'))!.trigger('click')
    expect(a.props('modelValue')).toBe('15')
  })

  it('clears on a long press of delete', async () => {
    vi.useFakeTimers()
    const w = mountKeypad({ modelValue: '123' })
    const del = w.find('[data-key="backspace"]')
    await del.trigger('pointerdown', { button: 0 })
    vi.advanceTimersByTime(600)
    await del.trigger('pointerup')
    await del.trigger('click')
    expect(w.props('modelValue')).toBe('')
    vi.useRealTimers()
  })

  it('takes the physical keyboard while focused', async () => {
    const w = mountKeypad()
    for (const key of ['4', ',', '5', 'Backspace', '7']) await w.trigger('keydown', { key })
    expect(w.props('modelValue')).toBe('4.7')
    await w.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')).toEqual([['4.7']])
    await w.trigger('keydown', { key: 'Escape' })
    expect(w.props('modelValue')).toBe('')
  })

  it('listens globally only with keyboard="global", never stealing from fields', async () => {
    const w = mountKeypad({ keyboard: 'global' })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '8' }))
    await w.vm.$nextTick()
    expect(w.props('modelValue')).toBe('8')
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.props('modelValue')).toBe('8')
    input.remove()
    w.unmount()
  })
})
