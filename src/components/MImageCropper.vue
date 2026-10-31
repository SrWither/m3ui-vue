<script setup lang="ts">
/**
 * An image cropper: the picture fitted in its box with a crop frame you drag and resize by its corners and edges
 * (a rule-of-thirds grid while you do), locked to an `aspect` or free, square or round (`shape="circle"` for
 * avatars). Rotate a quarter turn at a time and flip; the frame follows. Not an M3 spec component: M3 parts after
 * Google Photos' crop tool.
 *
 * `v-model:crop` is the frame in the rotated picture's own pixels (`{ x, y, width, height }`), `v-model:rotation`
 * (0, 90, 180, 270, applied after the mirror) and `v-model:flipped` (the picture mirrored left to right before it turns). The template ref's `toCanvas()` / `toBlob()` draw the result, at the
 * crop's size or one you give (`width`, `height`, `maxSize`), round with a transparent outside for `circle`.
 * `src` takes a URL, a `File` or a `Blob` (e.g. from MFileUpload); a picture from another origin must allow it
 * (CORS) to be exported, and gets `crossorigin="anonymous"`.
 *
 * Keyboard (on the frame): arrows move it, Shift + arrows resize it (10 px steps with Alt).
 *
 * @slot controls Instead of the toolbar under the picture. Props: `{ rotate, flip, reset, aspect, setAspect }`
 * @event load The picture loaded: `{ width, height }` (its natural size)
 * @event error The picture didn't load
 * @event change A drag or a key changed the crop (after `update:crop`): the crop
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLocale } from '../composables/useLocale'
import { prefersReducedMotion } from '../composables/_springAnimation'
import MIconButton from './MIconButton.vue'
import MChip from './MChip.vue'

export interface CropRect { x: number; y: number; width: number; height: number }
export interface CropAspect { label: string; value: number | null }
export interface CropOutputOptions {
  /** The result's size in px; one alone keeps the crop's proportions (default the crop's own size) */
  width?: number
  height?: number
  /** The longest side at most, px */
  maxSize?: number
  /** Round, transparent outside (default true for `shape="circle"`) */
  circle?: boolean
}

const props = withDefaults(defineProps<{
  /** The picture: a URL, a File or a Blob */
  src?: string | Blob | null
  /** The frame, in the rotated picture's pixels (`v-model:crop`) */
  crop?: CropRect | null
  /** Width over height (1 square, 16 / 9…); null is free */
  aspect?: number | null
  /** Aspects offered in the toolbar as chips (`v-model:aspect` follows them) */
  aspects?: CropAspect[]
  /** Quarter turns clockwise in degrees (`v-model:rotation`) */
  rotation?: 0 | 90 | 180 | 270
  /** Mirrored left to right (`v-model:flipped`) */
  flipped?: boolean
  shape?: 'rect' | 'circle'
  /** The frame's smallest side, in the picture's px */
  minSize?: number
  /** The rule-of-thirds grid: while dragging (default), always or never */
  guides?: 'drag' | 'always' | 'never'
  /** The toolbar under the picture */
  controls?: boolean
  /** Accessible name of the picture */
  alt?: string
}>(), {
  src: null,
  crop: null,
  aspect: null,
  rotation: 0,
  flipped: false,
  shape: 'rect',
  minSize: 24,
  guides: 'drag',
  controls: true,
  alt: '',
})

const emit = defineEmits<{
  'update:crop': [CropRect]
  'update:aspect': [number | null]
  'update:rotation': [0 | 90 | 180 | 270]
  'update:flipped': [boolean]
  load: [{ width: number; height: number }]
  error: [Event]
  change: [CropRect]
}>()

const locale = useLocale()

// ── The picture ───────────────────────────────────────────────────────────────────────────────────────────
const url = ref<string | null>(null)
const natural = ref<{ w: number; h: number } | null>(null)
let objectUrl: string | null = null
watch(() => props.src, (src) => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = null
  natural.value = null
  if (src && typeof src !== 'string') url.value = objectUrl = URL.createObjectURL(src)
  else url.value = src || null
}, { immediate: true })
const img = ref<HTMLImageElement>()
const crossOrigin = computed(() => (typeof url.value === 'string' && /^https?:/.test(url.value) && !url.value.startsWith(location.origin) ? 'anonymous' : undefined))

const rot = ref(props.rotation)
watch(() => props.rotation, (r) => { if (r !== rot.value) applyRotation(r) })
const flip = ref(props.flipped)
watch(() => props.flipped, (f) => { if (f !== flip.value) flipX() })
const ratio = ref<number | null>(props.aspect)
watch(() => props.aspect, (a) => { if (a !== ratio.value) setAspect(a) })

// The rotated picture's size: what the crop is measured in
const size = computed(() => {
  const n = natural.value
  if (!n) return null
  return rot.value % 180 ? { w: n.h, h: n.w } : { w: n.w, h: n.h }
})

// ── Layout ────────────────────────────────────────────────────────────────────────────────────────────────
const stage = ref<HTMLElement>()
const box = ref({ w: 0, h: 0 })
const PAD = 24
const fit = computed(() => {
  const s = size.value
  if (!s || !box.value.w) return null
  const scale = Math.min((box.value.w - PAD * 2) / s.w, (box.value.h - PAD * 2) / s.h)
  return { scale, x: (box.value.w - s.w * scale) / 2, y: (box.value.h - s.h * scale) / 2 }
})

// ── The frame ─────────────────────────────────────────────────────────────────────────────────────────────
const rect = ref<CropRect>({ x: 0, y: 0, width: 0, height: 0 })
// What's drawn: springs to `rect` when it changes by a button, follows it as is while dragging
const shown = ref<CropRect>({ x: 0, y: 0, width: 0, height: 0 })
watch(() => props.crop, (c) => {
  if (!c || !size.value || sameRect(c, rect.value)) return
  rect.value = clampRect({ ...c })
  animateTo(rect.value, false)
})
const sameRect = (a: CropRect, b: CropRect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
const round = (r: CropRect): CropRect => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) })

// The largest frame of the aspect, centered (or the whole picture when free)
function fullRect(a = ratio.value): CropRect {
  const s = size.value!
  if (!a) return { x: 0, y: 0, width: s.w, height: s.h }
  let w = s.w
  let h = w / a
  if (h > s.h) { h = s.h; w = h * a }
  return { x: (s.w - w) / 2, y: (s.h - h) / 2, width: w, height: h }
}
function clampRect(r: CropRect): CropRect {
  const s = size.value!
  const min = Math.min(props.minSize, s.w, s.h)
  let { x, y, width, height } = r
  width = Math.min(Math.max(width, min), s.w)
  height = Math.min(Math.max(height, min), s.h)
  if (ratio.value) {
    // Shrink to fit the aspect inside the picture
    if (width / height > ratio.value) width = height * ratio.value
    else height = width / ratio.value
  }
  x = Math.min(Math.max(x, 0), s.w - width)
  y = Math.min(Math.max(y, 0), s.h - height)
  return { x, y, width, height }
}
function commit(r: CropRect, animate: boolean, done = false) {
  rect.value = r
  const out = round(r)
  emit('update:crop', out)
  if (done) emit('change', out)
  animateTo(r, animate)
}

// Standard DefaultSpatial, on the four values together
let raf = 0
let vel = [0, 0, 0, 0]
function animateTo(target: CropRect, animate: boolean) {
  if (!animate || prefersReducedMotion()) {
    cancelAnimationFrame(raf)
    raf = 0
    vel = [0, 0, 0, 0]
    shown.value = { ...target }
    return
  }
  if (raf) return
  let last = performance.now()
  const step = (now: number) => {
    let dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const cur = [shown.value.x, shown.value.y, shown.value.width, shown.value.height]
    const to = [rect.value.x, rect.value.y, rect.value.width, rect.value.height]
    while (dt > 0) {
      const h = Math.min(dt, 0.004)
      for (let i = 0; i < 4; i++) {
        vel[i]! += (-700 * (cur[i]! - to[i]!) - 2 * 0.9 * Math.sqrt(700) * vel[i]!) * h
        cur[i]! += vel[i]! * h
      }
      dt -= h
    }
    const done = cur.every((v, i) => Math.abs(v - to[i]!) < 0.5) && vel.every((v) => Math.abs(v) < 5)
    shown.value = done ? { ...rect.value } : { x: cur[0]!, y: cur[1]!, width: cur[2]!, height: cur[3]! }
    if (done) { raf = 0; vel = [0, 0, 0, 0]; return }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function onLoad() {
  const el = img.value!
  natural.value = { w: el.naturalWidth, h: el.naturalHeight }
  emit('load', { width: el.naturalWidth, height: el.naturalHeight })
  const r = props.crop ? clampRect({ ...props.crop }) : fullRect()
  commit(r, false)
}

// ── Rotate, flip, aspect, reset ───────────────────────────────────────────────────────────────────────────
function applyRotation(to: number) {
  const steps = ((to - rot.value) / 90 + 4) % 4
  for (let i = 0; i < steps; i++) turn(1)
}
// A quarter turn: the frame turns with the picture
function turn(dir: 1 | -1) {
  if (!size.value) {
    rot.value = ((rot.value + dir * 90 + 360) % 360) as 0 | 90 | 180 | 270
    return
  }
  const { w: W, h: H } = size.value
  const r = rect.value
  const next = dir === 1
    ? { x: H - (r.y + r.height), y: r.x, width: r.height, height: r.width }
    : { x: r.y, y: W - (r.x + r.width), width: r.height, height: r.width }
  rot.value = ((rot.value + dir * 90 + 360) % 360) as 0 | 90 | 180 | 270
  emit('update:rotation', rot.value)
  // A locked aspect stays the frame's shape: refit what turned
  commit(ratio.value && ratio.value !== 1 ? clampRect({ ...next, ...fitAspect(next) }) : clampRect(next), false)
}
function fitAspect(r: CropRect): CropRect {
  const a = ratio.value!
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  let w = r.width
  let h = w / a
  if (h > r.height) { h = r.height; w = h * a }
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h }
}
// Mirrored left to right as seen. The mirror is kept in the picture's own frame (drawn as rotate · mirror), so a
// turn after it still turns the whole picture: mirroring as seen is the opposite turn with the mirror toggled
function flipX() {
  flip.value = !flip.value
  emit('update:flipped', flip.value)
  if (rot.value % 180) {
    rot.value = (360 - rot.value) as 90 | 270
    emit('update:rotation', rot.value)
  }
  if (!size.value) return
  const r = rect.value
  commit({ ...r, x: size.value.w - (r.x + r.width) }, false)
}
function setAspect(a: number | null) {
  ratio.value = a
  emit('update:aspect', a)
  if (!size.value) return
  // The largest frame of the new shape around the current one's center
  if (!a) return
  const r = rect.value
  const s = size.value
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  let w = Math.min(s.w, Math.max(r.width, r.height * a))
  let h = w / a
  if (h > s.h) { h = s.h; w = h * a }
  commit(clampRect({ x: cx - w / 2, y: cy - h / 2, width: w, height: h }), true, true)
}
function reset() {
  if (rot.value || flip.value) {
    rot.value = 0
    flip.value = false
    emit('update:rotation', 0)
    emit('update:flipped', false)
  }
  if (size.value) commit(fullRect(), true, true)
}

// ── Dragging ──────────────────────────────────────────────────────────────────────────────────────────────
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Exclude<Handle, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
let drag: { id: number; handle: Handle; sx: number; sy: number; start: CropRect } | null = null
const dragging = ref(false)

function onDown(e: PointerEvent, handle: Handle) {
  if (e.button !== 0 || !fit.value) return
  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  drag = { id: e.pointerId, handle, sx: e.clientX, sy: e.clientY, start: { ...rect.value } }
  dragging.value = true
}
function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id || !fit.value) return
  const dx = (e.clientX - drag.sx) / fit.value.scale
  const dy = (e.clientY - drag.sy) / fit.value.scale
  commit(dragRect(drag.start, drag.handle, dx, dy), false)
}
function onUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  drag = null
  dragging.value = false
  emit('change', round(rect.value))
}

// The frame after pulling `handle` by dx, dy (picture px), kept inside the picture and to its aspect
function dragRect(r: CropRect, handle: Handle, dx: number, dy: number): CropRect {
  const s = size.value!
  if (handle === 'move') return clampRect({ ...r, x: r.x + dx, y: r.y + dy })
  const min = Math.min(props.minSize, s.w, s.h)
  let left = r.x
  let top = r.y
  let right = r.x + r.width
  let bottom = r.y + r.height
  if (handle.includes('w')) left = Math.min(Math.max(0, r.x + dx), right - min)
  if (handle.includes('e')) right = Math.max(Math.min(s.w, right + dx), left + min)
  if (handle.includes('n')) top = Math.min(Math.max(0, r.y + dy), bottom - min)
  if (handle.includes('s')) bottom = Math.max(Math.min(s.h, bottom + dy), top + min)
  const a = ratio.value
  if (!a) return { x: left, y: top, width: right - left, height: bottom - top }
  // Locked: the opposite corner (or edge's middle) stays put, and the frame stays inside
  const corner = handle.length === 2
  const ax = handle.includes('w') ? r.x + r.width : handle.includes('e') ? r.x : r.x + r.width / 2
  const ay = handle.includes('n') ? r.y + r.height : handle.includes('s') ? r.y : r.y + r.height / 2
  let w = right - left
  let h = bottom - top
  if (corner) {
    // The bigger pull decides (heights counted in widths, through the aspect)
    if (Math.abs(w - r.width) >= Math.abs(h - r.height) * a) h = w / a
    else w = h * a
  } else if (handle === 'n' || handle === 's') w = h * a
  else h = w / a
  const maxW = handle.includes('w') ? ax : handle.includes('e') ? s.w - ax : 2 * Math.min(ax, s.w - ax)
  const maxH = handle.includes('n') ? ay : handle.includes('s') ? s.h - ay : 2 * Math.min(ay, s.h - ay)
  w = Math.max(Math.min(w, maxW, maxH * a), min)
  h = w / a
  const x = handle.includes('w') ? ax - w : handle.includes('e') ? ax : ax - w / 2
  const y = handle.includes('n') ? ay - h : handle.includes('s') ? ay : ay - h / 2
  return clampRect({ x, y, width: w, height: h })
}

function onKey(e: KeyboardEvent) {
  const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const k = keys[e.key]
  if (!k || !size.value) return
  e.preventDefault()
  const step = (e.altKey ? 10 : 1) / (fit.value?.scale ?? 1)
  const r = e.shiftKey ? dragRect(rect.value, k[0] ? 'e' : 's', k[0] * step, k[1] * step) : dragRect(rect.value, 'move', k[0] * step, k[1] * step)
  commit(r, false, true)
}

// ── Output ────────────────────────────────────────────────────────────────────────────────────────────────
function toCanvas(options: CropOutputOptions = {}): HTMLCanvasElement | null {
  const el = img.value
  const n = natural.value
  const s = size.value
  if (!el || !n || !s) return null
  const r = round(rect.value)
  let w = options.width ?? (options.height ? (options.height * r.width) / r.height : r.width)
  let h = options.height ?? (options.width ? (options.width * r.height) / r.width : r.height)
  if (options.maxSize && Math.max(w, h) > options.maxSize) {
    const k = options.maxSize / Math.max(w, h)
    w *= k
    h *= k
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  if (options.circle ?? props.shape === 'circle') {
    ctx.beginPath()
    ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2, 0, 0, Math.PI * 2)
    ctx.clip()
  }
  // Crop space → the rotated, flipped picture → its natural pixels
  ctx.scale(canvas.width / r.width, canvas.height / r.height)
  ctx.translate(-r.x, -r.y)
  ctx.translate(s.w / 2, s.h / 2)
  ctx.rotate((rot.value * Math.PI) / 180)
  if (flip.value) ctx.scale(-1, 1)
  ctx.drawImage(el, -n.w / 2, -n.h / 2)
  return canvas
}
function toBlob(options: CropOutputOptions & { type?: string; quality?: number } = {}): Promise<Blob | null> {
  const canvas = toCanvas(options)
  if (!canvas) return Promise.resolve(null)
  const type = options.type ?? ((options.circle ?? props.shape === 'circle') ? 'image/png' : 'image/jpeg')
  return new Promise((resolve) => canvas.toBlob(resolve, type, options.quality ?? 0.92))
}

let ro: ResizeObserver | undefined
onMounted(() => {
  const el = stage.value!
  const measure = () => { box.value = { w: el.clientWidth, h: el.clientHeight } }
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(el)
  // Already loaded from the cache before the listener
  nextTick(() => { if (img.value?.complete && img.value.naturalWidth && !natural.value) onLoad() })
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})

// ── Drawing ───────────────────────────────────────────────────────────────────────────────────────────────
const imgStyle = computed(() => {
  const f = fit.value
  const n = natural.value
  if (!f || !n) return { visibility: 'hidden' as const }
  const w = n.w * f.scale
  const h = n.h * f.scale
  const mirror = flip.value ? 'scaleX(-1)' : ''
  return {
    width: `${w}px`,
    height: `${h}px`,
    left: `${box.value.w / 2 - w / 2}px`,
    top: `${box.value.h / 2 - h / 2}px`,
    transform: `rotate(${rot.value}deg) ${mirror}`,
  }
})
const frame = computed(() => {
  const f = fit.value
  if (!f) return null
  const r = shown.value
  return { left: f.x + r.x * f.scale, top: f.y + r.y * f.scale, width: r.width * f.scale, height: r.height * f.scale }
})
const HANDLE_POS: Record<Exclude<Handle, 'move'>, string> = {
  nw: 'top-0 left-0 cursor-nwse-resize', n: 'top-0 left-1/2 cursor-ns-resize', ne: 'top-0 left-full cursor-nesw-resize', e: 'top-1/2 left-full cursor-ew-resize',
  se: 'top-full left-full cursor-nwse-resize', s: 'top-full left-1/2 cursor-ns-resize', sw: 'top-full left-0 cursor-nesw-resize', w: 'top-1/2 left-0 cursor-ew-resize',
}
const showGuides = computed(() => props.guides === 'always' || (props.guides === 'drag' && dragging.value))

defineExpose({ toCanvas, toBlob, rotate: turn, flip: flipX, reset, setAspect })
</script>

<template>
  <div class="m3-image-cropper flex flex-col gap-3">
    <div ref="stage" class="relative min-h-0 flex-1 touch-none overflow-hidden rounded-md bg-surface-container-highest select-none">
      <img
        v-if="url"
        ref="img"
        :src="url"
        :alt="alt"
        :crossorigin="crossOrigin"
        draggable="false"
        class="pointer-events-none absolute max-w-none"
        :style="imgStyle"
        @load="onLoad"
        @error="emit('error', $event)"
      >
      <div
        v-if="frame && natural"
        role="slider"
        tabindex="0"
        :aria-label="locale.cropArea"
        :aria-valuetext="`${Math.round(rect.width)} × ${Math.round(rect.height)}`"
        class="absolute cursor-move outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        :class="shape === 'circle' ? 'rounded-full' : ''"
        :style="{ left: `${frame.left}px`, top: `${frame.top}px`, width: `${frame.width}px`, height: `${frame.height}px`, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }"
        @pointerdown="onDown($event, 'move')"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @keydown="onKey"
      >
        <!-- The frame's line, and the rule of thirds while dragging -->
        <div class="pointer-events-none absolute inset-0 border-2 border-white/90" :class="shape === 'circle' ? 'rounded-full' : ''" />
        <div class="pointer-events-none absolute inset-0 transition-opacity duration-200" :class="showGuides ? 'opacity-100' : 'opacity-0'">
          <div class="absolute inset-y-0 left-1/3 w-px bg-white/60" />
          <div class="absolute inset-y-0 left-2/3 w-px bg-white/60" />
          <div class="absolute inset-x-0 top-1/3 h-px bg-white/60" />
          <div class="absolute inset-x-0 top-2/3 h-px bg-white/60" />
        </div>
        <div
          v-for="h in HANDLES"
          :key="h"
          class="absolute flex size-11 -translate-1/2 items-center justify-center"
          :class="HANDLE_POS[h]"
          @pointerdown="onDown($event, h)"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <span class="block bg-white shadow-elevation-1" :class="h.length === 2 ? 'size-4 rounded-full' : h === 'n' || h === 's' ? 'h-1.5 w-6 rounded-full' : 'h-6 w-1.5 rounded-full'" />
        </div>
      </div>
    </div>

    <slot v-if="controls" name="controls" :rotate="turn" :flip="flipX" :reset="reset" :aspect="ratio" :set-aspect="setAspect">
      <div class="flex flex-wrap items-center gap-1">
        <MIconButton icon="rotate_left" :label="locale.cropRotateLeft" @click="turn(-1)" />
        <MIconButton icon="rotate_right" :label="locale.cropRotateRight" @click="turn(1)" />
        <MIconButton icon="flip" :label="locale.cropFlip" :checked="flip" @click="flipX" />
        <MIconButton icon="restart_alt" :label="locale.cropReset" @click="reset" />
        <div v-if="aspects?.length" class="ml-2 flex flex-wrap gap-2">
          <MChip v-for="a in aspects" :key="a.label" type="filter" :selected="ratio === a.value" @click="setAspect(a.value)">
            {{ a.label === '' ? locale.cropFree : a.label }}
          </MChip>
        </div>
      </div>
    </slot>
  </div>
</template>
