import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MTypewriter from '../components/MTypewriter.vue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const typed = (w: ReturnType<typeof mount>) => w.find('[aria-hidden="true"]').element.textContent
const opts = { typeSpeed: 10, deleteSpeed: 5, pause: 100, startDelay: 0, humanize: false, startOnVisible: false }

describe('MTypewriter', () => {
  it('types a phrase out, one grapheme at a time', async () => {
    const w = mount(MTypewriter, { props: { text: 'Hola 👋🏽', ...opts } })
    await vi.advanceTimersByTimeAsync(0)
    expect(typed(w)).toBe('H')
    await vi.advanceTimersByTimeAsync(30)
    expect(typed(w)).toBe('Hola')
    // The waving hand with its skin tone is one keystroke
    await vi.advanceTimersByTimeAsync(20)
    expect(typed(w)).toBe('Hola 👋🏽')
    await vi.advanceTimersByTimeAsync(10)
    expect(w.emitted('typed')).toEqual([[0]])
  })

  it('erases only the end that differs, then types the next phrase, in a loop', async () => {
    const w = mount(MTypewriter, { props: { text: ['build faster', 'build better'], ...opts } })
    await vi.advanceTimersByTimeAsync(12 * 10 + 1)
    expect(typed(w)).toBe('build faster')
    await vi.advanceTimersByTimeAsync(100 + 6 * 5)
    expect(typed(w)).toBe('build ')
    await vi.advanceTimersByTimeAsync(30 + 6 * 10)
    expect(typed(w)).toBe('build better')
    await vi.advanceTimersByTimeAsync(100 + 6 * 5 + 30 + 6 * 10)
    expect(typed(w)).toBe('build faster')
  })

  it('stops on the last phrase without loop and emits done', async () => {
    const w = mount(MTypewriter, { props: { text: ['a', 'b'], loop: false, ...opts } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(typed(w)).toBe('b')
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('gives screen readers every phrase once', async () => {
    const w = mount(MTypewriter, { props: { text: ['one', 'two'], ...opts } })
    await nextTick()
    expect(w.find('.sr-only').text()).toBe('one, two')
  })
})
