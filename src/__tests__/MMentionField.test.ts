import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import MMentionField from '../components/MMentionField.vue'
import type { MentionItem, MentionRef, MentionSource } from '../components/MMentionField.vue'

const PEOPLE: MentionItem[] = [
  { id: 1, label: 'Ana López', description: 'Design' },
  { id: 2, label: 'Bruno Díaz', description: 'Backend' },
  { id: 3, label: 'Mariana Paz', avatar: 'https://img.test/m.png' },
]
const TAGS: MentionItem[] = [{ id: 'bug', label: 'bug', icon: 'bug_report' }, { id: 'ux', label: 'ux' }]

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function mountField(sources: MentionSource[] = [{ trigger: '@', items: PEOPLE }, { trigger: '#', items: TAGS }], slots = {}) {
  const text = ref('')
  const mentions = ref<MentionRef[]>([])
  const onMention = vi.fn()
  const Host = defineComponent({
    setup: () => () => h(MMentionField, {
      modelValue: text.value, 'onUpdate:modelValue': (v: string) => (text.value = v),
      mentions: mentions.value, 'onUpdate:mentions': (v: MentionRef[]) => (mentions.value = v),
      onMention, sources, label: 'Message',
    }, slots),
  })
  wrapper = mount(Host, { attachTo: document.body })
  const el = wrapper.find('textarea').element as HTMLTextAreaElement
  /** Types the whole text with the caret at its end (or at `caret`) */
  const type = async (value: string, caret = value.length) => {
    el.value = value
    el.setSelectionRange(caret, caret)
    el.dispatchEvent(new Event('input'))
    await nextTick()
    await nextTick()
  }
  const key = async (k: string, opts: KeyboardEventInit = {}) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }))
    await nextTick()
  }
  return { text, mentions, onMention, el, type, key }
}

const options = () => [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
const list = () => document.body.querySelector('[role="listbox"]')

describe('MMentionField', () => {
  it('opens on a trigger at the start of a word, filtered without accents or case', async () => {
    const { type, el } = mountField()
    await type('Hi @')
    expect(options().map((o) => o.querySelector('.text-body-large')!.textContent)).toEqual(['Ana López', 'Bruno Díaz', 'Mariana Paz'])
    await type('Hi @ana')
    // "Ana López" starts with it, "Mariana Paz" only contains it
    expect(options().map((o) => o.querySelector('.text-body-large')!.textContent)).toEqual(['Ana López', 'Mariana Paz'])
    await type('Hi @diaz')
    expect(options()).toHaveLength(1)
    expect(el.getAttribute('aria-expanded')).toBe('true')
    // Inside a word (an email) it's not a mention
    await type('mail me at ana@ex')
    expect(list()).toBeNull()
    // A space ends the query
    await type('Hi @ana ')
    expect(list()).toBeNull()
  })

  it('picks with the keyboard, writing the label and keeping the mention with its id', async () => {
    const { type, key, text, mentions, onMention, el } = mountField()
    await type('Hi @an')
    await key('ArrowDown')
    expect(el.getAttribute('aria-activedescendant')).toBe(options()[1]!.id)
    await key('Enter')
    expect(text.value).toBe('Hi @Mariana Paz ')
    expect(mentions.value).toEqual([{ trigger: '@', id: 3, label: 'Mariana Paz' }])
    expect(onMention).toHaveBeenCalledWith(PEOPLE[2], '@')
    expect(list()).toBeNull()
  })

  it('picks with the pointer, mid-text, and handles a second trigger', async () => {
    const { type, text, mentions } = mountField()
    await type('Fixed #b today', 'Fixed #b'.length)
    expect(options()).toHaveLength(1)
    options()[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(text.value).toBe('Fixed #bug  today')
    expect(mentions.value).toEqual([{ trigger: '#', id: 'bug', label: 'bug' }])
    // Its icon instead of initials
    await type('#u')
    expect(options()[0]!.textContent).toContain('ux')
  })

  it('drops a mention once its text is gone', async () => {
    const { type, key, mentions } = mountField()
    await type('@br')
    await key('Enter')
    expect(mentions.value).toHaveLength(1)
    await type('@Bruno Dí')
    expect(mentions.value).toEqual([])
  })

  it('closes on Escape, and Enter then types as usual', async () => {
    const { type, key } = mountField()
    await type('@a')
    expect(list()).not.toBeNull()
    await key('Escape')
    expect(list()).toBeNull()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    wrapper!.find('textarea').element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
  })

  it('looks items up through search, debounced, aborting a replaced query', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (q: string) => PEOPLE.filter((p) => p.label.toLowerCase().startsWith(q)))
    const { type } = mountField([{ trigger: '@', search }])
    await type('@a')
    await type('@an')
    expect(document.body.textContent).toContain('Loading')
    // A key that types nothing while the search is on its way doesn't make its answer look stale
    wrapper!.find('textarea').element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(search).toHaveBeenCalledTimes(1)
    expect(search.mock.calls[0]![0]).toBe('an')
    expect(options()).toHaveLength(1)
  })

  it('marks the Enter it picks with, before the consumer\'s own @keydown sees it', async () => {
    const seen: boolean[] = []
    const text = ref('')
    const Host = defineComponent({
      setup: () => () => h(MMentionField, {
        modelValue: text.value, 'onUpdate:modelValue': (v: string) => (text.value = v),
        sources: [{ trigger: '@', items: PEOPLE }], label: 'Message',
        onKeydown: (e: KeyboardEvent) => seen.push(e.defaultPrevented),
      }),
    })
    wrapper = mount(Host, { attachTo: document.body })
    const el = wrapper.find('textarea').element as HTMLTextAreaElement
    el.value = '@bru'
    el.setSelectionRange(4, 4)
    el.dispatchEvent(new Event('input'))
    await nextTick()
    await nextTick()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await nextTick()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    // The first Enter picked (prevented), the second is the consumer's to use
    expect(seen).toEqual([true, false])
    expect(text.value).toBe('@Bruno Díaz ')
  })

  it('takes an #item slot', async () => {
    const { type } = mountField(undefined, { item: ({ item, active }: { item: MentionItem; active: boolean }) => h('b', `${item.label}${active ? '*' : ''}`) })
    await type('@bru')
    expect(options()[0]!.textContent).toBe('Bruno Díaz*')
  })
})
