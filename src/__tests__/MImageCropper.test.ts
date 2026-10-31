import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MImageCropper from '../components/MImageCropper.vue'
import type { CropRect } from '../components/MImageCropper.vue'

// A 448 × 348 stage (400 × 300 inside the padding) and an 800 × 600 picture: half scale
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(448)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(348)
})
afterEach(() => vi.restoreAllMocks())

async function cropper(props: Record<string, unknown> = {}) {
  const w = mount(MImageCropper, { props: { src: 'photo.jpg', ...props }, attachTo: document.body })
  await nextTick()
  const img = w.find('img').element as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: 800 })
  Object.defineProperty(img, 'naturalHeight', { value: 600 })
  await w.find('img').trigger('load')
  await flushPromises()
  return w
}
const last = (w: ReturnType<typeof mount>) => w.emitted('update:crop')!.at(-1)![0] as CropRect
function pointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }))
}

describe('MImageCropper', () => {
  it('starts with the whole picture, or the largest frame of the aspect, centered', async () => {
    expect(last(await cropper())).toEqual({ x: 0, y: 0, width: 800, height: 600 })
    expect(last(await cropper({ aspect: 1 }))).toEqual({ x: 100, y: 0, width: 600, height: 600 })
  })

  it('moves the frame, kept inside the picture', async () => {
    const w = await cropper({ aspect: 1 })
    const frame = w.find('[role="slider"]').element
    pointer(frame, 'pointerdown', 200, 150)
    // 100 px on screen = 200 px of picture, but only 100 are left to the right
    pointer(frame, 'pointermove', 300, 150)
    pointer(frame, 'pointerup', 300, 150)
    expect(last(w)).toEqual({ x: 200, y: 0, width: 600, height: 600 })
    expect(w.emitted('change')!.at(-1)![0]).toEqual({ x: 200, y: 0, width: 600, height: 600 })
  })

  it('resizes from a corner keeping the aspect, the opposite corner fixed', async () => {
    const w = await cropper({ aspect: 1 })
    const se = w.findAll('[role="slider"] > div').find((d) => d.classes().includes('cursor-nwse-resize') && d.classes().includes('top-full'))!.element
    pointer(se, 'pointerdown', 0, 0)
    pointer(se, 'pointermove', -100, -40)
    pointer(se, 'pointerup', -100, -40)
    // The bigger pull (width, -200) decides: 400 × 400 from the top left corner
    expect(last(w)).toEqual({ x: 100, y: 0, width: 400, height: 400 })
  })

  it('free frames resize each side on its own; arrows move, Shift + arrows resize', async () => {
    const w = await cropper()
    const frame = w.find('[role="slider"]')
    const e = w.findAll('[role="slider"] > div').find((d) => d.classes().includes('cursor-ew-resize') && d.classes().includes('left-full'))!.element
    pointer(e, 'pointerdown', 0, 0)
    pointer(e, 'pointermove', -50, 30)
    pointer(e, 'pointerup', -50, 30)
    expect(last(w)).toEqual({ x: 0, y: 0, width: 700, height: 600 })
    await frame.trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(last(w)).toEqual({ x: 20, y: 0, width: 700, height: 600 })
    await frame.trigger('keydown', { key: 'ArrowDown', shiftKey: true, altKey: true })
    // Already full height
    expect(last(w).height).toBe(600)
  })

  it('turns and mirrors the frame with the picture', async () => {
    const w = await cropper({ crop: { x: 100, y: 50, width: 200, height: 100 } })
    const vm = w.vm as unknown as { rotate(d: 1 | -1): void; flip(): void; setAspect(a: number | null): void; reset(): void }
    vm.rotate(1)
    // 600 × 800 now: the top left corner goes top right
    expect(w.emitted('update:rotation')!.at(-1)![0]).toBe(90)
    expect(last(w)).toEqual({ x: 450, y: 100, width: 100, height: 200 })
    vm.flip()
    // Mirrored as seen: the turn's direction flips with it
    expect(w.emitted('update:flipped')!.at(-1)![0]).toBe(true)
    expect(w.emitted('update:rotation')!.at(-1)![0]).toBe(270)
    expect(last(w)).toEqual({ x: 50, y: 100, width: 100, height: 200 })
    vm.setAspect(1)
    expect(last(w)).toEqual({ x: 0, y: 100, width: 200, height: 200 })
    // Back to no turn and no mirror; the aspect chosen stays
    vm.reset()
    expect(last(w)).toEqual({ x: 100, y: 0, width: 600, height: 600 })
  })
})
