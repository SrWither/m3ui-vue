import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MChatBubble from '../components/MChatBubble.vue'

describe('MChatBubble', () => {
  it('shows bouncing dots instead of the content while typing', () => {
    const w = mount(MChatBubble, { props: { typing: 'text', text: 'hidden', time: '10:00' } })
    expect(w.findAll('.m3-typing-dot')).toHaveLength(3)
    expect(w.find('[role="status"]').attributes('aria-label')).toBe('Typing…')
    expect(w.text()).not.toContain('hidden')
    expect(w.text()).not.toContain('10:00')
  })

  it('shows a mic and waveform while recording audio, labelled with the sender', () => {
    const w = mount(MChatBubble, { props: { typing: 'audio', sender: 'Alex' } })
    expect(w.find('.m3-typing-mic').exists()).toBe(true)
    expect(w.findAll('.m3-typing-bar')).toHaveLength(7)
    expect(w.find('[role="status"]').attributes('aria-label')).toBe('Alex: Recording audio…')
  })

  it('renders slot content in a div, not a p', () => {
    const w = mount(MChatBubble, { slots: { default: '<div class="custom">x</div>' } })
    expect(w.find('p .custom').exists()).toBe(false)
    expect(w.find('.custom').exists()).toBe(true)
  })

  it('tints status checks with the bubble color', () => {
    const w = mount(MChatBubble, { props: { side: 'right', color: 'tertiary', status: 'read', text: 'hi' } })
    const icon = w.findAll('.material-symbols-outlined').at(-1)!
    expect(icon.classes()).toContain('text-on-tertiary')
    expect(icon.classes()).not.toContain('text-on-primary')
  })
})
