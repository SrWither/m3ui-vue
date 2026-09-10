import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MCopyButton from '../components/MCopyButton.vue'

describe('MCopyButton', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('copies the value to the clipboard on click', async () => {
    const wrapper = mount(MCopyButton, { props: { value: 'hello' } })
    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello'))
  })

  it('emits copied with the value', async () => {
    const wrapper = mount(MCopyButton, { props: { value: 'hello' } })
    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('copied')).toEqual([['hello']]))
  })

  it('swaps the icon to copiedIcon after copying, then reverts after resetDelay', async () => {
    const wrapper = mount(MCopyButton, { props: { value: 'hello', resetDelay: 30 } })
    expect(wrapper.text()).toContain('content_copy')

    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('check'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('content_copy'))
  })

  it('emits error when the clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    const wrapper = mount(MCopyButton, { props: { value: 'hello' } })
    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('error')).toHaveLength(1))
  })

  it('does not copy when disabled', async () => {
    const wrapper = mount(MCopyButton, { props: { value: 'hello', disabled: true } })
    await wrapper.find('button').trigger('click')
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})
