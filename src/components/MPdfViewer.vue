<script lang="ts">
/** One annotation, in PDF points (origin at the page's bottom left), so it survives zoom, rotation and reflows */
export interface PdfAnnotation {
  id: string
  type: 'highlight' | 'note' | 'ink'
  /** 1-based page */
  page: number
  /** Any CSS color */
  color: string
  /** highlight: the selected lines, `[x1, y1, x2, y2]` each */
  rects?: [number, number, number, number][]
  /** highlight: the text it covers */
  quote?: string
  /** note: where its icon sits */
  at?: [number, number]
  /** ink: strokes, each a list of points */
  paths?: [number, number][][]
  /** ink: stroke width in points */
  width?: number
  /** A note's text, or a comment on a highlight or drawing */
  text?: string
  author?: string
  /** ISO date */
  createdAt: string
}

export type PdfTool = 'select' | 'highlight' | 'note' | 'ink' | 'eraser'

/**
 * What's left of an annotation after the eraser passed over `at` (PDF points, radius `r`): an ink stroke is cut
 * where it passes (null once nothing is left), a highlight or a note it touches goes entirely. The same object
 * back means it wasn't touched
 */
export function eraseFrom(a: PdfAnnotation, at: { x: number; y: number; r: number }): PdfAnnotation | null {
  const { x, y, r } = at
  if (a.type === 'note') {
    const [nx, ny] = a.at ?? [0, 0]
    return Math.hypot(nx - x, ny - y) <= r + 10 ? null : a
  }
  if (a.type === 'highlight') {
    const hit = (a.rects ?? []).some(([x1, y1, x2, y2]) =>
      x >= Math.min(x1, x2) - r && x <= Math.max(x1, x2) + r && y >= Math.min(y1, y2) - r && y <= Math.max(y1, y2) + r)
    return hit ? null : a
  }
  const reach = r + (a.width ?? 2) / 2
  // Distance from the eraser to a segment
  const near = (p: [number, number], q: [number, number]) => {
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / len)) : 0
    return Math.hypot(p[0] + t * dx - x, p[1] + t * dy - y) <= reach
  }
  let touched = false
  const paths: [number, number][][] = []
  for (const path of a.paths ?? []) {
    let run: [number, number][] = []
    path.forEach((p, i) => {
      const prev = path[i - 1]
      const gone = Math.hypot(p[0] - x, p[1] - y) <= reach
      const crossed = !!prev && run.length > 0 && near(prev, p)
      if (gone || crossed) {
        touched = true
        if (run.length > 1) paths.push(run)
        run = gone ? [] : [p]
      } else run.push(p)
    })
    if (run.length > 1) paths.push(run)
  }
  if (!touched) return a
  return paths.length ? { ...a, paths } : null
}
export type PdfZoom = number | 'fit-width' | 'fit-page'
</script>

<script setup lang="ts">
/**
 * A PDF viewer on pdf.js (not an M3 spec component; after androidx.pdf's `PdfView` and Google Drive's viewer). The
 * pages scroll continuously, each rendered only near the viewport, with selectable text and working links. Zoom:
 * fit to width (the default) or the page, a percentage, Ctrl + wheel or a trackpad pinch, a pinch on touch, and a
 * double click or double tap (zooms in there, or back to the width). A top bar with the page, zoom, search (hits
 * marked in the text), and download, print, rotate and full screen; a side panel with thumbnails and the outline;
 * a page indicator while scrolling (a draggable thumb on touch). With `annotate`, an edit button opens a floating
 * toolbar to highlight text, place notes and draw, kept in `v-model:annotations` as JSON (not written into the file).
 *
 * Needs the `pdfjs-dist` package. Set its worker once with `setPdfWorker()` (or `worker-src`); without it pdf.js
 * runs on the main thread.
 *
 * @slot actions Extra buttons at the end of the top bar. Props: `{ pdf }`
 * @slot empty Shown without a `src`
 * @event loaded The document loaded, with its pdf.js proxy
 * @event error The document failed to load
 * @event link A link was followed: `{ url }` (opens in a new tab) or `{ page }` (scrolled to)
 * @event annotation-click An annotation was clicked with the select tool
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { usePdf, type PdfDocument, type PdfSource } from '../composables/usePdf'
import { useLocale } from '../composables/useLocale'
import PdfPageView from './_MPdfPage.vue'
import MIconButton from './MIconButton.vue'
import MIcon from './MIcon.vue'
import MMenu from './MMenu.vue'
import MMenuItem from './MMenuItem.vue'
import MProgressBar from './MProgressBar.vue'
import MTextField from './MTextField.vue'
import MButton from './MButton.vue'
import MLoadingIndicator from './MLoadingIndicator.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** The PDF: a URL, its bytes, or a `File`/`Blob` */
  src?: PdfSource | null
  /** Shown in the top bar; default the document's own title */
  title?: string
  /** Current page, 1-based (v-model) */
  page?: number
  /** `fit-width`, `fit-page`, or a zoom where 1 is 100% (v-model) */
  zoom?: PdfZoom
  /** Extra rotation in degrees, a multiple of 90 (v-model) */
  rotation?: number
  /** Annotations to draw (v-model) */
  annotations?: PdfAnnotation[]
  /** Shows the edit button and the annotation toolbar */
  annotate?: boolean
  /** The active tool (v-model) */
  tool?: PdfTool
  /** Colors offered for annotations */
  colors?: string[]
  /** Written into new annotations' `author` */
  author?: string
  /** The side panel: thumbnails, the outline, or closed (v-model) */
  sidebar?: 'thumbnails' | 'outline' | null
  /** Shows the top bar */
  toolbar?: boolean
  /** Shows download and print */
  downloadable?: boolean
  /** File name for downloads; default the URL's or the document's title */
  fileName?: string
  /** A password to try first */
  password?: string
  /** The pdf.js worker URL (or `setPdfWorker()` once for the app) */
  workerSrc?: string
  minZoom?: number
  maxZoom?: number
}>(), {
  src: null,
  page: undefined,
  zoom: 'fit-width',
  rotation: 0,
  annotations: () => [],
  annotate: false,
  tool: 'select',
  colors: () => ['#FFE14D', '#7ED957', '#5EB8FF', '#FF7EB6', '#B388FF', '#1F1F1F'],
  sidebar: null,
  toolbar: true,
  downloadable: true,
  minZoom: 0.25,
  maxZoom: 8,
})

const emit = defineEmits<{
  'update:page': [number]
  'update:zoom': [PdfZoom]
  'update:rotation': [number]
  'update:annotations': [PdfAnnotation[]]
  'update:tool': [PdfTool]
  'update:sidebar': ['thumbnails' | 'outline' | null]
  loaded: [PdfDocument]
  error: [Error]
  link: [{ url?: string; page?: number }]
  'annotation-click': [PdfAnnotation]
}>()

const locale = useLocale()
const pdf = usePdf(() => props.src, { password: () => props.password, workerSrc: props.workerSrc })
watch(pdf.doc, (d) => { if (d) emit('loaded', d) })
watch(pdf.error, (e) => { if (e) emit('error', e) })

const root = ref<HTMLElement>()
const scroller = ref<HTMLElement>()
const viewW = ref(800)
const viewH = ref(600)
const rootW = ref(800)
const compact = computed(() => rootW.value < 600)

// ── Layout: CSS px per PDF point at 100% (pdf.js's and the browser's 100%), page gap and padding ─────────
const PT = 96 / 72
const GAP = 8
const PAD = 16
const rotation = ref(((props.rotation % 360) + 360) % 360)
watch(() => props.rotation, (r) => { rotation.value = ((r % 360) + 360) % 360 })

const sizes = computed(() => {
  const swap = rotation.value % 180 !== 0
  return pdf.pageSizes.value.map((s) => (swap ? { width: s.height, height: s.width } : s))
})
const zoomMode = ref<PdfZoom>(props.zoom)
watch(() => props.zoom, (z) => { if (z !== zoomMode.value) setZoom(z) })

const refSize = computed(() => sizes.value[Math.max(0, currentPage.value - 1)] ?? sizes.value[0] ?? { width: 612, height: 792 })
function fitScale(mode: 'fit-width' | 'fit-page') {
  const w = (viewW.value - 2 * (compact.value ? 8 : PAD)) / refSize.value.width
  if (mode === 'fit-width') return w
  return Math.min(w, (viewH.value - 2 * PAD) / refSize.value.height)
}
// The scale actually used (px per point); a numeric zoom is relative to 100%
const scale = computed(() => {
  const z = zoomMode.value
  const s = typeof z === 'number' ? z * PT : fitScale(z)
  return Math.max(props.minZoom * PT, Math.min(props.maxZoom * PT, s || PT))
})
const zoomPercent = computed(() => Math.round((scale.value / PT) * 100))

const layout = computed(() => {
  const pad = compact.value ? 8 : PAD
  let y = pad
  let maxW = 0
  const boxes = sizes.value.map((s) => {
    const w = Math.floor(s.width * scale.value)
    const h = Math.floor(s.height * scale.value)
    const box = { top: y, width: w, height: h }
    y += h + GAP
    maxW = Math.max(maxW, w)
    return box
  })
  return { boxes, height: y - GAP + pad, width: maxW + 2 * pad, pad }
})

// ── Scroll position → current page and the pages to render ──────────────────────────────────────────────
const scrollTop = ref(0)
function pageAt(y: number) {
  const boxes = layout.value.boxes
  let lo = 0
  let hi = boxes.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (boxes[mid]!.top <= y) lo = mid
    else hi = mid - 1
  }
  return lo
}
const currentPage = ref(1)
function updateCurrent() {
  if (!layout.value.boxes.length) return
  // The page under a third of the way down the view
  const p = pageAt(scrollTop.value + viewH.value / 3) + 1
  if (p !== currentPage.value) {
    currentPage.value = p
    emit('update:page', p)
  }
}
const activePages = computed(() => {
  const boxes = layout.value.boxes
  if (!boxes.length) return new Set<number>()
  const a = pageAt(Math.max(0, scrollTop.value - viewH.value))
  const b = pageAt(scrollTop.value + viewH.value * 2)
  const set = new Set<number>()
  for (let i = a; i <= b; i++) set.add(i + 1)
  return set
})

let scrollingTimer: ReturnType<typeof setTimeout> | undefined
const scrolling = ref(false)
function onScroll() {
  const el = scroller.value!
  scrollTop.value = el.scrollTop
  updateCurrent()
  scrolling.value = true
  clearTimeout(scrollingTimer)
  scrollingTimer = setTimeout(() => (scrolling.value = false), 1200)
}

function goTo(page: number, top?: number, smooth = false) {
  const el = scroller.value
  const box = layout.value.boxes[page - 1]
  if (!el || !box) return
  // A destination's `top` is in PDF points from the page's bottom (unrotated pages only)
  const size = sizes.value[page - 1]!
  const within = top !== undefined && rotation.value === 0 ? Math.max(0, (size.height - top) * scale.value) : 0
  el.scrollTo({ top: box.top + within - (within ? 8 : layout.value.pad), behavior: smooth ? 'smooth' : 'auto' })
  currentPage.value = page
  emit('update:page', page)
}
watch(() => props.page, (p) => { if (p && p !== currentPage.value) goTo(p) })

// ── Zoom about a point, keeping what's under it in place ────────────────────────────────────────────────
function setZoom(z: PdfZoom, anchor?: { x: number; y: number }) {
  const el = scroller.value
  const nextScale = typeof z === 'number' ? Math.max(props.minZoom, Math.min(props.maxZoom, z)) : z
  if (!el || !layout.value.boxes.length) {
    zoomMode.value = nextScale
    emit('update:zoom', nextScale)
    return
  }
  const r = el.getBoundingClientRect()
  const ax = anchor ? anchor.x - r.left : el.clientWidth / 2
  const ay = anchor ? anchor.y - r.top : el.clientHeight / 2
  const docY = el.scrollTop + ay
  const i = pageAt(docY)
  const box = layout.value.boxes[i]!
  const fy = (docY - box.top) / box.height
  const contentW = Math.max(layout.value.width, el.clientWidth)
  const left = (contentW - box.width) / 2
  const fx = (el.scrollLeft + ax - left) / box.width
  zoomMode.value = nextScale
  emit('update:zoom', nextScale)
  nextTick(() => {
    const nb = layout.value.boxes[i]!
    const nContentW = Math.max(layout.value.width, el.clientWidth)
    el.scrollTop = nb.top + fy * nb.height - ay
    el.scrollLeft = (nContentW - nb.width) / 2 + fx * nb.width - ax
    onScroll()
  })
}
const zoomBy = (f: number, anchor?: { x: number; y: number }) => setZoom((scale.value / PT) * f, anchor)
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
function stepZoom(dir: 1 | -1) {
  const z = scale.value / PT
  const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 0.01) ?? props.maxZoom : [...ZOOM_STEPS].reverse().find((s) => s < z - 0.01) ?? props.minZoom
  setZoom(next)
}

// Ctrl + wheel (a trackpad pinch arrives as one too)
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), { x: e.clientX, y: e.clientY })
}

// Double click / double tap: zoom in there, or back to the width (androidx.pdf's double tap)
function onDblClick(e: MouseEvent) {
  if (props.tool !== 'select' || (e.target as HTMLElement).closest('button, a, input, textarea')) return
  const fit = fitScale('fit-width')
  if (scale.value > fit * 1.05) setZoom('fit-width', { x: e.clientX, y: e.clientY })
  else setZoom(Math.min(props.maxZoom, (fit * 2) / PT), { x: e.clientX, y: e.clientY })
}

// Pinch on touch: pdf.js's TouchManager owns two-finger gestures (one finger still scrolls natively)
let touchAC: AbortController | null = null
let pinchFrame = 0
let pinchFactor = 1
let pinchOrigin = { x: 0, y: 0 }
function setupPinch() {
  const lib = pdf.pdfjs.value
  const el = scroller.value
  if (!lib || !el || touchAC) return
  touchAC = new AbortController()
  new lib.TouchManager({
    container: el,
    isPinchingDisabled: () => props.tool === 'ink',
    onPinching: (origin: [number, number], prevDistance: number, distance: number) => {
      pinchFactor *= distance / (prevDistance || distance)
      pinchOrigin = { x: origin[0], y: origin[1] }
      pinchFrame ||= requestAnimationFrame(() => {
        pinchFrame = 0
        const f = pinchFactor
        pinchFactor = 1
        zoomBy(f, pinchOrigin)
      })
    },
    signal: touchAC.signal,
  })
}
watch(() => pdf.pdfjs.value, setupPinch)

// ── Fit modes follow the size; a new document starts at the top ─────────────────────────────────────────
let ro: ResizeObserver | undefined
watch(pdf.doc, async (d) => {
  if (!d) return
  await nextTick()
  const p = props.page && props.page <= d.numPages ? props.page : 1
  currentPage.value = p
  if (p > 1) goTo(p)
  else if (scroller.value) scroller.value.scrollTop = 0
  setupPinch()
})

// ── Rotation ────────────────────────────────────────────────────────────────────────────────────────────
function rotate() {
  const page = currentPage.value
  rotation.value = (rotation.value + 90) % 360
  emit('update:rotation', rotation.value)
  nextTick(() => goTo(page))
}

// ── Search ──────────────────────────────────────────────────────────────────────────────────────────────
const searchOpen = ref(false)
const query = ref('')
const matches = shallowRef<{ page: number; start: number; end: number }[]>([])
const matchIndex = ref(-1)
const searching = ref(false)
let searchAC: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => runSearch(q), 250)
})
async function runSearch(q: string) {
  searchAC?.abort()
  matches.value = []
  matchIndex.value = -1
  if (!q.trim() || !pdf.doc.value) return
  const ac = (searchAC = new AbortController())
  searching.value = true
  const found = await pdf.search(q, { signal: ac.signal })
  if (ac.signal.aborted) return
  searching.value = false
  matches.value = found
  // The first hit at or after the current page
  const i = found.findIndex((m) => m.page >= currentPage.value)
  if (found.length) showMatch(i < 0 ? 0 : i)
}
function showMatch(i: number) {
  const n = matches.value.length
  if (!n) return
  matchIndex.value = ((i % n) + n) % n
  const m = matches.value[matchIndex.value]!
  // Scroll its page in, then the hit itself once marked
  if (!activePages.value.has(m.page) || Math.abs(m.page - currentPage.value) > 0) goTo(m.page)
  pendingHitScroll = true
}
let pendingHitScroll = false
const hitsByPage = computed(() => {
  const map = new Map<number, { start: number; end: number; current: boolean }[]>()
  matches.value.forEach((m, i) => {
    const list = map.get(m.page) ?? []
    list.push({ start: m.start, end: m.end, current: i === matchIndex.value })
    map.set(m.page, list)
  })
  return map
})
const NO_HITS: { start: number; end: number; current: boolean }[] = []
const pageRefs = reactive(new Map<number, InstanceType<typeof PdfPageView>>())
function setPageRef(n: number, el: unknown) {
  if (el) pageRefs.set(n, el as InstanceType<typeof PdfPageView>)
  else pageRefs.delete(n)
}
// Once the focused hit is marked in its page's text layer, bring it to the middle of the view
watch(() => {
  const m = matches.value[matchIndex.value]
  return m ? pageRefs.get(m.page)?.currentHit : null
}, (el) => {
  if (!el || !pendingHitScroll || !scroller.value) return
  pendingHitScroll = false
  const r = (el as HTMLElement).getBoundingClientRect()
  const s = scroller.value.getBoundingClientRect()
  scroller.value.scrollBy({ top: r.top - s.top - s.height / 2, left: r.left < s.left || r.right > s.right ? r.left - s.left - s.width / 2 : 0 })
})
function openSearch() {
  searchOpen.value = true
  nextTick(() => root.value?.querySelector<HTMLInputElement>('.m3-pdf-search input')?.focus())
}
function closeSearch() {
  searchOpen.value = false
  query.value = ''
  searchAC?.abort()
  matches.value = []
  matchIndex.value = -1
}
const matchText = computed(() =>
  !query.value.trim() ? '' : searching.value ? '…' : matches.value.length ? locale.pdfMatchCount.replace('{current}', String(matchIndex.value + 1)).replace('{total}', String(matches.value.length)) : locale.pdfNoMatches,
)

// ── Side panel: thumbnails and outline ──────────────────────────────────────────────────────────────────
const panel = ref<'thumbnails' | 'outline' | null>(props.sidebar)
watch(() => props.sidebar, (v) => { panel.value = v })
function setPanel(v: 'thumbnails' | 'outline' | null) {
  panel.value = v
  emit('update:sidebar', v)
}
const thumbs = reactive(new Map<number, string>())
const thumbList = ref<HTMLElement>()
let thumbObserver: IntersectionObserver | null = null
function observeThumb(el: unknown, n: number) {
  if (!(el instanceof HTMLElement)) return
  el.dataset.page = String(n)
  thumbObserver?.observe(el)
}
watch([panel, pdf.doc], async ([p, d]) => {
  thumbObserver?.disconnect()
  thumbs.clear()
  if (p !== 'thumbnails' || !d || typeof IntersectionObserver === 'undefined') return
  await nextTick()
  thumbObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      const n = Number((e.target as HTMLElement).dataset.page)
      if (thumbs.has(n)) continue
      thumbs.set(n, '')
      pdf.thumbnail(n, 120).then((url) => thumbs.set(n, url), () => {})
    }
  }, { root: thumbList.value, rootMargin: '200px' })
  thumbList.value?.querySelectorAll<HTMLElement>('[data-page]').forEach((el) => thumbObserver!.observe(el))
  thumbList.value?.querySelector(`[data-page="${currentPage.value}"]`)?.scrollIntoView({ block: 'center' })
})
function pickFromPanel(page: number, top?: number) {
  goTo(page, top)
  if (compact.value) setPanel(null)
}
const outlineOpen = reactive(new Set<string>())
type FlatOutline = { key: string; title: string; page?: number; top?: number; url?: string; depth: number; hasChildren: boolean }
const flatOutline = computed(() => {
  const out: FlatOutline[] = []
  const walk = (items: typeof pdf.outline.value, depth: number, prefix: string) => {
    items.forEach((it, i) => {
      const key = `${prefix}${i}`
      out.push({ key, title: it.title, page: it.page, top: it.top, url: it.url, depth, hasChildren: it.children.length > 0 })
      if (it.children.length && outlineOpen.has(key)) walk(it.children, depth + 1, `${key}.`)
    })
  }
  walk(pdf.outline.value, 0, '')
  return out
})
function toggleOutline(key: string) {
  if (outlineOpen.has(key)) outlineOpen.delete(key)
  else outlineOpen.add(key)
}

// ── Links ───────────────────────────────────────────────────────────────────────────────────────────────
async function onLink(l: { url?: string; dest?: unknown }) {
  if (l.url) {
    emit('link', { url: l.url })
    return
  }
  const at = await pdf.resolveDest(l.dest)
  if (!at) return
  goTo(at.page, at.top)
  emit('link', { page: at.page })
}

// ── Annotations ─────────────────────────────────────────────────────────────────────────────────────────
const tool = ref<PdfTool>(props.tool)
watch(() => props.tool, (t) => { tool.value = t })
function setTool(t: PdfTool) {
  tool.value = t
  emit('update:tool', t)
  selection.value = null
  selected.value = null
}
const color = ref(props.colors[0]!)
const inkWidth = ref(2)
const editing = ref(false)
watch(() => props.annotate, (on) => { if (!on) closeEditing() })
function openEditing() {
  editing.value = true
  setTool('highlight')
}
function closeEditing() {
  editing.value = false
  setTool('select')
}

const byPage = computed(() => {
  const map = new Map<number, PdfAnnotation[]>()
  for (const a of props.annotations) {
    const list = map.get(a.page) ?? []
    list.push(a)
    map.set(a.page, list)
  }
  return map
})
const NO_ANNOTATIONS: PdfAnnotation[] = []
const history: PdfAnnotation[][] = []
function commit(next: PdfAnnotation[]) {
  history.push(props.annotations)
  if (history.length > 50) history.shift()
  canUndo.value = true
  emit('update:annotations', next)
}
const canUndo = ref(false)
function undo() {
  const prev = history.pop()
  canUndo.value = history.length > 0
  if (prev) emit('update:annotations', prev)
  selected.value = null
}
function add(a: PdfAnnotation) {
  if (props.author) a.author = props.author
  commit([...props.annotations, a])
  // A new note opens for its text
  if (a.type === 'note') nextTick(() => selectById(a.id))
}
function erase(id: string) {
  commit(props.annotations.filter((a) => a.id !== id))
  if (selected.value?.id === id) selected.value = null
}
// The eraser dragged across a page: one undo step per stroke of it
function eraseStart() {
  history.push(props.annotations)
  if (history.length > 50) history.shift()
  canUndo.value = true
}
function eraseAt(page: number, at: { x: number; y: number; r: number }) {
  let changed = false
  const next: PdfAnnotation[] = []
  for (const a of props.annotations) {
    const kept = a.page === page ? eraseFrom(a, at) : a
    if (kept !== a) changed = true
    if (kept) next.push(kept)
  }
  if (!changed) return
  if (selected.value && !next.some((a) => a.id === selected.value!.id)) selected.value = null
  emit('update:annotations', next)
}
function update(id: string, patch: Partial<PdfAnnotation>) {
  emit('update:annotations', props.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)))
}

// The selected annotation's card, and the popup over a text selection, placed near what they're about
const selected = ref<{ id: string; x: number; y: number } | null>(null)
const selectedAnnotation = computed(() => props.annotations.find((a) => a.id === selected.value?.id) ?? null)
function place(anchor: DOMRect) {
  const r = root.value!.getBoundingClientRect()
  return { x: Math.min(Math.max(8, anchor.left - r.left + anchor.width / 2), r.width - 8), y: anchor.bottom - r.top + 8 }
}
function onSelect(s: { id: string; anchor: DOMRect } | null) {
  if (!s) {
    selected.value = null
    return
  }
  selection.value = null
  selected.value = { id: s.id, ...place(s.anchor) }
  const a = props.annotations.find((x) => x.id === s.id)
  if (a) emit('annotation-click', a)
}
function selectById(id: string) {
  const el = root.value?.querySelector(`.m3-pdf-note[aria-label]`)
  const a = props.annotations.find((x) => x.id === id)
  if (!a) return
  const page = pageRefs.get(a.page)?.root as HTMLElement | undefined
  const target = [...(page?.querySelectorAll<HTMLElement>('.m3-pdf-note') ?? [])].pop() ?? el
  if (target) selected.value = { id, ...place(target.getBoundingClientRect()) }
}
const cardStyle = computed(() => {
  const s = selected.value ?? selection.value
  if (!s) return {}
  const w = Math.min(300, rootW.value - 16)
  return { left: `${Math.min(Math.max(8, s.x - w / 2), rootW.value - w - 8)}px`, top: `${s.y}px`, width: `${w}px` }
})

const selection = ref<{ page: number; rects: [number, number, number, number][]; quote: string; x: number; y: number } | null>(null)
function onTextSelection(s: { page: number; rects: [number, number, number, number][]; quote: string; anchor: DOMRect } | null) {
  if (!s || !props.annotate) {
    selection.value = null
    return
  }
  selected.value = null
  selection.value = { page: s.page, rects: s.rects, quote: s.quote, ...place(s.anchor) }
}
function highlightSelection() {
  const s = selection.value
  if (!s) return
  add({ id: crypto.randomUUID?.() ?? String(Date.now()), type: 'highlight', page: s.page, color: color.value, rects: s.rects, quote: s.quote, text: '', createdAt: new Date().toISOString() })
  window.getSelection()?.removeAllRanges()
  selection.value = null
}
async function copySelection() {
  const s = selection.value
  if (s) await navigator.clipboard?.writeText(s.quote).catch(() => {})
  window.getSelection()?.removeAllRanges()
  selection.value = null
}
// Scrolling moves the anchors away: close the floating cards
watch(scrollTop, () => {
  selection.value = null
  if (selectedAnnotation.value?.type !== 'note') selected.value = null
})

// ── Fast scroll (touch): a thumb on the edge while scrolling, with the page ─────────────────────────────
const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
const thumbTop = computed(() => {
  const el = scroller.value
  const max = layout.value.height - viewH.value
  void scrollTop.value
  return el && max > 0 ? (scrollTop.value / max) * (viewH.value - 48) : 0
})
const dragging = ref(false)
function onThumbDown(e: PointerEvent) {
  e.preventDefault()
  dragging.value = true
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  const startY = e.clientY
  const start = scroller.value!.scrollTop
  const max = layout.value.height - viewH.value
  const move = (ev: PointerEvent) => {
    scroller.value!.scrollTop = start + ((ev.clientY - startY) / Math.max(1, viewH.value - 48)) * max
  }
  const up = () => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

// ── Full screen ─────────────────────────────────────────────────────────────────────────────────────────
const fullscreen = ref(false)
async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
  else await root.value?.requestFullscreen?.().catch(() => {})
}
const onFullscreenChange = () => { fullscreen.value = document.fullscreenElement === root.value }

// ── Keys ────────────────────────────────────────────────────────────────────────────────────────────────
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  const typing = !!t.closest('input, textarea, [contenteditable]')
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    openSearch()
  } else if (mod && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    stepZoom(1)
  } else if (mod && e.key === '-') {
    e.preventDefault()
    stepZoom(-1)
  } else if (mod && e.key === '0') {
    e.preventDefault()
    setZoom('fit-width')
  } else if (mod && e.key.toLowerCase() === 'z' && !typing && props.annotate) {
    e.preventDefault()
    undo()
  } else if (e.key === 'Escape') {
    if (selected.value || selection.value) {
      selected.value = null
      selection.value = null
    } else if (searchOpen.value) closeSearch()
    else if (editing.value) closeEditing()
    else return
    e.stopPropagation()
  } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
    erase(selected.value.id)
  } else if (!typing && !mod && (e.key === 'PageDown' || e.key === 'PageUp')) {
    e.preventDefault()
    goTo(Math.max(1, Math.min(pdf.numPages.value, currentPage.value + (e.key === 'PageDown' ? 1 : -1))))
  }
}

// ── Page field ──────────────────────────────────────────────────────────────────────────────────────────
const pageInput = ref('')
watch(currentPage, (p) => { pageInput.value = String(p) }, { immediate: true })
function commitPageInput() {
  const n = Math.round(Number(pageInput.value))
  if (n >= 1 && n <= pdf.numPages.value) goTo(n)
  else pageInput.value = String(currentPage.value)
}

// ── Password ────────────────────────────────────────────────────────────────────────────────────────────
const passwordInput = ref('')
function submitPassword() {
  pdf.submitPassword(passwordInput.value)
  passwordInput.value = ''
}

const docTitle = computed(() => props.title ?? pdf.metadata.value.title ?? '')

onMounted(() => {
  const el = scroller.value!
  el.addEventListener('wheel', onWheel, { passive: false })
  ro = new ResizeObserver(() => {
    viewW.value = el.clientWidth
    viewH.value = el.clientHeight
    rootW.value = root.value?.clientWidth ?? rootW.value
  })
  ro.observe(el)
  ro.observe(root.value!)
  viewW.value = el.clientWidth || viewW.value
  viewH.value = el.clientHeight || viewH.value
  rootW.value = root.value!.clientWidth || rootW.value
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  touchAC?.abort()
  thumbObserver?.disconnect()
  searchAC?.abort()
  cancelAnimationFrame(pinchFrame)
  clearTimeout(scrollingTimer)
  clearTimeout(searchTimer)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

defineExpose({
  pdf,
  goToPage: (p: number) => goTo(p),
  setZoom: (z: PdfZoom) => setZoom(z),
  search: (q: string) => { openSearch(); query.value = q },
  undo,
})

const TOOLS = computed(() => [
  { id: 'select' as const, icon: 'arrow_selector_tool', label: locale.pdfSelect },
  { id: 'highlight' as const, icon: 'ink_highlighter', label: locale.pdfHighlight },
  { id: 'note' as const, icon: 'sticky_note_2', label: locale.pdfNote },
  { id: 'ink' as const, icon: 'draw', label: locale.pdfDraw },
  { id: 'eraser' as const, icon: 'ink_eraser', label: locale.pdfEraser },
])
</script>

<template>
  <div
    ref="root"
    v-bind="$attrs"
    role="region"
    :aria-label="docTitle || locale.pdfViewer"
    class="m3-pdf bg-surface-container text-on-surface"
    @keydown="onKey"
  >
    <!-- Top bar -->
    <div v-if="toolbar" class="relative z-10 flex h-16 shrink-0 items-center gap-1 bg-surface-container px-1 sm:px-2">
      <MIconButton
        :icon="panel ? 'left_panel_close' : 'left_panel_open'"
        :label="locale.pdfThumbnails"
        :disabled="!pdf.doc.value"
        @click="setPanel(panel ? null : 'thumbnails')"
      />
      <p class="min-w-0 flex-1 truncate px-1 text-title-medium">{{ docTitle }}</p>

      <template v-if="pdf.doc.value">
        <div v-if="!compact" class="flex items-center gap-1 text-body-medium text-on-surface-variant">
          <input
            v-model="pageInput"
            inputmode="numeric"
            class="h-8 w-11 rounded-sm bg-surface-container-highest text-center text-body-medium text-on-surface tabular-nums outline-none focus:ring-2 focus:ring-primary"
            :aria-label="locale.pdfPage"
            @keydown.enter="commitPageInput"
            @blur="commitPageInput"
          />
          <span class="tabular-nums">/ {{ pdf.numPages.value }}</span>
        </div>
        <div v-if="!compact" class="mx-1 flex items-center">
          <MIconButton icon="remove" :label="locale.pdfZoomOut" size="xs" @click="stepZoom(-1)" />
          <MMenu align="right">
            <template #trigger>
              <button type="button" class="h-8 min-w-14 cursor-pointer rounded-full px-2 text-label-large tabular-nums hover:bg-on-surface/8" :aria-label="locale.pdfZoom">{{ zoomPercent }}%</button>
            </template>
            <MMenuItem icon="fit_width" :selected="zoomMode === 'fit-width'" @click="setZoom('fit-width')">{{ locale.pdfFitWidth }}</MMenuItem>
            <MMenuItem icon="fit_page" :selected="zoomMode === 'fit-page'" @click="setZoom('fit-page')">{{ locale.pdfFitPage }}</MMenuItem>
            <MMenuItem v-for="z in ZOOM_STEPS" :key="z" :selected="zoomMode === z" @click="setZoom(z)">{{ z * 100 }}%</MMenuItem>
          </MMenu>
          <MIconButton icon="add" :label="locale.pdfZoomIn" size="xs" @click="stepZoom(1)" />
        </div>
        <MIconButton icon="search" :label="locale.pdfSearch" :checked="searchOpen" @update:checked="(v: boolean) => (v ? openSearch() : closeSearch())" />
        <slot name="actions" :pdf="pdf" />
        <MMenu align="right">
          <template #trigger>
            <MIconButton icon="more_vert" :label="locale.pdfMore" />
          </template>
          <template v-if="compact">
            <MMenuItem icon="zoom_in" @click="stepZoom(1)">{{ locale.pdfZoomIn }}</MMenuItem>
            <MMenuItem icon="zoom_out" @click="stepZoom(-1)">{{ locale.pdfZoomOut }}</MMenuItem>
            <MMenuItem icon="fit_width" @click="setZoom('fit-width')">{{ locale.pdfFitWidth }}</MMenuItem>
          </template>
          <MMenuItem icon="list" :disabled="!pdf.outline.value.length" @click="setPanel('outline')">{{ locale.pdfOutline }}</MMenuItem>
          <MMenuItem icon="rotate_right" @click="rotate">{{ locale.pdfRotate }}</MMenuItem>
          <MMenuItem v-if="downloadable" icon="download" @click="pdf.download(fileName)">{{ locale.pdfDownload }}</MMenuItem>
          <MMenuItem v-if="downloadable" icon="print" @click="pdf.print()">{{ locale.pdfPrint }}</MMenuItem>
          <MMenuItem :icon="fullscreen ? 'fullscreen_exit' : 'fullscreen'" @click="toggleFullscreen">{{ fullscreen ? locale.pdfExitFullscreen : locale.pdfFullscreen }}</MMenuItem>
        </MMenu>
      </template>
      <MProgressBar v-if="pdf.loading.value" :value="pdf.progress.value ? pdf.progress.value * 100 : undefined" :indeterminate="!pdf.progress.value" class="absolute inset-x-0 bottom-0" />
    </div>

    <!-- Search -->
    <Transition name="m3-pdf-drop">
      <div v-if="searchOpen" class="m3-pdf-search z-10 flex shrink-0 items-center gap-1 bg-surface-container px-2 pb-2">
        <div class="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-container-highest pr-1 pl-4">
          <MIcon name="search" :size="20" class="text-on-surface-variant" />
          <input
            v-model="query"
            type="search"
            class="min-w-0 flex-1 bg-transparent text-body-large outline-none placeholder:text-on-surface-variant"
            :placeholder="locale.pdfSearch"
            :aria-label="locale.pdfSearch"
            @keydown.enter.prevent="showMatch(matchIndex + ((($event as KeyboardEvent).shiftKey) ? -1 : 1))"
          />
          <span class="shrink-0 text-label-medium whitespace-nowrap text-on-surface-variant tabular-nums" aria-live="polite">{{ matchText }}</span>
          <MIconButton icon="keyboard_arrow_up" :label="locale.pdfSearchPrevious" size="xs" :disabled="!matches.length" @click="showMatch(matchIndex - 1)" />
          <MIconButton icon="keyboard_arrow_down" :label="locale.pdfSearchNext" size="xs" :disabled="!matches.length" @click="showMatch(matchIndex + 1)" />
        </div>
        <MIconButton icon="close" :label="locale.close" @click="closeSearch" />
      </div>
    </Transition>

    <div class="relative flex min-h-0 flex-1">
      <!-- Side panel: inline on wide screens, over the pages on narrow ones -->
      <Transition name="m3-pdf-fade">
        <div v-if="panel && compact" class="absolute inset-0 z-20 bg-scrim/32" @click="setPanel(null)" />
      </Transition>
      <Transition name="m3-pdf-panel">
        <aside
          v-if="panel && pdf.doc.value"
          class="flex w-56 shrink-0 flex-col bg-surface-container"
          :class="compact ? 'absolute inset-y-0 left-0 z-30 rounded-r-lg shadow-elevation-2' : 'relative'"
        >
          <div class="flex shrink-0 gap-1 px-3 pt-1 pb-2">
            <button
              v-for="tab in (['thumbnails', 'outline'] as const)"
              :key="tab"
              type="button"
              class="h-8 flex-1 cursor-pointer rounded-full text-label-large transition-colors"
              :class="panel === tab ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-on-surface/8'"
              :disabled="tab === 'outline' && !pdf.outline.value.length"
              @click="setPanel(tab)"
            >{{ tab === 'thumbnails' ? locale.pdfThumbnails : locale.pdfOutline }}</button>
          </div>
          <div v-if="panel === 'thumbnails'" ref="thumbList" class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <div class="flex flex-col items-center gap-3">
              <button
                v-for="n in pdf.numPages.value"
                :key="n"
                :ref="(el) => observeThumb(el, n)"
                type="button"
                class="group flex cursor-pointer flex-col items-center gap-1 outline-none"
                :aria-label="`${locale.pdfPage} ${n}`"
                :aria-current="n === currentPage ? 'page' : undefined"
                @click="pickFromPanel(n)"
              >
                <span
                  class="block w-30 overflow-hidden rounded-sm bg-white shadow-elevation-1 ring-offset-2 ring-offset-surface-container transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-secondary"
                  :class="n === currentPage && 'ring-3 ring-primary'"
                  :style="{ aspectRatio: `${sizes[n - 1]?.width ?? 3} / ${sizes[n - 1]?.height ?? 4}` }"
                >
                  <img v-if="thumbs.get(n)" :src="thumbs.get(n)" alt="" class="h-full w-full object-contain" :style="{ transform: rotation ? `rotate(${rotation}deg)` : undefined }" />
                </span>
                <span class="text-label-medium tabular-nums" :class="n === currentPage ? 'text-primary' : 'text-on-surface-variant'">{{ n }}</span>
              </button>
            </div>
          </div>
          <nav v-else class="min-h-0 flex-1 overflow-y-auto px-2 pb-3" :aria-label="locale.pdfOutline">
            <div v-for="o in flatOutline" :key="o.key" class="flex items-center" :style="{ paddingLeft: `${o.depth * 12}px` }">
              <button
                v-if="o.hasChildren"
                type="button"
                class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
                :aria-label="outlineOpen.has(o.key) ? locale.collapse : locale.expand"
                @click="toggleOutline(o.key)"
              ><MIcon :name="outlineOpen.has(o.key) ? 'expand_more' : 'chevron_right'" :size="20" /></button>
              <span v-else class="w-8 shrink-0" />
              <component
                :is="o.url ? 'a' : 'button'"
                :href="o.url"
                :target="o.url ? '_blank' : undefined"
                :type="o.url ? undefined : 'button'"
                class="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full px-3 text-left text-label-large hover:bg-on-surface/8"
                @click="o.page && pickFromPanel(o.page, o.top)"
              >
                <span class="min-w-0 flex-1 truncate">{{ o.title }}</span>
                <span v-if="o.page" class="text-label-small text-on-surface-variant tabular-nums">{{ o.page }}</span>
              </component>
            </div>
          </nav>
        </aside>
      </Transition>

      <!-- Pages -->
      <div class="relative min-w-0 flex-1">
        <div
          ref="scroller"
          class="m3-pdf-scroller absolute inset-0 overflow-auto overscroll-contain bg-surface-container-highest outline-none"
          :class="[tool === 'select' ? '' : 'm3-pdf-annotating', coarse && 'scrollbar-none']"
          tabindex="0"
          @scroll="onScroll"
          @dblclick="onDblClick"
        >
          <div
            v-if="pdf.doc.value"
            class="relative mx-auto"
            :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
          >
            <div
              v-for="(box, i) in layout.boxes"
              :key="i"
              class="absolute left-1/2 -translate-x-1/2"
              :style="{ top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }"
            >
              <PdfPageView
                :ref="(el) => setPageRef(i + 1, el)"
                :pdf="pdf"
                :page="i + 1"
                :scale="scale"
                :rotation="rotation"
                :active="activePages.has(i + 1)"
                :hits="hitsByPage.get(i + 1) ?? NO_HITS"
                :annotations="byPage.get(i + 1) ?? NO_ANNOTATIONS"
                :tool="tool"
                :color="color"
                :ink-width="inkWidth"
                :selected-id="selected?.id ?? null"
                class="h-full w-full"
                @link="onLink"
                @add="add"
                @erase="erase"
                @erase-start="eraseStart"
                @erase-at="(at: { x: number; y: number; r: number }) => eraseAt(i + 1, at)"
                @select="onSelect"
                @text-selection="onTextSelection"
              />
            </div>
          </div>

          <div v-else-if="pdf.needsPassword.value" class="flex h-full items-center justify-center p-6">
            <form class="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl bg-surface-container-low p-6 text-center shadow-elevation-1" @submit.prevent="submitPassword">
              <MIcon name="lock" :size="32" class="text-primary" />
              <p class="text-title-medium">{{ locale.pdfPassword }}</p>
              <MTextField
                v-model="passwordInput"
                type="password"
                :label="locale.pdfPasswordLabel"
                :error="pdf.wrongPassword.value"
                :error-label="pdf.wrongPassword.value ? locale.pdfWrongPassword : undefined"
                autocomplete="off"
                class="w-full"
              />
              <MButton type="submit" :disabled="!passwordInput" class="self-end">{{ locale.pdfOpen }}</MButton>
            </form>
          </div>
          <div v-else-if="pdf.error.value" class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-on-surface-variant">
            <MIcon name="error" :size="32" class="text-error" />
            <p class="text-title-medium text-on-surface">{{ locale.pdfError }}</p>
            <p class="text-body-medium">{{ pdf.error.value.message }}</p>
          </div>
          <div v-else-if="pdf.loading.value" class="flex h-full items-center justify-center">
            <MLoadingIndicator :label="locale.pdfLoading" />
          </div>
          <div v-else class="flex h-full items-center justify-center p-6">
            <slot name="empty" />
          </div>
        </div>

        <!-- Page indicator while scrolling; a draggable thumb on touch (androidx.pdf's fast scroller) -->
        <Transition name="m3-pdf-fade">
          <div v-if="pdf.doc.value && (scrolling || dragging) && pdf.numPages.value > 1" class="pointer-events-none absolute inset-y-0 right-0 w-full">
            <div class="absolute right-1 flex items-center gap-2" :style="{ top: `${coarse ? thumbTop : Math.min(viewH - 40, Math.max(8, thumbTop))}px` }">
              <span class="rounded-full bg-inverse-surface px-3 py-1 text-label-large text-inverse-on-surface tabular-nums shadow-elevation-1">{{ currentPage }} / {{ pdf.numPages.value }}</span>
              <span v-if="coarse" class="pointer-events-auto flex h-12 w-6 touch-none items-center justify-center" @pointerdown="onThumbDown">
                <span class="h-12 w-1.5 rounded-full bg-on-surface-variant" />
              </span>
              <span v-else class="w-3" />
            </div>
          </div>
        </Transition>

        <!-- Edit button, and the annotation toolbar (androidx.pdf's edit FAB) -->
        <Transition name="m3-pdf-fade">
          <button
            v-if="annotate && pdf.doc.value && !editing"
            type="button"
            class="absolute right-4 bottom-4 flex size-14 cursor-pointer items-center justify-center rounded-lg bg-primary-container text-on-primary-container shadow-elevation-3 transition-shadow outline-none hover:shadow-elevation-4 focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="locale.pdfAnnotate"
            @click="openEditing"
          ><MIcon name="edit" :size="24" /></button>
        </Transition>
        <Transition name="m3-pdf-rise">
          <div v-if="annotate && editing" class="absolute inset-x-0 bottom-4 z-10 flex justify-center px-2">
            <div class="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-surface-container-high p-2 shadow-elevation-3 scrollbar-none" role="toolbar" :aria-label="locale.pdfAnnotate">
              <MIconButton
                v-for="t in TOOLS"
                :key="t.id"
                :icon="t.icon"
                :label="t.label"
                :checked="tool === t.id"
                variant="standard"
                @update:checked="setTool(t.id)"
              />
              <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
              <button
                v-for="c in colors"
                :key="c"
                type="button"
                class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :aria-label="`${locale.pdfColor} ${c}`"
                :aria-pressed="color === c"
                @click="color = c"
              >
                <span class="size-6 rounded-full border border-outline-variant transition-transform" :class="color === c && 'scale-125 ring-2 ring-on-surface ring-offset-2 ring-offset-surface-container-high'" :style="{ backgroundColor: c }" />
              </button>
              <span class="mx-1 h-6 w-px shrink-0 bg-outline-variant" />
              <MIconButton icon="undo" :label="locale.pdfUndo" :disabled="!canUndo" @click="undo" />
              <MIconButton icon="close" :label="locale.close" @click="closeEditing" />
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- A text selection: copy, or highlight it -->
    <div v-if="selection" class="absolute z-40 flex justify-center" :style="cardStyle">
      <div class="flex items-center gap-1 rounded-full bg-surface-container-high p-1 shadow-elevation-2">
        <MButton variant="text" icon="content_copy" size="sm" @click="copySelection">{{ locale.pdfCopy }}</MButton>
        <MButton variant="text" icon="ink_highlighter" size="sm" @click="highlightSelection">{{ locale.pdfHighlight }}</MButton>
      </div>
    </div>

    <!-- The selected annotation -->
    <div v-if="selected && selectedAnnotation" class="absolute z-40" :style="cardStyle" @keydown.stop="(e: KeyboardEvent) => e.key === 'Escape' && (selected = null)">
      <div class="flex flex-col gap-3 rounded-lg bg-surface-container-high p-3 shadow-elevation-2">
        <p v-if="selectedAnnotation.quote" class="line-clamp-3 border-l-4 pl-2 text-body-medium text-on-surface-variant" :style="{ borderColor: selectedAnnotation.color }">{{ selectedAnnotation.quote }}</p>
        <MTextField
          :model-value="selectedAnnotation.text ?? ''"
          :label="selectedAnnotation.type === 'note' ? locale.pdfNotePlaceholder : locale.pdfAddComment"
          multiline
          auto-grow
          :rows="2"
          :max-rows="6"
          variant="outlined"
          field-bg="var(--color-surface-container-high)"
          @update:model-value="(v: string | number) => update(selectedAnnotation!.id, { text: String(v) })"
        />
        <div class="flex items-center gap-1">
          <button
            v-for="c in colors"
            :key="c"
            type="button"
            class="flex size-8 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="`${locale.pdfColor} ${c}`"
            :aria-pressed="selectedAnnotation.color === c"
            @click="update(selectedAnnotation!.id, { color: c })"
          >
            <span class="size-5 rounded-full border border-outline-variant" :class="selectedAnnotation.color === c && 'ring-2 ring-on-surface ring-offset-1 ring-offset-surface-container-high'" :style="{ backgroundColor: c }" />
          </button>
          <span class="flex-1" />
          <MIconButton icon="delete" :label="locale.pdfDelete" size="xs" @click="erase(selectedAnnotation!.id)" />
          <MIconButton icon="check" :label="locale.close" size="xs" @click="selected = null" />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Root defaults in the base layer, so any class the consumer gives (absolute inset-0, hidden…) wins */
@layer base {
  .m3-pdf {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

/* pdf.js's text layer (from pdfjs-dist's pdf_viewer.css, Apache-2.0), for selectable text over the canvas */
.m3-pdf .textLayer {
  position: absolute;
  inset: 0;
  overflow: clip;
  line-height: 1;
  text-align: initial;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  caret-color: CanvasText;
  z-index: 0;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}
.m3-pdf .textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  user-select: text;
}
.m3-pdf .textLayer > :not(.markedContent),
.m3-pdf .textLayer .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}
.m3-pdf .textLayer .markedContent { display: contents; }
.m3-pdf .textLayer span.m3-pdf-hit {
  position: static;
  margin: -1px;
  padding: 1px;
  border-radius: 3px;
  background-color: color-mix(in srgb, var(--color-tertiary) 30%, transparent);
}
.m3-pdf .textLayer span.m3-pdf-hit-current { background-color: color-mix(in srgb, var(--color-primary) 45%, transparent); }
.m3-pdf .textLayer ::selection { background: color-mix(in srgb, var(--color-primary) 30%, transparent); color: transparent; }
.m3-pdf .textLayer br::selection { background: transparent; }
.m3-pdf .textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: 0;
  cursor: default;
  user-select: none;
}
.m3-pdf .textLayer.selecting .endOfContent { top: 0; }
.m3-pdf [data-main-rotation='90'] { transform: rotate(90deg) translateY(-100%); }
.m3-pdf [data-main-rotation='180'] { transform: rotate(180deg) translate(-100%, -100%); }
.m3-pdf [data-main-rotation='270'] { transform: rotate(270deg) translateX(-100%); }

/* Highlights tint the text under them, like a marker */
.m3-pdf .m3-pdf-highlight { mix-blend-mode: multiply; opacity: 0.45; }
.m3-pdf .m3-pdf-annotating .m3-pdf-highlight,
.m3-pdf .m3-pdf-annotating .m3-pdf-ink { cursor: inherit; }
.m3-pdf .m3-pdf-scroller:not(.m3-pdf-annotating) :is(.m3-pdf-highlight, .m3-pdf-ink) { pointer-events: auto; cursor: pointer; }
.m3-pdf .m3-pdf-scroller.m3-pdf-annotating :is(.m3-pdf-highlight, .m3-pdf-ink) { pointer-events: none; }
.m3-pdf .m3-pdf-selected { filter: drop-shadow(0 0 2px var(--color-primary)); opacity: 0.7; }

.m3-pdf-fade-enter-active,
.m3-pdf-fade-leave-active { transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1); }
.m3-pdf-fade-enter-from,
.m3-pdf-fade-leave-to { opacity: 0; }
.m3-pdf-drop-enter-active,
.m3-pdf-drop-leave-active { transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1), transform 250ms cubic-bezier(0.2, 0, 0, 1); }
.m3-pdf-drop-enter-from,
.m3-pdf-drop-leave-to { opacity: 0; transform: translateY(-8px); }
.m3-pdf-rise-enter-active,
.m3-pdf-rise-leave-active { transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1), transform 300ms cubic-bezier(0.05, 0.7, 0.1, 1); }
.m3-pdf-rise-enter-from,
.m3-pdf-rise-leave-to { opacity: 0; transform: translateY(24px); }
.m3-pdf-panel-enter-active,
.m3-pdf-panel-leave-active { transition: margin 300ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms; }
.m3-pdf-panel-enter-from,
.m3-pdf-panel-leave-to { margin-left: -14rem; opacity: 0; }
</style>
