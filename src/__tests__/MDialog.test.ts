import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MDialog from '../components/MDialog.vue'

describe('MDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing when closed', () => {
    mount(MDialog, {
      props: { modelValue: false },
      attachTo: document.body,
    })
    expect(document.body.querySelector('.fixed')).toBeNull()
  })

  it('renders content when open', () => {
    mount(MDialog, {
      props: { modelValue: true, title: 'Test Dialog' },
      slots: { default: 'Dialog body' },
      attachTo: document.body,
    })
    expect(document.body.textContent).toContain('Test Dialog')
    expect(document.body.textContent).toContain('Dialog body')
  })

  it('emits update:modelValue false when close button clicked', async () => {
    const wrapper = mount(MDialog, {
      props: { modelValue: true, title: 'Test' },
      attachTo: document.body,
    })
    const closeBtn = wrapper.findComponent({ name: 'MIconButton' })
    await closeBtn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('hides close button when persistent', () => {
    const wrapper = mount(MDialog, {
      props: { modelValue: true, persistent: true, title: 'Test' },
      attachTo: document.body,
    })
    const iconBtn = wrapper.findComponent({ name: 'MIconButton' })
    expect(iconBtn.exists()).toBe(false)
  })

  it('renders actions slot', () => {
    mount(MDialog, {
      props: { modelValue: true, title: 'Test' },
      slots: {
        default: 'Body',
        actions: '<button>OK</button>',
      },
      attachTo: document.body,
    })
    expect(document.body.textContent).toContain('OK')
  })
})
