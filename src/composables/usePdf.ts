import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref, type ShallowRef } from 'vue'
import type * as Pdfjs from 'pdfjs-dist'

/** The `pdfjs-dist` module */
export type PdfjsModule = typeof import('pdfjs-dist')
export type PdfDocument = Pdfjs.PDFDocumentProxy
export type PdfPage = Pdfjs.PDFPageProxy

/** What `usePdf` loads: a URL, the file's bytes, or a `File`/`Blob` (an upload) */
export type PdfSource = string | URL | Uint8Array | ArrayBuffer | Blob

export interface PdfOutlineItem {
  title: string
  /** 1-based page it points to (undefined for an external link or a destination that can't be resolved) */
  page?: number
  /** Where on that page, in PDF points from the bottom, when the destination says */
  top?: number
  /** An external link */
  url?: string
  children: PdfOutlineItem[]
}

export interface PdfSearchMatch {
  /** 1-based page */
  page: number
  /** Index of the match on its page */
  index: number
  /** Character offsets in the page's text (see `pageText`) */
  start: number
  end: number
  /** The text around it, for a results list */
  context: string
}

export interface PdfMetadata {
  title?: string
  author?: string
  subject?: string
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
}

/** A page's text as `usePdf` indexes it: its text items joined, and where each item starts */
export interface PdfPageText {
  text: string
  /** Start offset of each text item (the text layer's spans, in order) */
  starts: number[]
}

export interface PdfOptions {
  /** A password to try first (the `needsPassword` flow handles the rest) */
  password?: MaybeRefOrGetter<string | undefined>
  /** Send cookies with a cross-origin URL */
  withCredentials?: boolean
  /**
   * The pdf.js worker's URL (with Vite: `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`), or
   * set it once for the app with `setPdfWorker()`. Without one, pdf.js runs on the main thread: it works, but
   * parsing a big file blocks the page meanwhile
   */
  workerSrc?: string
}

export interface PdfState {
  /** The pdf.js document, once loaded */
  doc: ShallowRef<PdfDocument | null>
  /** The `pdfjs-dist` module, loaded with the first document */
  pdfjs: ShallowRef<PdfjsModule | null>
  loading: Readonly<Ref<boolean>>
  /** Download progress, 0 to 1 (0 while the size is unknown) */
  progress: Readonly<Ref<number>>
  error: Readonly<Ref<Error | null>>
  /** The file is encrypted: call `submitPassword()` */
  needsPassword: Readonly<Ref<boolean>>
  /** The last password was wrong */
  wrongPassword: Readonly<Ref<boolean>>
  submitPassword: (password: string) => void
  numPages: Readonly<Ref<number>>
  /**
   * Each page's size in PDF points at zoom 1, with its own rotation (index 0 = page 1). Every page starts as the
   * first one's size and gets its own as the pages are read, in the background
   */
  pageSizes: Readonly<Ref<{ width: number; height: number }[]>>
  outline: Readonly<Ref<PdfOutlineItem[]>>
  metadata: Readonly<Ref<PdfMetadata>>
  getPage: (page: number) => Promise<PdfPage>
  /** A page's text (cached) */
  pageText: (page: number) => Promise<PdfPageText>
  /** Finds text in every page (case and accent insensitive unless `caseSensitive`) */
  search: (query: string, options?: { caseSensitive?: boolean; signal?: AbortSignal }) => Promise<PdfSearchMatch[]>
  /** A picture of a page `width` CSS pixels wide, as an object URL (cached; revoked when the document changes) */
  thumbnail: (page: number, width?: number) => Promise<string>
  /** Resolves a link destination (a name or an explicit array) to a page and a position */
  resolveDest: (dest: unknown) => Promise<{ page: number; top?: number } | null>
  /** The file's bytes */
  getData: () => Promise<Uint8Array>
  /** Saves the file */
  download: (fileName?: string) => Promise<void>
  /** Opens the browser's print dialog for the file */
  print: () => Promise<void>
}

let globalWorkerSrc: string | undefined

/** Sets the pdf.js worker URL for every `usePdf`/`MPdfViewer` of the app (see `PdfOptions.workerSrc`) */
export function setPdfWorker(src: string) {
  globalWorkerSrc = src
}

let pdfjsPromise: Promise<PdfjsModule> | null = null

/** Internal: loads pdf.js once, with its worker (or, without one, the worker's code on the main thread) */
export function loadPdfjs(workerSrc?: string): Promise<PdfjsModule> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import('pdfjs-dist')
    const src = workerSrc ?? globalWorkerSrc
    if (src) pdfjs.GlobalWorkerOptions.workerSrc = src
    // @ts-ignore: the worker module has no types (importing it registers globalThis.pdfjsWorker)
    else if (!pdfjs.GlobalWorkerOptions.workerSrc) await import('pdfjs-dist/build/pdf.worker.min.mjs')
    return pdfjs
  })()
  return pdfjsPromise
}

// Case and accent folding that keeps one character per character, so offsets stay valid
function fold(s: string, caseSensitive: boolean) {
  let out = ''
  for (const c of s) {
    const base = c.normalize('NFD').replace(/\p{M}/gu, '')
    const one = base.length === 1 ? base : c
    out += caseSensitive ? one : one.toLowerCase()
  }
  return out
}

function parseDate(pdfjs: PdfjsModule, v: unknown) {
  return typeof v === 'string' ? pdfjs.PDFDateString.toDateObject(v) ?? undefined : undefined
}

/**
 * Loads a PDF with pdf.js and exposes what a viewer needs: pages and their sizes, the outline, metadata, text
 * search, thumbnails, download and print. `MPdfViewer` is built on it; use it for a viewer of your own, a
 * thumbnail grid, or a search over a document. Reactive to `src`: a new one replaces the document.
 *
 * ```ts
 * const pdf = usePdf(() => file.value)
 * watchEffect(async () => { if (pdf.doc.value) cover.value = await pdf.thumbnail(1, 160) })
 * const hits = await pdf.search('invoice')
 * ```
 */
export function usePdf(src: MaybeRefOrGetter<PdfSource | null | undefined>, options: PdfOptions = {}): PdfState {
  const doc = shallowRef<PdfDocument | null>(null)
  const pdfjs = shallowRef<PdfjsModule | null>(null)
  const loading = ref(false)
  const progress = ref(0)
  const error = shallowRef<Error | null>(null)
  const needsPassword = ref(false)
  const wrongPassword = ref(false)
  const pageSizes = shallowRef<{ width: number; height: number }[]>([])
  const outline = shallowRef<PdfOutlineItem[]>([])
  const metadata = shallowRef<PdfMetadata>({})
  const numPages = computed(() => doc.value?.numPages ?? 0)

  let task: Pdfjs.PDFDocumentLoadingTask | null = null
  let passwordCallback: ((pw: string) => void) | null = null
  let generation = 0
  const texts = new Map<number, Promise<PdfPageText>>()
  const thumbs = new Map<string, Promise<string>>()

  function reset() {
    for (const p of thumbs.values()) p.then((url) => URL.revokeObjectURL(url), () => {})
    thumbs.clear()
    texts.clear()
    const old = task
    task = null
    old?.destroy()
    doc.value = null
    pageSizes.value = []
    outline.value = []
    metadata.value = {}
    needsPassword.value = false
    wrongPassword.value = false
    passwordCallback = null
  }

  async function load(source: PdfSource | null | undefined) {
    const gen = ++generation
    reset()
    error.value = null
    progress.value = 0
    if (!source || typeof window === 'undefined') {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const lib = await loadPdfjs(options.workerSrc)
      if (gen !== generation) return
      pdfjs.value = lib
      let data: Uint8Array | undefined
      let url: string | undefined
      if (typeof source === 'string' || source instanceof URL) url = String(source)
      else if (source instanceof Blob) data = new Uint8Array(await source.arrayBuffer())
      // pdf.js transfers the buffer to its worker: give it a copy, so the caller's stays usable
      else data = new Uint8Array(source instanceof ArrayBuffer ? source.slice(0) : source.slice())
      if (gen !== generation) return
      task = lib.getDocument({ url, data, password: toValue(options.password), withCredentials: options.withCredentials })
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (gen === generation && total) progress.value = Math.min(1, loaded / total)
      }
      task.onPassword = (update: (pw: string) => void, reason: number) => {
        if (gen !== generation) return
        passwordCallback = update
        wrongPassword.value = reason === lib.PasswordResponses.INCORRECT_PASSWORD
        needsPassword.value = true
      }
      const mine = task
      const d = await mine.promise
      if (gen !== generation) {
        mine.destroy()
        return
      }
      needsPassword.value = false
      wrongPassword.value = false
      progress.value = 1
      const first = (await d.getPage(1)).getViewport({ scale: 1 })
      pageSizes.value = Array.from({ length: d.numPages }, () => ({ width: first.width, height: first.height }))
      doc.value = d
      loading.value = false
      readSizes(d, gen)
      readOutline(d, gen)
      readMetadata(d, lib, gen)
    } catch (e) {
      if (gen !== generation) return
      error.value = e instanceof Error ? e : new Error(String(e))
      loading.value = false
    }
  }

  // Every page's own size, a batch at a time so a long document lays out right without blocking anything
  async function readSizes(d: PdfDocument, gen: number) {
    const sizes = pageSizes.value.slice()
    let changed = false
    for (let i = 2; i <= d.numPages; i++) {
      if (gen !== generation) return
      const v = (await d.getPage(i)).getViewport({ scale: 1 })
      const s = sizes[i - 1]!
      if (s.width !== v.width || s.height !== v.height) {
        sizes[i - 1] = { width: v.width, height: v.height }
        changed = true
      }
      if (changed && (i % 25 === 0 || i === d.numPages)) {
        pageSizes.value = sizes.slice()
        changed = false
      }
    }
  }

  async function resolveDest(dest: unknown): Promise<{ page: number; top?: number } | null> {
    const d = doc.value
    if (!d || !dest) return null
    try {
      const explicit = typeof dest === 'string' ? await d.getDestination(dest) : (dest as unknown[])
      if (!Array.isArray(explicit)) return null
      const ref = explicit[0]
      const index = typeof ref === 'number' ? ref : await d.getPageIndex(ref as Parameters<PdfDocument['getPageIndex']>[0])
      // [ref, { name: 'XYZ' }, left, top, zoom] or [ref, { name: 'FitH' }, top]
      const kind = (explicit[1] as { name?: string } | undefined)?.name
      const top = kind === 'XYZ' ? explicit[3] : kind === 'FitH' || kind === 'FitBH' ? explicit[2] : null
      return { page: index + 1, top: typeof top === 'number' ? top : undefined }
    } catch {
      return null
    }
  }

  async function readOutline(d: PdfDocument, gen: number) {
    const raw = await d.getOutline().catch(() => null)
    if (!raw || gen !== generation) return
    type Raw = { title: string; dest: unknown; url: string | null; items: Raw[] }
    const walk = async (items: Raw[]): Promise<PdfOutlineItem[]> =>
      Promise.all(items.map(async (it) => {
        const at = it.dest ? await resolveDest(it.dest) : null
        return { title: it.title, page: at?.page, top: at?.top, url: it.url ?? undefined, children: await walk(it.items ?? []) }
      }))
    const tree = await walk(raw as Raw[])
    if (gen === generation) outline.value = tree
  }

  async function readMetadata(d: PdfDocument, lib: PdfjsModule, gen: number) {
    const m = await d.getMetadata().catch(() => null)
    if (!m || gen !== generation) return
    const info = m.info as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)
    metadata.value = {
      title: str(m.metadata?.get('dc:title')) ?? str(info.Title),
      author: str(m.metadata?.get('dc:creator')) ?? str(info.Author),
      subject: str(info.Subject),
      creator: str(info.Creator),
      producer: str(info.Producer),
      creationDate: parseDate(lib, info.CreationDate),
      modificationDate: parseDate(lib, info.ModDate),
    }
  }

  async function getPage(n: number) {
    const d = doc.value
    if (!d) throw new Error('No document loaded')
    return d.getPage(n)
  }

  function pageText(n: number): Promise<PdfPageText> {
    let p = texts.get(n)
    if (!p) {
      p = getPage(n).then(async (page) => {
        const content = await page.getTextContent()
        let text = ''
        const starts: number[] = []
        for (const item of content.items) {
          if (!('str' in item)) continue
          starts.push(text.length)
          text += item.str
          // A line break reads as a space, so a phrase split across lines is still found
          if (item.hasEOL) text += ' '
        }
        return { text, starts }
      })
      texts.set(n, p)
    }
    return p
  }

  async function search(query: string, opts: { caseSensitive?: boolean; signal?: AbortSignal } = {}) {
    const q = fold(query.trim(), !!opts.caseSensitive)
    const out: PdfSearchMatch[] = []
    if (!q || !doc.value) return out
    for (let n = 1; n <= numPages.value; n++) {
      if (opts.signal?.aborted) break
      const { text } = await pageText(n)
      const hay = fold(text, !!opts.caseSensitive)
      let index = 0
      for (let at = hay.indexOf(q); at >= 0; at = hay.indexOf(q, at + q.length)) {
        const a = Math.max(0, at - 40)
        const b = Math.min(text.length, at + q.length + 40)
        out.push({ page: n, index: index++, start: at, end: at + q.length, context: (a ? '…' : '') + text.slice(a, b).trim() + (b < text.length ? '…' : '') })
      }
    }
    return out
  }

  function thumbnail(n: number, width = 160): Promise<string> {
    const ratio = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
    const key = `${n}@${width}`
    let p = thumbs.get(key)
    if (!p) {
      p = getPage(n).then(async (page) => {
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (width / base.width) * ratio })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('Thumbnail failed')
        return URL.createObjectURL(blob)
      })
      thumbs.set(key, p)
    }
    return p
  }

  const getData = async () => {
    const d = doc.value
    if (!d) throw new Error('No document loaded')
    return d.getData()
  }

  async function blobUrl() {
    const bytes = await getData()
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  }

  async function download(fileName?: string) {
    const url = await blobUrl()
    const s = toValue(src)
    const fromUrl = typeof s === 'string' ? decodeURIComponent(s.split(/[?#]/)[0]!.split('/').pop() ?? '') : ''
    const a = document.createElement('a')
    a.href = url
    a.download = fileName ?? (s instanceof File ? s.name : fromUrl.toLowerCase().endsWith('.pdf') ? fromUrl : `${metadata.value.title ?? 'document'}.pdf`)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  // The browser's own PDF viewer prints it, in a hidden frame
  async function print() {
    const url = await blobUrl()
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    frame.src = url
    frame.onload = () => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch {
        window.open(url, '_blank')
      }
      setTimeout(() => {
        frame.remove()
        URL.revokeObjectURL(url)
      }, 60_000)
    }
    document.body.appendChild(frame)
  }

  function submitPassword(pw: string) {
    const cb = passwordCallback
    if (!cb) return
    passwordCallback = null
    needsPassword.value = false
    cb(pw)
  }

  watch(() => toValue(src), (s) => { load(s) }, { immediate: true })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      generation++
      reset()
    })
  }

  return {
    doc,
    pdfjs,
    loading,
    progress,
    error,
    needsPassword,
    wrongPassword,
    submitPassword,
    numPages,
    pageSizes,
    outline,
    metadata,
    getPage,
    pageText,
    search,
    thumbnail,
    resolveDest,
    getData,
    download,
    print,
  }
}
