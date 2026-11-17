import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MCertificate from '../components/MCertificate.vue'

describe('MCertificate', () => {
  it('renders the recipient with locale defaults', () => {
    const w = mount(MCertificate, { props: { recipient: 'Ana Gómez', description: 'has completed Vue 3 Fundamentals', date: new Date(2026, 10, 17), code: 'M3-2026-0042' } })
    expect(w.find('[data-title]').text()).toBe('Certificate of completion')
    expect(w.text()).toContain('This certifies that')
    expect(w.find('[data-recipient]').text()).toBe('Ana Gómez')
    expect(w.text()).toContain('November 17, 2026')
    expect(w.find('[data-code]').text()).toBe('Certificate ID: M3-2026-0042')
  })

  it('draws signatures, with an image when given', () => {
    const w = mount(MCertificate, {
      props: { recipient: 'A', signatures: [{ name: 'Leo Paz', role: 'Director', image: 'data:image/png;base64,x' }, { name: 'Mía Ruiz' }] },
    })
    const sigs = w.findAll('[data-signature]')
    expect(sigs).toHaveLength(2)
    expect(sigs[0]!.find('img').attributes('src')).toBe('data:image/png;base64,x')
    expect(sigs[0]!.text()).toContain('Director')
  })

  it('switches variant, orientation, color and seal', async () => {
    const w = mount(MCertificate, { props: { recipient: 'A', variant: 'modern', orientation: 'portrait', color: 'tertiary', seal: false } })
    expect(w.attributes('data-variant')).toBe('modern')
    expect(w.attributes('style')).toContain('210 / 297')
    expect(w.attributes('style')).toContain('var(--color-tertiary)')
    expect(w.find('.m3-certificate__seal').exists()).toBe(false)
  })
})
