import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import MDragHandle from '../components/MDragHandle.vue'
import MSplitter from '../components/MSplitter.vue'

const settle = () => new Promise((r) => setTimeout(r, 600))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})


describe('MDragHandle', () => {
  it('is a 4×48 outline capsule that becomes 12×52 on-surface when dragged', async () => {
    wrapper = mount(MDragHandle)
    const bar = wrapper.find('span > span').element as HTMLElement
    expect([bar.style.width, bar.style.height]).toEqual(['4px', '48px'])
    expect(bar.className).toContain('bg-outline')
    await wrapper.setProps({ dragging: true })
    await settle()
    expect([bar.style.width, bar.style.height]).toEqual(['12px', '52px'])
    expect(bar.className).toContain('bg-on-surface')
  })

  it('lies down when horizontal', async () => {
    wrapper = mount(MDragHandle, { props: { orientation: 'horizontal' } })
    await settle()
    const bar = wrapper.find('span > span').element as HTMLElement
    expect([bar.style.width, bar.style.height]).toEqual(['48px', '4px'])
  })
})

describe('MSplitter', () => {
  it('draws the drag handle on its bar, dragged while the bar is', async () => {
    wrapper = mount(MSplitter)
    const sep = wrapper.find('[role="separator"]')
    const bar = sep.find('span > span').element as HTMLElement
    expect([bar.style.width, bar.style.height]).toEqual(['4px', '48px'])
    await sep.trigger('pointerdown', { button: 0, pointerId: 1 })
    await settle()
    expect([bar.style.width, bar.style.height]).toEqual(['12px', '52px'])
  })

  it('moves the split with the arrow keys', async () => {
    wrapper = mount(MSplitter, { props: { initialSplit: 50 } })
    const sep = wrapper.find('[role="separator"]')
    await sep.trigger('keydown', { key: 'ArrowRight' })
    expect(sep.attributes('aria-valuenow')).toBe('51')
    await sep.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(sep.attributes('aria-valuenow')).toBe('41')
    await sep.trigger('keydown', { key: 'End' })
    expect(sep.attributes('aria-valuenow')).toBe('90')
  })
})
