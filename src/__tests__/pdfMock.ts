// A fake pdfjs-dist for tests (happy-dom can't run pdf.js): pages with sizes, text and links, an outline, metadata
// and an optional password, with the calls the library makes.
import { vi } from 'vitest'

export interface FakePage { width: number; height: number; text: { str: string; hasEOL?: boolean }[]; links?: { rect: number[]; url?: string; dest?: unknown }[] }

export const fakeDoc = {
  pages: [] as FakePage[],
  password: '' as string,
  outline: [] as unknown[],
  title: 'Fake document',
}

class Viewport {
  constructor(public width: number, public height: number, public scale: number, public rotation: number) {}
  convertToViewportPoint(x: number, y: number) { return [x * this.scale, this.height - y * this.scale] }
  convertToPdfPoint(x: number, y: number) { return [x / this.scale, (this.height - y) / this.scale] }
  get rawDims() { return { pageWidth: this.width / this.scale, pageHeight: this.height / this.scale } }
}

function page(i: number) {
  const p = fakeDoc.pages[i]!
  return {
    rotate: 0,
    getViewport: ({ scale = 1, rotation = 0 }: { scale?: number; rotation?: number } = {}) => {
      const swap = rotation % 180 !== 0
      return new Viewport((swap ? p.height : p.width) * scale, (swap ? p.width : p.height) * scale, scale, rotation)
    },
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    getTextContent: async () => ({ items: p.text.map((t) => ({ str: t.str, hasEOL: !!t.hasEOL, transform: [1, 0, 0, 1, 0, 0] })) }),
    getAnnotations: async () => (p.links ?? []).map((l) => ({ subtype: 'Link', ...l })),
    cleanup: () => {},
  }
}

export const getDocument = vi.fn((_params: Record<string, unknown>) => {
  const task: Record<string, unknown> = { destroy: vi.fn() }
  task.promise = (async () => {
    await Promise.resolve()
    if (fakeDoc.password && _params.password !== fakeDoc.password) {
      // Ask until the right one comes
      let tried = _params.password as string | undefined
      while (tried !== fakeDoc.password) {
        tried = await new Promise<string>((resolve) => (task.onPassword as (cb: (p: string) => void, reason: number) => void)(resolve, tried === undefined ? 1 : 2))
      }
    }
    return {
      numPages: fakeDoc.pages.length,
      getPage: async (n: number) => page(n - 1),
      getOutline: async () => fakeDoc.outline,
      getMetadata: async () => ({ info: { Title: fakeDoc.title }, metadata: null }),
      getDestination: async (name: string) => (name === 'ch2' ? [{ num: 1 }, { name: 'XYZ' }, 0, 700, null] : null),
      getPageIndex: async (ref: { num: number }) => ref.num,
      getData: async () => new Uint8Array([37, 80, 68, 70]),
      destroy: vi.fn(),
    }
  })()
  return task
})

export class TextLayer {
  textDivs: HTMLElement[] = []
  textContentItemsStr: string[] = []
  constructor(private o: { textContentSource: { items: { str: string }[] }; container: HTMLElement }) {}
  async render() {
    for (const item of this.o.textContentSource.items) {
      const span = document.createElement('span')
      span.textContent = item.str
      this.o.container.appendChild(span)
      this.textDivs.push(span)
      this.textContentItemsStr.push(item.str)
    }
  }
  cancel() {}
}

export class TouchManager {
  constructor(_o: unknown) {}
}

export const GlobalWorkerOptions = { workerSrc: 'fake-worker.js' }
export const PasswordResponses = { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 }
export const PDFDateString = { toDateObject: () => null }
