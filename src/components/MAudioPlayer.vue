<script setup lang="ts">
/**
 * An audio player (not an M3 spec component). `mini` is a port of Media3's Compose Material3 `MiniController`
 * (androidx/media `ui_compose_material3`): artwork, title and artist, previous / play-pause / next and a thin
 * progress line, on an elevated card; a click on it emits `click` (open your full player). `standard` is a full
 * player bar: artwork and text, an `MSeekBar`, shuffle / previous / play / next / repeat, and volume.
 *
 * Plays `src`/`sources` in a hidden `<audio>`, or drives a `player` from `useMediaPlayer()` (keep it outside a
 * page to play on while the app navigates, or give it a clock for generated audio). The queue is yours: the
 * buttons emit `previous`/`next`, and stay in place, disabled, without `hasPrevious`/`hasNext` (as Media3's).
 *
 * @slot artwork Replaces the artwork. Props: `{ player }`
 * @slot actions Extra buttons at the end of the controls (a like, a queue button). Props: `{ player }`
 * @event previous The previous button (or the lock screen's) was pressed
 * @event next The next button (or the lock screen's) was pressed
 * @event ended The track reached its end
 * @event error The audio failed to load or play, with the media element's error
 * @event click The mini player was clicked (outside its buttons)
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMediaPlayer, type MediaPlayer } from '../composables/useMediaPlayer'
import { useLocale } from '../composables/useLocale'
import type { VideoSource } from './MVideoPlayer.vue'
import MSeekBar from './MSeekBar.vue'
import MIconButton from './MIconButton.vue'
import MIcon from './MIcon.vue'
import MSlider from './MSlider.vue'
import MMenu from './MMenu.vue'
import MMenuItem from './MMenuItem.vue'

const props = withDefaults(defineProps<{
  /** `mini`: Media3's MiniController (a compact card). `standard`: a full player bar */
  variant?: 'mini' | 'standard'
  /** Audio URL */
  src?: string
  /** Several formats of the audio; the browser plays the first it can */
  sources?: VideoSource[]
  /** Track title (also shown on the lock screen) */
  title?: string
  /** Artist (also shown on the lock screen) */
  artist?: string
  /** Album, for the lock screen */
  album?: string
  /** Cover image URL */
  artwork?: string
  /** Length in seconds, for a clock without `src` (with a file it comes from the file) */
  duration?: number
  /** Drive this player instead of one of its own (from `useMediaPlayer()`). Read once */
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
  /** Shuffle (v-model); unset hides the button */
  shuffle?: boolean
  /** Repeat mode (v-model); unset hides the button */
  repeat?: 'off' | 'all' | 'one'
  /** Starts playing when mounted (browsers block it with sound before a user gesture) */
  autoplay?: boolean
  /** There is a previous track: enables the previous button (emits `previous`) */
  hasPrevious?: boolean
  /** There is a next track: enables the next button (emits `next`) */
  hasNext?: boolean
  /** Speeds offered in a speed menu (`standard`); unset hides it */
  speeds?: number[]
  /** The seek bar's look (`standard`) */
  seekBar?: 'slider' | 'line' | 'wavy'
  /** Played part and play button: an M3 role or any CSS color */
  color?: string
}>(), {
  variant: 'standard',
  playing: undefined,
  currentTime: undefined,
  rate: undefined,
  volume: undefined,
  muted: undefined,
  shuffle: undefined,
  repeat: undefined,
  autoplay: false,
  hasPrevious: false,
  hasNext: false,
  seekBar: 'slider',
  color: 'primary',
})

const emit = defineEmits<{
  'update:playing': [boolean]
  'update:currentTime': [number]
  'update:rate': [number]
  'update:volume': [number]
  'update:muted': [boolean]
  'update:shuffle': [boolean]
  'update:repeat': ['off' | 'all' | 'one']
  previous: []
  next: []
  ended: []
  error: [MediaError | null]
  click: [MouseEvent]
}>()

const locale = useLocale()
const audioEl = ref<HTMLAudioElement>()
const hasFile = computed(() => !!(props.src || props.sources?.length))

const player: MediaPlayer = props.player ?? useMediaPlayer({
  media: () => (hasFile.value ? audioEl.value : null),
  duration: () => props.duration,
  loop: () => props.repeat === 'one',
  metadata: () => (props.title ? { title: props.title, artist: props.artist, album: props.album, artwork: props.artwork ? [props.artwork] : [] } : null),
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

const allSources = computed<VideoSource[]>(() => props.sources ?? (props.src ? [{ src: props.src }] : []))
watch(allSources, () => {
  const wasPlaying = player.playing.value
  audioEl.value?.load()
  // A new track keeps playing if the last one was (or just ended into it)
  if (wasPlaying || player.ended.value) player.play()
}, { flush: 'post' })

onMounted(() => {
  if (external) player.attach(hasFile.value ? audioEl.value ?? null : null)
  if (props.autoplay || props.playing) player.play()
})
onBeforeUnmount(() => {
  if (external) player.attach(undefined)
})

// ── Controls ────────────────────────────────────────────────────────────────────────────────────────────
const playIcon = computed(() => (player.playing.value ? 'pause' : 'play_arrow'))
const playLabel = computed(() => (player.playing.value ? locale.mediaPause : locale.mediaPlay))
const progress = computed(() => {
  const d = player.duration.value
  return d && Number.isFinite(d) ? Math.min(1, player.currentTime.value / d) : 0
})

const repeatIcon = computed(() => (props.repeat === 'one' ? 'repeat_one' : 'repeat'))
const repeatLabel = computed(() => (props.repeat === 'one' ? locale.mediaRepeatOne : locale.mediaRepeat))
function cycleRepeat() {
  const order = ['off', 'all', 'one'] as const
  emit('update:repeat', order[(order.indexOf(props.repeat ?? 'off') + 1) % 3]!)
}

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
const speedLabel = (s: number) => (s === 1 ? locale.mediaSpeedNormal : `${s}×`)

const ROLES = ['primary', 'secondary', 'tertiary', 'error']
const activeColor = computed(() => (ROLES.includes(props.color) ? `var(--color-${props.color})` : props.color))

function onMiniClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button, a, [role="slider"]')) return
  emit('click', e)
}
</script>

<template>
  <!-- MiniController: MiniControllerTokens (56dp artwork, 48dp controls, 8/4dp padding, 4dp card elevation) -->
  <div
    v-if="variant === 'mini'"
    role="region"
    :aria-label="title || locale.mediaPlayer"
    class="m3-audio-mini cursor-pointer items-center gap-2 rounded-md bg-surface-container-low px-2 py-1 text-on-surface shadow-elevation-2"
    @click="onMiniClick"
  >
    <slot name="artwork" :player="player">
      <img v-if="artwork" :src="artwork" alt="" class="size-14 shrink-0 rounded-sm object-cover" />
      <div v-else class="flex size-14 shrink-0 items-center justify-center rounded-sm bg-surface-container-highest text-on-surface-variant">
        <MIcon name="music_note" />
      </div>
    </slot>
    <div class="min-w-0 flex-1">
      <p class="truncate text-title-small">{{ title }}</p>
      <p v-if="artist" class="truncate text-body-medium text-on-surface-variant">{{ artist }}</p>
    </div>
    <MIconButton icon="skip_previous" :label="locale.previous" :size="48" :icon-size="24" :disabled="!hasPrevious" icon-filled @click="previous" />
    <MIconButton :icon="playIcon" :label="playLabel" :size="48" :icon-size="24" icon-filled @click="player.toggle()" />
    <MIconButton icon="skip_next" :label="locale.next" :size="48" :icon-size="24" :disabled="!hasNext" icon-filled @click="next" />
    <slot name="actions" :player="player" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-secondary-container" aria-hidden="true">
      <div class="h-full origin-left" :style="{ transform: `scaleX(${progress})`, backgroundColor: activeColor }" />
    </div>
    <audio v-if="hasFile" ref="audioEl" preload="metadata" :loop="repeat === 'one'" class="hidden">
      <source v-for="s in allSources" :key="s.src" :src="s.src" :type="s.type" />
    </audio>
  </div>

  <div
    v-else
    role="region"
    :aria-label="title || locale.mediaPlayer"
    class="@container flex flex-col gap-1 text-on-surface"
  >
    <div class="flex items-center gap-3">
      <slot name="artwork" :player="player">
        <img v-if="artwork" :src="artwork" alt="" class="size-14 shrink-0 rounded-md object-cover" />
      </slot>
      <div class="min-w-0 flex-1">
        <p v-if="title" class="truncate text-title-medium">{{ title }}</p>
        <p v-if="artist" class="truncate text-body-medium text-on-surface-variant">{{ artist }}</p>
      </div>
      <slot name="actions" :player="player" />
    </div>

    <MSeekBar
      v-if="!player.live.value"
      v-model="player.currentTime.value"
      :duration="player.duration.value"
      :buffered="player.buffered.value"
      :playing="player.playing.value && !player.waiting.value"
      :playback-rate="player.rate.value"
      :variant="seekBar"
      :color="color"
      size="sm"
    />

    <div class="flex items-center gap-1">
      <div class="flex flex-1 items-center">
        <MIconButton
          v-if="shuffle !== undefined"
          icon="shuffle"
          :label="locale.mediaShuffle"
          :checked="shuffle"
          @update:checked="(v: boolean) => emit('update:shuffle', v)"
        />
      </div>
      <MIconButton icon="skip_previous" :label="locale.previous" size="md" :disabled="!hasPrevious" icon-filled @click="previous" />
      <MIconButton
        :icon="playIcon"
        :label="playLabel"
        size="md"
        variant="filled"
        :color="color"
        icon-filled
        @click="player.toggle()"
      />
      <MIconButton icon="skip_next" :label="locale.next" size="md" :disabled="!hasNext" icon-filled @click="next" />
      <div class="flex flex-1 items-center justify-end">
        <MIconButton v-if="repeat !== undefined" :icon="repeatIcon" :label="repeatLabel" :checked="repeat !== 'off'" @update:checked="cycleRepeat" />
      </div>
    </div>

    <div class="flex items-center justify-end gap-1">
      <MMenu v-if="speeds?.length" align="right">
        <template #trigger>
          <button type="button" class="h-8 cursor-pointer rounded-full px-3 text-label-large text-on-surface-variant hover:bg-on-surface/8" :aria-label="locale.mediaSpeed">
            {{ speedLabel(player.rate.value) }}
          </button>
        </template>
        <MMenuItem v-for="s in speeds" :key="s" :selected="player.rate.value === s" @click="player.rate.value = s">{{ speedLabel(s) }}</MMenuItem>
      </MMenu>
      <span class="flex-1" />
      <MIconButton :icon="volumeIcon" :label="player.muted.value ? locale.mediaUnmute : locale.mediaMute" size="xs" @click="toggleMute" />
      <MSlider v-model="volumePercent" :min="0" :max="100" size="xs" class="hidden w-28 @sm:block" />
    </div>

    <audio v-if="hasFile" ref="audioEl" preload="metadata" :loop="repeat === 'one'" class="hidden">
      <source v-for="s in allSources" :key="s.src" :src="s.src" :type="s.type" />
    </audio>
  </div>
</template>

<style>
/* Root defaults in the base layer, so a consumer's position or display class wins */
@layer base {
  .m3-audio-mini {
    position: relative;
    display: flex;
    overflow: hidden;
  }
}
</style>
