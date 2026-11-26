<script setup lang="ts">
/**
 * Takes a photo with the device's camera: a live preview, a shutter button, switching between the front and back
 * cameras, and Retake / Use photo once taken. The photo comes out as a `Blob` and a data URL (`capture`), and as the
 * v-model (the data URL). The camera starts on a button press (or `autostart`), and stops once the photo is used and
 * when unmounted. A denied permission or a missing camera says so, with a button to try again. Needs a secure page
 * (https or localhost).
 *
 * @event update:modelValue The photo used (a data URL), or null after Retake
 * @event capture The photo used: `{ blob, dataUrl, width, height }`
 * @event error The camera failed: `'denied' | 'unavailable' | 'unsupported' | 'failed'`
 */
import { computed, onMounted, ref, watch } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'
import { useCamera, type CameraError, type CameraFacing } from '../composables/_useCamera'

/** A photo taken by `MCameraCapture`. */
export interface CameraPhoto {
  blob: Blob
  dataUrl: string
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    /** The photo used (v-model): a data URL, or null */
    modelValue?: string | null
    /** Which camera to start with: the back one (`environment`) or the selfie one (`user`) */
    facing?: CameraFacing
    /** The preview's aspect ratio (CSS `aspect-ratio`) */
    aspect?: string
    /** The photo's format */
    type?: 'image/jpeg' | 'image/png' | 'image/webp'
    /** JPEG / WebP quality, 0–1 */
    quality?: number
    /** The resolution asked for (the longer side, ideal) */
    resolution?: number
    /** Start the camera on mount instead of on a button press */
    autostart?: boolean
  }>(),
  { modelValue: null, facing: 'environment', aspect: '4 / 3', type: 'image/jpeg', quality: 0.9, resolution: 1920, autostart: false },
)

const emit = defineEmits<{
  'update:modelValue': [dataUrl: string | null]
  capture: [photo: CameraPhoto]
  error: [error: CameraError]
}>()

const t = useLocale()
const video = ref<HTMLVideoElement>()
const cam = useCamera(video, { facing: () => props.facing, resolution: () => props.resolution })
const shot = ref<CameraPhoto | null>(null)

watch(cam.error, (e) => { if (e) emit('error', e) })

const errorText = computed(() => ({
  denied: t.cameraDenied, unavailable: t.cameraUnavailable, unsupported: t.cameraUnsupported, failed: t.cameraFailed,
})[cam.error.value ?? 'failed'])
// The selfie camera previews mirrored, as phones do; the photo isn't
const mirrored = computed(() => cam.facing.value === 'user')

async function capture() {
  const v = video.value
  if (!v || !v.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = v.videoWidth
  canvas.height = v.videoHeight
  canvas.getContext('2d')!.drawImage(v, 0, 0)
  const dataUrl = canvas.toDataURL(props.type, props.quality)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, props.type, props.quality))
  if (!blob) return
  shot.value = { blob, dataUrl, width: canvas.width, height: canvas.height }
  v.pause()
}

function retake() {
  shot.value = null
  if (props.modelValue) emit('update:modelValue', null)
  if (cam.status.value === 'live') void video.value?.play().catch(() => {})
  else void cam.start()
}

function use() {
  if (!shot.value) return
  emit('update:modelValue', shot.value.dataUrl)
  emit('capture', shot.value)
  cam.stop()
}

onMounted(() => { if (props.autostart) void cam.start() })

defineExpose({
  /** Starts the camera */
  start: () => cam.start(),
  /** Stops the camera */
  stop: cam.stop,
  /** Takes the photo now (as the shutter button) */
  capture,
})
</script>

<template>
  <div class="m3-camera relative overflow-hidden rounded-xl bg-[#000] text-[#fff]" :style="{ aspectRatio: aspect }">
    <!-- The used photo, once there is one and the camera is off -->
    <img v-if="modelValue && !shot && cam.status.value !== 'live'" :src="modelValue" alt="" class="absolute inset-0 size-full object-cover">

    <video
      ref="video"
      class="absolute inset-0 size-full object-cover"
      :class="[{ invisible: cam.status.value !== 'live' || shot }, mirrored ? '-scale-x-100' : '']"
      playsinline
      muted
    />
    <img v-if="shot" :src="shot.dataUrl" alt="" class="absolute inset-0 size-full object-cover">

    <!-- Off: a button to start (or to start again over the used photo) -->
    <div v-if="cam.status.value === 'idle' && !shot" class="absolute inset-0 grid place-items-center" :class="modelValue ? 'items-end p-4' : ''">
      <MButton variant="tonal" icon="photo_camera" @click="cam.start()">{{ modelValue ? t.cameraRetake : t.cameraStart }}</MButton>
    </div>
    <div v-else-if="cam.status.value === 'starting'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-body-medium" role="status">
      <MSpinner :size="32" />{{ t.cameraStarting }}
    </div>
    <div v-else-if="cam.status.value === 'error'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
      <MIcon :name="cam.error.value === 'denied' ? 'no_photography' : 'videocam_off'" :size="36" />
      <p class="max-w-72 text-body-medium">{{ errorText }}</p>
      <MButton v-if="cam.error.value !== 'unsupported'" variant="tonal" icon="refresh" @click="cam.start()">{{ t.cameraStart }}</MButton>
    </div>

    <!-- Live: switch, shutter -->
    <div v-if="cam.status.value === 'live' && !shot" class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-8 bg-gradient-to-t from-[#000]/60 to-transparent px-4 pb-4 pt-10">
      <MIconButton v-if="cam.canSwitch.value" icon="cameraswitch" :label="t.cameraSwitch" class="text-[#fff]" @click="cam.switchCamera()" />
      <span v-else class="size-10" />
      <button
        type="button"
        class="grid size-16 cursor-pointer place-items-center rounded-full border-4 border-[#fff] transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fff]"
        :aria-label="t.cameraCapture"
        @click="capture"
      >
        <span class="size-12 rounded-full bg-[#fff]" />
      </button>
      <span class="size-10" />
    </div>

    <!-- Taken: retake or use -->
    <div v-if="shot" class="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-[#000]/60 to-transparent px-4 pb-4 pt-10">
      <MButton variant="text" class="text-[#fff]" @click="retake">{{ t.cameraRetake }}</MButton>
      <MButton icon="check" @click="use">{{ t.cameraUsePhoto }}</MButton>
    </div>
  </div>
</template>
