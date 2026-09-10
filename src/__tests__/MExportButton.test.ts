import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MExportButton from '../components/MExportButton.vue'

const sampleData = [
  { name: 'Ada', age: 30 },
  { name: 'Grace, "The Admiral"', age: 45 },
]

describe('MExportButton', () => {
  let clickSpy: ReturnType<typeof vi.fn>
  let lastBlob: Blob | null

  beforeEach(() => {
    clickSpy = vi.fn()
    lastBlob = null
    HTMLAnchorElement.prototype.click = clickSpy
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      lastBlob = blob
      return 'blob:mock'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('renders the label', () => {
    const wrapper = mount(MExportButton, { props: { data: sampleData } })
    expect(wrapper.text()).toContain('Export')
  })

  it('exports CSV by default, escaping commas and quotes', async () => {
    const wrapper = mount(MExportButton, { props: { data: sampleData } })
    await wrapper.find('button').trigger('click')
    const text = await lastBlob!.text()
    expect(text).toBe('name,age\nAda,30\n"Grace, ""The Admiral""",45')
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('exports JSON when format is json', async () => {
    const wrapper = mount(MExportButton, { props: { data: sampleData, format: 'json' } })
    await wrapper.find('button').trigger('click')
    const text = await lastBlob!.text()
    expect(JSON.parse(text)).toEqual(sampleData)
  })

  it('emits exported with the format and filename', async () => {
    const wrapper = mount(MExportButton, { props: { data: sampleData, filename: 'users' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('exported')![0]).toEqual([{ format: 'csv', filename: 'users.csv' }])
  })

  it('does not export when disabled', async () => {
    const wrapper = mount(MExportButton, { props: { data: sampleData, disabled: true } })
    await wrapper.find('button').trigger('click')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('supports a custom label via the default slot', () => {
    const wrapper = mount(MExportButton, {
      props: { data: sampleData },
      slots: { default: 'Download all' },
    })
    expect(wrapper.text()).toContain('Download all')
  })
})
