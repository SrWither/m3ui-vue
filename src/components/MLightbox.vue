<script setup lang="ts">
/*
 * Full-screen image viewer. M3 has no lightbox component; the reference is Google Photos' viewer:
 * a black stage, a top bar (close, position, actions) and a bottom area (caption, thumbnails) that
 * a tap hides and shows, and gestures for everything.
 *
 * - Swipe between images on a track where the neighbors are already there (prev / current / next
 *   are rendered), velocity-aware; arrows and keys too.
 * - Zoom: double tap / double click at a point, pinch, wheel; drag to pan while zoomed.
 * - Drag the image down (or up) to dismiss, the backdrop fading as it goes.
 * - Opens from and closes back into the image it came from when there is one (auto-scanned
 *   images, or `open(index, el)`); otherwise it scales and fades.
 *
 * Motion follows the library's convention: plain JS springs (Standard DefaultSpatial,
 * dampingRatio 0.9 / stiffness 700) stepped in one rAF loop that writes transforms directly.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MIconButton from './MIconButton.vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'

export interface LightboxItem {
  src: string
  alt?: string
  caption?: string
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    /** Explicit gallery. Omit it to auto-detect `<img>` elements rendered in the default slot instead. */
    items?: LightboxItem[]
    index?: number
    loop?: boolean
    closeLabel?: string
    /** Show a row of clickable thumbnails at the bottom for jumping directly to an image. */
    showThumbnails?: boolean
    /** Round the corners of the opened image. */
    rounded?: boolean
    /** Allow zooming (double tap / double click, pinch, wheel, + and - keys). */
    zoom?: boolean
    /** Largest zoom factor. */
    maxZoom?: number
  }>(),
  {
    modelValue: false,
    index: 0,
    loop: true,
    showThumbnails: false,
    rounded: true,
    zoom: true,
    maxZoom: 4,
  },
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'update:index': [number]
  change: [index: number]
}>()

defineSlots<{
  default?: () => unknown
  /** Extra buttons in the top bar (download, share, info…). */
  actions?: (scope: { item: LightboxItem; index: number }) => unknown
}>()

const locale = useLocale()

const containerEl = ref<HTMLElement>()
const rootEl = ref<HTMLElement>()
const stageEl = ref<HTMLElement>()
const thumbsEl = ref<HTMLElement>()
const scannedItems = ref<LightboxItem[]>([])
const scannedEls: HTMLElement[] = []
/** Elements the viewer can open from / close into, by item index. */
const origins = new Map<number, HTMLElement>()

const rendered = ref(false)
const currentIndex = ref(props.index)
const chrome = ref(true)
const zoomed = ref(false)
const loaded = ref(new Set<string>())
/** Width / height of each image, measured once it loads. */
const ratios = ref(new Map<string, number>())
/** The area an image can fill: the stage minus the slide's padding (p-4, sm:p-12). */
const box = ref({ w: 0, h: 0 })

const galleryItems = computed(() => props.items ?? scannedItems.value)
const count = computed(() => galleryItems.value.length)
const current = computed(() => galleryItems.value[currentIndex.value])
const hasMultiple = computed(() => count.value > 1)

function neighbor(i: number, delta: number) {
  const n = i + delta
  if (n >= 0 && n < count.value) return n
  if (!props.loop || count.value < 2) return null
  return (n + count.value) % count.value
}
const prevIndex = computed(() => neighbor(currentIndex.value, -1))
const nextIndex = computed(() => neighbor(currentIndex.value, 1))
// Current first in the DOM, then its neighbors (preloaded, ready for a swipe).
const slides = computed(() =>
  [
    { offset: 0, index: currentIndex.value },
    { offset: 1, index: nextIndex.value },
    { offset: -1, index: prevIndex.value },
  ].filter((s): s is { offset: number; index: number } => s.index !== null && !!galleryItems.value[s.index]),
)

const positionLabel = computed(() =>
  locale.carouselItem.replace('{index}', String(currentIndex.value + 1)).replace('{count}', String(count.value)),
)

// ── Springs ───────────────────────────────────────────────────────────────────────────────────

interface Spring { pos: number; vel: number; target: number; k: number; z: number }
const spring = (pos: number, k = 700, z = 0.9): Spring => ({ pos, vel: 0, target: pos, k, z })

const trackX = spring(0)
const dismissY = spring(0)
const scale = spring(1)
const panX = spring(0)
const panY = spring(0)
const intro = spring(0)
const backdrop = spring(0, 300, 1)
const springs = [trackX, dismissY, scale, panX, panY, intro, backdrop]

const GAP = 16
let stageW = 0
let stageH = 0
let raf = 0
let lastFrame = 0
let onSettled: (() => void) | null = null
/** The origin as a transform of the open image: offset, scale, and the crop that gives it the origin's shape. */
interface Origin { dx: number; dy: number; s: number; insetX: number; insetY: number; radius: number }
let introFrom: Origin | null = null
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function setNow(s: Spring, v: number) {
  s.pos = v
  s.target = v
  s.vel = 0
}

function animate() {
  if (reducedMotion()) springs.forEach((s) => setNow(s, s.target))
  if (!raf) {
    lastFrame = performance.now()
    raf = requestAnimationFrame(step)
  }
  write()
}

function step(now: number) {
  raf = 0
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30)
  lastFrame = now
  let moving = false
  for (const s of springs) {
    for (let left = dt; left > 0; left -= 0.004) {
      const h = Math.min(0.004, left)
      s.vel += (-s.k * (s.pos - s.target) - 2 * s.z * Math.sqrt(s.k) * s.vel) * h
      s.pos += s.vel * h
    }
    const eps = s === scale || s === intro || s === backdrop ? 0.001 : 0.5
    if (Math.abs(s.pos - s.target) < eps && Math.abs(s.vel) < eps * 10) setNow(s, s.target)
    else moving = true
  }
  write()
  if (moving || dragging()) raf = requestAnimationFrame(step)
  else if (onSettled) {
    const cb = onSettled
    onSettled = null
    cb()
  }
}

/** Writes every animated value to the DOM (never through reactive bindings). */
function write() {
  const root = rootEl.value
  if (!root) return
  const fade = 1 - Math.min(Math.abs(dismissY.pos) / (stageH * 0.5 || 300), 1) * 0.85
  const back = root.querySelector<HTMLElement>('[data-lb-backdrop]')
  if (back) back.style.opacity = String(Math.max(0, Math.min(1, backdrop.pos * fade)))
  root.querySelectorAll<HTMLElement>('[data-lb-slide]').forEach((el) => {
    const k = Number(el.dataset.offset)
    el.style.transform = `translate3d(${k * (stageW + GAP) + trackX.pos}px, 0, 0)`
  })
  // Neighbors show their image plainly: clear what was written while one of them was current.
  root.querySelectorAll<HTMLElement>('[data-lb-slide]:not([data-offset="0"]) [data-lb-zoom]').forEach((el) => {
    el.style.transform = ''
    el.style.opacity = ''
    el.style.clipPath = ''
  })
  const zoomEl = root.querySelector<HTMLElement>('[data-lb-slide][data-offset="0"] [data-lb-zoom]')
  if (zoomEl) {
    const shrink = 1 - Math.min(Math.abs(dismissY.pos) / (stageH || 600), 1) * 0.3
    let tx = panX.pos
    let ty = panY.pos + dismissY.pos
    let s = scale.pos * shrink
    let opacity = 1
    let clip = ''
    const p = intro.pos
    if (p < 1) {
      if (introFrom) {
        // Container transform: start as the origin (its position, size, crop and corners) and
        // open up into the whole image.
        tx = introFrom.dx + (tx - introFrom.dx) * p
        ty = introFrom.dy + (ty - introFrom.dy) * p
        s = introFrom.s + (s - introFrom.s) * p
        const q = Math.max(0, 1 - p)
        const radius = introFrom.radius + ((props.rounded ? 16 : 0) - introFrom.radius) * p
        clip = `inset(${introFrom.insetY * q}px ${introFrom.insetX * q}px round ${Math.max(0, radius)}px)`
      } else {
        s *= 0.92 + 0.08 * p
        opacity = Math.max(0, Math.min(1, p))
      }
    }
    zoomEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`
    zoomEl.style.opacity = String(opacity)
    zoomEl.style.clipPath = clip
  }
}

// ── Opening and closing ───────────────────────────────────────────────────────────────────────

let restoreFocus: HTMLElement | null = null

function measure() {
  stageW = stageEl.value?.clientWidth ?? 0
  stageH = stageEl.value?.clientHeight ?? 0
  const pad = window.innerWidth >= 640 ? 48 : 16
  const w = Math.max(0, stageW - pad * 2)
  const h = Math.max(0, stageH - pad * 2)
  if (w !== box.value.w || h !== box.value.h) box.value = { w, h }
}

function currentImg() {
  return rootEl.value?.querySelector<HTMLImageElement>('[data-lb-slide][data-offset="0"] img') ?? null
}

/**
 * The origin element as a transform of the open image. The origin usually crops the picture
 * (object-cover thumbnails), so the image is scaled to cover it and clipped to its shape.
 */
function originTransform(): Origin | null {
  const el = origins.get(currentIndex.value)
  const img = currentImg()
  const stage = stageEl.value
  if (!el || !el.isConnected || !img || !stage || !img.offsetWidth) return null
  const o = el.getBoundingClientRect()
  if (!o.width || !o.height) return null
  const st = stage.getBoundingClientRect()
  const iw = img.offsetWidth
  const ih = img.offsetHeight
  const s = Math.max(0.05, Math.max(o.width / iw, o.height / ih))
  return {
    dx: o.left + o.width / 2 - (st.left + st.width / 2),
    dy: o.top + o.height / 2 - (st.top + st.height / 2),
    s,
    // Insets and radius are in the image's own (unscaled) pixels: the clip is scaled with it.
    insetX: Math.max(0, (iw - o.width / s) / 2),
    insetY: Math.max(0, (ih - o.height / s) / 2),
    radius: (Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) / s,
  }
}

async function show() {
  restoreFocus = document.activeElement as HTMLElement | null
  rendered.value = true
  chrome.value = true
  resetZoom(true)
  setNow(trackX, 0)
  setNow(dismissY, 0)
  setNow(intro, 0)
  setNow(backdrop, 0)
  backdrop.k = 300
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  await nextTick()
  measure()
  backdrop.target = 1
  animate()
  rootEl.value?.querySelector<HTMLElement>('[data-lb-close]')?.focus()
  // Grow out of the origin once the image has a size to grow into (or after a short wait).
  const img = currentImg()
  if (img && !img.complete) {
    await Promise.race([new Promise((r) => img.addEventListener('load', r, { once: true })), new Promise((r) => setTimeout(r, 300))])
  }
  if (!rendered.value) return
  introFrom = originTransform()
  intro.target = 1
  animate()
}

function hide() {
  document.removeEventListener('keydown', onKeydown)
  // The bars and the backdrop go with the image, not after it.
  chrome.value = false
  backdrop.k = 700
  introFrom = originTransform()
  resetZoom()
  intro.target = 0
  backdrop.target = 0
  if (introFrom) dismissY.target = 0
  else if (dismissY.pos !== 0) {
    // Dismissed by a drag with nowhere to return to: carry on in that direction.
    intro.target = 1
    dismissY.target = Math.sign(dismissY.pos) * (stageH || 800)
  }
  onSettled = () => {
    rendered.value = false
    document.body.style.overflow = ''
    restoreFocus?.focus?.()
    restoreFocus = null
  }
  animate()
}

watch(() => props.modelValue, (v) => (v ? !rendered.value && show() : rendered.value && hide()), { immediate: true })
watch(() => props.index, (v) => {
  if (v === currentIndex.value || !galleryItems.value[v]) return
  // Closed, or still opening (a consumer usually sets the index and opens in the same tick): show
  // that image directly. Only an index change while it's open slides.
  if (!rendered.value || intro.pos < 0.999 || intro.target < 1) {
    resetZoom(true)
    setNow(trackX, 0)
    currentIndex.value = v
  } else {
    go(v)
  }
})

function open(i = 0, sourceEl?: HTMLElement) {
  if (sourceEl) origins.set(i, sourceEl)
  setIndex(i)
  emit('update:modelValue', true)
  if (!rendered.value) show()
}

function close() {
  emit('update:modelValue', false)
  if (rendered.value) hide()
}

// ── Navigation ────────────────────────────────────────────────────────────────────────────────

function setIndex(i: number) {
  if (i === currentIndex.value) return
  currentIndex.value = i
  emit('update:index', i)
  emit('change', i)
}

/**
 * Moves to `i`. The index changes right away; the track starts where the new image already was
 * (or one slot away, for a jump) and springs to center.
 */
function go(i: number, direction?: number) {
  if (i === currentIndex.value || !galleryItems.value[i]) return
  const dir = direction ?? (i > currentIndex.value ? 1 : -1)
  resetZoom(true)
  setNow(dismissY, 0)
  setIndex(i)
  trackX.pos += dir * (stageW + GAP)
  trackX.target = 0
  animate()
}

function next() {
  if (nextIndex.value !== null) go(nextIndex.value, 1)
}

function prev() {
  if (prevIndex.value !== null) go(prevIndex.value, -1)
}

watch(currentIndex, async () => {
  await nextTick()
  write()
  // Scroll only the strip: scrollIntoView() would also scroll the viewer's own (overflow-hidden)
  // container and leave the whole thing shifted sideways.
  const strip = thumbsEl.value
  const thumb = strip?.querySelector<HTMLElement>('[data-lb-thumb][aria-current="true"]')
  if (strip && thumb) strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' })
})

// ── Zoom ──────────────────────────────────────────────────────────────────────────────────────

function panBounds(s: number) {
  const img = currentImg()
  const w = img?.offsetWidth ?? 0
  const h = img?.offsetHeight ?? 0
  return { x: Math.max(0, (w * s - stageW) / 2), y: Math.max(0, (h * s - stageH) / 2) }
}

function clampPanTargets() {
  const b = panBounds(scale.target)
  panX.target = Math.max(-b.x, Math.min(b.x, panX.target))
  panY.target = Math.max(-b.y, Math.min(b.y, panY.target))
}

function resetZoom(now = false) {
  for (const [s, v] of [[scale, 1], [panX, 0], [panY, 0]] as const) {
    if (now) setNow(s, v)
    else s.target = v
  }
  zoomed.value = false
}

/** Zooms to `factor` keeping the point (x, y), relative to the stage center, under the pointer. */
function zoomTo(factor: number, x: number, y: number, now = false) {
  const s = Math.max(1, Math.min(props.maxZoom, factor))
  const ratio = s / scale.target
  const tx = x - (x - panX.target) * ratio
  const ty = y - (y - panY.target) * ratio
  scale.target = s
  panX.target = tx
  panY.target = ty
  clampPanTargets()
  if (now) [scale, panX, panY].forEach((sp) => setNow(sp, sp.target))
  zoomed.value = s > 1.01
  animate()
}

function stagePoint(clientX: number, clientY: number) {
  const r = stageEl.value!.getBoundingClientRect()
  return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) }
}

function toggleZoomAt(clientX: number, clientY: number) {
  if (!props.zoom) return
  if (zoomed.value) {
    resetZoom()
    animate()
  } else {
    const p = stagePoint(clientX, clientY)
    zoomTo(Math.min(2.5, props.maxZoom), p.x, p.y)
  }
}

function onWheel(e: WheelEvent) {
  if (!props.zoom || !rendered.value) return
  e.preventDefault()
  const p = stagePoint(e.clientX, e.clientY)
  // Trackpad pinches arrive as ctrl+wheel with small deltas.
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))
  zoomTo(scale.target * factor, p.x, p.y, true)
}

// ── Gestures ──────────────────────────────────────────────────────────────────────────────────

type Mode = 'pending' | 'swipe' | 'dismiss' | 'pan' | 'pinch' | 'ignore'
const pointers = new Map<number, { x: number; y: number }>()
let mode: Mode | null = null
let start = { x: 0, y: 0, t: 0, trackX: 0, dismissY: 0, panX: 0, panY: 0 }
let pinch = { dist: 0, scale: 1, mid: { x: 0, y: 0 }, panX: 0, panY: 0 }
let samples: { t: number; x: number; y: number }[] = []
let lastTap = { t: -Infinity, x: 0, y: 0 }
let tapTimer: ReturnType<typeof setTimeout> | null = null
const dragging = () => mode !== null && mode !== 'pending'

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || (e.target as Element).closest('button, a, input')) return
  measure()
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  try { stageEl.value?.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
  if (pointers.size === 2 && props.zoom) {
    startPinch()
    return
  }
  if (pointers.size > 1) return
  springs.forEach((s) => (s.target = s.pos))
  start = { x: e.clientX, y: e.clientY, t: performance.now(), trackX: trackX.pos, dismissY: dismissY.pos, panX: panX.pos, panY: panY.pos }
  samples = [{ t: start.t, x: e.clientX, y: e.clientY }]
  mode = 'pending'
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (mode === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    const s = Math.max(0.8, Math.min(props.maxZoom * 1.2, pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist)))
    const mid = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2)
    lastMid = mid
    const ratio = s / pinch.scale
    setNow(scale, s)
    setNow(panX, mid.x - (pinch.mid.x - pinch.panX) * ratio)
    setNow(panY, mid.y - (pinch.mid.y - pinch.panY) * ratio)
    zoomed.value = s > 1.01
    write()
    return
  }
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  const now = performance.now()
  samples.push({ t: now, x: e.clientX, y: e.clientY })
  while (samples.length > 2 && now - samples[0]!.t > 100) samples.shift()
  if (mode === 'pending') {
    const slop = e.pointerType === 'touch' ? 8 : 4
    if (Math.hypot(dx, dy) < slop) return
    if (zoomed.value) mode = 'pan'
    else if (Math.abs(dx) > Math.abs(dy)) mode = hasMultiple.value ? 'swipe' : 'dismiss'
    else mode = 'dismiss'
    chromeBeforeDrag = chrome.value
    if (mode === 'dismiss') chrome.value = false
  }
  if (mode === 'swipe') {
    // Resist past the ends of a non-looping gallery.
    let x = start.trackX + dx
    if ((x > 0 && prevIndex.value === null) || (x < 0 && nextIndex.value === null)) x = start.trackX + dx * 0.3
    setNow(trackX, x)
  } else if (mode === 'dismiss') {
    setNow(dismissY, start.dismissY + dy)
  } else if (mode === 'pan') {
    setNow(panX, start.panX + dx)
    setNow(panY, start.panY + dy)
  }
  write()
}

let chromeBeforeDrag = true
let lastMid = { x: 0, y: 0 }

function startPinch() {
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = null
  // Fingers rarely land together: the first one may already have started a swipe or a
  // dismiss drag. Undo it, or its offset would stay applied on top of the zoom.
  if (mode === 'swipe' || mode === 'dismiss') {
    trackX.target = 0
    dismissY.target = 0
    chrome.value = chromeBeforeDrag
  }
  const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
  const mid = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2)
  pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: scale.pos, mid, panX: panX.pos, panY: panY.pos }
  lastMid = mid
  setNow(scale, scale.pos)
  setNow(panX, panX.pos)
  setNow(panY, panY.pos)
  mode = 'pinch'
  animate()
}

/** After a pinch: back to 1 if it went below, into range around the fingers if it went past max. */
function settleZoom() {
  if (scale.pos < 1) resetZoom()
  else zoomTo(scale.pos, lastMid.x, lastMid.y)
  animate()
}

function velocity() {
  const a = samples[0]
  const b = samples[samples.length - 1]
  if (!a || !b || b.t - a.t < 1) return { x: 0, y: 0 }
  return { x: ((b.x - a.x) / (b.t - a.t)) * 1000, y: ((b.y - a.y) / (b.t - a.t)) * 1000 }
}

function onPointerUp(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.delete(e.pointerId)
  if (mode === 'pinch') {
    if (pointers.size > 1) return
    settleZoom()
    const rest = [...pointers.values()][0]
    if (!rest) {
      mode = null
      return
    }
    // One finger left: it keeps moving a zoomed image, and does nothing otherwise.
    const t = performance.now()
    start = { x: rest.x, y: rest.y, t, trackX: trackX.pos, dismissY: dismissY.pos, panX: panX.pos, panY: panY.pos }
    samples = [{ t, x: rest.x, y: rest.y }]
    mode = scale.target > 1.01 ? 'pan' : 'ignore'
    return
  }
  if (mode === 'ignore') {
    if (pointers.size === 0) mode = null
    return
  }
  const m = mode
  mode = null
  const v = velocity()
  if (m === 'pending' && e.type === 'pointerup') return onTap(e)
  if (m === 'swipe') {
    const threshold = Math.min(120, (stageW || 480) * 0.25)
    const dx = trackX.pos
    if ((dx <= -threshold || v.x < -500) && nextIndex.value !== null) {
      trackX.vel = v.x
      next()
    } else if ((dx >= threshold || v.x > 500) && prevIndex.value !== null) {
      trackX.vel = v.x
      prev()
    } else {
      trackX.target = 0
      trackX.vel = v.x
      animate()
    }
  } else if (m === 'dismiss') {
    if (Math.abs(dismissY.pos) > 120 || Math.abs(v.y) > 800) {
      dismissY.vel = v.y
      close()
    } else {
      chrome.value = chromeBeforeDrag
      dismissY.target = 0
      dismissY.vel = v.y
      animate()
    }
  } else if (m === 'pan') {
    panX.vel = v.x
    panY.vel = v.y
    panX.target = panX.pos + v.x * 0.2
    panY.target = panY.pos + v.y * 0.2
    clampPanTargets()
    animate()
  }
}

/** A tap toggles the bars (or closes, outside the image); two taps zoom. */
function onTap(e: PointerEvent) {
  const now = performance.now()
  const double = now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30
  lastTap = { t: double ? -Infinity : now, x: e.clientX, y: e.clientY }
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = null
  if (double) {
    toggleZoomAt(e.clientX, e.clientY)
    return
  }
  // By position, not e.target: the stage captures the pointer, so pointerup targets the stage.
  const r = currentImg()?.getBoundingClientRect()
  const onImage = zoomed.value || (!!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
  tapTimer = setTimeout(() => {
    tapTimer = null
    if (onImage) chrome.value = !chrome.value
    else close()
  }, props.zoom ? 260 : 0)
}

// ── Keyboard and focus ────────────────────────────────────────────────────────────────────────

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
  else if (props.zoom && (e.key === '+' || e.key === '=')) zoomTo(scale.target * 1.5, 0, 0)
  else if (props.zoom && e.key === '-') zoomTo(scale.target / 1.5, 0, 0)
  else if (props.zoom && e.key === '0') { resetZoom(); animate() }
  else if (e.key === 'Tab') trapFocus(e)
  else return
  if (e.key !== 'Tab') e.preventDefault()
}

function trapFocus(e: KeyboardEvent) {
  const els = Array.from(rootEl.value?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])') ?? [])
    .filter((el) => !el.closest('[inert]'))
  if (!els.length) return
  const first = els[0]!
  const last = els[els.length - 1]!
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

function onImgLoad(src: string, e: Event) {
  loaded.value = new Set(loaded.value).add(src)
  measureRatio(src, e.target as HTMLImageElement)
}

/**
 * An SVG with a viewBox but no width/height has a ratio but no size: inside a shrink-to-fit box it
 * would collapse to 0×0 (and naturalWidth can't be trusted for it). So every image gets an explicit
 * size from its ratio, read from an off-screen copy laid out at a fixed width.
 */
function measureRatio(src: string, img: HTMLImageElement) {
  if (ratios.value.has(src)) return
  const set = (r: number) => (ratios.value = new Map(ratios.value).set(src, r > 0 && Number.isFinite(r) ? r : 1))
  const natural = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0
  if (natural && !/^data:image\/svg|\.svg(\?|#|$)/i.test(src)) return set(natural)
  const probe = new Image()
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:auto;visibility:hidden;pointer-events:none'
  const done = () => {
    set(probe.offsetHeight ? 1000 / probe.offsetHeight : natural)
    probe.remove()
  }
  probe.onload = done
  probe.onerror = () => {
    set(natural)
    probe.remove()
  }
  probe.src = src
  document.body.appendChild(probe)
  if (probe.complete && probe.naturalWidth) done()
}

/** The image's size: as large as fits in the box, keeping its ratio. */
function sizeFor(src: string) {
  const r = ratios.value.get(src)
  const { w, h } = box.value
  if (!r || !w || !h) return undefined
  const width = Math.min(w, h * r)
  return { width: `${width}px`, height: `${width / r}px` }
}

// ── Auto-scan ─────────────────────────────────────────────────────────────────────────────────
// Pull <img> elements out of whatever is rendered in the default slot (e.g. MMarkdown output, a
// hand-rolled gallery grid) so this works without building an `items` array by hand. Opt an image
// out with `data-lightbox="false"`.
let observer: MutationObserver | null = null
let resizeObserver: ResizeObserver | null = null

function scan() {
  if (props.items || !containerEl.value) return
  const imgs = Array.from(containerEl.value.querySelectorAll('img')).filter((img) => img.dataset.lightbox !== 'false')
  scannedItems.value = imgs.map((img) => ({
    src: img.currentSrc || img.src,
    alt: img.alt || undefined,
    caption: img.dataset.caption || img.title || undefined,
  }))
  scannedEls.length = 0
  imgs.forEach((img, i) => {
    scannedEls.push(img)
    origins.set(i, img)
    img.style.cursor = 'zoom-in'
    img.onclick = (e) => {
      e.preventDefault()
      open(i, img)
    }
  })
}

onMounted(() => {
  if (!props.items && containerEl.value) {
    scan()
    observer = new MutationObserver(scan)
    observer.observe(containerEl.value, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
  }
})

watch(stageEl, (el, old) => {
  if (old) {
    old.removeEventListener('wheel', onWheel)
    resizeObserver?.disconnect()
  }
  if (el) {
    el.addEventListener('wheel', onWheel, { passive: false })
    resizeObserver = new ResizeObserver(() => {
      measure()
      write()
    })
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  resizeObserver?.disconnect()
  stageEl.value?.removeEventListener('wheel', onWheel)
  if (raf) cancelAnimationFrame(raf)
  if (tapTimer) clearTimeout(tapTimer)
  document.removeEventListener('keydown', onKeydown)
  if (rendered.value) document.body.style.overflow = ''
})

defineExpose({ open, close, next, prev })
</script>

<template>
  <div ref="containerEl" v-bind="$attrs" class="contents">
    <slot />
  </div>

  <Teleport to="body">
    <div
      v-if="rendered"
      ref="rootEl"
      class="fixed inset-0 z-[100] overflow-hidden text-white"
      role="dialog"
      aria-modal="true"
      :aria-label="current?.alt || current?.caption || positionLabel"
    >
      <div data-lb-backdrop class="absolute inset-0 bg-black" style="opacity: 0" />

      <!-- Stage: the image track -->
      <div
        ref="stageEl"
        data-lb-stage
        class="absolute inset-0 touch-none select-none"
        :class="zoomed ? 'cursor-grab active:cursor-grabbing' : props.zoom ? 'cursor-zoom-in' : ''"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dragstart.prevent
      >
        <div
          v-for="s in slides"
          :key="s.offset === -1 && s.index === nextIndex ? `prev-${s.index}` : s.index"
          data-lb-slide
          :data-offset="s.offset"
          class="absolute inset-0 flex items-center justify-center p-4 sm:p-12"
          :aria-hidden="s.offset !== 0"
        >
          <!-- No style binding here: transform / opacity / clip-path are written by write() -->
          <div data-lb-zoom class="flex max-h-full max-w-full items-center justify-center">
            <img
              :src="galleryItems[s.index]!.src"
              :alt="galleryItems[s.index]!.alt ?? ''"
              class="block select-none object-contain"
              :class="[rounded ? 'rounded-2xl' : '', sizeFor(galleryItems[s.index]!.src) ? '' : 'max-h-[calc(100dvh-2rem)] max-w-full sm:max-h-[calc(100dvh-6rem)]']"
              :style="sizeFor(galleryItems[s.index]!.src)"
              draggable="false"
              @load="onImgLoad(galleryItems[s.index]!.src, $event)"
            />
          </div>
          <MSpinner
            v-if="s.offset === 0 && !loaded.has(galleryItems[s.index]!.src)"
            :size="40"
            class="pointer-events-none absolute text-white/80"
          />
        </div>
      </div>

      <!-- Top bar -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-1 bg-gradient-to-b from-black/60 to-transparent px-2 pt-2 pb-8 transition-opacity duration-200 sm:px-4"
        :class="chrome ? 'opacity-100' : 'opacity-0'"
        :inert="!chrome"
      >
        <!-- The bars let touches through (a pinch can start anywhere); only their controls take them -->
        <MIconButton data-lb-close icon="close" :label="closeLabel ?? locale.close" class="pointer-events-auto" style="color: #fff" @click="close" />
        <span v-if="hasMultiple" class="flex-1 px-2 text-title-medium" aria-hidden="true">{{ currentIndex + 1 }} / {{ count }}</span>
        <span v-else class="flex-1" />
        <div v-if="current && $slots.actions" class="pointer-events-auto flex items-center gap-1">
          <slot name="actions" :item="current" :index="currentIndex" />
        </div>
      </div>

      <!-- Previous / next, for mouse users -->
      <template v-if="hasMultiple">
        <div
          class="absolute top-1/2 left-2 z-10 -translate-y-1/2 transition-opacity duration-200 sm:left-4 [@media(pointer:coarse)]:hidden"
          :class="chrome && prevIndex !== null ? 'opacity-100' : 'pointer-events-none opacity-0'"
        >
          <MIconButton icon="chevron_left" :label="locale.previous" variant="tonal" @click="prev" />
        </div>
        <div
          class="absolute top-1/2 right-2 z-10 -translate-y-1/2 transition-opacity duration-200 sm:right-4 [@media(pointer:coarse)]:hidden"
          :class="chrome && nextIndex !== null ? 'opacity-100' : 'pointer-events-none opacity-0'"
        >
          <MIconButton icon="chevron_right" :label="locale.next" variant="tonal" @click="next" />
        </div>
      </template>

      <!-- Caption and thumbnails -->
      <div
        v-if="current?.caption || (showThumbnails && hasMultiple)"
        class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-4 transition-opacity duration-200"
        :class="chrome ? 'opacity-100' : 'opacity-0'"
        :inert="!chrome"
      >
        <p v-if="current?.caption" class="mx-auto max-w-3xl text-center text-body-large">{{ current.caption }}</p>
        <div v-if="showThumbnails && hasMultiple" ref="thumbsEl" class="pointer-events-auto flex gap-2 overflow-x-auto px-1 py-1 sm:justify-center" style="scrollbar-width: none">
          <button
            v-for="(item, i) in galleryItems"
            :key="i"
            type="button"
            data-lb-thumb
            class="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md ring-2 transition-opacity"
            :class="i === currentIndex ? 'opacity-100 ring-white' : 'opacity-50 ring-transparent hover:opacity-80'"
            :aria-label="item.alt || locale.carouselItem.replace('{index}', String(i + 1)).replace('{count}', String(count))"
            :aria-current="i === currentIndex ? 'true' : undefined"
            @click="go(i)"
          >
            <img :src="item.src" :alt="''" class="h-full w-full object-cover" draggable="false" />
          </button>
        </div>
      </div>

      <span class="sr-only" aria-live="polite">{{ positionLabel }}</span>
    </div>
  </Teleport>
</template>
