import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import MCameraCapture from '../components/MCameraCapture.vue'
import MQRScanner from '../components/MQRScanner.vue'

// A stand-in camera: a stream whose tracks record being stopped
let tracks: { stop: ReturnType<typeof vi.fn> }[] = []
let getUserMedia: ReturnType<typeof vi.fn>
function camera(devices = 2) {
  getUserMedia = vi.fn(async () => {
    const track = { stop: vi.fn() }
    tracks.push(track)
    return { getTracks: () => [track] }
  })
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: {
      getUserMedia,
      enumerateDevices: async () => Array.from({ length: devices }, () => ({ kind: 'videoinput' })),
    },
  })
}

let wrapper: VueWrapper | undefined
beforeEach(() => {
  tracks = []
  // happy-dom has no media or canvas
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  // happy-dom only takes a real MediaStream here
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get() { return (this as unknown as { _s: unknown })._s ?? null },
    set(v) { (this as unknown as { _s: unknown })._s = v },
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(4) }),
  }) as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => 'data:image/jpeg;base64,AAA')
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(new Blob(['x'], { type: 'image/jpeg' })) })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const button = (text: string) => wrapper!.findAll('button').find((b) => b.text().includes(text) || b.attributes('aria-label') === text)!

describe('MCameraCapture', () => {
  it('starts on a press, asks for the back camera, and offers switching', async () => {
    camera()
    wrapper = mount(MCameraCapture)
    expect(getUserMedia).not.toHaveBeenCalled()
    await button('Turn on camera').trigger('click')
    await flushPromises()
    expect(getUserMedia.mock.calls[0]![0].video.facingMode).toEqual({ ideal: 'environment' })
    expect(button('Take photo').exists()).toBe(true)
    await button('Switch camera').trigger('click')
    await flushPromises()
    expect(getUserMedia.mock.calls[1]![0].video.facingMode).toEqual({ ideal: 'user' })
    // The previous stream let go
    expect(tracks[0]!.stop).toHaveBeenCalled()
    expect(wrapper.find('video').classes()).toContain('-scale-x-100')
  })

  it('takes a photo, retakes, uses it, and turns the camera off', async () => {
    camera()
    wrapper = mount(MCameraCapture, { props: { autostart: true } })
    await flushPromises()
    await button('Take photo').trigger('click')
    await flushPromises()
    expect(wrapper.find('img').attributes('src')).toBe('data:image/jpeg;base64,AAA')
    await button('Retake').trigger('click')
    await flushPromises()
    expect(button('Take photo').exists()).toBe(true)
    await button('Take photo').trigger('click')
    await flushPromises()
    await button('Use photo').trigger('click')
    const photo = wrapper.emitted('capture')![0]![0] as { blob: Blob; dataUrl: string; width: number; height: number }
    expect(photo).toMatchObject({ dataUrl: 'data:image/jpeg;base64,AAA', width: 640, height: 480 })
    expect(photo.blob).toBeInstanceOf(Blob)
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['data:image/jpeg;base64,AAA'])
    expect(tracks.at(-1)!.stop).toHaveBeenCalled()
  })

  it('says when access is denied, with a way to try again', async () => {
    camera()
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    wrapper = mount(MCameraCapture, { props: { autostart: true } })
    await flushPromises()
    expect(wrapper.text()).toContain('Camera access was denied')
    expect(wrapper.emitted('error')![0]).toEqual(['denied'])
    await button('Turn on camera').trigger('click')
    await flushPromises()
    expect(button('Take photo').exists()).toBe(true)
  })

  it('stops the camera when unmounted', async () => {
    camera(1)
    wrapper = mount(MCameraCapture, { props: { autostart: true } })
    await flushPromises()
    expect(wrapper.findAll('button').some((b) => b.attributes('aria-label') === 'Switch camera')).toBe(false)
    wrapper.unmount()
    wrapper = undefined
    expect(tracks[0]!.stop).toHaveBeenCalled()
  })
})

describe('MQRScanner', () => {
  it('says so when the browser can\'t read codes and no detector is given', () => {
    camera()
    wrapper = mount(MQRScanner)
    expect(wrapper.text()).toContain("This browser can't read codes")
  })

  it('reads with BarcodeDetector, once per code within 2 s, and stops with once', async () => {
    vi.useFakeTimers()
    camera()
    const detect = vi.fn(async () => [{ rawValue: 'https://m3ui.dev', format: 'qr_code' }])
    const ctor = vi.fn(function () { return { detect } })
    vi.stubGlobal('BarcodeDetector', ctor)
    wrapper = mount(MQRScanner, { props: { autostart: true, formats: ['qr_code', 'ean_13'] } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(260)
    expect(ctor).toHaveBeenCalledWith({ formats: ['qr_code', 'ean_13'] })
    expect(wrapper.emitted('detect')![0]).toEqual([{ rawValue: 'https://m3ui.dev', format: 'qr_code' }])
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('detect')).toHaveLength(1)
    await wrapper.setProps({ once: true })
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper.emitted('detect')).toHaveLength(2)
    expect(tracks[0]!.stop).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Turn on camera')
  })

  it('uses a detector of yours on the frame\'s ImageData', async () => {
    vi.useFakeTimers()
    camera()
    const detector = vi.fn((frame: ImageData) => (frame.width === 640 ? { rawValue: 'TICKET-42', format: 'qr_code' } : null))
    wrapper = mount(MQRScanner, { props: { autostart: true, detector } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(260)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['TICKET-42'])
  })
})
