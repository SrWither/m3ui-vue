<script setup lang="ts">
/**
 * Reads QR codes (and barcodes) with the device's camera: a live preview with an M3 viewfinder, reading a few times a
 * second. Uses the browser's `BarcodeDetector` where there is one (Chrome on Android and desktop, Edge, Samsung
 * Internet; not Firefox or Safari on desktop); elsewhere, pass a `detector` of yours (jsQR, ZXing) that reads an
 * `ImageData`, or it says the browser can't. Each code read is emitted once (`detect`) and is the v-model; the same
 * code isn't repeated for 2 seconds. `once` stops the camera after the first. Needs a secure page (https or localhost).
 *
 * @event update:modelValue A code was read (its text)
 * @event detect A code was read: `{ rawValue, format }`
 * @event error The camera failed: `'denied' | 'unavailable' | 'unsupported' | 'failed'`
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'
import { useCamera, type CameraError, type CameraFacing } from '../composables/_useCamera'

/** A code read by `MQRScanner`. */
export interface ScanResult {
  rawValue: string
  /** `qr_code`, `ean_13`, `code_128`… */
  format: string
}

/** Your own reader, for browsers without BarcodeDetector: a frame in, a code (or null) out. */
export type ScanDetector = (frame: ImageData) => ScanResult | null | Promise<ScanResult | null>

const props = withDefaults(
  defineProps<{
    /** The last code read (v-model) */
    modelValue?: string | null
    /** What BarcodeDetector looks for */
    formats?: string[]
    /** Your reader instead of BarcodeDetector (e.g. jsQR on the frame) */
    detector?: ScanDetector
    /** Which camera: the back one (`environment`) or the selfie one (`user`) */
    facing?: CameraFacing
    /** How often to look, in ms */
    interval?: number
    /** Stop the camera after the first code */
    once?: boolean
    /** Start the camera on mount instead of on a button press */
    autostart?: boolean
    /** The preview's aspect ratio (CSS `aspect-ratio`) */
    aspect?: string
  }>(),
  { modelValue: null, formats: () => ['qr_code'], facing: 'environment', interval: 250, once: false, autostart: false, aspect: '1 / 1' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  detect: [result: ScanResult]
  error: [error: CameraError]
}>()

const t = useLocale()
const video = ref<HTMLVideoElement>()
const cam = useCamera(video, { facing: () => props.facing, resolution: () => 1280 })

type NativeDetector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> }
// Looked up when needed, not at import: a polyfill loaded later still counts
const nativeClass = () => (typeof window !== 'undefined' ? (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector }).BarcodeDetector : undefined)
const supported = computed(() => !!props.detector || !!nativeClass())

let native: NativeDetector | null = null
let timer: ReturnType<typeof setInterval> | undefined
let busy = false
let canvas: HTMLCanvasElement | null = null
let last = { value: '', at: 0 }
const hit = ref(false)

async function read(): Promise<ScanResult | null> {
  const v = video.value
  if (!v || !v.videoWidth) return null
  if (props.detector) {
    canvas ??= document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(v, 0, 0)
    return props.detector(ctx.getImageData(0, 0, canvas.width, canvas.height))
  }
  native ??= new (nativeClass()!)({ formats: props.formats })
  const [first] = await native.detect(v)
  return first ? { rawValue: first.rawValue, format: first.format } : null
}

async function tick() {
  if (busy || cam.status.value !== 'live') return
  busy = true
  try {
    const result = await read()
    if (result?.rawValue && (result.rawValue !== last.value || Date.now() - last.at > 2000)) {
      last = { value: result.rawValue, at: Date.now() }
      hit.value = true
      setTimeout(() => (hit.value = false), 400)
      emit('update:modelValue', result.rawValue)
      emit('detect', result)
      if (props.once) stop()
    }
  } catch {
    // A frame that couldn't be read: try the next one
  } finally {
    busy = false
  }
}

function startScan() {
  clearInterval(timer)
  timer = setInterval(tick, props.interval)
}
function stop() {
  clearInterval(timer)
  cam.stop()
}

watch(cam.status, (s) => (s === 'live' ? startScan() : clearInterval(timer)))
watch(cam.error, (e) => { if (e) emit('error', e) })
watch(() => props.formats.join(), () => { native = null })

const errorText = computed(() => ({
  denied: t.cameraDenied, unavailable: t.cameraUnavailable, unsupported: t.cameraUnsupported, failed: t.cameraFailed,
})[cam.error.value ?? 'failed'])

onMounted(() => { if (props.autostart && supported.value) void cam.start() })
onBeforeUnmount(() => clearInterval(timer))

defineExpose({
  /** Starts the camera */
  start: () => cam.start(),
  /** Stops the camera */
  stop,
})
</script>

<template>
  <div class="m3-qr-scanner relative overflow-hidden rounded-xl bg-[#000] text-[#fff]" :style="{ aspectRatio: aspect }">
    <video ref="video" class="absolute inset-0 size-full object-cover" :class="{ invisible: cam.status.value !== 'live' }" playsinline muted />

    <!-- The viewfinder: the outside dimmed, the corners marked, a flash of primary on a read -->
    <div v-if="cam.status.value === 'live'" class="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        class="relative aspect-square w-3/5 rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] transition-[outline-color] duration-200"
        :class="hit ? 'outline-4 outline-primary' : 'outline-0 outline-transparent'"
      >
        <span v-for="c in ['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl']" :key="c" class="absolute size-8 border-[#fff]" :class="c" />
      </div>
      <p class="absolute bottom-4 rounded-full bg-[#000]/50 px-3 py-1 text-body-small">{{ t.qrHint }}</p>
    </div>
    <MIconButton
      v-if="cam.status.value === 'live' && cam.canSwitch.value"
      icon="cameraswitch"
      :label="t.cameraSwitch"
      class="absolute right-2 top-2 text-[#fff]"
      @click="cam.switchCamera()"
    />

    <div v-if="!supported" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
      <MIcon name="qr_code_scanner" :size="36" />
      <p class="max-w-72 text-body-medium">{{ t.qrUnsupported }}</p>
    </div>
    <div v-else-if="cam.status.value === 'idle'" class="absolute inset-0 grid place-items-center">
      <MButton variant="tonal" icon="qr_code_scanner" @click="cam.start()">{{ t.cameraStart }}</MButton>
    </div>
    <div v-else-if="cam.status.value === 'starting'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-body-medium" role="status">
      <MSpinner :size="32" />{{ t.cameraStarting }}
    </div>
    <div v-else-if="cam.status.value === 'error'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
      <MIcon :name="cam.error.value === 'denied' ? 'no_photography' : 'videocam_off'" :size="36" />
      <p class="max-w-72 text-body-medium">{{ errorText }}</p>
      <MButton v-if="cam.error.value !== 'unsupported'" variant="tonal" icon="refresh" @click="cam.start()">{{ t.cameraStart }}</MButton>
    </div>
  </div>
</template>
