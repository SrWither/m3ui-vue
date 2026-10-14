<script lang="ts">
// Module-scoped so it's actually shared across every MWindow instance.
// Kept below the app-level overlay scale (dialogs/spotlight/command palette use z-50)
// so windows never render on top of a real modal.
import { ref as moduleRef } from 'vue'

let sharedZIndex = 10
let nextId = 0
/** The window brought to front last: it alone gets the focused look. */
const activeWindowId = moduleRef<number | null>(null)
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()
const id = ++nextId

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    icon?: string
    width?: string
    height?: string
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    resizable?: boolean
    draggable?: boolean
    closable?: boolean
    minimizable?: boolean
    /** Maximize button, and double-click on the title bar, to fill the parent and back. */
    maximizable?: boolean
    /**
     * Edge snapping while dragging, like GNOME: hold the pointer at the parent's top edge to
     * maximize, or at its left/right edge to fill that half. A preview shows where it will land.
     */
    snap?: boolean
    /**
     * Lets the window be dragged partly out of its container, like a desktop: up to 3/4 of its
     * width past either side, and down until only the title bar shows; never above the top.
     * The container should clip it (`overflow: hidden`).
     */
    offscreen?: boolean
    x?: number
    y?: number
    resetPosition?: boolean
  }>(),
  {
    width: '400px',
    height: '300px',
    minWidth: 200,
    minHeight: 150,
    resizable: true,
    draggable: true,
    closable: true,
    minimizable: true,
    maximizable: true,
    snap: false,
    offscreen: false,
    x: 50,
    y: 50,
    resetPosition: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  minimize: []
  maximize: [maximized: boolean]
  /** The window came to the front (clicked, dragged, opened, or `focus()`). */
  focus: []
}>()

// ---- State ----
const posX = ref(props.x)
const posY = ref(props.y)
const winWidth = ref(parseInt(props.width) || 400)
const winHeight = ref(parseInt(props.height) || 300)
const minimized = ref(false)
const maximized = ref(false)
const zIndex = ref(sharedZIndex)
/** The front window looks focused; the others step back (lower bar contrast and elevation). */
const active = computed(() => activeWindowId.value === id)
const dragging = ref(false)
// Maximize/restore animates the geometry; dragging and resizing must not.
const animatingGeometry = ref(false)
let geometryTimer: ReturnType<typeof setTimeout> | undefined
let restoreBox = { x: 0, y: 0, w: 0, h: 0 }
/** Filling the left or right half after a snap (maximized is its own state). */
const tiled = ref<'left' | 'right' | null>(null)
const snapped = computed(() => maximized.value || tiled.value !== null)
/** Where a release would snap to while dragging with `snap`; drives the preview. */
const snapTarget = ref<'top' | 'left' | 'right' | null>(null)
const parentEl = ref<HTMLElement | null>(null)
/** Title bar height: a minimized window is exactly this tall. */
const BAR = 40
/** How close (px) the pointer must get to the parent's edge to offer a snap. */
const SNAP_EDGE = 12

/** Allowed left for a window this wide: inside the parent, or with `offscreen`, 1/4 kept visible. */
function clampLeft(x: number, w: number) {
  const pw = windowRef.value?.parentElement?.clientWidth ?? Infinity
  if (!props.offscreen) return Math.max(0, Math.min(pw - w, x))
  const keep = Math.min(w, Math.max(48, w / 4))
  return Math.max(keep - w, Math.min(pw - keep, x))
}
/** Allowed top: never above the parent; with `offscreen`, down until only the title bar shows. */
function clampTop(y: number, h: number) {
  const ph = windowRef.value?.parentElement?.clientHeight ?? Infinity
  return Math.max(0, Math.min(ph - (props.offscreen ? BAR : h), y))
}

const windowRef = ref<HTMLElement | null>(null)

// ---- Drag state ----
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartPosX = 0
let dragStartPosY = 0

// ---- Resize state ----
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
let isResizing = false
let resizeDir: ResizeDirection = 'se'
let resizeStartX = 0
let resizeStartY = 0
let resizeStartW = 0
let resizeStartH = 0
let resizeStartPosX = 0
let resizeStartPosY = 0

// ---- Computed ----
const windowStyle = computed(() => ({
  left: `${posX.value}px`,
  top: `${posY.value}px`,
  width: `${winWidth.value}px`,
  height: minimized.value ? `${BAR}px` : `${winHeight.value}px`,
  zIndex: zIndex.value,
}))

// ---- Bring to front ----
function bringToFront() {
  if (activeWindowId.value !== id) emit('focus')
  activeWindowId.value = id
  sharedZIndex++
  zIndex.value = sharedZIndex
}

// ---- Pointer listeners (Pointer Events: mouse, touch and pen alike) ----
function addListeners() {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}
function removeListeners() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

// ---- Drag ----
// A drag that starts on a maximized or snapped window first restores it, but only once the
// pointer has travelled DETACH_DISTANCE (desktops make you pull it away deliberately, so a
// click, double-click or small slip doesn't). The size then eases back to the restored one
// while the window stays anchored to the pointer at the same proportional grab point.
const DETACH_DISTANCE = 40
const RESTORE_MS = 250
let restoreOnMove = false
/** Set after a detach: the window is positioned from the pointer instead of from deltas. */
let anchor: { ratio: number; grabY: number } | null = null
let pointerLocal = { x: 0, y: 0 }
let sizeAnim: { fromW: number; fromH: number; toW: number; toH: number; start: number } | null = null
let sizeRaf = 0
let parentLeft = 0
let parentTop = 0
/** Geometry to restore after a snap: the window as it was before this drag. */
let preDragBox = { x: 0, y: 0, w: 0, h: 0 }

function onTitleBarStart(e: PointerEvent) {
  bringToFront()
  if (!props.draggable || e.button !== 0) return
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  isDragging = true
  dragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartPosX = posX.value
  dragStartPosY = posY.value
  const rect = windowRef.value?.parentElement?.getBoundingClientRect()
  parentLeft = rect?.left ?? 0
  parentTop = rect?.top ?? 0
  restoreOnMove = snapped.value
  preDragBox = snapped.value ? { ...restoreBox } : { x: posX.value, y: posY.value, w: winWidth.value, h: winHeight.value }
  addListeners()
}

function restoreUnderPointer() {
  anchor = {
    ratio: winWidth.value ? (dragStartX - parentLeft - posX.value) / winWidth.value : 0.5,
    grabY: dragStartY - parentTop - posY.value,
  }
  const wasMaximized = maximized.value
  maximized.value = false
  tiled.value = null
  restoreOnMove = false
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    winWidth.value = restoreBox.w
    winHeight.value = restoreBox.h
    positionFromAnchor()
  } else {
    sizeAnim = { fromW: winWidth.value, fromH: winHeight.value, toW: restoreBox.w, toH: restoreBox.h, start: performance.now() }
    cancelAnimationFrame(sizeRaf)
    sizeRaf = requestAnimationFrame(stepRestore)
  }
  if (wasMaximized) emit('maximize', false)
}

function stepRestore(now: number) {
  if (!sizeAnim) return
  const t = Math.min(1, (now - sizeAnim.start) / RESTORE_MS)
  const eased = 1 - (1 - t) ** 3
  winWidth.value = sizeAnim.fromW + (sizeAnim.toW - sizeAnim.fromW) * eased
  winHeight.value = sizeAnim.fromH + (sizeAnim.toH - sizeAnim.fromH) * eased
  positionFromAnchor()
  if (t < 1) {
    sizeRaf = requestAnimationFrame(stepRestore)
    return
  }
  winWidth.value = sizeAnim.toW
  winHeight.value = sizeAnim.toH
  positionFromAnchor()
  sizeAnim = null
  sizeRaf = 0
  if (!isDragging) anchor = null
}

/** Keeps the grab point under the pointer while the size changes under it. */
function positionFromAnchor() {
  if (!anchor) return
  posX.value = clampLeft(pointerLocal.x - anchor.ratio * winWidth.value, winWidth.value)
  posY.value = clampTop(pointerLocal.y - anchor.grabY, winHeight.value)
}

function snapAt(e: PointerEvent): 'top' | 'left' | 'right' | null {
  const parent = windowRef.value?.parentElement
  if (!props.snap || !parent) return null
  const localX = e.clientX - parentLeft
  const localY = e.clientY - parentTop
  // Sides first: pushed into a top corner means "that half", not "maximize".
  if (localX <= SNAP_EDGE) return 'left'
  if (localX >= parent.clientWidth - SNAP_EDGE) return 'right'
  if (localY <= SNAP_EDGE && props.maximizable) return 'top'
  return null
}

// ---- Resize ----
function onResizeStart(e: PointerEvent, direction: ResizeDirection) {
  if (!props.resizable || e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  isResizing = true
  resizeDir = direction
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  resizeStartW = winWidth.value
  resizeStartH = winHeight.value
  resizeStartPosX = posX.value
  resizeStartPosY = posY.value
  bringToFront()
  addListeners()
}

function onPointerMove(e: PointerEvent) {
  const x = e.clientX
  const y = e.clientY

  if (isDragging) {
    pointerLocal = { x: x - parentLeft, y: y - parentTop }
    if (restoreOnMove) {
      if (Math.hypot(x - dragStartX, y - dragStartY) < DETACH_DISTANCE) return
      restoreUnderPointer()
    }
    snapTarget.value = snapAt(e)
    if (anchor) return positionFromAnchor()
    posX.value = clampLeft(dragStartPosX + x - dragStartX, winWidth.value)
    posY.value = clampTop(dragStartPosY + y - dragStartY, minimized.value ? BAR : winHeight.value)
  }

  if (isResizing) {
    const dx = x - resizeStartX
    const dy = y - resizeStartY
    const dir = resizeDir
    const parent = windowRef.value?.parentElement
    // With `offscreen` the right/bottom/left edges may grow past the parent too.
    const parentW = parent && !props.offscreen ? parent.clientWidth : Infinity
    const parentH = parent && !props.offscreen ? parent.clientHeight : Infinity

    const clampW = (w: number) => Math.min(props.maxWidth ?? Infinity, Math.max(props.minWidth, w))
    const clampH = (h: number) => Math.min(props.maxHeight ?? Infinity, Math.max(props.minHeight, h))

    if (dir.includes('e')) {
      winWidth.value = Math.min(parentW - resizeStartPosX, clampW(resizeStartW + dx))
    }
    if (dir.includes('w')) {
      const newW = props.offscreen
        ? clampW(resizeStartW - dx)
        : Math.min(resizeStartPosX + resizeStartW, clampW(resizeStartW - dx))
      posX.value = props.offscreen ? resizeStartPosX + (resizeStartW - newW) : Math.max(0, resizeStartPosX + (resizeStartW - newW))
      winWidth.value = newW
    }
    if (dir.includes('s')) {
      winHeight.value = Math.min(parentH - resizeStartPosY, clampH(resizeStartH + dy))
    }
    if (dir.includes('n')) {
      // The bottom edge stays put: grow upward, never past the parent's top.
      const newH = Math.min(resizeStartPosY + resizeStartH, clampH(resizeStartH - dy))
      posY.value = Math.max(0, resizeStartPosY + (resizeStartH - newH))
      winHeight.value = newH
    }
  }
}

function onPointerUp() {
  const target = isDragging ? snapTarget.value : null
  isDragging = false
  isResizing = false
  dragging.value = false
  restoreOnMove = false
  snapTarget.value = null
  // A restore still easing keeps its anchor until it ends (stepRestore clears it).
  if (!sizeAnim) anchor = null
  removeListeners()
  if (target) snapTo(target)
}

function snapTo(target: 'top' | 'left' | 'right') {
  cancelAnimationFrame(sizeRaf)
  sizeAnim = null
  anchor = null
  restoreBox = { ...preDragBox }
  animateGeometry()
  minimized.value = false
  if (target === 'top') {
    tiled.value = null
    maximized.value = true
    fillParent()
    emit('maximize', true)
  } else {
    maximized.value = false
    tiled.value = target
    fillHalf()
  }
}

function fillHalf() {
  const parent = windowRef.value?.parentElement
  if (!parent) return
  winWidth.value = Math.floor(parent.clientWidth / 2)
  winHeight.value = parent.clientHeight
  posX.value = tiled.value === 'right' ? parent.clientWidth - winWidth.value : 0
  posY.value = 0
}

/** The snap preview, in the parent's coordinates, inset like GNOME's. */
const snapRect = computed(() => {
  const parent = parentEl.value
  if (!parent || !snapTarget.value) return undefined
  const w = parent.clientWidth
  const h = parent.clientHeight
  const gap = 8
  const half = (w - gap * 3) / 2
  const left = snapTarget.value === 'right' ? gap * 2 + half : gap
  const width = snapTarget.value === 'top' ? w - gap * 2 : half
  return { left: `${left}px`, top: `${gap}px`, width: `${width}px`, height: `${h - gap * 2}px`, zIndex: zIndex.value - 1 }
})

// ---- Actions ----
function close() {
  emit('update:modelValue', false)
  emit('close')
  if (props.resetPosition) {
    posX.value = props.x
    posY.value = props.y
    winWidth.value = parseInt(props.width) || 400
    winHeight.value = parseInt(props.height) || 300
    minimized.value = false
    maximized.value = false
    tiled.value = null
  }
}

function toggleMinimize() {
  // The height animates between the window's and the title bar's (see animateGeometry); the
  // body stays rendered during it so the content is folded away rather than vanishing first.
  animateGeometry()
  minimized.value = !minimized.value
  emit('minimize')
}

function animateGeometry() {
  animatingGeometry.value = true
  clearTimeout(geometryTimer)
  geometryTimer = setTimeout(() => (animatingGeometry.value = false), 300)
}

function toggleMaximize() {
  if (!props.maximizable) return
  const parent = windowRef.value?.parentElement
  if (!parent) return
  animateGeometry()
  if (!maximized.value) {
    // From a half snap, keep the size it had before snapping as the one to restore.
    if (!tiled.value) restoreBox = { x: posX.value, y: posY.value, w: winWidth.value, h: winHeight.value }
    tiled.value = null
    minimized.value = false
    maximized.value = true
    fillParent()
  } else {
    maximized.value = false
    posX.value = restoreBox.x
    posY.value = restoreBox.y
    winWidth.value = restoreBox.w
    winHeight.value = restoreBox.h
    clampToParent()
  }
  bringToFront()
  emit('maximize', maximized.value)
}

function fillParent() {
  const parent = windowRef.value?.parentElement
  if (!parent) return
  posX.value = 0
  posY.value = 0
  winWidth.value = parent.clientWidth
  winHeight.value = parent.clientHeight
}

function onTitleBarDoubleClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  toggleMaximize()
}

// ---- Focus on click ----
function onWindowPointerDown() {
  bringToFront()
}

// ---- Clamp to parent ----
function clampToParent() {
  if (maximized.value) return fillParent()
  if (tiled.value) return fillHalf()
  const parent = windowRef.value?.parentElement
  if (!parent) return
  const pw = parent.clientWidth
  const ph = parent.clientHeight
  if (winWidth.value > pw) winWidth.value = Math.max(props.minWidth, pw)
  if (winHeight.value > ph) winHeight.value = Math.max(props.minHeight, ph)
  posX.value = clampLeft(posX.value, winWidth.value)
  posY.value = clampTop(posY.value, minimized.value ? BAR : winHeight.value)
}

let resizeObserver: ResizeObserver | null = null

// Keeps following the parent's size, also for windows that open after mounting.
function watchParent() {
  const parent = windowRef.value?.parentElement ?? null
  if (!parent || parent === parentEl.value) return
  parentEl.value = parent
  resizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(clampToParent)
  resizeObserver.observe(parent)
}

onMounted(() => {
  watchParent()
  clampToParent()
  if (props.modelValue) bringToFront()
})

// ---- Sync initial props ----
watch(
  () => props.x,
  (v) => { posX.value = v },
)
watch(
  () => props.y,
  (v) => { posY.value = v },
)
watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    bringToFront()
    nextTick(() => {
      watchParent()
      clampToParent()
    })
  },
)

// ---- Cleanup ----
onUnmounted(() => {
  removeListeners()
  clearTimeout(geometryTimer)
  cancelAnimationFrame(sizeRaf)
  if (activeWindowId.value === id) activeWindowId.value = null
  resizeObserver?.disconnect()
})

defineExpose({
  /** Brings the window to the front, e.g. from a taskbar. */
  focus: bringToFront,
  toggleMaximize,
  toggleMinimize,
})

// Resize handle definitions
const resizeHandles: { dir: ResizeDirection; class: string; cursor: string }[] = [
  { dir: 'n', class: 'top-0 left-[20px] right-[20px] h-[6px]', cursor: 'cursor-ns-resize' },
  { dir: 'ne', class: 'top-0 right-0 w-[16px] h-[16px]', cursor: 'cursor-nesw-resize' },
  { dir: 'nw', class: 'top-0 left-0 w-[16px] h-[16px]', cursor: 'cursor-nwse-resize' },
  { dir: 's', class: 'bottom-0 left-[20px] right-[20px] h-[8px]', cursor: 'cursor-ns-resize' },
  { dir: 'e', class: 'top-[20px] right-0 bottom-[20px] w-[8px]', cursor: 'cursor-ew-resize' },
  { dir: 'w', class: 'top-[20px] left-0 bottom-[20px] w-[8px]', cursor: 'cursor-ew-resize' },
  { dir: 'se', class: 'bottom-0 right-0 w-[20px] h-[20px]', cursor: 'cursor-nwse-resize' },
  { dir: 'sw', class: 'bottom-0 left-0 w-[20px] h-[20px]', cursor: 'cursor-nesw-resize' },
]
</script>

<template>
  <Transition name="m3-window">
    <div
      v-if="modelValue"
      ref="windowRef"
      role="dialog"
      :aria-label="title"
      class="absolute flex flex-col overflow-hidden bg-surface transition-shadow duration-200"
      :class="[
        snapped ? 'rounded-none' : 'rounded-xl',
        dragging ? 'shadow-elevation-4' : active ? 'shadow-elevation-3' : 'shadow-elevation-1',
        animatingGeometry && 'm3-window-geometry',
      ]"
      :style="windowStyle"
      @pointerdown="onWindowPointerDown"
    >
      <!--
        Title bar. Not an M3 spec component (M3 has no window); built from its pieces: the front
        window's bar is surface-container-high with on-surface text, the ones behind step back
        to surface-container / on-surface-variant at elevation 1, like a desktop's focus cue.
      -->
      <div
        class="flex h-10 shrink-0 select-none items-center gap-1 pr-1.5 pl-4 transition-colors duration-200"
        :class="[
          active ? 'bg-surface-container-high' : 'bg-surface-container',
          draggable ? 'cursor-move touch-none' : '',
        ]"
        @pointerdown="onTitleBarStart"
        @dblclick="onTitleBarDoubleClick"
      >
        <slot name="header">
          <MIcon
            v-if="icon"
            :name="icon"
            :size="18"
            class="mr-1 shrink-0 transition-colors duration-200"
            :class="active ? 'text-primary' : 'text-on-surface-variant'"
          />
          <span
            class="flex-1 truncate text-title-small font-medium transition-colors duration-200"
            :class="active ? 'text-on-surface' : 'text-on-surface-variant'"
          >
            {{ title }}
          </span>
        </slot>

        <slot name="actions" />

        <button
          v-if="minimizable"
          type="button"
          class="m3-window-btn"
          :aria-label="minimized ? locale.windowRestore : locale.windowMinimize"
          :title="minimized ? locale.windowRestore : locale.windowMinimize"
          @click="toggleMinimize"
        >
          <MIcon :name="minimized ? 'expand_content' : 'minimize'" :size="18" />
        </button>

        <button
          v-if="maximizable"
          type="button"
          class="m3-window-btn"
          :aria-label="maximized ? locale.windowRestore : locale.windowMaximize"
          :title="maximized ? locale.windowRestore : locale.windowMaximize"
          @click="toggleMaximize"
        >
          <MIcon :name="maximized ? 'close_fullscreen' : 'open_in_full'" :size="16" />
        </button>

        <button
          v-if="closable"
          type="button"
          class="m3-window-btn m3-window-btn-close"
          :aria-label="locale.close"
          :title="locale.close"
          @click="close"
        >
          <MIcon name="close" :size="18" />
        </button>
      </div>

      <!-- Body -->
      <div v-show="!minimized || animatingGeometry" class="min-h-0 flex-1 overflow-auto">
        <slot />
      </div>

      <!-- Snap preview: drawn in the parent, since the window clips its own content. -->
      <Teleport v-if="snap && parentEl" :to="parentEl">
        <Transition name="m3-window-snap">
          <div
            v-if="snapTarget"
            aria-hidden="true"
            class="m3-window-snap-preview pointer-events-none absolute rounded-xl border-2 border-primary/40 bg-primary/12"
            :style="snapRect"
          />
        </Transition>
      </Teleport>

      <!-- Resize handles -->
      <template v-if="resizable && !minimized && !snapped">
        <div
          v-for="handle in resizeHandles"
          :key="handle.dir"
          class="absolute touch-none"
          :class="[handle.class, handle.cursor]"
          @pointerdown="onResizeStart($event, handle.dir)"
        />
      </template>
    </div>
  </Transition>
</template>

<style scoped>
/* 32dp circular buttons with M3 state layers (8% hover, 10% press) and the library's focus ring. */
.m3-window-btn {
  position: relative;
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: var(--color-on-surface-variant);
  outline: none;
  transition: background-color 150ms, color 150ms;
}
.m3-window-btn:hover {
  background-color: color-mix(in srgb, var(--color-on-surface-variant) 8%, transparent);
}
.m3-window-btn:active {
  background-color: color-mix(in srgb, var(--color-on-surface-variant) 10%, transparent);
}
.m3-window-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--color-secondary);
}
.m3-window-btn-close:hover {
  color: var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 8%, transparent);
}
.m3-window-btn-close:active {
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
}

/* Maximize/restore only: drag and resize write the geometry directly, untransitioned. */
.m3-window-geometry {
  transition-property: left, top, width, height, box-shadow, border-radius;
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

/* Snap preview: glides between targets, fades and grows in (GNOME-like). */
.m3-window-snap-preview {
  transition:
    left 200ms cubic-bezier(0.2, 0, 0, 1),
    width 200ms cubic-bezier(0.2, 0, 0, 1),
    opacity 150ms linear,
    transform 200ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-window-snap-enter-from,
.m3-window-snap-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* Open: scale up from 92% and fade in (emphasized decelerate); close: quicker, accelerate. */
.m3-window-enter-active {
  transition:
    opacity 150ms linear,
    transform 300ms cubic-bezier(0.05, 0.7, 0.1, 1);
}
.m3-window-leave-active {
  transition:
    opacity 150ms linear,
    transform 200ms cubic-bezier(0.3, 0, 0.8, 0.15);
}
.m3-window-enter-from,
.m3-window-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

@media (prefers-reduced-motion: reduce) {
  .m3-window-geometry,
  .m3-window-snap-preview,
  .m3-window-enter-active,
  .m3-window-leave-active {
    transition: none;
  }
}
</style>
