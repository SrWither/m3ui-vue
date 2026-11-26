import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MNotificationCenter from '../components/MNotificationCenter.vue'
import MChip from '../components/MChip.vue'
import type { InboxNotification } from '../components/MNotificationCenter.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const now = Date.now()
const items = (): InboxNotification[] => [
  { id: 1, title: 'New order', body: '3 items from Ana', time: now - 5 * 60e3, icon: 'shopping_bag', color: 'primary' },
  { id: 2, title: 'Payment received', time: now - 2 * 3600e3, read: true, color: 'success' },
  { id: 3, title: 'Weekly report', time: now - 26 * 3600e3 },
  { id: 4, title: 'Server restarted', time: now - 5 * 24 * 3600e3, read: true },
]

function mountCenter(props: Record<string, unknown> = {}) {
  const list = ref(items())
  const opened: InboxNotification[] = []
  const dismissed: InboxNotification[] = []
  const Host = defineComponent({
    setup: () => () => h(MNotificationCenter, {
      modelValue: list.value, 'onUpdate:modelValue': (v: InboxNotification[]) => (list.value = v),
      onOpen: (n: InboxNotification) => opened.push(n), onDismiss: (n: InboxNotification) => dismissed.push(n), ...props,
    }),
  })
  wrapper = mount(Host, { attachTo: document.body })
  return { list, opened, dismissed }
}

const rows = () => wrapper!.findAll('li')
const row = (title: string) => rows().find((r) => r.text().includes(title))!

describe('MNotificationCenter', () => {
  it('groups by day, newest first, with relative times and the unread count', () => {
    mountCenter()
    expect(wrapper!.findAll('h3').map((h) => h.text()).slice(0, 2)).toEqual(['Today', 'Yesterday'])
    expect(rows().map((r) => r.find('.text-body-large').text())).toEqual(['New order', 'Payment received', 'Weekly report', 'Server restarted'])
    expect(row('New order').text()).toContain('5 min. ago')
    expect(wrapper!.text()).toContain('Mark all as read')
    expect(wrapper!.find('h2').text()).toBe('Notifications')
  })

  it('opens one on click, marking it read', async () => {
    const { list, opened } = mountCenter()
    await row('New order').trigger('click')
    expect(list.value.find((n) => n.id === 1)!.read).toBe(true)
    expect(opened[0]!.id).toBe(1)
  })

  it('marks all read, and filters to unread', async () => {
    const { list } = mountCenter()
    const chips = wrapper!.findAllComponents(MChip)
    await chips[1]!.find('button').trigger('click')
    expect(rows().map((r) => r.find('.text-body-large').text())).toEqual(['New order', 'Weekly report'])
    await wrapper!.findAll('button').find((b) => b.text() === 'Mark all as read')!.trigger('click')
    expect(list.value.every((n) => n.read)).toBe(true)
    await nextTick()
    expect(wrapper!.text()).toContain("You're all caught up")
  })

  it('dismisses from its button and with Delete', async () => {
    const { list, dismissed } = mountCenter()
    await row('Weekly report').find('button[aria-label="Dismiss"]').trigger('click')
    expect(list.value.map((n) => n.id)).toEqual([1, 2, 4])
    expect(dismissed[0]!.id).toBe(3)
    await row('Payment received').trigger('keydown', { key: 'Delete' })
    expect(list.value.map((n) => n.id)).toEqual([1, 4])
  })

  it('dismisses with a swipe, and not with a short one', async () => {
    const { list } = mountCenter()
    const el = row('New order').element as HTMLElement
    Object.defineProperty(el, 'offsetWidth', { value: 300 })
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 10, button: 0, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointerup', {}))
    expect(list.value).toHaveLength(4)
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 10, button: 0, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointerup', {}))
    // happy-dom's timeline doesn't run by itself
    el.getAnimations().forEach((a) => a.finish())
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
    expect(list.value.map((n) => n.id)).toEqual([2, 3, 4])
  })
})
