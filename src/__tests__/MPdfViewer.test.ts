import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { PdfAnnotation } from '../components/MPdfViewer.vue'

vi.mock('pdfjs-dist', () => import('./pdfMock'))
const { fakeDoc } = await import('./pdfMock')
const { default: MPdfViewer, eraseFrom } = await import('../components/MPdfViewer.vue')

// happy-dom has no layout: the scroller is 640×480
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480)
  fakeDoc.password = ''
  fakeDoc.outline = []
  fakeDoc.pages = Array.from({ length: 4 }, (_, i) => ({ width: 612, height: 792, text: [{ str: `Page ${i + 1} talks about basil` }] }))
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

async function settle() {
  for (let i = 0; i < 8; i++) await flushPromises()
}

async function viewer(props: Record<string, unknown> = {}) {
  const w = mount(MPdfViewer, { props: { src: '/doc.pdf', ...props }, attachTo: document.body })
  await settle()
  return w
}

const pages = (w: ReturnType<typeof mount>) => w.findAll('.m3-pdf-page')
const pageBox = (w: ReturnType<typeof mount>, n: number) => pages(w)[n - 1]!.element.parentElement as HTMLElement

describe('MPdfViewer', () => {
  it('lays every page out at fit-width, with the title and page count', async () => {
    const w = await viewer()
    expect(pages(w)).toHaveLength(4)
    // (640 - 2 × 16 padding) / 612pt
    const box = pageBox(w, 1)
    expect(box.style.width).toBe('608px')
    expect(box.style.height).toBe(`${Math.floor(792 * (608 / 612))}px`)
    expect(w.text()).toContain('Fake document')
    expect(w.text()).toContain('/ 4')
  })

  it('a numeric zoom is relative to 100% (96/72 px per point), and the buttons step through it', async () => {
    const w = await viewer({ zoom: 1 })
    expect(pageBox(w, 1).style.width).toBe(`${Math.floor(612 * (96 / 72))}px`)
    expect(w.text()).toContain('100%')
    await w.find('[aria-label="Zoom in"]').trigger('click')
    expect(w.emitted('update:zoom')!.at(-1)).toEqual([1.25])
    await w.find('[aria-label="Zoom out"]').trigger('click')
    expect(w.emitted('update:zoom')!.at(-1)).toEqual([1])
  })

  it('v-model:page scrolls to that page', async () => {
    const w = await viewer()
    const scroller = w.find('.m3-pdf-scroller').element as HTMLElement
    const scrollTo = vi.fn()
    scroller.scrollTo = scrollTo as never
    await w.setProps({ page: 3 })
    const top = Number(pageBox(w, 3).style.top.replace('px', ''))
    expect(scrollTo).toHaveBeenCalledWith({ top: top - 16, behavior: 'auto' })
    expect(w.emitted('update:page')!.at(-1)).toEqual([3])
  })

  it('search marks the hits in the text layer and counts them', async () => {
    vi.useFakeTimers()
    const w = await viewer()
    await w.find('[aria-label="Find in document"]').trigger('click')
    await w.find('.m3-pdf-search input').setValue('basil')
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    await settle()
    expect(w.text()).toContain('1 of 4')
    const hits = w.findAll('.m3-pdf-hit')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.text()).toBe('basil')
    expect(w.findAll('.m3-pdf-hit-current')).toHaveLength(1)
  })

  it('the note tool places a note where clicked, in PDF points; undo takes it back', async () => {
    const annotations: PdfAnnotation[] = []
    const w = await viewer({ annotate: true, annotations, author: 'Mara' })
    await w.find('[aria-label="Annotate"]').trigger('click')
    await w.find('[aria-label="Note"]').trigger('click')
    const page = pages(w)[0]!.element as HTMLElement
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 608, height: 787, right: 608, bottom: 787, x: 0, y: 0, toJSON: () => ({}) })
    page.dispatchEvent(new MouseEvent('click', { clientX: 304, clientY: 100, bubbles: true }))
    const next = w.emitted('update:annotations')!.at(-1)![0] as PdfAnnotation[]
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ type: 'note', page: 1, author: 'Mara' })
    // Half the page's width, 100px from the top: y counts up from the bottom
    expect(next[0]!.at![0]).toBeCloseTo(306, 0)
    expect(next[0]!.at![1]).toBeGreaterThan(600)
    await w.setProps({ annotations: next })
    await w.find('[aria-label="Undo"]').trigger('click')
    expect(w.emitted('update:annotations')!.at(-1)![0]).toEqual([])
  })

  it('draws annotations from the model, and the eraser removes them', async () => {
    const annotations: PdfAnnotation[] = [
      { id: 'h', type: 'highlight', page: 1, color: '#ff0', rects: [[72, 700, 200, 712]], createdAt: '' },
      { id: 'n', type: 'note', page: 2, color: '#0f0', at: [100, 100], text: 'Hi', createdAt: '' },
    ]
    const w = await viewer({ annotate: true, annotations })
    expect(w.findAll('.m3-pdf-highlight rect')).toHaveLength(1)
    expect(w.findAll('.m3-pdf-note')).toHaveLength(1)
    await w.find('[aria-label="Annotate"]').trigger('click')
    await w.find('[aria-label="Eraser"]').trigger('click')
    await w.find('.m3-pdf-note').trigger('click')
    expect((w.emitted('update:annotations')!.at(-1)![0] as PdfAnnotation[]).map((a) => a.id)).toEqual(['h'])
  })

  it('eraseFrom cuts a stroke where the eraser passes, and takes highlights and notes it touches', () => {
    const line: PdfAnnotation = { id: 'i', type: 'ink', page: 1, color: '#000', width: 2, paths: [[[0, 0], [10, 0], [20, 0], [30, 0], [40, 0], [50, 0]]], createdAt: '' }
    // The middle goes: two strokes are left
    const cut = eraseFrom(line, { x: 25, y: 0, r: 3 })!
    expect(cut.paths).toEqual([[[0, 0], [10, 0], [20, 0]], [[30, 0], [40, 0], [50, 0]]])
    // A fast drag across a long segment, between its points, still cuts it
    const across = eraseFrom({ ...line, paths: [[[0, 0], [100, 0]]] }, { x: 50, y: 1, r: 3 })
    expect(across).toBe(null)
    // Out of reach: untouched, the same object
    expect(eraseFrom(line, { x: 25, y: 30, r: 3 })).toBe(line)
    // Erasing the end of a stroke leaves the rest
    expect(eraseFrom(line, { x: 50, y: 0, r: 3 })!.paths).toEqual([[[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]]])
    const hl: PdfAnnotation = { id: 'h', type: 'highlight', page: 1, color: '#ff0', rects: [[10, 10, 90, 22]], createdAt: '' }
    expect(eraseFrom(hl, { x: 50, y: 16, r: 2 })).toBe(null)
    expect(eraseFrom(hl, { x: 50, y: 60, r: 2 })).toBe(hl)
  })

  it('dragging the eraser over a drawing cuts it, as one undo step', async () => {
    const annotations: PdfAnnotation[] = [
      { id: 'i', type: 'ink', page: 1, color: '#000', width: 2, paths: [Array.from({ length: 21 }, (_, k) => [100 + k * 10, 500] as [number, number])], createdAt: '' },
    ]
    const w = await viewer({ annotate: true, annotations, zoom: 1 })
    await w.find('[aria-label="Annotate"]').trigger('click')
    await w.find('[aria-label="Eraser"]').trigger('click')
    const page = pages(w)[0]!.element as HTMLElement
    const scale = 96 / 72
    const width = Math.floor(612 * scale)
    const height = Math.floor(792 * scale)
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) })
    const svg = page.querySelector('svg')!
    // Across the stroke's middle, top to bottom (y = 500pt from the bottom)
    const yPx = (792 - 500) * scale
    const ev = (type: string, y: number) => svg.dispatchEvent(new PointerEvent(type, { clientX: 200 * scale, clientY: y, pointerId: 3, button: 0, pointerType: 'pen', bubbles: true }))
    ev('pointerdown', yPx - 30)
    for (let d = -20; d <= 30; d += 5) ev('pointermove', yPx + d)
    ev('pointerup', yPx + 30)
    const next = w.emitted('update:annotations')!.at(-1)![0] as PdfAnnotation[]
    expect(next).toHaveLength(1)
    expect(next[0]!.paths!.length).toBe(2)
    await w.setProps({ annotations: next })
    await w.find('[aria-label="Undo"]').trigger('click')
    expect(w.emitted('update:annotations')!.at(-1)![0]).toEqual(annotations)
  })

  it('asks for the password of an encrypted file', async () => {
    fakeDoc.password = 'm3ui'
    const w = await viewer()
    expect(w.text()).toContain('password protected')
    await w.find('input[type="password"]').setValue('m3ui')
    await w.find('form').trigger('submit')
    await settle()
    expect(pages(w)).toHaveLength(4)
  })

  it('shows #empty without a src, and forwards attrs to its root', async () => {
    const w = mount(MPdfViewer, { props: { src: null }, slots: { empty: 'Pick a file' }, attrs: { class: 'h-96', 'data-x': '1' } })
    await settle()
    expect(w.text()).toContain('Pick a file')
    expect(w.classes()).toContain('h-96')
    // Its position/display defaults live in @layer base (.m3-pdf), so a consumer's `absolute inset-0` wins:
    // a `relative` utility on the root beat it and the viewer collapsed when its side panel closed
    expect(w.classes()).not.toContain('relative')
    expect(w.classes()).not.toContain('flex')
    expect(w.attributes('data-x')).toBe('1')
  })
  it('keeps the reading point when the width changes a fit mode (the side panel opening)', async () => {
    const callbacks: (() => void)[] = []
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { callbacks.push(cb) }
      observe() {}
      disconnect() {}
    })
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    const w = await viewer()
    const scroller = w.find('.m3-pdf-scroller').element as HTMLElement
    // A third of the way into page 3, under the reading point (a third of the 480px view)
    const before = pageBox(w, 3)
    const top3 = parseFloat(before.style.top)
    const h3 = parseFloat(before.style.height)
    scroller.scrollTop = top3 + h3 / 3 - 160
    scroller.dispatchEvent(new Event('scroll'))
    width.mockReturnValue(400)
    callbacks.forEach((cb) => cb())
    await nextTick()
    await nextTick()
    const after = pageBox(w, 3)
    const point = scroller.scrollTop + 160
    expect(parseFloat(after.style.height)).toBeLessThan(h3)
    expect((point - parseFloat(after.style.top)) / parseFloat(after.style.height)).toBeCloseTo(1 / 3, 1)
    expect(w.emitted('update:page')?.at(-1)).toEqual([3])
    vi.unstubAllGlobals()
  })
})
