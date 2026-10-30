import { describe, it, expect, afterEach, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useMediaPlayer, type MediaPlayerOptions } from '../composables/useMediaPlayer'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'mediaSession')
})

function setup(options: MediaPlayerOptions) {
  const scope = effectScope()
  const player = scope.run(() => useMediaPlayer(options))!
  return { player, stop: () => scope.stop() }
}

// A media element whose play() resolves (or rejects) and fires the events a browser would
function fakeMedia(opts: { block?: boolean } = {}) {
  const el = document.createElement('video')
  let paused = true
  Object.defineProperty(el, 'paused', { get: () => paused })
  Object.defineProperty(el, 'duration', { value: 120, configurable: true })
  el.play = vi.fn(async () => {
    if (opts.block) throw new DOMException('blocked', 'NotAllowedError')
    paused = false
    el.dispatchEvent(new Event('play'))
    el.dispatchEvent(new Event('playing'))
  })
  el.pause = vi.fn(() => {
    paused = true
    el.dispatchEvent(new Event('pause'))
  })
  return el
}

describe('useMediaPlayer — clock', () => {
  it('advances while playing, at the rate, and stops at the end', async () => {
    vi.useFakeTimers()
    const { player } = setup({ duration: 10 })
    expect(player.duration.value).toBe(10)
    await player.play()
    vi.advanceTimersByTime(1000)
    expect(player.currentTime.value).toBeGreaterThan(0.8)
    expect(player.currentTime.value).toBeLessThan(1.2)

    player.rate.value = 2
    const before = player.currentTime.value
    vi.advanceTimersByTime(1000)
    expect(player.currentTime.value - before).toBeGreaterThan(1.7)

    vi.advanceTimersByTime(10000)
    expect(player.currentTime.value).toBe(10)
    expect(player.playing.value).toBe(false)
    expect(player.ended.value).toBe(true)

    // Playing again starts over
    await player.play()
    expect(player.ended.value).toBe(false)
    expect(player.currentTime.value).toBeLessThan(1)
  })

  it("doesn't advance while waiting, and loops with loop", async () => {
    vi.useFakeTimers()
    const { player } = setup({ duration: 4, loop: true })
    await player.play()
    player.waiting.value = true
    vi.advanceTimersByTime(1000)
    expect(player.currentTime.value).toBe(0)
    player.waiting.value = false
    vi.advanceTimersByTime(5000)
    expect(player.playing.value).toBe(true)
    expect(player.currentTime.value).toBeLessThan(4)
  })

  it('seek and skip clamp to the media', () => {
    const { player } = setup({ duration: 30 })
    player.skip()
    expect(player.currentTime.value).toBe(10)
    player.skip(-25)
    expect(player.currentTime.value).toBe(0)
    player.currentTime.value = 99
    expect(player.currentTime.value).toBe(30)
  })
})

describe('useMediaPlayer — media element', () => {
  it('mirrors the element and acts on it', async () => {
    const el = fakeMedia()
    const media = ref<HTMLMediaElement | null>(el)
    const { player } = setup({ media })
    expect(player.duration.value).toBe(120)

    await player.play()
    expect(el.play).toHaveBeenCalled()
    expect(player.playing.value).toBe(true)

    player.currentTime.value = 30
    expect(el.currentTime).toBe(30)
    player.rate.value = 1.5
    expect(el.playbackRate).toBe(1.5)
    player.muted.value = true
    expect(el.muted).toBe(true)

    el.dispatchEvent(new Event('waiting'))
    expect(player.waiting.value).toBe(true)
    el.dispatchEvent(new Event('playing'))
    expect(player.waiting.value).toBe(false)

    player.playing.value = false
    expect(el.pause).toHaveBeenCalled()
    expect(player.playing.value).toBe(false)
  })

  it('a position set before the element exists is where it starts', async () => {
    const media = ref<HTMLMediaElement | null>(null)
    const { player } = setup({ media })
    player.seek(105)
    const el = fakeMedia()
    media.value = el
    await nextTick()
    expect(el.currentTime).toBe(105)
    expect(player.currentTime.value).toBe(105)
  })

  it('reports a blocked autoplay', async () => {
    const { player } = setup({ media: fakeMedia({ block: true }) })
    await player.play()
    expect(player.blocked.value).toBe(true)
    expect(player.playing.value).toBe(false)
  })

  it('carries rate and volume over to an attached element', async () => {
    const { player } = setup({ duration: 60 })
    player.rate.value = 2
    player.volume.value = 0.3
    const el = fakeMedia()
    player.attach(el)
    await nextTick()
    expect(player.media.value).toBe(el)
    expect(el.playbackRate).toBe(2)
    expect(el.volume).toBeCloseTo(0.3)
    expect(player.duration.value).toBe(120)
    player.attach(undefined)
    await nextTick()
    expect(player.media.value).toBe(null)
    expect(player.duration.value).toBe(60)
  })
})

describe('useMediaPlayer — Media Session', () => {
  it('takes the session while playing: metadata, handlers and position', async () => {
    const handlers: Record<string, ((d: MediaSessionActionDetails) => void) | null> = {}
    const session = {
      metadata: null as unknown,
      playbackState: 'none',
      setActionHandler: (a: string, fn: ((d: MediaSessionActionDetails) => void) | null) => { handlers[a] = fn },
      setPositionState: vi.fn(),
    }
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true })
    vi.stubGlobal('MediaMetadata', class { constructor(public init: MediaMetadataInit) {} })
    const onNext = vi.fn()
    const { player, stop } = setup({ duration: 100, metadata: { title: 'Song', artist: 'Band', artwork: ['/a.png'] }, onNext })

    await player.play()
    expect((session.metadata as { init: MediaMetadataInit }).init).toMatchObject({ title: 'Song', artist: 'Band', artwork: [{ src: '/a.png' }] })
    expect(session.playbackState).toBe('playing')
    expect(session.setPositionState).toHaveBeenCalledWith({ duration: 100, playbackRate: 1, position: 0 })

    handlers.seekforward!({ action: 'seekforward' })
    expect(player.currentTime.value).toBe(10)
    handlers.seekto!({ action: 'seekto', seekTime: 42 })
    expect(player.currentTime.value).toBe(42)
    handlers.nexttrack!({ action: 'nexttrack' })
    expect(onNext).toHaveBeenCalled()
    expect(handlers.previoustrack).toBeNull()

    stop()
    expect(session.metadata).toBeNull()
    expect(handlers.play).toBeNull()
    vi.unstubAllGlobals()
  })
})
