/*
 * Internal (not exported from index.ts): the camera behind MCameraCapture and MQRScanner. Starts a getUserMedia
 * stream on a <video>, switches between the front and back cameras, stops every track when stopped or unmounted
 * (so the browser's camera light goes off), and turns failures into a kind the components word through the locale.
 */
import { onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'

export type CameraFacing = 'user' | 'environment'
export type CameraError = 'denied' | 'unavailable' | 'unsupported' | 'failed'

export function useCamera(video: Ref<HTMLVideoElement | null | undefined>, options: { facing: () => CameraFacing; resolution?: () => number }) {
  const stream = shallowRef<MediaStream | null>(null)
  const status = ref<'idle' | 'starting' | 'live' | 'error'>('idle')
  const error = ref<CameraError | null>(null)
  const facing = ref<CameraFacing>(options.facing())
  /** More than one camera: worth offering to switch */
  const canSwitch = ref(false)

  function stop() {
    stream.value?.getTracks().forEach((t) => t.stop())
    stream.value = null
    if (video.value) video.value.srcObject = null
    if (status.value !== 'error') status.value = 'idle'
  }

  async function start(next: CameraFacing = facing.value) {
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!media?.getUserMedia) {
      status.value = 'error'
      error.value = 'unsupported'
      return
    }
    stop()
    facing.value = next
    status.value = 'starting'
    error.value = null
    const ideal = options.resolution?.() ?? 1280
    try {
      const s = await media.getUserMedia({ audio: false, video: { facingMode: { ideal: next }, width: { ideal }, height: { ideal } } })
      stream.value = s
      if (video.value) {
        video.value.srcObject = s
        await video.value.play().catch(() => {})
      }
      status.value = 'live'
      try {
        const devices = await media.enumerateDevices?.()
        canSwitch.value = (devices ?? []).filter((d) => d.kind === 'videoinput').length > 1
      } catch {
        canSwitch.value = false
      }
    } catch (e) {
      const name = (e as { name?: string })?.name
      status.value = 'error'
      error.value = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' ? 'unavailable'
          : 'failed'
    }
  }

  const switchCamera = () => start(facing.value === 'user' ? 'environment' : 'user')

  onBeforeUnmount(stop)

  return { stream, status, error, facing, canSwitch, start, stop, switchCamera }
}
