<script lang="ts">
import type { MediaPlayer } from '../composables/useMediaPlayer'

export interface VideoSource {
  src: string
  /** MIME type, e.g. `video/webm` or `application/vnd.apple.mpegurl` (HLS) */
  type?: string
}

export interface VideoTrack {
  /** WebVTT file */
  src: string
  /** Language code, e.g. `es` */
  srclang: string
  /** Shown in the subtitles menu */
  label: string
  /** Shown from the start */
  default?: boolean
  /** Default `subtitles` */
  kind?: 'subtitles' | 'captions'
}

/** The bits of hls.js the player uses, so the library doesn't depend on it */
export interface HlsLike {
  loadSource(src: string): void
  attachMedia(el: HTMLMediaElement): void
  destroy(): void
  on(event: string, fn: (...args: any[]) => void): void
  levels: { height?: number; bitrate?: number }[]
  currentLevel: number
}
export interface HlsModule {
  default: { new (config?: Record<string, unknown>): HlsLike; isSupported(): boolean; Events: Record<string, string> }
}

/** What the control slots receive */
export interface VideoPlayerSlotProps {
  player: MediaPlayer
  /** The controls are showing (slots usually fade with them) */
  shown: boolean
  fullscreen: boolean
  /** The player is narrower than 480px (a phone in portrait) */
  compact: boolean
}
</script>

<script setup lang="ts">
/**
 * A video player (not an M3 spec component: a port of Media3's Compose Material3 `Player`, androidx/media
 * `ui_compose_material3`): controls in three slots like Media3's, top (empty, the title in full screen), center
 * (previous, back, a large play/pause, forward, next, centered on the picture) and bottom (an `MSeekBar`, the time
 * and chapter, volume, subtitles, settings, picture in picture and full screen). Unlike Media3's they keep a dark
 * scrim and white content in both themes, as they sit on the picture; the play button is primary-container, a
 * circle while paused that squares off while playing. Controls hide while playing after `hideDelay`.
 * A click plays/pauses and a double click goes full screen; on touch a tap shows or hides the controls, a double
 * tap on either side skips (taps add up), and a long press plays at 2× while held. Keys (with the player
 * focused): Space/K, J/L, arrows, F, M, C, 0–9, Home/End, `<`/`>`.
 *
 * Plays `src`/`sources` in a `<video>`, or anything else through `#media` over a clock of `duration` seconds.
 * HLS (`.m3u8`) plays natively where the browser can; elsewhere pass `:hls="() => import("hls.js")"`.
 *
 * @slot media Replaces the `<video>` (a canvas, a shader, a 3D scene). Props: `{ time, playing, rate, duration }`
 * @slot top Top controls. Props: `VideoPlayerSlotProps`
 * @slot center Replaces the center controls. Props: `VideoPlayerSlotProps`
 * @slot bottom Replaces the bottom controls. Props: `VideoPlayerSlotProps`
 * @slot settings Extra `MMenuItem`s at the end of the settings menu. Props: `{ player }`
 * @slot end Shown over the video when it ends (an "up next", say). Props: `{ player, replay }`
 * @slot error Replaces the error message. Props: `{ error }`
 * @event previous The previous button (or the lock screen's) was pressed
 * @event next The next button (or the lock screen's) was pressed
 * @event ended The video reached its end
 * @event error The video failed to load or play, with the media element's error
 * @event fullscreen Full screen was entered (true) or left (false)
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { useMediaPlayer } from '../composables/useMediaPlayer'
import { useLocale } from '../composables/useLocale'
import MSeekBar, { type SeekBarChapter } from './MSeekBar.vue'
import MIconButton from './MIconButton.vue'
import MIcon from './MIcon.vue'
import MSlider from './MSlider.vue'
import MMenu from './MMenu.vue'
import MMenuItem from './MMenuItem.vue'
import MLoadingIndicator from './MLoadingIndicator.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Video URL */
  src?: string
  /** Several formats of the video; the browser plays the first it can */
  sources?: VideoSource[]
  /** Image shown before playing */
  poster?: string
  /** Subtitle tracks (WebVTT) */
  tracks?: VideoTrack[]
  /** Chapters, drawn on the seek bar */
  chapters?: SeekBarChapter[]
  /** Shown at the top in full screen, and on the lock screen while playing */
  title?: string
  /** Length in seconds, for `#media` content (with a `<video>` it comes from the file) */
  duration?: number
  /** Drive this player instead of one of its own (from `useMediaPlayer()`, kept outside to survive page changes). Read once */
  player?: MediaPlayer
  /** Playing (v-model) */
  playing?: boolean
  /** Position in seconds (v-model) */
  currentTime?: number
  /** Playback speed (v-model) */
  rate?: number
  /** Volume, 0 to 1 (v-model) */
  volume?: number
  /** Muted (v-model) */
  muted?: boolean
  /** Starts playing when mounted; muted if the browser blocks sound before a user gesture */
  autoplay?: boolean
  /** Starts over at the end */
  loop?: boolean
  /** Shows the controls. Off: just the video and its gestures */
  controls?: boolean
  /** Adds previous and next buttons (emits `previous`); with only one of the two, the other shows disabled */
  hasPrevious?: boolean
  /** Adds previous and next buttons (emits `next`); with only one of the two, the other shows disabled */
  hasNext?: boolean
  /** Seconds the skip buttons, J/L and double taps move */
  seekStep?: number
  /** Speeds offered in the settings menu */
  speeds?: number[]
  /** Box ratio, as CSS `aspect-ratio`; `auto` follows the video */
  aspectRatio?: string
  /** How the video fills the box */
  fit?: 'contain' | 'cover'
  /** Milliseconds without activity before the controls hide while playing */
  hideDelay?: number
  /** Played part of the seek bar: an M3 role or any CSS color */
  color?: string
  /**
   * The video's CORS mode. Subtitles from another origin need `anonymous` (and a video host that allows it, as
   * the `<track>` is fetched in the video's mode)
   */
  crossorigin?: 'anonymous' | 'use-credentials'
  /** Loads hls.js for `.m3u8` where the browser can't play HLS: `() => import("hls.js")` */
  hls?: () => Promise<HlsModule>
}>(), {
  playing: undefined,
  currentTime: undefined,
  rate: undefined,
  volume: undefined,
  muted: undefined,
  autoplay: false,
  loop: false,
  controls: true,
  hasPrevious: false,
  hasNext: false,
  seekStep: 10,
  speeds: () => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  aspectRatio: '16/9',
  fit: 'contain',
  hideDelay: 3000,
  color: 'primary',
})

const emit = defineEmits<{
  'update:playing': [boolean]
  'update:currentTime': [number]
  'update:rate': [number]
  'update:volume': [number]
  'update:muted': [boolean]
  previous: []
  next: []
  ended: []
  error: [MediaError | null]
  fullscreen: [boolean]
}>()

const slots = useSlots()
const locale = useLocale()
const root = ref<HTMLElement>()
const videoEl = ref<HTMLVideoElement>()
const custom = !!slots.media

const player: MediaPlayer = props.player ?? useMediaPlayer({
  media: () => (custom ? null : videoEl.value),
  duration: () => props.duration,
  loop: () => props.loop,
  metadata: () => (props.title ? { title: props.title, artwork: props.poster ? [props.poster] : [] } : null),
  seekStep: props.seekStep,
  onPrevious: () => emit('previous'),
  onNext: () => emit('next'),
  hasPrevious: () => props.hasPrevious,
  hasNext: () => props.hasNext,
})
const external = !!props.player
const hasPrevious = computed(() => (external ? player.hasPrevious.value : props.hasPrevious))
const hasNext = computed(() => (external ? player.hasNext.value : props.hasNext))
function previous() {
  if (external) player.previous()
  else emit('previous')
}
function next() {
  if (external) player.next()
  else emit('next')
}

// ── v-model ─────────────────────────────────────────────────────────────────────────────────────────────
watch(() => props.playing, (v) => { if (v !== undefined) player.playing.value = v })
watch(() => props.currentTime, (v) => { if (v !== undefined && Math.abs(v - player.currentTime.value) > 0.5) player.seek(v) }, { immediate: true })
watch(() => props.rate, (v) => { if (v !== undefined) player.rate.value = v }, { immediate: true })
watch(() => props.volume, (v) => { if (v !== undefined) player.volume.value = v }, { immediate: true })
watch(() => props.muted, (v) => { if (v !== undefined) player.muted.value = v }, { immediate: true })
watch(player.playing, (v) => emit('update:playing', v))
watch(player.currentTime, (v) => emit('update:currentTime', v))
watch(player.rate, (v) => emit('update:rate', v))
watch(player.volume, (v) => emit('update:volume', v))
watch(player.muted, (v) => emit('update:muted', v))
watch(player.ended, (v) => { if (v) emit('ended') })
watch(player.error, (e) => { if (e) emit('error', e) })

// ── Size ────────────────────────────────────────────────────────────────────────────────────────────────
const width = ref(640)
const compact = computed(() => width.value < 480)
let ro: ResizeObserver | undefined

// ── Controls visibility ─────────────────────────────────────────────────────────────────────────────────
const shown = ref(true)
const overControls = ref(false)
const menu = ref<InstanceType<typeof MMenu>>()
const menuOpen = computed(() => !!(menu.value as { open?: boolean } | undefined)?.open)
let hideTimer: ReturnType<typeof setTimeout> | undefined
function poke() {
  shown.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (player.playing.value && !menuOpen.value && !overControls.value) shown.value = false
  }, props.hideDelay)
}
watch(player.playing, (on) => (on ? poke() : (shown.value = true)))
watch(menuOpen, (open) => { if (!open) poke() })
const visible = computed(() => props.controls && (shown.value || !player.playing.value || player.ended.value))

// ── Flash: a big icon for what you can't see happen (a click on the picture, a double tap, a key) ───────
const flash = ref<{ icon: string; text?: string; side?: 'left' | 'right'; n: number } | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
function show(icon: string, text?: string, side?: 'left' | 'right') {
  flash.value = { icon, text, side, n: (flash.value?.n ?? 0) + 1 }
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = null), 650)
}
const seconds = (n: number) => locale.mediaSeconds.replace('{seconds}', String(n))

function toggle(flashIt = false) {
  const wasPlaying = player.playing.value
  player.toggle()
  if (flashIt) show(wasPlaying ? 'pause' : 'play_arrow')
}
// Double taps add up while they keep coming: "30 seconds"
let skipRun = { side: '' as '' | 'left' | 'right', total: 0, at: 0 }
function skip(s: number, flashIt = false) {
  player.skip(s)
  if (!flashIt) return
  const side = s > 0 ? 'right' : 'left'
  const t = performance.now()
  skipRun = skipRun.side === side && t - skipRun.at < 1000 ? { side, total: skipRun.total + Math.abs(s), at: t } : { side, total: Math.abs(s), at: t }
  show(s > 0 ? 'fast_forward' : 'fast_rewind', seconds(skipRun.total), side)
}

// ── Pointer on the picture ──────────────────────────────────────────────────────────────────────────────
let lastTap = -Infinity
let tapTimer: ReturnType<typeof setTimeout> | undefined
let pressTimer: ReturnType<typeof setTimeout> | undefined
let fastFrom: number | null = null
const fast = ref(false)

function onSurfaceDown(e: PointerEvent) {
  if (e.button !== 0) return
  root.value?.focus({ preventScroll: true })
  // Long press: 2× while held (touch and mouse alike, as YouTube)
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    if (!player.playing.value) return
    fastFrom = player.rate.value
    player.rate.value = 2
    fast.value = true
  }, 500)
}
function endFast() {
  clearTimeout(pressTimer)
  if (fastFrom === null) return false
  player.rate.value = fastFrom
  fastFrom = null
  fast.value = false
  return true
}
function onSurfaceUp(e: PointerEvent) {
  if (e.button !== 0) return
  if (endFast()) return
  if (e.pointerType === 'mouse') {
    toggle(true)
    return
  }
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (e.clientX - r.left) / (r.width || 1)
  const t = performance.now()
  const sideTap = x < 0.35 || x > 0.65
  // A double tap on a side skips; while skips keep coming, single taps on that side do too
  if (sideTap && (t - lastTap < 300 || (skipRun.side && t - skipRun.at < 1000 && skipRun.side === (x < 0.5 ? 'left' : 'right')))) {
    clearTimeout(tapTimer)
    lastTap = t
    skip(x < 0.5 ? -props.seekStep : props.seekStep, true)
    return
  }
  lastTap = t
  clearTimeout(tapTimer)
  tapTimer = setTimeout(() => (shown.value ? (shown.value = false) : poke()), 260)
}

// ── Full screen: the player covers the page (fixed) and the document goes full screen, so menus teleported
// to <body> still show over it. iPhones have no Fullscreen API for elements: their video's own player then ──
const fullscreen = ref(false)
async function toggleFullscreen() {
  if (fullscreen.value) {
    fullscreen.value = false
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    return
  }
  const doc = document.documentElement
  if (!doc.requestFullscreen && videoEl.value && 'webkitEnterFullscreen' in videoEl.value) {
    ;(videoEl.value as HTMLVideoElement & { webkitEnterFullscreen(): void }).webkitEnterFullscreen()
    return
  }
  fullscreen.value = true
  await doc.requestFullscreen?.().catch(() => {})
  // Phones turn to landscape where the browser allows it
  ;(screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> } | undefined)?.lock?.('landscape').catch(() => {})
}
function onFullscreenChange() {
  if (!document.fullscreenElement && fullscreen.value) fullscreen.value = false
}
watch(fullscreen, (v) => emit('fullscreen', v))

// ── Picture in picture ──────────────────────────────────────────────────────────────────────────────────
const pipAvailable = ref(false)
async function togglePip() {
  const el = videoEl.value
  if (!el) return
  if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => {})
  else await el.requestPictureInPicture().catch(() => {})
}

// ── Volume ──────────────────────────────────────────────────────────────────────────────────────────────
const volumeIcon = computed(() => {
  const v = player.volume.value
  return player.muted.value || v === 0 ? 'volume_off' : v < 0.5 ? 'volume_down' : 'volume_up'
})
const volumePercent = computed({
  get: () => (player.muted.value ? 0 : Math.round(player.volume.value * 100)),
  set: (v: number) => {
    player.volume.value = v / 100
    player.muted.value = v === 0
  },
})
function toggleMute() {
  if (player.muted.value && player.volume.value === 0) player.volume.value = 1
  player.muted.value = !player.muted.value
}

// ── Subtitles ───────────────────────────────────────────────────────────────────────────────────────────
const subtitle = ref<number>(props.tracks?.findIndex((t) => t.default) ?? -1)
let lastSubtitle = Math.max(0, subtitle.value)
// The browser may turn tracks on by itself (one matching the user's language, say): ours wins whenever they change
function applySubtitles() {
  const list = videoEl.value?.textTracks
  if (!list) return
  for (let i = 0; i < list.length; i++) {
    const mode = i === subtitle.value ? 'showing' : 'disabled'
    if (list[i]!.mode !== mode) list[i]!.mode = mode
  }
}
watch(subtitle, (i) => {
  if (i >= 0) lastSubtitle = i
  applySubtitles()
})
const toggleSubtitles = () => (subtitle.value = subtitle.value >= 0 ? -1 : lastSubtitle)

// ── HLS ─────────────────────────────────────────────────────────────────────────────────────────────────
let hls: HlsLike | null = null
const levels = ref<{ height?: number; bitrate?: number }[]>([])
const level = ref(-1)
watch(level, (l) => { if (hls) hls.currentLevel = l })
const allSources = computed<VideoSource[]>(() => props.sources ?? (props.src ? [{ src: props.src }] : []))
const isHls = (s: VideoSource) => /\.m3u8(\?|#|$)/i.test(s.src) || /mpegurl/i.test(s.type ?? '')
// A source the browser plays itself goes in <source>; an HLS one it can't goes to hls.js
const hlsSource = ref<string | null>(null)

async function setupSource() {
  hls?.destroy()
  hls = null
  levels.value = []
  level.value = -1
  hlsSource.value = null
  const el = videoEl.value
  if (!el || custom) return
  const h = allSources.value.find(isHls)
  if (!h || el.canPlayType('application/vnd.apple.mpegurl') || !props.hls) return
  hlsSource.value = h.src
  const { default: Hls } = await props.hls()
  if (!Hls.isSupported() || hlsSource.value !== h.src) return
  hls = new Hls()
  hls.on(Hls.Events.MANIFEST_PARSED ?? 'hlsManifestParsed', () => { levels.value = hls?.levels ?? [] })
  hls.loadSource(h.src)
  hls.attachMedia(el)
}
const nativeSources = computed(() => allSources.value.filter((s) => !hlsSource.value || s.src !== hlsSource.value))
watch(allSources, async () => {
  // A new video keeps playing if the last one was (or just ended into it)
  const resume = player.playing.value || player.ended.value
  await setupSource()
  await nextTick()
  if (!hls) videoEl.value?.load()
  if (resume) player.play()
})
const levelLabel = (l: { height?: number; bitrate?: number }) => (l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)} kbps`)
const qualityLabel = computed(() => (level.value < 0 ? locale.mediaQualityAuto : levelLabel(levels.value[level.value] ?? {})))

const speedLabel = (s: number) => (s === 1 ? locale.mediaSpeedNormal : `${s}×`)

// ── Keyboard (YouTube's keys) ───────────────────────────────────────────────────────────────────────────
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (e.ctrlKey || e.metaKey || e.altKey || t.closest('input, textarea, select, [contenteditable]')) return
  const onControl = t !== root.value && !!t.closest('button, a, [role="slider"], [role="menuitem"]')
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const d = player.duration.value
  const actions: Record<string, () => void> = {
    k: () => toggle(true),
    j: () => skip(-props.seekStep, true),
    l: () => skip(props.seekStep, true),
    f: toggleFullscreen,
    m: toggleMute,
    '<': () => setSpeed(-1),
    '>': () => setSpeed(1),
  }
  if (props.tracks?.length) actions.c = toggleSubtitles
  if (!onControl) {
    actions[' '] = () => toggle(true)
    actions.ArrowLeft = () => skip(-5, true)
    actions.ArrowRight = () => skip(5, true)
    actions.ArrowUp = () => { volumePercent.value = Math.min(100, volumePercent.value + 5) }
    actions.ArrowDown = () => { volumePercent.value = Math.max(0, volumePercent.value - 5) }
    actions.Home = () => player.seek(0)
    actions.End = () => player.seek(d)
  }
  if (/^[0-9]$/.test(k) && Number.isFinite(d)) actions[k] = () => player.seek((d * Number(k)) / 10)
  if (k === 'Escape' && fullscreen.value) actions.Escape = toggleFullscreen
  const run = actions[k]
  if (!run) return
  e.preventDefault()
  e.stopPropagation()
  run()
  poke()
}
function setSpeed(dir: number) {
  const list = props.speeds
  const i = list.indexOf(player.rate.value)
  const nextRate = list[Math.min(list.length - 1, Math.max(0, (i < 0 ? list.indexOf(1) : i) + dir))]
  if (nextRate === undefined) return
  player.rate.value = nextRate
  show('speed', speedLabel(nextRate))
}

// ── Lifecycle ───────────────────────────────────────────────────────────────────────────────────────────
onMounted(async () => {
  ro = new ResizeObserver(([entry]) => { width.value = entry!.contentRect.width })
  ro.observe(root.value!)
  width.value = root.value!.clientWidth || width.value
  document.addEventListener('fullscreenchange', onFullscreenChange)
  pipAvailable.value = !custom && !!document.pictureInPictureEnabled
  if (external && !custom) player.attach(videoEl.value ?? null)
  else if (external) player.attach(null)
  await setupSource()
  applySubtitles()
  videoEl.value?.textTracks?.addEventListener?.('change', applySubtitles)
  videoEl.value?.textTracks?.addEventListener?.('addtrack', applySubtitles)
  poke()
  if (props.autoplay || props.playing) {
    await player.play()
    if (player.blocked.value) {
      player.muted.value = true
      await player.play()
    }
  }
})
onBeforeUnmount(() => {
  ro?.disconnect()
  hls?.destroy()
  videoEl.value?.textTracks?.removeEventListener?.('change', applySubtitles)
  videoEl.value?.textTracks?.removeEventListener?.('addtrack', applySubtitles)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (fullscreen.value && document.fullscreenElement) document.exitFullscreen().catch(() => {})
  ;[hideTimer, flashTimer, tapTimer, pressTimer].forEach(clearTimeout)
  if (external) player.attach(undefined)
})

const slotProps = computed<VideoPlayerSlotProps>(() => ({ player, shown: visible.value, fullscreen: fullscreen.value, compact: compact.value }))
const errorText = computed(() => (player.error.value ? locale.mediaError : ''))
const playIcon = computed(() => (player.ended.value ? 'replay' : player.playing.value ? 'pause' : 'play_arrow'))
const playLabel = computed(() => (player.ended.value ? locale.mediaReplay : player.playing.value ? locale.mediaPause : locale.mediaPlay))
const seekBackLabel = computed(() => locale.mediaSeekBack.replace('{seconds}', String(props.seekStep)))
const seekForwardLabel = computed(() => locale.mediaSeekForward.replace('{seconds}', String(props.seekStep)))
const skipIcon = (dir: 'back' | 'forward') => ([5, 10, 30].includes(props.seekStep) ? `${dir === 'back' ? 'replay' : 'forward'}_${props.seekStep}` : dir === 'back' ? 'fast_rewind' : 'fast_forward')

// Controls sit on the picture, so they keep a dark scrim and white content in both themes (as Google Photos' and
// YouTube's do; Media3's gradient to the theme's background washes a light theme's picture out). The play button
// carries the color: primary-container, a circle while paused that squares off while playing
const GLASS = 'rgb(0 0 0 / 0.38)'
const sizes = computed(() => (compact.value ? { play: 64, skip: 48, track: 40, gap: 'gap-5' } : { play: 80, skip: 56, track: 48, gap: 'gap-8' }))
const playRadius = computed(() => (player.playing.value ? `${Math.round(sizes.value.play * 0.3)}px` : `${sizes.value.play / 2}px`))
const showTrackButtons = computed(() => hasPrevious.value || hasNext.value)

const pad2 = (n: number) => String(n).padStart(2, '0')
function fmt(t: number) {
  const sec = Math.max(0, Math.floor(t || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return (h ? `${h}:${pad2(m)}` : String(m)) + ':' + pad2(sec % 60)
}
const timeText = computed(() => `${fmt(player.currentTime.value)} / ${player.duration.value ? fmt(player.duration.value) : '--:--'}`)
const chapterTitle = computed(() => {
  let found: SeekBarChapter | null = null
  for (const c of props.chapters ?? []) if (c.start <= player.currentTime.value && (!found || c.start >= found.start)) found = c
  return found?.title
})

// A video a hair off the box's ratio (854×481 in 16:9) would leave sub-pixel bars of the black shutter on two
// edges, which also show through the rounded corners' antialiasing: within 2%, fill the box instead
const naturalRatio = ref(0)
function onMetadata() {
  const el = videoEl.value
  naturalRatio.value = el && el.videoHeight ? el.videoWidth / el.videoHeight : 0
}
const fitClass = computed(() => {
  if (props.fit === 'cover') return 'object-cover'
  const el = root.value
  const box = el && el.clientHeight ? el.clientWidth / el.clientHeight : 0
  void width.value
  return naturalRatio.value && box && Math.abs(naturalRatio.value / box - 1) < 0.02 ? 'object-cover' : 'object-contain'
})
</script>

<template>
  <div
    ref="root"
    v-bind="$attrs"
    role="region"
    :aria-label="title || locale.mediaPlayer"
    tabindex="-1"
    class="m3-video-player group/player isolate overflow-hidden bg-black text-white outline-none select-none transform-gpu"
    :class="[fullscreen ? 'fixed inset-0 z-400' : 'relative', !visible && player.playing.value && 'cursor-none']"
    :style="fullscreen ? undefined : { aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio }"
    @pointermove="(e: PointerEvent) => e.pointerType !== 'touch' && poke()"
    @keydown="onKey"
    @focusin="poke"
  >
    <div class="absolute inset-0 flex items-center justify-center">
      <slot
        v-if="custom"
        name="media"
        :time="player.currentTime.value"
        :playing="player.playing.value"
        :rate="player.rate.value"
        :duration="player.duration.value"
      />
      <video
        v-else
        ref="videoEl"
        class="h-full w-full"
        :class="fitClass"
        :poster="poster"
        :loop="loop"
        playsinline
        preload="metadata"
        :crossorigin="crossorigin"
        @loadedmetadata="onMetadata"
      >
        <source v-for="s in nativeSources" :key="s.src" :src="s.src" :type="s.type" />
        <track
          v-for="(t, i) in tracks"
          :key="t.src"
          :kind="t.kind ?? 'subtitles'"
          :src="t.src"
          :srclang="t.srclang"
          :label="t.label"
          :default="i === subtitle"
        />
      </video>
    </div>

    <!-- Scrims behind the top and bottom controls, fading with them -->
    <Transition name="m3-video-fade">
      <div v-if="visible" class="pointer-events-none absolute inset-0" aria-hidden="true">
        <div v-if="fullscreen || slots.top" class="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent" />
        <div class="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-black/75 via-black/35 to-transparent" />
      </div>
    </Transition>

    <!-- Taps and clicks land here, under the controls -->
    <div class="absolute inset-0" @pointerdown="onSurfaceDown" @pointerup="onSurfaceUp" @pointercancel="endFast" @pointerleave="endFast" @dblclick="toggleFullscreen" @contextmenu.prevent />

    <div v-if="player.waiting.value && !player.error.value" class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <MLoadingIndicator :size="compact ? 56 : 72" contained :label="locale.loading" />
    </div>

    <!-- 2× while held -->
    <Transition name="m3-video-fade">
      <div v-if="fast" class="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
        <span class="flex items-center gap-1 rounded-full bg-black/45 px-3.5 py-1.5 text-label-large backdrop-blur-md">
          2× <MIcon name="fast_forward" :size="18" filled />
        </span>
      </div>
    </Transition>

    <Transition name="m3-video-flash">
      <div
        v-if="flash"
        :key="flash.n"
        class="pointer-events-none absolute inset-y-0 flex items-center justify-center"
        :class="flash.side === 'left' ? 'left-0 w-2/5' : flash.side === 'right' ? 'right-0 w-2/5' : 'inset-x-0'"
        aria-hidden="true"
      >
        <div class="flex flex-col items-center gap-2">
          <span class="flex size-16 items-center justify-center rounded-full bg-black/45 backdrop-blur-md"><MIcon :name="flash.icon" :size="34" filled /></span>
          <span v-if="flash.text" class="rounded-full bg-black/45 px-3 py-0.5 text-label-large backdrop-blur-md">{{ flash.text }}</span>
        </div>
      </div>
    </Transition>

    <div v-if="player.error.value" class="absolute inset-0 flex items-center justify-center bg-black/60 p-4 text-center">
      <slot name="error" :error="player.error.value">
        <p class="flex flex-col items-center gap-2 text-title-medium">
          <MIcon name="error" :size="32" />
          {{ errorText }}
        </p>
      </slot>
    </div>

    <div v-if="player.ended.value && slots.end" class="absolute inset-0">
      <slot name="end" :player="player" :replay="() => player.play()" />
    </div>

    <Transition name="m3-video-fade">
      <div v-if="visible && !(player.ended.value && slots.end)" class="pointer-events-none absolute inset-0">
        <!-- Top -->
        <div class="pointer-events-auto absolute inset-x-0 top-0" @pointerenter="overControls = true" @pointerleave="overControls = false">
          <slot name="top" v-bind="slotProps">
            <div v-if="fullscreen" class="flex items-center gap-2 px-2 pt-2">
              <MIconButton icon="arrow_back" :label="locale.mediaExitFullscreen" color="#fff" @click="toggleFullscreen" />
              <p v-if="title" class="min-w-0 flex-1 truncate text-title-medium">{{ title }}</p>
            </div>
          </slot>
        </div>

        <!-- Center: on the picture's center, whatever the top and bottom hold -->
        <div v-if="!player.waiting.value && !player.error.value" class="absolute inset-0 flex items-center justify-center" :class="sizes.gap">
          <slot name="center" v-bind="slotProps">
            <MIconButton
              v-if="showTrackButtons"
              icon="skip_previous"
              :label="locale.previous"
              :size="sizes.track"
              :icon-size="compact ? 24 : 28"
              :aria-disabled="!hasPrevious || undefined"
              :tabindex="hasPrevious ? undefined : -1"
              variant="filled"
              :color="GLASS"
              icon-filled
              class="backdrop-blur-md" :class="hasPrevious ? 'pointer-events-auto' : 'opacity-40'"
              @click="previous"
            />
            <MIconButton
              v-if="!player.live.value"
              :icon="skipIcon('back')"
              :label="seekBackLabel"
              :size="sizes.skip"
              :icon-size="compact ? 26 : 30"
              variant="filled"
              :color="GLASS"
              class="pointer-events-auto backdrop-blur-md"
              @click="skip(-seekStep)"
            />
            <MIconButton
              :icon="playIcon"
              :label="playLabel"
              :size="sizes.play"
              :icon-size="compact ? 32 : 40"
              variant="filled"
              color="var(--color-primary-container)"
              content-color="on-primary-container"
              icon-filled
              class="m3-video-play pointer-events-auto shadow-elevation-2"
              :style="{ borderRadius: playRadius }"
              @click="toggle()"
            />
            <MIconButton
              v-if="!player.live.value"
              :icon="skipIcon('forward')"
              :label="seekForwardLabel"
              :size="sizes.skip"
              :icon-size="compact ? 26 : 30"
              variant="filled"
              :color="GLASS"
              class="pointer-events-auto backdrop-blur-md"
              @click="skip(seekStep)"
            />
            <MIconButton
              v-if="showTrackButtons"
              icon="skip_next"
              :label="locale.next"
              :size="sizes.track"
              :icon-size="compact ? 24 : 28"
              :aria-disabled="!hasNext || undefined"
              :tabindex="hasNext ? undefined : -1"
              variant="filled"
              :color="GLASS"
              icon-filled
              class="backdrop-blur-md" :class="hasNext ? 'pointer-events-auto' : 'opacity-40'"
              @click="next"
            />
          </slot>
        </div>

        <!-- Bottom -->
        <div class="pointer-events-auto absolute inset-x-0 bottom-0" @pointerenter="overControls = true" @pointerleave="overControls = false">
          <slot name="bottom" v-bind="slotProps">
            <div :class="compact ? 'px-2 pb-1' : 'px-4 pb-2'">
              <MSeekBar
                v-if="!player.live.value"
                v-model="player.currentTime.value"
                :duration="player.duration.value"
                :buffered="player.buffered.value"
                :chapters="chapters"
                :playing="player.playing.value && !player.waiting.value"
                :playback-rate="player.rate.value"
                :color="color"
                track-color="rgb(255 255 255 / 0.28)"
                variant="line"
                :size="compact ? 'xs' : 'sm'"
                time="none"
                class="px-1"
              />
              <div class="flex items-center gap-1">
                <span v-if="player.live.value" class="ml-2 flex items-center gap-1.5 rounded-full bg-error px-2.5 py-0.5 text-label-medium text-on-error">
                  <span class="size-1.5 rounded-full bg-on-error" />{{ locale.mediaLive }}
                </span>
                <p v-else class="ml-1 min-w-0 truncate text-label-large tabular-nums">
                  {{ timeText }}<span v-if="chapterTitle && !compact" class="text-white/75"> · {{ chapterTitle }}</span>
                </p>
                <span class="flex-1" />
                <div class="group/vol flex items-center">
                  <div v-if="!compact" class="w-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(.2,0,0,1)] group-focus-within/vol:w-24 group-hover/vol:w-24">
                    <MSlider v-model="volumePercent" :min="0" :max="100" size="xs" class="w-22 px-1" />
                  </div>
                  <MIconButton :icon="volumeIcon" :label="player.muted.value ? locale.mediaUnmute : locale.mediaMute" color="#fff" :size="compact ? 'xs' : 'sm'" @click="toggleMute" />
                </div>
                <MIconButton
                  v-if="tracks?.length"
                  :icon="subtitle >= 0 ? 'subtitles' : 'subtitles_off'"
                  :label="locale.mediaSubtitles"
                  color="#fff"
                  :size="compact ? 'xs' : 'sm'"
                  :icon-filled="subtitle >= 0"
                  @click="toggleSubtitles"
                />
                <MMenu ref="menu" submenu-mode="push" align="right">
                  <template #trigger>
                    <MIconButton icon="settings" :label="locale.mediaSettings" color="#fff" :size="compact ? 'xs' : 'sm'" />
                  </template>
                  <MMenuItem icon="slow_motion_video">
                    {{ locale.mediaSpeed }} · {{ speedLabel(player.rate.value) }}
                    <template #children>
                      <MMenuItem v-for="s in speeds" :key="s" :selected="player.rate.value === s" @click="player.rate.value = s">{{ speedLabel(s) }}</MMenuItem>
                    </template>
                  </MMenuItem>
                  <MMenuItem v-if="tracks?.length" icon="subtitles">
                    {{ locale.mediaSubtitles }} · {{ subtitle >= 0 ? tracks[subtitle]?.label : locale.mediaSubtitlesOff }}
                    <template #children>
                      <MMenuItem :selected="subtitle < 0" @click="subtitle = -1">{{ locale.mediaSubtitlesOff }}</MMenuItem>
                      <MMenuItem v-for="(t, i) in tracks" :key="t.src" :selected="subtitle === i" @click="subtitle = i">{{ t.label }}</MMenuItem>
                    </template>
                  </MMenuItem>
                  <MMenuItem v-if="levels.length > 1" icon="tune">
                    {{ locale.mediaQuality }} · {{ qualityLabel }}
                    <template #children>
                      <MMenuItem :selected="level < 0" @click="level = -1">{{ locale.mediaQualityAuto }}</MMenuItem>
                      <MMenuItem v-for="(l, i) in levels" :key="i" :selected="level === i" @click="level = i">{{ levelLabel(l) }}</MMenuItem>
                    </template>
                  </MMenuItem>
                  <slot name="settings" :player="player" />
                </MMenu>
                <MIconButton
                  v-if="pipAvailable && !compact"
                  icon="picture_in_picture_alt"
                  :label="locale.mediaPictureInPicture"
                  color="#fff"
                  size="sm"
                  @click="togglePip"
                />
                <MIconButton
                  :icon="fullscreen ? 'fullscreen_exit' : 'fullscreen'"
                  :label="fullscreen ? locale.mediaExitFullscreen : locale.mediaFullscreen"
                  color="#fff"
                  :size="compact ? 'xs' : 'sm'"
                  @click="toggleFullscreen"
                />
              </div>
            </div>
          </slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.m3-video-player video::cue {
  background: color-mix(in srgb, var(--color-scrim) 75%, transparent);
  color: #fff;
}
.m3-video-play { transition: border-radius 350ms cubic-bezier(0.2, 0, 0, 1); }
.m3-video-fade-enter-active,
.m3-video-fade-leave-active { transition: opacity 250ms cubic-bezier(0.2, 0, 0, 1); }
.m3-video-fade-enter-from,
.m3-video-fade-leave-to { opacity: 0; }
.m3-video-flash-leave-active { transition: opacity 400ms ease, transform 400ms ease; }
.m3-video-flash-leave-to { opacity: 0; transform: scale(1.3); }
</style>
