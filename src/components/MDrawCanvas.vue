<script setup lang="ts">
/**
 * A drawing surface: pens that follow a stylus' pressure, an eraser that cuts strokes (and the pen's eraser end),
 * lines, arrows, rectangles, ellipses, text, lasso selection to move, scale or delete, layers, undo and redo, pan
 * and pinch zoom. An infinite canvas, or pages of a fixed size. The drawing is plain data (`v-model`, a list of
 * strokes, shapes and texts), exported as SVG or PNG. Put an MDrawToolbar (or your own, with `useDrawing()`) in its
 * default slot. Not an M3 spec component.
 *
 * Gestures: draw with the pen, mouse or a finger; two fingers pan and zoom (and cancel a stroke a finger just
 * started); the wheel pans, Ctrl + wheel zooms; Space + drag or the middle button pans. With `penOnly` (by default
 * once a stylus has been used) fingers only pan and zoom, so a palm on the screen doesn't draw. Keys: Ctrl+Z undo,
 * Ctrl+Shift+Z or Ctrl+Y redo, Delete removes the selection, Escape drops it, Ctrl+A selects everything.
 *
 * @slot default Overlays: a toolbar (MDrawToolbar), a layers panel (MDrawLayers), anything positioned over the canvas
 * @event change Fires after every edit with the new items (the same as `update:modelValue`)
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, useId, watch } from 'vue'
import {
  constrain,
  drawId,
  eraseAt,
  hitItem,
  inLasso,
  itemBox,
  LINE_HEIGHT,
  PENS,
  shapePath,
  simulatePressure,
  smoothPoints,
  sortByLayer,
  strokePath,
  svgToPng,
  textBox,
  toDrawSvg,
  transformItem,
  unionBox,
  type DrawBox,
  type DrawItem,
  type DrawLayer,
  type DrawPoint,
  type DrawShapeKind,
} from '../composables/drawGeometry'
import { DRAW_KEY, type DrawExportOptions, type DrawTool } from '../composables/useDrawing'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(defineProps<{
  /** An endless canvas, or pages of `pageSize` stacked one under another */
  mode?: 'infinite' | 'pages'
  /** A page's size in drawing units (A4 at 96 dpi by default) */
  pageSize?: { width: number; height: number }
  /** The paper's color (pages, or the whole infinite canvas) */
  paper?: string
  /** A ruling drawn on the paper */
  background?: 'none' | 'grid' | 'dots' | 'lines'
  /** The ruling's spacing */
  backgroundSize?: number
  /** An image under the drawing, to trace or annotate: fills each page, or sits at (0, 0) on an infinite canvas */
  backgroundImage?: string
  /** Fingers only pan and zoom: `true`, `false`, or `'auto'` (once a stylus has touched the canvas) */
  penOnly?: boolean | 'auto'
  /** Use the stylus' pressure (without one, speed thins the line) */
  pressure?: boolean
  /** How much strokes are smoothed, 0–1 */
  smoothing?: number
  /** The eraser's radius in screen pixels */
  eraserSize?: number
  /** Undo and redo */
  history?: boolean
  historySize?: number
  /** Look only: no drawing, but pan and zoom */
  readonly?: boolean
  minZoom?: number
  maxZoom?: number
  /** Accessible name of the canvas */
  label?: string
}>(), {
  mode: 'infinite',
  pageSize: () => ({ width: 794, height: 1123 }),
  paper: '#ffffff',
  background: 'none',
  backgroundSize: 24,
  penOnly: 'auto',
  pressure: true,
  smoothing: 0.5,
  eraserSize: 12,
  history: true,
  historySize: 100,
  readonly: false,
  minZoom: 0.1,
  maxZoom: 8,
})

/** The drawing: strokes, shapes and texts */
const items = defineModel<DrawItem[]>({ default: () => [] })
const tool = defineModel<DrawTool>('tool', { default: 'pen' })
const color = defineModel<string>('color', { default: '#1d1b20' })
/** Pen width, shape line width or font size, by tool */
const size = defineModel<number>('size', { default: 4 })
/** New rects and ellipses are filled with the color */
const fill = defineModel<boolean>('fill', { default: false })
/** Layers, bottom first (none: one implicit layer) */
const layers = defineModel<DrawLayer[]>('layers', { default: () => [] })
/** The layer new items go on (default: the top one) */
const layer = defineModel<string | undefined>('layer', { default: undefined })
/** How many pages, in `mode="pages"` */
const pages = defineModel<number>('pages', { default: 1 })
/** The selected items' ids */
const selection = defineModel<string[]>('selection', { default: () => [] })
/** Pan and zoom: screen = drawing × zoom + (x, y) */
const viewport = defineModel<{ x: number; y: number; zoom: number }>('viewport', { default: () => ({ x: 0, y: 0, zoom: 1 }) })

const emit = defineEmits<{ change: [items: DrawItem[]] }>()
const locale = useLocale()

const root = ref<HTMLElement>()
const svgEl = ref<SVGSVGElement>()
const size2 = ref({ width: 0, height: 0 })
const GAP = 24
const pageTop = (i: number) => i * (props.pageSize.height + GAP)
const isPages = computed(() => props.mode === 'pages')

// ── Items, layers, history ──────────────────────────────────────────────────────────────────────────────
// While a gesture edits (erasing, moving) it works on a draft, committed once when it ends
const draft = shallowRef<DrawItem[] | null>(null)
const shownItems = computed(() => draft.value ?? items.value)
const layerIds = computed(() => layers.value.map((l) => l.id))
const activeLayer = computed(() => layer.value ?? layers.value[layers.value.length - 1]?.id)
const layerOf = (it: DrawItem) => layers.value.find((l) => l.id === (it.layer ?? layers.value[0]?.id))
const visible = (it: DrawItem) => layerOf(it)?.visible !== false
const editable = (it: DrawItem) => visible(it) && !layerOf(it)?.locked
const ordered = computed(() => sortByLayer(shownItems.value, layerIds.value).filter(visible))

const past = shallowRef<DrawItem[][]>([])
const future = shallowRef<DrawItem[][]>([])
function commit(next: DrawItem[]) {
  if (props.history) {
    past.value = [...past.value, items.value].slice(-props.historySize)
    future.value = []
  }
  items.value = next
  emit('change', next)
}
function undo() {
  if (!past.value.length) return
  future.value = [items.value, ...future.value]
  items.value = past.value[past.value.length - 1]!
  past.value = past.value.slice(0, -1)
  selection.value = selection.value.filter((id) => items.value.some((i) => i.id === id))
  emit('change', items.value)
}
function redo() {
  if (!future.value.length) return
  past.value = [...past.value, items.value]
  items.value = future.value[0]!
  future.value = future.value.slice(1)
  emit('change', items.value)
}
function clear() {
  if (items.value.length) commit(items.value.filter((i) => !editable(i)))
  selection.value = []
}
function deleteSelection() {
  if (!selection.value.length) return
  const ids = new Set(selection.value)
  commit(items.value.filter((i) => !ids.has(i.id)))
  selection.value = []
}

// ── Coordinates ─────────────────────────────────────────────────────────────────────────────────────────
const vp = computed(() => viewport.value)
function toContent(e: { clientX: number; clientY: number }) {
  const r = root.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left - vp.value.x) / vp.value.zoom, y: (e.clientY - r.top - vp.value.y) / vp.value.zoom }
}
/** The page under a content point (pages mode), or undefined */
function pageAt(y: number) {
  if (!isPages.value) return undefined
  const i = Math.floor(y / (props.pageSize.height + GAP))
  return Math.max(0, Math.min(pages.value - 1, i))
}
const local = (p: { x: number; y: number }, page: number | undefined) => ({ x: p.x, y: page === undefined ? p.y : p.y - pageTop(page) })
const offsetOf = (it: DrawItem) => (isPages.value ? pageTop(it.page ?? 0) : 0)
const clampZoom = (z: number) => Math.min(props.maxZoom, Math.max(props.minZoom, z))
function zoomAt(z: number, sx: number, sy: number) {
  const v = vp.value
  const nz = clampZoom(z)
  viewport.value = { zoom: nz, x: sx - ((sx - v.x) / v.zoom) * nz, y: sy - ((sy - v.y) / v.zoom) * nz }
}
const zoomBy = (f: number) => zoomAt(vp.value.zoom * f, size2.value.width / 2, size2.value.height / 2)
function fitView() {
  const { width, height } = size2.value
  if (!width || !height) return
  const b: DrawBox | null = isPages.value
    ? { x: 0, y: 0, width: props.pageSize.width, height: pageTop(pages.value - 1) + props.pageSize.height }
    : unionBox(ordered.value.map((i) => itemBox(i)))
  if (!b) {
    viewport.value = { x: width / 2, y: height / 2, zoom: 1 }
    return
  }
  const pad = 24
  // Pages fit their width (scrolling down through them); a drawing fits whole
  const z = clampZoom(isPages.value ? Math.min((width - pad * 2) / b.width, 1.5) : Math.min((width - pad * 2) / b.width, (height - pad * 2) / b.height, 2))
  viewport.value = { zoom: z, x: (width - b.width * z) / 2 - b.x * z, y: isPages.value ? pad : (height - b.height * z) / 2 - b.y * z }
}

// ── Pointer gestures ────────────────────────────────────────────────────────────────────────────────────
type Gesture =
  | { kind: 'draw'; id: number; page?: number; points: DrawPoint[]; pen: boolean; touch: boolean; started: number }
  | { kind: 'erase'; id: number; whole: boolean; last: { x: number; y: number } }
  | { kind: 'shape'; id: number; page?: number; shape: DrawShapeKind; from: [number, number]; to: [number, number] }
  | { kind: 'lasso'; id: number; points: [number, number][]; add: boolean }
  | { kind: 'move'; id: number; from: { x: number; y: number }; moved: boolean }
  | { kind: 'scale'; id: number; origin: { x: number; y: number }; from: { x: number; y: number } }
  | { kind: 'pan'; id: number; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'pinch'; ids: [number, number] }
const gesture = shallowRef<Gesture | null>(null)
const touches = new Map<number, { x: number; y: number }>()
let pinch0: { d: number; mx: number; my: number; vp: { x: number; y: number; zoom: number } } | null = null
const penSeen = ref(false)
const spaceHeld = ref(false)
const fingersOnlyNavigate = computed(() => props.penOnly === true || (props.penOnly === 'auto' && penSeen.value))
const live = shallowRef<DrawItem | null>(null)
const lasso = shallowRef<[number, number][] | null>(null)

const isPen = (t: DrawTool): t is 'pen' | 'brush' | 'marker' | 'highlighter' => t === 'pen' || t === 'brush' || t === 'marker' || t === 'highlighter'
const isShape = (t: DrawTool): t is DrawShapeKind => t === 'line' || t === 'arrow' || t === 'rect' || t === 'ellipse'
const pressureOf = (e: PointerEvent) => (props.pressure && e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5)

function strokeFrom(g: Extract<Gesture, { kind: 'draw' }>): DrawItem {
  const pen = tool.value as 'pen'
  let pts = g.points
  if (!(g.pen && props.pressure) && PENS[pen].thinning > 0) pts = simulatePressure(pts, size.value)
  pts = smoothPoints(pts, props.smoothing, size.value).map(([x, y, p]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(p * 100) / 100])
  return { id: 'live', type: 'stroke', pen, color: color.value, size: size.value, points: pts, layer: activeLayer.value, page: g.page }
}

function startPinch() {
  const [a, b] = [...touches.values()]
  if (!a || !b) return
  const r = root.value!.getBoundingClientRect()
  pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, vp: { ...vp.value } }
  gesture.value = { kind: 'pinch', ids: [...touches.keys()].slice(0, 2) as [number, number] }
}

/** Events on the drawing itself, not on what's laid over it (a toolbar, a panel, the text being typed) */
const onCanvas = (e: Event) => e.target === root.value || !!svgEl.value?.contains(e.target as Node)
function onPointerDown(e: PointerEvent) {
  if (!onCanvas(e)) return
  root.value!.focus({ preventScroll: true })
  if (e.pointerType === 'touch') touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (e.pointerType === 'pen') penSeen.value = true
  const g = gesture.value
  // A second finger: pinch (dropping a stroke a finger just began)
  if (e.pointerType === 'touch' && touches.size === 2 && (!g || g.kind === 'pan' || (g.kind === 'draw' && g.touch) || g.kind === 'lasso' || g.kind === 'shape' || g.kind === 'erase')) {
    if (g?.kind === 'erase') draft.value = null
    live.value = null
    lasso.value = null
    startPinch()
    return
  }
  if (g) return
  try {
    root.value!.setPointerCapture(e.pointerId)
  } catch {}
  const p = toContent(e)
  const navigate = e.button === 1 || spaceHeld.value || tool.value === 'pan' || props.readonly || (e.pointerType === 'touch' && fingersOnlyNavigate.value)
  if (navigate) {
    gesture.value = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: vp.value.x, vy: vp.value.y }
    return
  }
  if (e.button !== 0 && !(e.pointerType === 'pen' && e.button === 5)) return
  const eraserEnd = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0)
  const t = eraserEnd ? 'eraser' : tool.value
  if (t === 'eraser' || t === 'stroke-eraser') {
    gesture.value = { kind: 'erase', id: e.pointerId, whole: t === 'stroke-eraser', last: p }
    draft.value = items.value
    eraseUnder(p)
    return
  }
  const page = pageAt(p.y)
  const lp = local(p, page)
  if (isPen(t)) {
    gesture.value = { kind: 'draw', id: e.pointerId, page, points: [[lp.x, lp.y, pressureOf(e)]], pen: e.pointerType === 'pen', touch: e.pointerType === 'touch', started: performance.now() }
    live.value = strokeFrom(gesture.value)
    return
  }
  if (isShape(t)) {
    gesture.value = { kind: 'shape', id: e.pointerId, page, shape: t, from: [lp.x, lp.y], to: [lp.x, lp.y] }
    return
  }
  if (t === 'text') {
    const hit = topHit(p, (i) => i.type === 'text')
    if (hit) editText(hit as Extract<DrawItem, { type: 'text' }>)
    else newText(lp, page)
    e.preventDefault()
    return
  }
  if (t === 'select') {
    const corner = handleAt(p)
    if (corner) {
      const b = selBox.value!
      const ox = corner.includes('l') ? b.x + b.width : b.x
      const oy = corner.includes('t') ? b.y + b.height : b.y
      gesture.value = { kind: 'scale', id: e.pointerId, origin: { x: ox, y: oy }, from: p }
      draft.value = items.value
      return
    }
    const hit = topHit(p)
    const inSel = selBox.value && p.x >= selBox.value.x && p.x <= selBox.value.x + selBox.value.width && p.y >= selBox.value.y && p.y <= selBox.value.y + selBox.value.height
    if (hit && !selection.value.includes(hit.id) && !inSel) selection.value = e.shiftKey ? [...selection.value, hit.id] : [hit.id]
    if (hit || inSel) {
      gesture.value = { kind: 'move', id: e.pointerId, from: p, moved: false }
      draft.value = items.value
      return
    }
    gesture.value = { kind: 'lasso', id: e.pointerId, points: [[p.x, p.y]], add: e.shiftKey }
    lasso.value = [[p.x, p.y]]
  }
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  const g = gesture.value
  if (!g) return
  if (g.kind === 'pinch') {
    const [a, b] = g.ids.map((id) => touches.get(id))
    if (!a || !b || !pinch0) return
    const r = root.value!.getBoundingClientRect()
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    const mx = (a.x + b.x) / 2 - r.left
    const my = (a.y + b.y) / 2 - r.top
    const z = clampZoom(pinch0.vp.zoom * (d / pinch0.d))
    // The content point under the fingers' first midpoint stays under their midpoint now
    const cx = (pinch0.mx - pinch0.vp.x) / pinch0.vp.zoom
    const cy = (pinch0.my - pinch0.vp.y) / pinch0.vp.zoom
    viewport.value = { zoom: z, x: mx - cx * z, y: my - cy * z }
    return
  }
  if ('id' in g && g.id !== e.pointerId) return
  if (g.kind === 'pan') {
    viewport.value = { ...vp.value, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy }
    return
  }
  const events = (e.getCoalescedEvents?.() ?? []).length ? e.getCoalescedEvents() : [e]
  if (g.kind === 'draw') {
    for (const ev of events) {
      const lp = local(toContent(ev), g.page)
      g.points.push([lp.x, lp.y, pressureOf(ev)])
    }
    live.value = strokeFrom(g)
    return
  }
  const p = toContent(e)
  if (g.kind === 'erase') {
    // Along the way, not only where the samples land: a quick swipe still erases what it crossed
    const step = props.eraserSize / vp.value.zoom / 2
    for (const ev of events) {
      const q = toContent(ev)
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - g.last.x, q.y - g.last.y) / step))
      for (let i = 1; i <= n; i++) eraseUnder({ x: g.last.x + ((q.x - g.last.x) * i) / n, y: g.last.y + ((q.y - g.last.y) * i) / n })
      g.last = q
    }
    return
  }
  if (g.kind === 'shape') {
    const lp = local(p, g.page)
    g.to = e.shiftKey ? constrain(g.shape, g.from, [lp.x, lp.y]) : [lp.x, lp.y]
    live.value = { id: 'live', type: 'shape', shape: g.shape, from: g.from, to: g.to, color: color.value, size: size.value, fill: fill.value ? color.value : null, layer: activeLayer.value, page: g.page }
    return
  }
  if (g.kind === 'lasso') {
    g.points.push([p.x, p.y])
    lasso.value = g.points.slice()
    return
  }
  if (g.kind === 'move') {
    const dx = p.x - g.from.x
    const dy = p.y - g.from.y
    if (!g.moved && Math.hypot(dx, dy) * vp.value.zoom < 3) return
    g.moved = true
    const ids = new Set(selection.value)
    draft.value = items.value.map((i) => (ids.has(i.id) ? transformItem(i, { dx, dy }) : i))
    return
  }
  if (g.kind === 'scale') {
    const d0 = Math.hypot(g.from.x - g.origin.x, g.from.y - g.origin.y) || 1
    const k = Math.max(0.05, Math.hypot(p.x - g.origin.x, p.y - g.origin.y) / d0)
    const ids = new Set(selection.value)
    draft.value = items.value.map((i) => (ids.has(i.id) ? transformItem(i, { sx: k, sy: k, ox: g.origin.x, oy: g.origin.y - offsetOf(i) }) : i))
  }
}

function onPointerUp(e: PointerEvent) {
  touches.delete(e.pointerId)
  const g = gesture.value
  if (!g) return
  if (g.kind === 'pinch') {
    if (!g.ids.includes(e.pointerId)) return
    gesture.value = null
    pinch0 = null
    // The finger left behind keeps panning
    const [id, t] = [...touches.entries()][0] ?? []
    if (id !== undefined && t) gesture.value = { kind: 'pan', id, sx: t.x, sy: t.y, vx: vp.value.x, vy: vp.value.y }
    return
  }
  if (g.id !== e.pointerId) return
  gesture.value = null
  const cancelled = e.type === 'pointercancel'
  if (g.kind === 'draw') {
    const s = strokeFrom(g)
    live.value = null
    if (!cancelled) commit([...items.value, { ...s, id: drawId() }])
  } else if (g.kind === 'shape') {
    const it = live.value
    live.value = null
    if (it && !cancelled && Math.hypot(g.to[0] - g.from[0], g.to[1] - g.from[1]) > 2) commit([...items.value, { ...it, id: drawId() }])
  } else if (g.kind === 'erase' || g.kind === 'move' || g.kind === 'scale') {
    const next = draft.value
    draft.value = null
    if (next && next !== items.value && !cancelled && (g.kind !== 'move' || g.moved)) commit(next)
    if (g.kind === 'move' && !g.moved && !e.shiftKey) {
      const hit = topHit(toContent(e))
      selection.value = hit ? [hit.id] : []
    }
  } else if (g.kind === 'lasso') {
    const poly = g.points
    lasso.value = null
    if (poly.length < 3) {
      if (!g.add) selection.value = []
      return
    }
    const taken = shownItems.value.filter((i) => editable(i) && inLasso(i, poly.map(([x, y]) => [x, y - offsetOf(i)]))).map((i) => i.id)
    selection.value = g.add ? [...new Set([...selection.value, ...taken])] : taken
  }
}

function eraseUnder(p: { x: number; y: number }) {
  const r = props.eraserSize / vp.value.zoom
  const g = gesture.value
  const whole = g?.kind === 'erase' && g.whole
  let changed = false
  const next: DrawItem[] = []
  for (const it of draft.value ?? items.value) {
    if (!editable(it)) {
      next.push(it)
      continue
    }
    const lx = p.x
    const ly = p.y - offsetOf(it)
    if (whole) {
      if (hitItem(it, lx, ly, r)) changed = true
      else next.push(it)
      continue
    }
    const kept = eraseAt(it, lx, ly, r)
    if (kept.length !== 1 || kept[0] !== it) changed = true
    next.push(...kept)
  }
  if (changed) draft.value = next
}

/** The topmost editable item under a content point */
function topHit(p: { x: number; y: number }, ok: (i: DrawItem) => boolean = () => true) {
  const tol = 6 / vp.value.zoom
  const list = ordered.value
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i]!
    if (editable(it) && ok(it) && hitItem(it, p.x, p.y - offsetOf(it), tol)) return it
  }
  return null
}

function onWheel(e: WheelEvent) {
  if (!onCanvas(e)) return
  e.preventDefault()
  const r = root.value!.getBoundingClientRect()
  if (e.ctrlKey || e.metaKey) zoomAt(vp.value.zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.01)), e.clientX - r.left, e.clientY - r.top)
  else {
    const k = e.deltaMode ? 16 : 1
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
    viewport.value = { ...vp.value, x: vp.value.x - dx * k, y: vp.value.y - dy * k }
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!onCanvas(e)) return
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    redo()
  } else if (mod && e.key.toLowerCase() === 'a' && !props.readonly) {
    e.preventDefault()
    tool.value = 'select'
    selection.value = shownItems.value.filter(editable).map((i) => i.id)
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.value.length) {
    e.preventDefault()
    deleteSelection()
  } else if (e.key === 'Escape') selection.value = []
  else if (e.key === ' ' && !e.repeat) {
    e.preventDefault()
    spaceHeld.value = true
  }
}
const onKeyup = (e: KeyboardEvent) => e.key === ' ' && (spaceHeld.value = false)

// ── Selection box ───────────────────────────────────────────────────────────────────────────────────────
const selBox = computed<DrawBox | null>(() => {
  const ids = new Set(selection.value)
  const boxes = shownItems.value.filter((i) => ids.has(i.id)).map((i) => {
    const b = itemBox(i)
    return { ...b, y: b.y + offsetOf(i) }
  })
  return unionBox(boxes)
})
const HANDLE = 10
const corners = computed(() => {
  const b = selBox.value
  if (!b || tool.value !== 'select') return []
  return [
    { id: 'tl', x: b.x, y: b.y, cursor: 'nwse-resize' },
    { id: 'tr', x: b.x + b.width, y: b.y, cursor: 'nesw-resize' },
    { id: 'bl', x: b.x, y: b.y + b.height, cursor: 'nesw-resize' },
    { id: 'br', x: b.x + b.width, y: b.y + b.height, cursor: 'nwse-resize' },
  ]
})
function handleAt(p: { x: number; y: number }) {
  const r = (HANDLE * 1.2) / vp.value.zoom
  return corners.value.find((c) => Math.abs(c.x - p.x) <= r && Math.abs(c.y - p.y) <= r)?.id
}
watch(tool, (t) => t !== 'select' && (selection.value = []))

// ── Text ────────────────────────────────────────────────────────────────────────────────────────────────
const editing = ref<{ id: string | null; at: [number, number]; page?: number; text: string; size: number; color: string } | null>(null)
const textarea = ref<HTMLTextAreaElement>()
function newText(lp: { x: number; y: number }, page: number | undefined) {
  if (editing.value) return finishText()
  const fs = Math.max(12, size.value * 4)
  editing.value = { id: null, at: [lp.x, lp.y - fs * 0.6], page, text: '', size: fs, color: color.value }
  nextTick(() => textarea.value?.focus())
}
function editText(t: Extract<DrawItem, { type: 'text' }>) {
  editing.value = { id: t.id, at: t.at, page: t.page, text: t.text, size: t.size, color: t.color }
  nextTick(() => {
    textarea.value?.focus()
    textarea.value?.select()
  })
}
function finishText() {
  const ed = editing.value
  if (!ed) return
  editing.value = null
  const text = ed.text.replace(/\s+$/, '')
  if (ed.id) {
    const before = items.value.find((i) => i.id === ed.id)
    if (!before) return
    if (!text) commit(items.value.filter((i) => i.id !== ed.id))
    else if (before.type === 'text' && before.text !== text) commit(items.value.map((i) => (i.id === ed.id ? { ...i, text } : i)))
  } else if (text) {
    commit([...items.value, { id: drawId(), type: 'text', at: ed.at, text, size: ed.size, color: ed.color, layer: activeLayer.value, page: ed.page }])
  }
}
const textStyle = computed(() => {
  const ed = editing.value
  if (!ed) return {}
  const z = vp.value.zoom
  const top = ed.page === undefined ? 0 : pageTop(ed.page)
  const lines = ed.text.split('\n')
  return {
    left: `${ed.at[0] * z + vp.value.x}px`,
    top: `${(ed.at[1] + top) * z + vp.value.y}px`,
    fontSize: `${ed.size * z}px`,
    lineHeight: String(LINE_HEIGHT),
    color: ed.color,
    width: `${Math.max(4, ...lines.map((l) => l.length + 1)) * 0.6}em`,
    height: `${lines.length * LINE_HEIGHT}em`,
  }
})
function onDblclick(e: MouseEvent) {
  if (tool.value !== 'select' || props.readonly) return
  const hit = topHit(toContent(e), (i) => i.type === 'text')
  if (hit) editText(hit as Extract<DrawItem, { type: 'text' }>)
}

// ── Drawing the items ───────────────────────────────────────────────────────────────────────────────────
const paths = new WeakMap<DrawItem, { d: string; head?: string }>()
function geometryOf(it: DrawItem) {
  let g = paths.get(it)
  if (!g) {
    g = it.type === 'stroke' ? { d: strokePath(it) } : it.type === 'shape' ? shapePath(it) : { d: '' }
    paths.set(it, g)
  }
  return g
}
const editingId = computed(() => editing.value?.id)
const pageList = computed(() => (isPages.value ? Array.from({ length: Math.max(1, pages.value) }, (_, i) => i) : [undefined]))
const itemsOn = (page: number | undefined) => ordered.value.filter((i) => (page === undefined ? true : (i.page ?? 0) === page) && i.id !== editingId.value)
// The infinite canvas' paper and ruling cover the visible area
const visibleArea = computed(() => {
  const z = vp.value.zoom
  return { x: -vp.value.x / z, y: -vp.value.y / z, width: size2.value.width / z, height: size2.value.height / z }
})
// Stable across server and client render (pattern and clip ids)
const uid = `m3d${useId().replace(/[^a-zA-Z0-9-]/g, "")}`
const rule = computed(() => props.backgroundSize)
const cursor = computed(() => {
  if (gesture.value?.kind === 'pan' || gesture.value?.kind === 'pinch') return 'grabbing'
  if (spaceHeld.value || tool.value === 'pan' || props.readonly) return 'grab'
  if (tool.value === 'text') return 'text'
  if (tool.value === 'select') return 'default'
  return 'crosshair'
})

// ── Exporting ───────────────────────────────────────────────────────────────────────────────────────────
const hiddenLayers = computed(() => layers.value.filter((l) => l.visible === false).map((l) => l.id))
function exportSvg(opts: DrawExportOptions = {}) {
  const font = root.value ? getComputedStyle(root.value).fontFamily : 'sans-serif'
  const page = isPages.value ? opts.page ?? 0 : undefined
  return toDrawSvg(items.value, {
    page,
    box: isPages.value ? { x: 0, y: 0, ...props.pageSize } : undefined,
    background: opts.background === false ? undefined : props.paper,
    hiddenLayers: hiddenLayers.value,
    layers: layerIds.value,
    fontFamily: font,
  })
}
const exportPng = (opts: DrawExportOptions = {}) => svgToPng(exportSvg(opts), opts.scale ?? 2)

// ── Lifecycle ───────────────────────────────────────────────────────────────────────────────────────────
let ro: ResizeObserver | null = null
onMounted(() => {
  const el = root.value!
  el.addEventListener('wheel', onWheel, { passive: false })
  const measure = () => (size2.value = { width: el.clientWidth, height: el.clientHeight })
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(el)
  // Pages start fitted to the width; an infinite canvas centered on what's drawn
  const v = viewport.value
  if (v.x === 0 && v.y === 0 && v.zoom === 1) fitView()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  root.value?.removeEventListener('wheel', onWheel)
})

provide(DRAW_KEY, {
  tool,
  color,
  size,
  fill,
  items: computed(() => items.value),
  selection,
  layers: computed(() => layers.value),
  setLayers: (l: DrawLayer[]) => (layers.value = l),
  layer: computed({ get: () => activeLayer.value, set: (v) => (layer.value = v) }),
  mode: computed(() => props.mode),
  pages,
  addPage: () => (pages.value = pages.value + 1),
  zoom: computed(() => vp.value.zoom),
  zoomIn: () => zoomBy(1.25),
  zoomOut: () => zoomBy(0.8),
  fitView,
  canUndo: computed(() => past.value.length > 0),
  canRedo: computed(() => future.value.length > 0),
  undo,
  redo,
  clear,
  deleteSelection,
  exportSvg,
  exportPng,
})

defineExpose({ undo, redo, clear, deleteSelection, fitView, zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(0.8), exportSvg, exportPng, toContent })
</script>

<template>
  <div
    ref="root"
    class="m3-draw-canvas relative overflow-hidden bg-surface-container outline-none select-none [touch-action:none]"
    :style="{ cursor }"
    tabindex="0"
    role="application"
    :aria-label="label ?? locale.drawCanvas"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onPointerUp"
    @dblclick="onDblclick"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @contextmenu.prevent
  >
    <svg ref="svgEl" class="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern :id="`${uid}-grid`" :width="rule" :height="rule" patternUnits="userSpaceOnUse">
          <path :d="`M${rule} 0H0V${rule}`" fill="none" stroke="rgba(0,0,0,.12)" :stroke-width="1 / vp.zoom" />
        </pattern>
        <pattern :id="`${uid}-dots`" :width="rule" :height="rule" patternUnits="userSpaceOnUse">
          <circle :cx="rule / 2" :cy="rule / 2" :r="Math.max(0.8, 1.2 / vp.zoom)" fill="rgba(0,0,0,.22)" />
        </pattern>
        <pattern :id="`${uid}-lines`" :width="rule * 4" :height="rule * 1.25" patternUnits="userSpaceOnUse">
          <path :d="`M0 ${rule * 1.25 - 0.5}H${rule * 4}`" fill="none" stroke="rgba(30,90,200,.22)" :stroke-width="1 / vp.zoom" />
        </pattern>
        <clipPath v-for="p in (isPages ? pageList : [])" :id="`${uid}-page${p}`" :key="p ?? 'x'">
          <rect x="0" y="0" :width="pageSize.width" :height="pageSize.height" />
        </clipPath>
      </defs>
      <g :transform="`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`">
        <template v-if="!isPages">
          <rect v-bind="visibleArea" :fill="paper" />
          <image v-if="backgroundImage" :href="backgroundImage" x="0" y="0" />
          <rect v-if="background !== 'none'" v-bind="visibleArea" :fill="`url(#${uid}-${background})`" />
        </template>
        <g v-for="p in pageList" :key="p ?? 'all'" :transform="p === undefined ? undefined : `translate(0 ${pageTop(p)})`">
          <template v-if="p !== undefined">
            <rect x="0" y="0" :width="pageSize.width" :height="pageSize.height" :fill="paper" class="m3-draw-page" />
            <image v-if="backgroundImage" :href="backgroundImage" x="0" y="0" :width="pageSize.width" :height="pageSize.height" preserveAspectRatio="xMidYMid meet" />
            <rect v-if="background !== 'none'" x="0" y="0" :width="pageSize.width" :height="pageSize.height" :fill="`url(#${uid}-${background})`" />
          </template>
          <g :clip-path="p === undefined ? undefined : `url(#${uid}-page${p})`">
            <template v-for="it in itemsOn(p)" :key="it.id">
              <path v-if="it.type === 'stroke'" :d="geometryOf(it).d" :fill="it.color" :fill-opacity="PENS[it.pen].opacity" />
              <template v-else-if="it.type === 'shape'">
                <path
                  :d="geometryOf(it).d"
                  :fill="it.fill && (it.shape === 'rect' || it.shape === 'ellipse') ? it.fill : 'none'"
                  :stroke="it.color"
                  :stroke-width="it.size"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path v-if="geometryOf(it).head" :d="geometryOf(it).head" :fill="it.color" />
              </template>
              <text v-else :x="it.at[0]" :y="it.at[1]" :font-size="it.size" :fill="it.color" class="m3-draw-text">
                <tspan v-for="(l, i) in it.text.split('\n')" :key="i" :x="it.at[0]" :dy="i ? it.size * LINE_HEIGHT : it.size * 0.95">{{ l || ' ' }}</tspan>
              </text>
            </template>
            <template v-if="live && (p === undefined || live.page === p)">
              <path v-if="live.type === 'stroke'" :d="strokePath(live)" :fill="live.color" :fill-opacity="PENS[live.pen].opacity" />
              <template v-else-if="live.type === 'shape'">
                <path :d="shapePath(live).d" :fill="live.fill && (live.shape === 'rect' || live.shape === 'ellipse') ? live.fill : 'none'" :stroke="live.color" :stroke-width="live.size" stroke-linecap="round" stroke-linejoin="round" />
                <path v-if="shapePath(live).head" :d="shapePath(live).head" :fill="live.color" />
              </template>
            </template>
          </g>
        </g>
        <!-- Selection -->
        <polygon v-if="lasso" :points="lasso.map((q) => q.join(',')).join(' ')" class="fill-primary/8 stroke-primary" :stroke-width="1.5 / vp.zoom" :stroke-dasharray="`${4 / vp.zoom} ${3 / vp.zoom}`" />
        <template v-if="selBox && tool === 'select'">
          <rect
            :x="selBox.x - 4 / vp.zoom"
            :y="selBox.y - 4 / vp.zoom"
            :width="selBox.width + 8 / vp.zoom"
            :height="selBox.height + 8 / vp.zoom"
            fill="none"
            class="stroke-primary"
            :stroke-width="1.5 / vp.zoom"
            :stroke-dasharray="`${5 / vp.zoom} ${4 / vp.zoom}`"
          />
          <rect
            v-for="h in corners"
            :key="h.id"
            :x="h.x - HANDLE / 2 / vp.zoom"
            :y="h.y - HANDLE / 2 / vp.zoom"
            :width="HANDLE / vp.zoom"
            :height="HANDLE / vp.zoom"
            :rx="2 / vp.zoom"
            class="fill-surface stroke-primary"
            :stroke-width="1.5 / vp.zoom"
            :style="{ cursor: h.cursor }"
          />
        </template>
      </g>
    </svg>

    <textarea
      v-if="editing"
      ref="textarea"
      v-model="editing.text"
      data-draw-overlay
      class="m3-draw-text absolute resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-1 outline-primary outline-dashed"
      :style="textStyle"
      :aria-label="locale.drawText"
      spellcheck="false"
      @blur="finishText"
      @keydown.esc.prevent="finishText"
      @keydown.stop
    />

    <slot />
  </div>
</template>

<style>
@layer base {
  .m3-draw-canvas {
    min-height: 240px;
  }
}
.m3-draw-page {
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.2)) drop-shadow(0 1px 6px rgb(0 0 0 / 0.08));
}
.m3-draw-text {
  font-family: var(--font-sans, sans-serif);
}
</style>
