import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import MVideoPlayer from '../components/MVideoPlayer.vue'
import { useMediaPlayer } from '../composables/useMediaPlayer'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const surface = (w: ReturnType<typeof mount>) => w.find('.absolute.inset-0[class="absolute inset-0"]').element as HTMLElement
const pointer = (type: string, x: number, pointerType = 'touch') =>
  new PointerEvent(type, { clientX: x, clientY: 100, pointerId: 1, button: 0, pointerType, bubbles: true })
const key = (w: ReturnType<typeof mount>, k: string) => w.element.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

// A clock "video" through #media, so nothing depends on happy-dom's media elements
function clockPlayer(props: Record<string, unknown> = {}) {
  return mount(MVideoPlayer, {
    props: { duration: 100, ...props },
    slots: { media: (p: { time: number }) => h('div', { class: 'scene' }, `t=${p.time.toFixed(1)}`) },
    attachTo: document.body,
  })
}

describe('MVideoPlayer', () => {
  it('renders a video with its sources and subtitle tracks', () => {
    const w = mount(MVideoPlayer, {
      props: {
        sources: [{ src: '/a.webm', type: 'video/webm' }, { src: '/a.mp4', type: 'video/mp4' }],
        poster: '/p.jpg',
        tracks: [{ src: '/es.vtt', srclang: 'es', label: 'Español' }],
      },
    })
    const video = w.find('video')
    expect(video.attributes('poster')).toBe('/p.jpg')
    expect(video.attributes('playsinline')).toBeDefined()
    expect(w.findAll('source').map((s) => s.attributes('src'))).toEqual(['/a.webm', '/a.mp4'])
    expect(w.find('track').attributes('srclang')).toBe('es')
    expect(w.find('[aria-label="Subtitles"]').exists()).toBe(true)
  })

  it('passes the clock to #media and plays it', async () => {
    vi.useFakeTimers()
    const w = clockPlayer()
    expect(w.find('.scene').text()).toBe('t=0.0')
    await w.find('[aria-label="Play"]').trigger('click')
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(w.emitted('update:playing')![0]).toEqual([true])
    expect(Number(w.find('.scene').text().slice(2))).toBeGreaterThan(1.5)
    expect(w.find('video').exists()).toBe(false)
  })

  it('keys: K plays and pauses, L and J skip, digits jump to a tenth', async () => {
    const w = clockPlayer()
    key(w, 'k')
    await nextTick()
    expect(w.emitted('update:playing')!.at(-1)).toEqual([true])
    key(w, 'k')
    await nextTick()
    expect(w.emitted('update:playing')!.at(-1)).toEqual([false])
    key(w, 'l')
    await nextTick()
    expect(w.emitted('update:currentTime')!.at(-1)).toEqual([10])
    key(w, 'j')
    key(w, 'j')
    await nextTick()
    expect(w.emitted('update:currentTime')!.at(-1)).toEqual([0])
    key(w, '7')
    await nextTick()
    expect(w.emitted('update:currentTime')!.at(-1)).toEqual([70])
  })

  it('a double tap on a side skips, and further taps add up', async () => {
    vi.useFakeTimers()
    const w = clockPlayer({ currentTime: 50 })
    await nextTick()
    const el = surface(w)
    const tap = (x: number) => {
      el.dispatchEvent(pointer('pointerdown', x))
      el.dispatchEvent(pointer('pointerup', x))
      vi.advanceTimersByTime(100)
    }
    tap(600)
    tap(600)
    await nextTick()
    expect(w.emitted('update:currentTime')!.at(-1)).toEqual([60])
    tap(600)
    await nextTick()
    expect(w.emitted('update:currentTime')!.at(-1)).toEqual([70])
    expect(w.text()).toContain('20 seconds')
    vi.advanceTimersByTime(1500)
    tap(20)
    tap(20)
    await nextTick()
    expect(w.emitted('update:currentTime')!.at(-1)).toEqual([60])
  })

  it('a single tap hides and shows the controls while playing', async () => {
    vi.useFakeTimers()
    const w = clockPlayer({ playing: true })
    await flushPromises()
    expect(w.find('[aria-label="Pause"]').exists()).toBe(true)
    const el = surface(w)
    el.dispatchEvent(pointer('pointerdown', 320))
    el.dispatchEvent(pointer('pointerup', 320))
    vi.advanceTimersByTime(300)
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    expect(w.find('[aria-label="Pause"]').exists()).toBe(false)
    el.dispatchEvent(pointer('pointerdown', 320))
    el.dispatchEvent(pointer('pointerup', 320))
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(w.find('[aria-label="Pause"]').exists()).toBe(true)
  })

  it('a long press plays at 2× until released', async () => {
    vi.useFakeTimers()
    const w = clockPlayer({ playing: true, rate: 1.25 })
    await flushPromises()
    const el = surface(w)
    el.dispatchEvent(pointer('pointerdown', 320))
    vi.advanceTimersByTime(600)
    await nextTick()
    expect(w.emitted('update:rate')!.at(-1)).toEqual([2])
    expect(w.text()).toContain('2×')
    el.dispatchEvent(pointer('pointerup', 320))
    await nextTick()
    expect(w.emitted('update:rate')!.at(-1)).toEqual([1.25])
    // The release doesn't also count as a tap
    expect(w.emitted('update:playing')!.at(-1)).toEqual([true])
  })

  it('a mouse click plays and pauses', async () => {
    const w = clockPlayer()
    const el = surface(w)
    el.dispatchEvent(pointer('pointerdown', 320, 'mouse'))
    el.dispatchEvent(pointer('pointerup', 320, 'mouse'))
    await nextTick()
    expect(w.emitted('update:playing')!.at(-1)).toEqual([true])
  })

  it('shows previous and next only when asked, and emits them', async () => {
    const w = clockPlayer()
    expect(w.find('[aria-label="Previous"]').exists()).toBe(false)
    await w.setProps({ hasPrevious: true, hasNext: true })
    await w.find('[aria-label="Previous"]').trigger('click')
    await w.find('[aria-label="Next"]').trigger('click')
    expect(w.emitted('previous')).toHaveLength(1)
    expect(w.emitted('next')).toHaveLength(1)
  })

  it('drives an external player and its previous/next', async () => {
    const onNext = vi.fn()
    const player = useMediaPlayer({ duration: 40, onNext })
    const w = mount(MVideoPlayer, {
      props: { player },
      slots: { media: (p: { time: number }) => h('div', { class: 'scene' }, String(p.time)) },
    })
    player.seek(12)
    await nextTick()
    expect(w.find('.scene').text()).toBe('12')
    await w.find('[aria-label="Next"]').trigger('click')
    expect(onNext).toHaveBeenCalled()
  })

  it('loads hls.js for an .m3u8 the browser cannot play', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('')
    const instance = { loadSource: vi.fn(), attachMedia: vi.fn(), destroy: vi.fn(), on: vi.fn(), levels: [], currentLevel: -1 }
    class Hls {
      static isSupported = () => true
      static Events = { MANIFEST_PARSED: 'hlsManifestParsed' }
      constructor() { return instance }
    }
    const loader = vi.fn(async () => ({ default: Hls as never }))
    const w = mount(MVideoPlayer, { props: { src: 'https://x.test/live/index.m3u8', hls: loader } })
    await flushPromises()
    expect(loader).toHaveBeenCalled()
    expect(instance.loadSource).toHaveBeenCalledWith('https://x.test/live/index.m3u8')
    expect(instance.attachMedia).toHaveBeenCalledWith(w.find('video').element)
    expect(w.findAll('source')).toHaveLength(0)
    w.unmount()
    expect(instance.destroy).toHaveBeenCalled()
  })

  it('forwards attrs to its root', () => {
    const w = mount(MVideoPlayer, { props: { duration: 1 }, attrs: { class: 'rounded-xl', 'data-x': '1' } })
    expect(w.classes()).toContain('rounded-xl')
    // position: relative comes from @layer base (.m3-video-player), so a consumer's `absolute` wins
    expect(w.classes()).not.toContain('relative')
    expect(w.attributes('data-x')).toBe('1')
  })
})
