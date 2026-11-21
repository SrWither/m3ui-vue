import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MMeterGroup from '../components/MMeterGroup.vue'

const items = [
  { label: 'Photos', value: 52 },
  { label: 'Apps', value: 28, color: 'tertiary' },
  { label: 'System', value: 18, color: '#123456' },
]

describe('MMeterGroup', () => {
  it('sizes each segment by its share of max, minus the gaps, and lists what is left', () => {
    const w = mount(MMeterGroup, { props: { items, max: 128, unit: 'GB', animate: false, locale: 'en-US', label: 'Storage' } })
    const segs = w.findAll('.m3-meter-segment')
    expect(segs).toHaveLength(3)
    // 3 segments + the track: 3 gaps of 4px
    expect((segs[0]!.element as HTMLElement).style.width).toBe(`calc((100% - 12px) * ${52 / 128})`)
    expect((segs[1]!.element as HTMLElement).style.backgroundColor).toBe('var(--color-tertiary)')
    expect(w.text()).toContain('98 GB of 128 GB')
    expect(w.text()).toContain('Remaining')
    expect(w.text()).toContain('30 GB')
  })

  it('without max fills the bar with no track, and scales values over max down', () => {
    const w = mount(MMeterGroup, { props: { items, animate: false } })
    expect((w.findAll('.m3-meter-segment')[0]!.element as HTMLElement).style.width).toBe(`calc((100% - 8px) * ${52 / 98})`)
    expect(w.find('.bg-secondary-container.flex-1').exists()).toBe(false)
    const over = mount(MMeterGroup, { props: { items, max: 50, animate: false } })
    expect((over.findAll('.m3-meter-segment')[2]!.element as HTMLElement).style.width).toBe(`calc((100% - 8px) * ${18 / 98})`)
  })

  it('shows percentages, a custom format, and emits select', async () => {
    const w = mount(MMeterGroup, { props: { items, max: 200, percent: true, format: (v: number) => `${v}u`, animate: false, locale: 'en-US' } })
    expect(w.text()).toContain('52u · 26%')
    await w.findAll('li')[1]!.trigger('click')
    expect(w.emitted('select')![0]).toEqual([items[1], 1])
  })

  it('describes every part to screen readers in one label', () => {
    const w = mount(MMeterGroup, { props: { items, max: 128, unit: 'GB', animate: false, locale: 'en-US', label: 'Storage' } })
    expect(w.find('[role="img"]').attributes('aria-label')).toBe('Storage, Photos: 52 GB, Apps: 28 GB, System: 18 GB, Remaining: 30 GB')
  })
})
