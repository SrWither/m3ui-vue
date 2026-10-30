import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MAudioPlayer from '../components/MAudioPlayer.vue'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('MAudioPlayer', () => {
  it('mini: artwork, text, play/pause, and a click outside the buttons', async () => {
    const w = mount(MAudioPlayer, { props: { variant: 'mini', duration: 60, title: 'Song', artist: 'Band', artwork: '/c.png' } })
    expect(w.find('img').attributes('src')).toBe('/c.png')
    expect(w.text()).toContain('Song')
    expect(w.text()).toContain('Band')
    await w.find('[aria-label="Play"]').trigger('click')
    expect(w.emitted('update:playing')![0]).toEqual([true])
    expect(w.emitted('click')).toBeUndefined()
    await w.find('p').trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('mini: the progress line follows the position', async () => {
    const w = mount(MAudioPlayer, { props: { variant: 'mini', duration: 200, currentTime: 50 } })
    await nextTick()
    expect(w.find('.origin-left').attributes('style')).toContain('scaleX(0.25)')
  })

  it('standard: shuffle and repeat only when bound, repeat cycles off → all → one', async () => {
    const w = mount(MAudioPlayer, { props: { duration: 60 } })
    expect(w.find('[aria-label="Shuffle"]').exists()).toBe(false)
    expect(w.find('[aria-label="Repeat"]').exists()).toBe(false)
    await w.setProps({ shuffle: false, repeat: 'off' })
    await w.find('[aria-label="Shuffle"]').trigger('click')
    expect(w.emitted('update:shuffle')![0]).toEqual([true])
    await w.find('[aria-label="Repeat"]').trigger('click')
    expect(w.emitted('update:repeat')![0]).toEqual(['all'])
    await w.setProps({ repeat: 'all' })
    await w.find('[aria-label="Repeat"]').trigger('click')
    expect(w.emitted('update:repeat')![1]).toEqual(['one'])
    await w.setProps({ repeat: 'one' })
    expect(w.find('[aria-label="Repeat one"]').exists()).toBe(true)
  })

  it('emits previous and next; without one its button stays in place, disabled', async () => {
    const w = mount(MAudioPlayer, { props: { duration: 60, hasNext: true } })
    expect(w.find('[aria-label="Previous"]').attributes('disabled')).toBeDefined()
    expect(w.find('[aria-label="Next"]').attributes('disabled')).toBeUndefined()
    await w.find('[aria-label="Next"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
  })

  it('plays a file in a hidden audio element, looping with repeat one', () => {
    const w = mount(MAudioPlayer, { props: { src: '/s.mp3', repeat: 'one' } })
    const audio = w.find('audio')
    expect(audio.find('source').attributes('src')).toBe('/s.mp3')
    expect((audio.element as HTMLAudioElement).loop).toBe(true)
  })

  it('a new track keeps playing', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const w = mount(MAudioPlayer, { props: { src: '/a.mp3' } })
    const el = w.find('audio').element
    Object.defineProperty(el, 'paused', { value: false, configurable: true })
    el.dispatchEvent(new Event('play'))
    play.mockClear()
    await w.setProps({ src: '/b.mp3' })
    await nextTick()
    expect(play).toHaveBeenCalled()
  })
})
