<script setup lang="ts">
// Internal to MPdfViewer: one page. The canvas renders only while `active` (near the viewport), at the device's
// pixel ratio, swapped in once ready so a zoom never flashes blank; meanwhile the old picture is stretched. Over it:
// pdf.js's text layer (selectable, with search hits marked in place), the page's links, and an SVG with the
// annotations, drawn from PDF points through the viewport so they follow zoom and rotation.
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { PdfPage, PdfState } from '../composables/usePdf'
import type { PdfAnnotation, PdfTool } from './MPdfViewer.vue'
import MIcon from './MIcon.vue'

type Viewport = ReturnType<PdfPage['getViewport']>

const props = defineProps<{
  pdf: PdfState
  page: number
  scale: number
  /** Extra rotation from the viewer, on top of the page's own */
  rotation: number
  /** Near the viewport: render the canvas and the layers */
  active: boolean
  /** Search hits on this page, as offsets in its text; `current` is the focused one */
  hits: { start: number; end: number; current: boolean }[]
  annotations: PdfAnnotation[]
  tool: PdfTool
  color: string
  inkWidth: number
  selectedId: string | null
}>()

const emit = defineEmits<{
  link: [{ url?: string; dest?: unknown }]
  add: [PdfAnnotation]
  select: [{ id: string; anchor: DOMRect } | null]
  erase: [string]
  'erase-start': []
  'erase-at': [{ x: number; y: number; r: number }]
  'text-selection': [{ page: number; rects: [number, number, number, number][]; quote: string; anchor: DOMRect } | null]
  rendered: [number]
}>()

const root = ref<HTMLElement>()
const canvasHost = ref<HTMLElement>()
const textHost = ref<HTMLElement>()
const pageProxy = shallowRef<PdfPage | null>(null)
const viewport = shallowRef<Viewport | null>(null)

function makeViewport(p: PdfPage) {
  return p.getViewport({ scale: props.scale, rotation: (p.rotate + props.rotation) % 360 })
}

// ── Canvas ──────────────────────────────────────────────────────────────────────────────────────────────
let renderTask: { cancel(): void; promise: Promise<void> } | null = null
let renderedKey = ''
// Browsers cap a canvas's area; past it, render at a lower ratio
const MAX_PIXELS = 16_000_000

async function render() {
  if (!props.active) return
  const p = pageProxy.value ?? (pageProxy.value = await props.pdf.getPage(props.page).catch(() => null))
  if (!p || !props.active) return
  const vp = makeViewport(p)
  viewport.value = vp
  let ratio = Math.min(2, window.devicePixelRatio || 1)
  if (vp.width * vp.height * ratio * ratio > MAX_PIXELS) ratio = Math.sqrt(MAX_PIXELS / (vp.width * vp.height))
  const key = `${props.scale}|${props.rotation}|${ratio}`
  if (key === renderedKey) return
  renderTask?.cancel()
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(vp.width * ratio)
  canvas.height = Math.floor(vp.height * ratio)
  canvas.className = 'absolute inset-0 h-full w-full'
  const task = p.render({ canvas, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined })
  renderTask = task
  try {
    await task.promise
  } catch {
    return // cancelled by a newer render
  }
  if (renderTask !== task) return
  renderTask = null
  renderedKey = key
  const host = canvasHost.value
  if (!host) return
  host.replaceChildren(canvas)
  emit('rendered', props.page)
  renderText(p, vp)
  readLinks(p, vp)
}

function release() {
  renderTask?.cancel()
  renderTask = null
  renderedKey = ''
  // Free the bitmap now rather than whenever the canvas gets collected
  const c = canvasHost.value?.querySelector('canvas')
  if (c) {
    c.width = 0
    c.height = 0
  }
  canvasHost.value?.replaceChildren()
  textLayer?.cancel()
  textLayer = null
  textHost.value?.replaceChildren()
  links.value = []
  pageProxy.value?.cleanup()
}

let timer: ReturnType<typeof setTimeout> | undefined

// ── Text layer and search hits ──────────────────────────────────────────────────────────────────────────
let textLayer: { render(): Promise<unknown>; cancel(): void; textDivs: HTMLElement[]; textContentItemsStr: string[] } | null = null
let textContent: unknown = null

async function renderText(p: PdfPage, vp: Viewport) {
  const lib = props.pdf.pdfjs.value
  const host = textHost.value
  if (!lib || !host) return
  textLayer?.cancel()
  textContent ??= await p.getTextContent()
  const container = document.createElement('div')
  container.className = 'textLayer'
  const layer = new lib.TextLayer({ textContentSource: textContent as never, container, viewport: vp }) as unknown as typeof textLayer
  textLayer = layer
  try {
    await layer!.render()
  } catch {
    return
  }
  if (textLayer !== layer) return
  host.replaceChildren(container)
  markHits()
}

let marked: number[] = []
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function markHits() {
  const layer = textLayer
  if (!layer) return
  // Put back what the last marking changed
  for (const i of marked) if (layer.textDivs[i]) layer.textDivs[i]!.textContent = layer.textContentItemsStr[i] ?? ''
  marked = []
  if (!props.hits.length) return
  const { starts } = await props.pdf.pageText(props.page)
  if (layer !== textLayer) return
  const parts = new Map<number, { a: number; b: number; current: boolean }[]>()
  for (const h of props.hits) {
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i]!
      const str = layer.textContentItemsStr[i] ?? ''
      const a = Math.max(h.start, s)
      const b = Math.min(h.end, s + str.length)
      if (b > a) {
        const list = parts.get(i) ?? []
        list.push({ a: a - s, b: b - s, current: h.current })
        parts.set(i, list)
      }
    }
  }
  let currentEl: HTMLElement | null = null
  for (const [i, ranges] of parts) {
    const div = layer.textDivs[i]
    const str = layer.textContentItemsStr[i] ?? ''
    if (!div) continue
    ranges.sort((x, y) => x.a - y.a)
    let html = ''
    let at = 0
    for (const r of ranges) {
      html += escape(str.slice(at, r.a)) + `<span class="m3-pdf-hit${r.current ? ' m3-pdf-hit-current' : ''}">${escape(str.slice(r.a, r.b))}</span>`
      at = r.b
    }
    div.innerHTML = html + escape(str.slice(at))
    marked.push(i)
    if (ranges.some((r) => r.current)) currentEl ??= div.querySelector<HTMLElement>('.m3-pdf-hit-current')
  }
  currentHit.value = currentEl
}
const currentHit = shallowRef<HTMLElement | null>(null)
watch(() => props.hits, markHits)

// ── Links ───────────────────────────────────────────────────────────────────────────────────────────────
interface Link { left: number; top: number; width: number; height: number; url?: string; dest?: unknown }
const links = ref<Link[]>([])
let rawLinks: { rect: number[]; url?: string; dest?: unknown }[] | null = null

async function readLinks(p: PdfPage, vp: Viewport) {
  rawLinks ??= (await p.getAnnotations().catch(() => []))
    .filter((a: { subtype?: string; url?: string; dest?: unknown }) => a.subtype === 'Link' && (a.url || a.dest))
    .map((a: { rect: number[]; url?: string; dest?: unknown }) => ({ rect: a.rect, url: a.url, dest: a.dest }))
  links.value = rawLinks!.map((l) => {
    const [x1, y1] = vp.convertToViewportPoint(l.rect[0]!, l.rect[1]!) as [number, number]
    const [x2, y2] = vp.convertToViewportPoint(l.rect[2]!, l.rect[3]!) as [number, number]
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), url: l.url, dest: l.dest }
  })
}
// Links scale with the page between renders
const linkScale = computed(() => (viewport.value && renderedKey ? props.scale / Number(renderedKey.split('|')[0]) : 1))

// ── Annotations ─────────────────────────────────────────────────────────────────────────────────────────
const toView = (x: number, y: number): [number, number] => (viewport.value ? (viewport.value.convertToViewportPoint(x, y) as [number, number]) : [0, 0])
const toPdf = (x: number, y: number): [number, number] => (viewport.value ? (viewport.value.convertToPdfPoint(x, y) as [number, number]) : [0, 0])

const shapes = computed(() => {
  void props.scale
  void props.rotation
  return props.annotations.map((a) => {
    if (a.type === 'highlight') {
      const rects = (a.rects ?? []).map(([x1, y1, x2, y2]) => {
        const [ax, ay] = toView(x1, y1)
        const [bx, by] = toView(x2, y2)
        return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) }
      })
      return { a, rects }
    }
    if (a.type === 'ink') {
      const d = (a.paths ?? []).map((path) => path.map(([x, y], i) => {
        const [vx, vy] = toView(x, y)
        return `${i ? 'L' : 'M'}${vx.toFixed(1)},${vy.toFixed(1)}`
      }).join('')).join('')
      return { a, d, w: (a.width ?? 2) * props.scale }
    }
    const [x, y] = toView(a.at?.[0] ?? 0, a.at?.[1] ?? 0)
    return { a, x, y }
  })
})

function onAnnotationClick(e: MouseEvent, a: PdfAnnotation) {
  // The eraser works by dragging (see onInkDown), a click included
  if (props.tool !== 'select') return
  e.stopPropagation()
  emit('select', { id: a.id, anchor: (e.currentTarget as Element).getBoundingClientRect() })
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
const now = () => new Date().toISOString()

function local(e: { clientX: number; clientY: number }) {
  const r = root.value!.getBoundingClientRect()
  // The page may be stretched by a pending zoom: map into the viewport's pixels
  const vp = viewport.value!
  return [((e.clientX - r.left) / (r.width || 1)) * vp.width, ((e.clientY - r.top) / (r.height || 1)) * vp.height] as [number, number]
}

// Note: a click places one
function onPageClick(e: MouseEvent) {
  if (props.tool !== 'note' || !viewport.value) return
  const [x, y] = toPdf(...local(e))
  emit('add', { id: uid(), type: 'note', page: props.page, color: props.color, at: [x, y], text: '', createdAt: now() })
}

// Ink: a drag draws, in viewport pixels while drawing, stored in PDF points. The eraser drags too: everything it
// passes over goes (strokes are cut where it passes); a stylus's eraser end erases whatever the tool
const drawing = ref<[number, number][] | null>(null)
const erasing = ref(false)
const eraserAt = ref<[number, number] | null>(null)
// The eraser's radius on screen, whatever the zoom
const ERASER_PX = 12
let drawId = -1
const isPenEraser = (e: PointerEvent) => e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0)
function eraseAt(e: PointerEvent) {
  const p = local(e)
  eraserAt.value = p
  const [x, y] = toPdf(p[0], p[1])
  emit('erase-at', { x, y, r: ERASER_PX / props.scale })
}
function onInkDown(e: PointerEvent) {
  const pen = isPenEraser(e)
  if ((props.tool !== 'ink' && props.tool !== 'eraser' && !pen) || (e.button !== 0 && !pen) || !viewport.value) return
  e.preventDefault()
  drawId = e.pointerId
  try {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  } catch { /* a pointer that's already gone */ }
  if (props.tool === 'eraser' || pen) {
    erasing.value = true
    emit('erase-start')
    eraseAt(e)
  } else drawing.value = [local(e)]
}
function onInkMove(e: PointerEvent) {
  if (props.tool === 'eraser' && !erasing.value && e.pointerType !== 'touch') eraserAt.value = local(e)
  if (e.pointerId !== drawId) return
  if (erasing.value) return eraseAt(e)
  if (!drawing.value) return
  const p = local(e)
  const last = drawing.value[drawing.value.length - 1]!
  if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) drawing.value = [...drawing.value, p]
}
function onInkUp(e: PointerEvent) {
  if (e.pointerId !== drawId) return
  drawId = -1
  if (erasing.value) {
    erasing.value = false
    if (e.pointerType === 'touch') eraserAt.value = null
    return
  }
  if (!drawing.value) return
  const pts = drawing.value
  drawing.value = null
  if (pts.length < 2) return
  emit('add', {
    id: uid(), type: 'ink', page: props.page, color: props.color, width: props.inkWidth,
    paths: [pts.map(([x, y]) => toPdf(x, y).map((v) => Math.round(v * 100) / 100) as [number, number])], createdAt: now(),
  })
}
const drawingPath = computed(() => (drawing.value ?? []).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(''))

// Text selection: its rects, in PDF points, for a highlight (made at once with the highlight tool)
function onTextPointerUp() {
  setTimeout(() => {
    const sel = window.getSelection()
    const host = textHost.value
    if (!sel || sel.isCollapsed || !sel.rangeCount || !host || !viewport.value) {
      if (props.tool === 'select') emit('text-selection', null)
      return
    }
    const range = sel.getRangeAt(0)
    if (!host.contains(range.commonAncestorContainer)) return
    const r = root.value!.getBoundingClientRect()
    const vp = viewport.value
    const sx = vp.width / (r.width || 1)
    const sy = vp.height / (r.height || 1)
    const rects: [number, number, number, number][] = []
    for (const c of Array.from(range.getClientRects())) {
      if (c.width < 1 || c.height < 1) continue
      const [x1, y1] = toPdf((c.left - r.left) * sx, (c.top - r.top) * sy)
      const [x2, y2] = toPdf((c.right - r.left) * sx, (c.bottom - r.top) * sy)
      rects.push([x1, y1, x2, y2].map((v) => Math.round(v * 100) / 100) as [number, number, number, number])
    }
    if (!rects.length) return
    const quote = sel.toString().replace(/\s+/g, ' ').trim()
    if (props.tool === 'highlight') {
      emit('add', { id: uid(), type: 'highlight', page: props.page, color: props.color, rects, quote, text: '', createdAt: now() })
      sel.removeAllRanges()
    } else {
      emit('text-selection', { page: props.page, rects, quote, anchor: range.getBoundingClientRect() })
    }
  })
}

// Last, so everything render() and release() touch is declared
watch(() => props.active, (on) => (on ? render() : release()), { immediate: true })
// A zoom re-renders shortly after it settles (the stretched picture stands in meanwhile)
watch(() => [props.scale, props.rotation], () => {
  if (pageProxy.value) viewport.value = makeViewport(pageProxy.value)
  clearTimeout(timer)
  timer = setTimeout(render, 140)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  release()
})

defineExpose({ root, currentHit })
</script>

<template>
  <div
    ref="root"
    class="m3-pdf-page relative bg-white shadow-elevation-1"
    :data-page="page"
    :style="{ '--scale-factor': scale, '--total-scale-factor': scale, '--user-unit': 1, '--scale-round-x': '1px', '--scale-round-y': '1px' }"
    @click="onPageClick"
  >
    <div ref="canvasHost" class="absolute inset-0" />
    <div
      ref="textHost"
      class="absolute inset-0 overflow-hidden"
      :class="{ 'pointer-events-none': tool === 'ink' || tool === 'note' || tool === 'eraser' }"
      @pointerup="onTextPointerUp"
    />

    <a
      v-for="(l, i) in links"
      :key="i"
      :href="l.url ?? '#'"
      :target="l.url ? '_blank' : undefined"
      :rel="l.url ? 'noopener noreferrer' : undefined"
      class="absolute rounded-xs hover:bg-primary/12"
      :class="{ 'pointer-events-none': tool !== 'select' }"
      :style="{ left: `${l.left * linkScale}px`, top: `${l.top * linkScale}px`, width: `${l.width * linkScale}px`, height: `${l.height * linkScale}px` }"
      @click="(e: MouseEvent) => { if (!l.url) { e.preventDefault(); emit('link', { dest: l.dest }) } else emit('link', { url: l.url }) }"
    />

    <svg
      class="absolute inset-0 h-full w-full overflow-visible"
      :class="tool === 'ink' ? 'cursor-crosshair touch-none' : tool === 'eraser' ? 'cursor-none touch-none' : 'pointer-events-none'"
      :viewBox="viewport ? `0 0 ${viewport.width} ${viewport.height}` : undefined"
      preserveAspectRatio="none"
      @pointerdown="onInkDown"
      @pointermove="onInkMove"
      @pointerup="onInkUp"
      @pointercancel="onInkUp"
      @pointerleave="eraserAt = erasing ? eraserAt : null"
    >
      <template v-for="s in shapes" :key="s.a.id">
        <g v-if="'rects' in s" class="m3-pdf-highlight" :class="{ 'm3-pdf-selected': s.a.id === selectedId }" @click="(e: MouseEvent) => onAnnotationClick(e, s.a)">
          <rect v-for="(r, i) in s.rects" :key="i" :x="r.x" :y="r.y" :width="r.w" :height="r.h" rx="2" :fill="s.a.color" />
        </g>
        <path
          v-else-if="'d' in s"
          :d="s.d"
          fill="none"
          :stroke="s.a.color"
          :stroke-width="s.w"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="m3-pdf-ink"
          :class="{ 'm3-pdf-selected': s.a.id === selectedId }"
          @click="(e: MouseEvent) => onAnnotationClick(e, s.a)"
        />
      </template>
      <circle v-if="eraserAt && tool === 'eraser'" :cx="eraserAt[0]" :cy="eraserAt[1]" :r="ERASER_PX" class="pointer-events-none fill-surface/40 stroke-on-surface" stroke-width="1.5" />
      <path v-if="drawing" :d="drawingPath" fill="none" :stroke="color" :stroke-width="inkWidth * scale" stroke-linecap="round" stroke-linejoin="round" />
    </svg>

    <!-- Notes: an icon at their point -->
    <template v-for="s in shapes" :key="`n-${s.a.id}`">
      <button
        v-if="'x' in s"
        type="button"
        class="m3-pdf-note absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full shadow-elevation-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="{ 'ring-2 ring-primary': s.a.id === selectedId }"
        :style="{ left: `${s.x}px`, top: `${s.y}px`, backgroundColor: s.a.color }"
        :aria-label="s.a.text || 'Note'"
        @click="(e: MouseEvent) => { e.stopPropagation(); if (tool === 'eraser') emit('erase', s.a.id); else emit('select', { id: s.a.id, anchor: (e.currentTarget as Element).getBoundingClientRect() }) }"
      >
        <MIcon name="sticky_note_2" :size="16" filled class="text-black/70" />
      </button>
    </template>
  </div>
</template>
