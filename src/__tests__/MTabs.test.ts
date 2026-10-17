import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MTabs from '../components/MTabs.vue'

const tabs = [
  { value: 'flights', label: 'Flights', icon: 'flight' },
  { value: 'hotels', label: 'Hotels', icon: 'hotel' },
]

const firstTab = (props: Record<string, unknown>) =>
  mount(MTabs, { props: { modelValue: 'flights', tabs, ...props } }).find('button').classes()

describe('MTabs', () => {
  it('stacks primary icons above the label in a 64px tab by default', () => {
    const c = firstTab({})
    expect(c).toContain('flex-col')
    expect(c).toContain('h-16')
  })

  it('puts the icon beside the label in a 48px tab with iconPosition="leading" (LeadingIconTab)', () => {
    const c = firstTab({ iconPosition: 'leading' })
    expect(c).toContain('flex-row')
    expect(c).toContain('h-12')
    expect(c).toContain('gap-2')
  })

  it('keeps secondary icons beside the label by default and stacks them with iconPosition="top"', () => {
    expect(firstTab({ variant: 'secondary' })).toContain('flex-row')
    const c = firstTab({ variant: 'secondary', iconPosition: 'top' })
    expect(c).toContain('flex-col')
    expect(c).toContain('h-16')
  })

  it('emits the picked tab', async () => {
    const w = mount(MTabs, { props: { modelValue: 'flights', tabs } })
    await w.findAll('button')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['hotels']])
  })
})
