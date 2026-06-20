import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MConfirmDialog from '../components/MConfirmDialog.vue'

describe('MConfirmDialog', () => {
  const baseProps = {
    modelValue: true,
    title: 'Delete item?',
    message: 'This cannot be undone.',
  }

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders title and message', () => {
    mount(MConfirmDialog, { props: baseProps, attachTo: document.body })
    expect(document.body.textContent).toContain('Delete item?')
    expect(document.body.textContent).toContain('This cannot be undone.')
  })

  it('uses locale defaults for labels', () => {
    mount(MConfirmDialog, { props: baseProps, attachTo: document.body })
    expect(document.body.textContent).toContain('Confirm')
    expect(document.body.textContent).toContain('Cancel')
  })

  it('uses custom labels when provided', () => {
    mount(MConfirmDialog, {
      props: { ...baseProps, confirmLabel: 'Delete', cancelLabel: 'Keep' },
      attachTo: document.body,
    })
    expect(document.body.textContent).toContain('Delete')
    expect(document.body.textContent).toContain('Keep')
  })

  it('emits confirm when confirm button clicked', async () => {
    const wrapper = mount(MConfirmDialog, { props: baseProps, attachTo: document.body })
    const buttons = wrapper.findAllComponents({ name: 'MButton' })
    const confirmBtn = buttons[buttons.length - 1]!
    await confirmBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('emits update:modelValue false when cancel clicked', async () => {
    const wrapper = mount(MConfirmDialog, { props: baseProps, attachTo: document.body })
    const cancelBtn = wrapper.findAllComponents({ name: 'MButton' })[0]!
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
