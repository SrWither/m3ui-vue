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

  it.each([
    ['a Tailwind class', 'max-w-sm', 'max-w-sm', ''],
    ['a length', '420px', '', '420px'],
    ['a CSS function', 'min(90vw, 40rem)', '', 'min(90vw, 40rem)'],
  ])('maxWidth accepts %s', (_name, maxWidth, cls, style) => {
    mount(MDialog, { props: { modelValue: true, maxWidth }, attachTo: document.body })
    const box = document.body.querySelector('.dialog-box') as HTMLElement
    if (cls) expect(box.classList.contains(cls)).toBe(true)
    expect(box.style.maxWidth).toBe(style)
  })

  it('maxHeight accepts a CSS value alongside a class maxWidth', () => {
    mount(MDialog, { props: { modelValue: true, maxWidth: 'max-w-md', maxHeight: '600px' }, attachTo: document.body })
    const box = document.body.querySelector('.dialog-box') as HTMLElement
    expect(box.classList.contains('max-w-md')).toBe(true)
    expect(box.style.maxHeight).toBe('600px')
  })

  it('bare: the content fills the box, with no title row, close button or padding', () => {
    mount(MDialog, {
      props: { modelValue: true, bare: true, title: 'Select date' },
      slots: { default: '<div class="mine">Picker</div>' },
      attachTo: document.body,
    })
    const box = document.body.querySelector('.dialog-box') as HTMLElement
    expect(box.querySelector('.mine')).not.toBeNull()
    expect(box.querySelector('h2')).toBeNull()
    expect(box.querySelector('button')).toBeNull()
    // The title still names it
    expect(box.getAttribute('role')).toBe('dialog')
    expect(box.getAttribute('aria-modal')).toBe('true')
    expect(box.getAttribute('aria-label')).toBe('Select date')
  })

  it('is labelled by its title', () => {
    mount(MDialog, { props: { modelValue: true, title: 'Delete file?' }, attachTo: document.body })
    const box = document.body.querySelector('.dialog-box') as HTMLElement
    const id = box.getAttribute('aria-labelledby')!
    expect(document.getElementById(id)?.textContent).toContain('Delete file?')
  })

  it('a dialog mounted open closes on Escape', async () => {
    const w = mount(MDialog, { props: { modelValue: true }, attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
    w.unmount()
  })
})
