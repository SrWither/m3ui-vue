import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MListItem from '../components/MListItem.vue'
import MIconButton from '../components/MIconButton.vue'
import MSwitch from '../components/MSwitch.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const settle = () => new Promise((r) => setTimeout(r, 600))
const radius = (el: Element) => (el as HTMLElement).style.borderRadius
const layer = (row: Element) => (row.querySelector('.mli-state-layer') as HTMLElement).style.opacity
const down = (el: Element) => el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerType: 'mouse', bubbles: true }))
const move = (el: Element) => el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }))

describe('MListItem with a control inside', () => {
  it('pressing a button in #trailing leaves the row unpressed; pressing the text presses it', async () => {
    wrapper = mount(MListItem, {
      props: { title: 'Wi-Fi', clickable: true },
      slots: { trailing: () => h(MIconButton, { icon: 'settings', label: 'Settings' }) },
      attachTo: document.body,
    })
    const row = wrapper.find('.mli-row').element
    const button = row.querySelector('button')!
    await settle()
    expect(radius(row)).toBe('4px')

    move(button.querySelector('*') ?? button)
    down(button.querySelector('*') ?? button)
    await settle()
    expect(radius(row)).toBe('4px')
    expect(layer(row)).toBe('0')

    const text = row.querySelector('p')!
    move(text)
    await nextTick()
    expect(layer(row)).toBe('0.08')
    down(text)
    await settle()
    expect(radius(row)).toBe('16px')
    expect(layer(row)).toBe('0.12')
  })

  it('no CSS hover/active background on the row anymore (they match through nested controls)', () => {
    wrapper = mount(MListItem, { props: { title: 'A', clickable: true }, attachTo: document.body })
    const cls = wrapper.find('.mli-row').classes().join(' ')
    expect(cls).not.toMatch(/(hover|active):bg-/)
  })

  it('an expandable header takes a #trailing switch that does not toggle it', async () => {
    let on = false
    wrapper = mount(MListItem, {
      props: { title: 'Notifications', expandable: true },
      slots: {
        trailing: () => h(MSwitch, { modelValue: on, 'onUpdate:modelValue': (v: boolean) => (on = v) }),
        children: () => h('p', 'child'),
      },
      attachTo: document.body,
    })
    const header = wrapper.find('[aria-expanded]')
    const sw = header.find('input')
    down(sw.element)
    await settle()
    expect(radius(header.element)).toBe('4px')
    await sw.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('update:expanded')).toBeUndefined()
    // The header itself still toggles
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
  })

  it('indent sets the children padding', async () => {
    wrapper = mount(MListItem, {
      props: { title: 'Group', expandable: true, expanded: true, indent: 12 },
      slots: { children: () => h('p', 'child') },
    })
    await nextTick()
    expect((wrapper.find('.mli-expand-body').element as HTMLElement).style.paddingLeft).toBe('12px')
    await wrapper.setProps({ indent: '0.5rem' })
    expect((wrapper.find('.mli-expand-body').element as HTMLElement).style.paddingLeft).toBe('0.5rem')
  })
})
