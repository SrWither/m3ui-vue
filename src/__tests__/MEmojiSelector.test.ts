import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MEmojiSelector from '../components/MEmojiSelector.vue'
import { M3_LOCALE_KEY } from '../composables/useLocale'
import { esLocale } from '../locales'
import { withSkinTone } from '../data/emojis'

enableAutoUnmount(afterEach)

function mountSelector(props: Record<string, unknown> = {}, locale?: object) {
  return mount(MEmojiSelector, {
    props,
    attachTo: document.body,
    global: locale ? { provide: { [M3_LOCALE_KEY as symbol]: locale } } : undefined,
  })
}

/** Names load with a dynamic import; wait until the buttons carry them. */
async function namesLoaded(wrapper: ReturnType<typeof mountSelector>) {
  await vi.waitFor(() => {
    expect(wrapper.find('[data-emoji="😀"]').attributes('aria-label')).not.toBe('😀')
  })
}

const search = async (wrapper: ReturnType<typeof mountSelector>, text: string) => {
  await wrapper.find('input').setValue(text)
  await flushPromises()
}
const shown = (wrapper: ReturnType<typeof mountSelector>) => wrapper.findAll('[data-emoji]').map((b) => b.attributes('data-emoji'))

describe('MEmojiSelector', () => {
  beforeEach(() => localStorage.clear())

  it('groups emoji under localized category headers with a tab each', () => {
    const wrapper = mountSelector()
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(11)
    expect(wrapper.findAll('section h3').map((h) => h.text())[0]).toBe('Smileys')
  })

  it('labels each emoji with its name', async () => {
    const wrapper = mountSelector()
    await namesLoaded(wrapper)
    expect(wrapper.find('[data-emoji="😀"]').attributes('aria-label')).toBe('Grinning face')
  })

  it('searches by name and keyword', async () => {
    const wrapper = mountSelector()
    await namesLoaded(wrapper)
    await search(wrapper, 'heart')
    expect(shown(wrapper)).toContain('❤️')
    await search(wrapper, 'pizza')
    expect(shown(wrapper)[0]).toBe('🍕')
  })

  it('searches in the app language, ignoring accents, and in English too', async () => {
    const wrapper = mountSelector({}, esLocale)
    await namesLoaded(wrapper)
    expect(wrapper.find('[data-emoji="😀"]').attributes('aria-label')).toBe('Cara sonriendo')
    await search(wrapper, 'corazon')
    expect(shown(wrapper)).toContain('❤️')
    await search(wrapper, 'pizza')
    expect(shown(wrapper)).toContain('🍕')
    await search(wrapper, 'grinning')
    await vi.waitFor(() => expect(shown(wrapper)).toContain('😀'))
    expect(wrapper.findAll('section h3').map((h) => h.text())[0]).toBe('Buscar emoji')
  })

  it('says so when nothing matches', async () => {
    const wrapper = mountSelector()
    await namesLoaded(wrapper)
    await search(wrapper, 'zzzzqqq')
    expect(wrapper.text()).toContain('No emoji found')
  })

  it('emits the emoji and shows it first under Recently used', async () => {
    const wrapper = mountSelector()
    await wrapper.find('[data-emoji="🍕"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['🍕'])
    await nextTick()
    expect(wrapper.findAll('section h3')[0]!.text()).toBe('Recently used')
    expect(shown(wrapper)[0]).toBe('🍕')
    expect(JSON.parse(localStorage.getItem('m3-emoji-recent')!)).toEqual(['🍕'])
  })

  it('recent can be turned off', async () => {
    const wrapper = mountSelector({ recent: false })
    await wrapper.find('[data-emoji="🍕"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('section h3')[0]!.text()).toBe('Smileys')
  })

  it('a right click on an emoji that takes skin tones offers them, and the choice sticks', async () => {
    const wrapper = mountSelector({ recent: false })
    await wrapper.find('[data-emoji="👍"]').trigger('contextmenu')
    const options = wrapper.findAll('[data-tone-option]')
    expect(options.map((o) => o.text())).toEqual(['👍', '👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿'])
    await options[3]!.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['👍🏽'])
    // Every emoji that takes a tone now shows the chosen one.
    expect(wrapper.find(`[data-emoji="${withSkinTone('👋', 3)}"]`).exists()).toBe(true)
    expect(localStorage.getItem('m3-emoji-tone')).toBe('3')
  })

  it('emoji without skin tones open nothing on right click', async () => {
    const wrapper = mountSelector()
    await wrapper.find('[data-emoji="🍕"]').trigger('contextmenu')
    expect(wrapper.find('[data-tone-picker]').exists()).toBe(false)
  })

  it('handles the emoji with a variation selector (☝️ → ☝🏽)', () => {
    expect(withSkinTone('☝️', 3)).toBe('☝🏽')
    expect(withSkinTone('🕵️‍♀️', 1)).toBe('🕵🏻‍♀️')
    expect(withSkinTone('🍕', 3)).toBe('🍕')
  })

  it('arrow keys move through the grid and Enter picks', async () => {
    const wrapper = mountSelector({ recent: false })
    const first = wrapper.find('[data-emoji="😀"]').element as HTMLElement
    expect(first.tabIndex).toBe(0)
    first.focus()
    await wrapper.find('[data-emoji="😀"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement?.getAttribute('data-emoji')).toBe('😃')
    ;(document.activeElement as HTMLElement).click()
    expect(wrapper.emitted('select')?.[0]).toEqual(['😃'])
  })

  it('ArrowDown from the search field goes to the first emoji', async () => {
    const wrapper = mountSelector({ recent: false })
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-emoji')).toBe('😀')
  })

  it('shows only the requested categories', () => {
    const wrapper = mountSelector({ categories: ['food', 'flags'] })
    expect(wrapper.findAll('section h3').map((h) => h.text())).toEqual(['Food & drink', 'Flags'])
  })
})
