<script setup lang="ts">
/**
 * Records a voice note with the microphone: a record button, a live waveform and timer while recording (pause,
 * resume, stop, discard), then the recording to play back (play / pause over its own waveform) and use or discard.
 * The recording comes out as a `Blob` with its duration and waveform peaks (`record`, `v-model`), in the format the
 * browser records (WebM/Opus in Chrome and Firefox, MP4/AAC in Safari). `maxDuration` stops it by itself. The
 * microphone is only on while recording. A denied permission or a missing microphone says so. Needs a secure page
 * (https or localhost).
 *
 * @event update:modelValue The recording used, or null after Discard
 * @event record The recording used: `{ blob, url, duration, mimeType, peaks }`
 * @event error The microphone failed: `'denied' | 'unavailable' | 'unsupported' | 'failed'`
 */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

/** A voice note made by `MAudioRecorder`. */
export interface AudioRecording {
  blob: Blob
  /** An object URL for the blob, to play it (revoked when the recorder is discarded or unmounted) */
  url: string
  /** In seconds */
  duration: number
  mimeType: string
  /** Its waveform, levels 0–1 (`bars` of them), to draw it elsewhere */
  peaks: number[]
}

type MicError = 'denied' | 'unavailable' | 'unsupported' | 'failed'

const props = withDefaults(
  defineProps<{
    /** The recording used (v-model), or null */
    modelValue?: AudioRecording | null
    /** Stop by itself after this many seconds (0: no limit) */
    maxDuration?: number
    /** How many bars the waveform has */
    bars?: number
    /** The format to ask for, when the browser can record it */
    mimeType?: string
    /** Skip the review step: a stopped recording is used right away */
    instant?: boolean
  }>(),
  { modelValue: null, maxDuration: 0, bars: 40, instant: false },
)

const emit = defineEmits<{
  'update:modelValue': [recording: AudioRecording | null]
  record: [recording: AudioRecording]
  error: [error: MicError]
}>()

const t = useLocale()

const status = ref<'idle' | 'starting' | 'recording' | 'paused' | 'review' | 'error'>('idle')
const error = ref<MicError | null>(null)
const elapsed = ref(0)
const levels = ref<number[]>([])
const result = shallowRef<AudioRecording | null>(null)
const playing = ref(false)
const played = ref(0)

let stream: MediaStream | null = null
let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let sampler: ReturnType<typeof setInterval> | undefined
let startedAt = 0
let pausedFor = 0
let pausedAt = 0
let all: number[] = []
let audio: HTMLAudioElement | null = null

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function pickType(): string | undefined {
  const Rec = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined
  const wanted = [props.mimeType, 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].filter(Boolean) as string[]
  return wanted.find((m) => Rec?.isTypeSupported?.(m))
}

/** `n` peaks out of any number of levels */
function downsample(values: number[], n: number): number[] {
  if (!values.length) return Array(n).fill(0)
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * values.length) / n)
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / n))
    return Math.max(...values.slice(a, b))
  })
}

function sample() {
  if (status.value !== 'recording') return
  elapsed.value = (performance.now() - startedAt - pausedFor) / 1000
  let level = 0
  if (analyser) {
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += ((v - 128) / 128) ** 2
    // RMS, boosted so speech fills the bar
    level = Math.min(1, Math.sqrt(sum / data.length) * 3)
  }
  all.push(level)
  levels.value = [...levels.value, level].slice(-props.bars)
  if (props.maxDuration > 0 && elapsed.value >= props.maxDuration) stop()
}

async function start() {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!media?.getUserMedia || typeof MediaRecorder === 'undefined') return fail('unsupported')
  discard()
  status.value = 'starting'
  try {
    stream = await media.getUserMedia({ audio: true })
  } catch (e) {
    const name = (e as { name?: string })?.name
    return fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'failed')
  }
  const type = pickType()
  try {
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
  } catch {
    return fail('failed')
  }
  chunks = []
  all = []
  levels.value = []
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  recorder.onstop = finish
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctx) {
      audioCtx = new Ctx()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      audioCtx.createMediaStreamSource(stream).connect(analyser)
    }
  } catch {
    analyser = null
  }
  recorder.start(250)
  startedAt = performance.now()
  pausedFor = 0
  elapsed.value = 0
  status.value = 'recording'
  sampler = setInterval(sample, 60)
}

function fail(kind: MicError) {
  release()
  status.value = 'error'
  error.value = kind
  emit('error', kind)
}

function pause() {
  if (status.value !== 'recording' || !recorder) return
  recorder.pause()
  pausedAt = performance.now()
  status.value = 'paused'
}
function resume() {
  if (status.value !== 'paused' || !recorder) return
  recorder.resume()
  pausedFor += performance.now() - pausedAt
  status.value = 'recording'
}

function stop() {
  if (!recorder || (status.value !== 'recording' && status.value !== 'paused')) return
  if (status.value === 'paused') pausedFor += performance.now() - pausedAt
  elapsed.value = (performance.now() - startedAt - pausedFor) / 1000
  clearInterval(sampler)
  recorder.stop()
}

/** The recorder stopped: build the recording, let the microphone go */
function finish() {
  const mimeType = recorder?.mimeType || pickType() || 'audio/webm'
  const blob = new Blob(chunks, { type: mimeType })
  release()
  const rec: AudioRecording = { blob, url: URL.createObjectURL(blob), duration: Math.round(elapsed.value * 10) / 10, mimeType, peaks: downsample(all, props.bars) }
  result.value = rec
  played.value = 0
  if (props.instant) use()
  else status.value = 'review'
}

/** Microphone and analyser off */
function release() {
  clearInterval(sampler)
  stream?.getTracks().forEach((tr) => tr.stop())
  stream = null
  void audioCtx?.close().catch(() => {})
  audioCtx = null
  analyser = null
  recorder = null
}

function use() {
  const rec = result.value
  if (!rec) return
  stopPlayback()
  emit('update:modelValue', rec)
  emit('record', rec)
  status.value = 'idle'
}

function discard() {
  stopPlayback()
  if (recorder && (status.value === 'recording' || status.value === 'paused')) {
    recorder.onstop = null
    recorder.stop()
  }
  release()
  if (result.value && result.value.url !== props.modelValue?.url) URL.revokeObjectURL(result.value.url)
  result.value = null
  levels.value = []
  elapsed.value = 0
  if (status.value !== 'starting') status.value = 'idle'
  if (props.modelValue) emit('update:modelValue', null)
}

// ── Playback of the recording under review (or the one in the v-model) ────────────────────────

const reviewing = computed(() => (status.value === 'review' ? result.value : status.value === 'idle' ? props.modelValue : null))

function togglePlay() {
  const rec = reviewing.value
  if (!rec) return
  if (playing.value) return stopPlayback(false)
  audio ??= new Audio()
  if (audio.src !== rec.url) audio.src = rec.url
  audio.ontimeupdate = () => { played.value = rec.duration ? Math.min(1, audio!.currentTime / rec.duration) : 0 }
  audio.onended = () => { playing.value = false; played.value = 0 }
  void audio.play().then(() => (playing.value = true), () => (playing.value = false))
}
function stopPlayback(rewind = true) {
  audio?.pause()
  if (audio && rewind) audio.currentTime = 0
  playing.value = false
  if (rewind) played.value = 0
}

onBeforeUnmount(() => {
  discardOnUnmount()
})
function discardOnUnmount() {
  stopPlayback()
  if (recorder && (status.value === 'recording' || status.value === 'paused')) {
    recorder.onstop = null
    recorder.stop()
  }
  release()
  if (result.value && result.value.url !== props.modelValue?.url) URL.revokeObjectURL(result.value.url)
}

const liveBars = computed(() => {
  const pad = Array(Math.max(0, props.bars - levels.value.length)).fill(0)
  return [...pad, ...levels.value]
})
const errorText = computed(() => ({ denied: t.micDenied, unavailable: t.micUnavailable, unsupported: t.micUnsupported, failed: t.micUnavailable })[error.value ?? 'failed'])

defineExpose({ start, stop, pause, resume, discard })
</script>

<template>
  <div class="m3-audio-recorder flex min-h-14 items-center gap-2 rounded-full bg-surface-container-high py-2 pl-2 pr-3">
    <!-- Idle: record (and the used recording to play, when there's one) -->
    <template v-if="status === 'idle' || status === 'error' || status === 'starting'">
      <MIconButton
        icon="mic"
        :label="t.recorderStart"
        variant="filled"
        :disabled="status === 'starting'"
        @click="start"
      />
      <template v-if="status === 'error'">
        <MIcon name="mic_off" :size="20" class="shrink-0 text-error" />
        <span class="min-w-0 flex-1 text-body-small text-error" role="alert">{{ errorText }}</span>
      </template>
      <template v-else-if="modelValue">
        <MIconButton :icon="playing ? 'pause' : 'play_arrow'" :label="playing ? t.recorderPausePlayback : t.recorderPlay" @click="togglePlay" />
        <span class="flex h-8 min-w-0 flex-1 items-center gap-[2px]" aria-hidden="true">
          <span
            v-for="(p, i) in modelValue.peaks"
            :key="i"
            class="w-[3px] min-w-[2px] flex-1 rounded-full"
            :class="i / modelValue.peaks.length < played ? 'bg-primary' : 'bg-on-surface-variant/50'"
            :style="{ height: `${Math.max(12, p * 100)}%` }"
          />
        </span>
        <span class="shrink-0 font-mono text-label-medium text-on-surface-variant">{{ fmt(modelValue.duration) }}</span>
        <MIconButton icon="delete" :label="t.recorderDiscard" @click="discard" />
      </template>
      <span v-else class="flex-1 text-body-medium text-on-surface-variant">{{ t.recorderStart }}</span>
    </template>

    <!-- Recording: discard, live waveform, time, pause / resume, stop -->
    <template v-else-if="status === 'recording' || status === 'paused'">
      <MIconButton icon="delete" :label="t.recorderDiscard" @click="discard" />
      <span class="size-2.5 shrink-0 rounded-full bg-error" :class="status === 'recording' ? 'animate-pulse' : 'opacity-40'" />
      <span class="sr-only" role="status">{{ t.recorderRecording }}</span>
      <span class="flex h-8 min-w-0 flex-1 items-center gap-[2px]" aria-hidden="true">
        <span v-for="(l, i) in liveBars" :key="i" class="w-[3px] min-w-[2px] flex-1 rounded-full bg-primary transition-[height] duration-75" :style="{ height: `${Math.max(8, l * 100)}%` }" />
      </span>
      <span class="shrink-0 font-mono text-label-medium text-on-surface" aria-live="off">{{ fmt(elapsed) }}<template v-if="maxDuration"> / {{ fmt(maxDuration) }}</template></span>
      <MIconButton v-if="status === 'recording'" icon="pause" :label="t.recorderPause" @click="pause" />
      <MIconButton v-else icon="mic" :label="t.recorderResume" @click="resume" />
      <MIconButton icon="stop" :label="t.recorderStop" variant="filled" @click="stop" />
    </template>

    <!-- Review: play it over its waveform, discard or use -->
    <template v-else-if="status === 'review' && result">
      <MIconButton icon="delete" :label="t.recorderDiscard" @click="discard" />
      <MIconButton :icon="playing ? 'pause' : 'play_arrow'" :label="playing ? t.recorderPausePlayback : t.recorderPlay" @click="togglePlay" />
      <span class="flex h-8 min-w-0 flex-1 items-center gap-[2px]" aria-hidden="true">
        <span
          v-for="(p, i) in result.peaks"
          :key="i"
          class="w-[3px] min-w-[2px] flex-1 rounded-full"
          :class="i / result.peaks.length < played ? 'bg-primary' : 'bg-on-surface-variant/50'"
          :style="{ height: `${Math.max(12, p * 100)}%` }"
        />
      </span>
      <span class="shrink-0 font-mono text-label-medium text-on-surface-variant">{{ fmt(result.duration) }}</span>
      <MIconButton icon="send" :label="t.recorderUse" variant="filled" @click="use" />
    </template>
  </div>
</template>
