import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import MAudioRecorder from '../components/MAudioRecorder.vue'

// A stand-in MediaRecorder: start/pause/resume/stop, a chunk on stop, then onstop
class FakeRecorder {
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus'
  static last: FakeRecorder | null = null
  state = 'inactive'
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(_s: unknown, o?: { mimeType?: string }) { this.mimeType = o?.mimeType ?? ''; FakeRecorder.last = this }
  start() { this.state = 'recording' }
  pause() { this.state = 'paused' }
  resume() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

let track: { stop: ReturnType<typeof vi.fn> }
let getUserMedia: ReturnType<typeof vi.fn>
let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.useFakeTimers()
  track = { stop: vi.fn() }
  getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }))
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:rec'), revokeObjectURL: vi.fn() }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const button = (label: string) => wrapper!.findAll('button').find((b) => b.attributes('aria-label') === label)!

async function record(props: Record<string, unknown> = {}, seconds = 3) {
  wrapper = mount(MAudioRecorder, { props })
  await button('Record').trigger('click')
  await flushPromises()
  await vi.advanceTimersByTimeAsync(seconds * 1000)
}

describe('MAudioRecorder', () => {
  it('records with the microphone in a supported format, showing the time', async () => {
    await record()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(FakeRecorder.last!.mimeType).toBe('audio/webm;codecs=opus')
    expect(wrapper!.text()).toMatch(/0:0[23]/)
    expect(button('Stop').exists()).toBe(true)
  })

  it('pauses and resumes, then stops into review, letting the microphone go', async () => {
    await record()
    await button('Pause').trigger('click')
    expect(FakeRecorder.last!.state).toBe('paused')
    await button('Resume').trigger('click')
    expect(FakeRecorder.last!.state).toBe('recording')
    await button('Stop').trigger('click')
    await flushPromises()
    expect(track.stop).toHaveBeenCalled()
    expect(button('Use recording').exists()).toBe(true)
    expect(button('Play').exists()).toBe(true)
  })

  it('emits the recording on Use, with its duration and peaks', async () => {
    await record({ bars: 20 }, 2)
    await button('Stop').trigger('click')
    await flushPromises()
    await button('Use recording').trigger('click')
    const rec = wrapper!.emitted('record')![0]![0] as { blob: Blob; url: string; duration: number; mimeType: string; peaks: number[] }
    expect(rec.blob).toBeInstanceOf(Blob)
    expect(rec.url).toBe('blob:rec')
    expect(rec.mimeType).toBe('audio/webm;codecs=opus')
    expect(rec.duration).toBeGreaterThanOrEqual(1.9)
    expect(rec.peaks).toHaveLength(20)
    expect(wrapper!.emitted('update:modelValue')![0]![0]).toBe(rec)
  })

  it('stops by itself at maxDuration, and uses it at once with instant', async () => {
    await record({ maxDuration: 2, instant: true }, 3)
    await flushPromises()
    expect(FakeRecorder.last!.state).toBe('inactive')
    expect(wrapper!.emitted('record')).toHaveLength(1)
  })

  it('discards while recording without emitting', async () => {
    await record()
    await button('Discard').trigger('click')
    await flushPromises()
    expect(track.stop).toHaveBeenCalled()
    expect(wrapper!.emitted('record')).toBeUndefined()
    expect(button('Record').exists()).toBe(true)
  })

  it('says when the microphone is denied, or recording is unsupported', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    wrapper = mount(MAudioRecorder)
    await button('Record').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Microphone access was denied')
    expect(wrapper.emitted('error')![0]).toEqual(['denied'])
    wrapper.unmount()
    vi.stubGlobal('MediaRecorder', undefined)
    wrapper = mount(MAudioRecorder)
    await button('Record').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain("This browser can't record audio")
  })

  it('lets the microphone go when unmounted mid-recording', async () => {
    await record()
    wrapper!.unmount()
    wrapper = undefined
    expect(track.stop).toHaveBeenCalled()
  })
})
