import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref, type WritableComputedRef } from 'vue'

/** What the lock screen and the system's media notification show (the Media Session API's metadata) */
export interface MediaPlayerMetadata {
  title?: string
  artist?: string
  album?: string
  /** Cover images, largest last is fine: `[{ src, sizes: '512x512', type: 'image/png' }]` or plain URLs */
  artwork?: (string | { src: string; sizes?: string; type?: string })[]
}

export interface MediaPlayerOptions {
  /**
   * The `<audio>` or `<video>` element to drive (a ref or a getter; it may come and go). Without one the player
   * runs its own clock over `duration`: for anything that isn't a media file (a canvas, a shader, generated audio)
   * that should still play, pause, seek and change speed like one.
   */
  media?: MaybeRefOrGetter<HTMLMediaElement | null | undefined>
  /** The length in seconds, for the clock (without `media`) */
  duration?: MaybeRefOrGetter<number | undefined>
  /** Shown on the lock screen and the system's media notification while this player plays (Media Session API) */
  metadata?: MaybeRefOrGetter<MediaPlayerMetadata | null | undefined>
  /** The previous button (and the lock screen's); without it there is none */
  onPrevious?: () => void
  /** The next button (and the lock screen's); without it there is none */
  onNext?: () => void
  /** Whether there is a previous item right now (the first of a playlist has none). Default: `onPrevious` was given */
  hasPrevious?: MaybeRefOrGetter<boolean>
  /** Whether there is a next item right now. Default: `onNext` was given */
  hasNext?: MaybeRefOrGetter<boolean>
  /** Seconds `skip()` and the lock screen's seek buttons move by default. Default 10 */
  seekStep?: number
  /** The clock starts over at the end instead of stopping (with `media`, set the element's `loop`) */
  loop?: MaybeRefOrGetter<boolean | undefined>
}

export interface MediaPlayer {
  /** The media element being driven, or null (clock, or not mounted yet) */
  media: Readonly<Ref<HTMLMediaElement | null>>
  /** Playing or paused; writing it plays or pauses */
  playing: WritableComputedRef<boolean>
  /** Position in seconds; writing it seeks */
  currentTime: WritableComputedRef<number>
  /** Length in seconds: 0 until known, Infinity for a live stream */
  duration: Readonly<Ref<number>>
  /** Loaded time ranges, `[[start, end], …]` (the clock reports all of it) */
  buffered: Readonly<Ref<[number, number][]>>
  /** Playback speed; writing it changes it */
  rate: WritableComputedRef<number>
  /** Volume, 0 to 1; writing it changes it */
  volume: WritableComputedRef<number>
  /** Muted; writing it mutes or unmutes */
  muted: WritableComputedRef<boolean>
  /** Stalled for data (a spinner's moment). Writable for the clock, to simulate buffering: it stops advancing meanwhile */
  waiting: Ref<boolean>
  /** Reached the end; `play()` or `toggle()` start over */
  ended: Readonly<Ref<boolean>>
  /** A live stream (infinite duration): no seeking */
  live: Readonly<Ref<boolean>>
  /** The media element's error, if loading or decoding failed */
  error: Readonly<Ref<MediaError | null>>
  /** The browser refused to start playing (autoplay with sound before any user gesture) */
  blocked: Readonly<Ref<boolean>>
  /** Whether there is a previous / next item (see the options of the same names) */
  hasPrevious: Readonly<Ref<boolean>>
  hasNext: Readonly<Ref<boolean>>
  play: () => Promise<void>
  pause: () => void
  toggle: () => Promise<void>
  /** Seeks to a time in seconds (clamped to the media) */
  seek: (time: number) => void
  /** Seeks by an offset in seconds, `seekStep` by default (negative goes back) */
  skip: (seconds?: number) => void
  /** Pauses and goes back to the start */
  stop: () => void
  previous: () => void
  next: () => void
  /**
   * Drives this element instead of the `media` option (null: the clock; undefined: back to `media`). What
   * `MVideoPlayer`/`MAudioPlayer` call with their own element when given a `player`: rate, volume and mute carry over
   */
  attach: (el: HTMLMediaElement | null | undefined) => void
}

const hasWindow = typeof window !== 'undefined'
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// The player that last started playing owns the Media Session (there is one per page)
let sessionOwner: object | null = null

/**
 * The state and controls of something that plays: an `<audio>`/`<video>` element, or a clock of its own for
 * anything else. Everything is reactive, the writable parts (`playing`, `currentTime`, `rate`, `volume`, `muted`)
 * act on the media when written, and the player takes the Media Session while it plays (lock screen and
 * notification controls, with `metadata`). `MVideoPlayer` and `MAudioPlayer` are built on it; pass one to their
 * `player` prop to keep playing across pages, or build a player UI of your own on it.
 *
 * ```ts
 * const audio = ref<HTMLAudioElement>()
 * const player = useMediaPlayer({ media: audio, metadata: () => ({ title: track.value.title }) })
 * // <audio ref="audio" :src="track.src" /> … <button @click="player.toggle()">
 *
 * // A shader "video" 90 seconds long: its time is player.currentTime
 * const clock = useMediaPlayer({ duration: 90 })
 * ```
 */
export function useMediaPlayer(options: MediaPlayerOptions = {}): MediaPlayer {
  const owner = {}
  const step = options.seekStep ?? 10
  const media = shallowRef<HTMLMediaElement | null>(null)
  const attached = shallowRef<HTMLMediaElement | null | undefined>(undefined)

  const playingState = ref(false)
  const time = ref(0)
  const durationState = ref(0)
  const buffered = ref<[number, number][]>([])
  const rateState = ref(1)
  const volumeState = ref(1)
  const mutedState = ref(false)
  const waiting = ref(false)
  const ended = ref(false)
  const error = shallowRef<MediaError | null>(null)
  const blocked = ref(false)
  const live = computed(() => durationState.value === Infinity)

  // ── Clock (no media element) ──────────────────────────────────────────────────────────────────────────
  let raf = 0
  let lastFrame = 0
  const clockDuration = () => {
    const d = toValue(options.duration)
    return d !== undefined && Number.isFinite(d) && d > 0 ? d : 0
  }

  function tick(t: number) {
    raf = 0
    if (media.value || !playingState.value) {
      lastFrame = 0
      return
    }
    const dt = lastFrame ? Math.min(0.25, (t - lastFrame) / 1000) : 0
    lastFrame = t
    if (!waiting.value) {
      const d = durationState.value
      let next = time.value + dt * rateState.value
      if (d && next >= d) {
        if (toValue(options.loop)) next %= d
        else {
          next = d
          playingState.value = false
          ended.value = true
        }
      }
      time.value = next
    }
    if (playingState.value) raf = requestAnimationFrame(tick)
    else lastFrame = 0
  }
  function runClock() {
    if (raf || !hasWindow || media.value || !playingState.value) return
    lastFrame = 0
    raf = requestAnimationFrame(tick)
  }
  watch(() => (media.value ? null : clockDuration()), (d) => {
    if (d === null) return
    durationState.value = d
    buffered.value = d ? [[0, d]] : []
    if (d && time.value > d) time.value = d
  }, { immediate: true })

  // ── Media element ─────────────────────────────────────────────────────────────────────────────────────
  function readRanges(el: HTMLMediaElement) {
    const out: [number, number][] = []
    const r = el.buffered
    for (let i = 0; i < (r?.length ?? 0); i++) out.push([r.start(i), r.end(i)])
    buffered.value = out
  }
  function readAll(el: HTMLMediaElement) {
    playingState.value = !el.paused && !el.ended
    time.value = el.currentTime || 0
    durationState.value = Number.isNaN(el.duration) ? 0 : el.duration
    rateState.value = el.playbackRate || 1
    volumeState.value = el.volume
    mutedState.value = el.muted
    ended.value = el.ended
    error.value = el.error
    readRanges(el)
  }

  const handlers: Record<string, (el: HTMLMediaElement) => void> = {
    play: () => { playingState.value = true; ended.value = false; blocked.value = false; claimSession() },
    playing: () => { playingState.value = true; waiting.value = false },
    pause: () => { playingState.value = false },
    waiting: () => { waiting.value = true },
    canplay: () => { waiting.value = false },
    seeked: (el) => { time.value = el.currentTime; waiting.value = false; syncPosition() },
    timeupdate: (el) => { time.value = el.currentTime },
    durationchange: (el) => { durationState.value = Number.isNaN(el.duration) ? 0 : el.duration; syncPosition() },
    loadedmetadata: (el) => readAll(el),
    progress: (el) => readRanges(el),
    ratechange: (el) => { rateState.value = el.playbackRate; syncPosition() },
    volumechange: (el) => { volumeState.value = el.volume; mutedState.value = el.muted },
    ended: () => { ended.value = true; playingState.value = false },
    error: (el) => { error.value = el.error; waiting.value = false; playingState.value = false },
    emptied: (el) => { readAll(el); waiting.value = false },
  }
  const listeners = new Map<string, EventListener>()

  watch(() => (attached.value !== undefined ? attached.value : toValue(options.media)) ?? null, (el, old) => {
    if (old) for (const [type, fn] of listeners) old.removeEventListener(type, fn)
    listeners.clear()
    media.value = el
    if (!el) {
      ended.value = false
      waiting.value = false
      return
    }
    cancelAnimationFrame(raf)
    raf = 0
    // A volume, rate or mute set before the element came keeps applying to it
    el.playbackRate = rateState.value
    el.volume = volumeState.value
    if (mutedState.value) el.muted = true
    // So does a position set before it (a start time): a fresh element starts there
    if (time.value > 0 && !el.currentTime) el.currentTime = time.value
    for (const [type, fn] of Object.entries(handlers)) {
      const l = () => fn(el)
      listeners.set(type, l)
      el.addEventListener(type, l)
    }
    readAll(el)
  }, { immediate: true })

  // ── Actions ───────────────────────────────────────────────────────────────────────────────────────────
  async function play() {
    const el = media.value
    if (ended.value) seek(0)
    ended.value = false
    if (!el) {
      playingState.value = true
      claimSession()
      runClock()
      return
    }
    try {
      await el.play()
    } catch (e) {
      // Autoplay with sound before a user gesture; a newer load() or pause() interrupting play() is no failure
      if ((e as DOMException)?.name === 'NotAllowedError') blocked.value = true
      playingState.value = !el.paused
    }
  }
  function pause() {
    if (media.value) media.value.pause()
    else playingState.value = false
  }
  const toggle = () => (playingState.value ? (pause(), Promise.resolve()) : play())

  function seek(t: number) {
    if (live.value) return
    const d = durationState.value
    const target = Math.max(0, d ? Math.min(d, t) : t)
    if (target < d) ended.value = false
    time.value = target
    const el = media.value
    if (el) {
      // fastSeek is cheaper but lands on a keyframe: only worth it mid-scrub, so seek precisely
      el.currentTime = target
    }
    syncPosition()
  }
  const skip = (s: number = step) => seek(time.value + s)
  function stop() {
    pause()
    seek(0)
  }

  watch(playingState, (on) => {
    if (on) runClock()
    if (sessionOwner === owner && hasWindow && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = on ? 'playing' : 'paused'
    }
  })

  // ── Media Session ─────────────────────────────────────────────────────────────────────────────────────
  const session = () => (hasWindow && 'mediaSession' in navigator ? navigator.mediaSession : null)

  function setMetadata() {
    const s = session()
    const m = toValue(options.metadata)
    if (!s || sessionOwner !== owner || typeof MediaMetadata === 'undefined') return
    s.metadata = m
      ? new MediaMetadata({
          title: m.title ?? '',
          artist: m.artist ?? '',
          album: m.album ?? '',
          artwork: (m.artwork ?? []).map((a) => (typeof a === 'string' ? { src: a } : a)),
        })
      : null
  }

  function syncPosition() {
    const s = session()
    const d = durationState.value
    if (!s || sessionOwner !== owner || !s.setPositionState) return
    try {
      if (d && Number.isFinite(d)) s.setPositionState({ duration: d, playbackRate: rateState.value, position: Math.min(d, time.value) })
      else s.setPositionState()
    } catch { /* a rate the browser rejects, say */ }
  }

  function setAction(s: MediaSession, action: MediaSessionAction, fn: MediaSessionActionHandler | null) {
    try { s.setActionHandler(action, fn) } catch { /* an action this browser doesn't know */ }
  }

  function claimSession() {
    const s = session()
    if (!s || options.metadata === undefined) return
    sessionOwner = owner
    setMetadata()
    setAction(s, 'play', () => { play() })
    setAction(s, 'pause', () => pause())
    setAction(s, 'stop', () => stop())
    setAction(s, 'seekbackward', (d) => skip(-(d.seekOffset ?? step)))
    setAction(s, 'seekforward', (d) => skip(d.seekOffset ?? step))
    setAction(s, 'seekto', (d) => { if (d.seekTime !== undefined) seek(d.seekTime) })
    setAction(s, 'previoustrack', options.onPrevious ? () => options.onPrevious!() : null)
    setAction(s, 'nexttrack', options.onNext ? () => options.onNext!() : null)
    s.playbackState = playingState.value ? 'playing' : 'paused'
    syncPosition()
  }
  if (options.metadata !== undefined) watch(() => toValue(options.metadata), setMetadata, { deep: true })

  function releaseSession() {
    const s = session()
    if (!s || sessionOwner !== owner) return
    sessionOwner = null
    s.metadata = null
    s.playbackState = 'none'
    for (const a of ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as MediaSessionAction[]) setAction(s, a, null)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      cancelAnimationFrame(raf)
      const el = media.value
      if (el) for (const [type, fn] of listeners) el.removeEventListener(type, fn)
      releaseSession()
    })
  }

  // ── Writable state ────────────────────────────────────────────────────────────────────────────────────
  const playing = computed({
    get: () => playingState.value,
    set: (v) => { if (v !== playingState.value) v ? play() : pause() },
  })
  const currentTime = computed({ get: () => time.value, set: (t) => seek(t) })
  const rate = computed({
    get: () => rateState.value,
    set: (r) => {
      rateState.value = r
      if (media.value) media.value.playbackRate = r
      syncPosition()
    },
  })
  const volume = computed({
    get: () => volumeState.value,
    set: (v) => {
      volumeState.value = Math.min(1, Math.max(0, v))
      if (media.value) media.value.volume = volumeState.value
    },
  })
  const muted = computed({
    get: () => mutedState.value,
    set: (m) => {
      mutedState.value = m
      if (media.value) media.value.muted = m
    },
  })

  return {
    media,
    playing,
    currentTime,
    duration: durationState,
    buffered,
    rate,
    volume,
    muted,
    waiting,
    ended,
    live,
    error,
    blocked,
    hasPrevious: computed(() => !!options.onPrevious && (toValue(options.hasPrevious) ?? true)),
    hasNext: computed(() => !!options.onNext && (toValue(options.hasNext) ?? true)),
    play,
    pause,
    toggle,
    seek,
    skip,
    stop,
    previous: () => options.onPrevious?.(),
    next: () => options.onNext?.(),
    attach: (el) => { attached.value = el },
  }
}
