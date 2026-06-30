<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import MIcon from './MIcon.vue'

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
    x: 50,
    y: 50,
    resetPosition: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  minimize: []
}>()

// ---- State ----
const posX = ref(props.x)
const posY = ref(props.y)
const winWidth = ref(parseInt(props.width) || 400)
const winHeight = ref(parseInt(props.height) || 300)
const minimized = ref(false)
const zIndex = ref(100)

// Global z-index counter shared across instances
let globalZIndex = 100

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
  height: minimized.value ? 'auto' : `${winHeight.value}px`,
  zIndex: zIndex.value,
}))

// ---- Bring to front ----
function bringToFront() {
  globalZIndex++
  zIndex.value = globalZIndex
}

// ---- Pointer helpers ----
function getXY(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('touches' in e) {
    const t = e.touches[0] ?? e.changedTouches[0]
    return { x: t!.clientX, y: t!.clientY }
  }
  return { x: e.clientX, y: e.clientY }
}

function addListeners() {
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
  document.addEventListener('touchmove', onPointerMove, { passive: false })
  document.addEventListener('touchend', onPointerUp)
}

function removeListeners() {
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
  document.removeEventListener('touchmove', onPointerMove)
  document.removeEventListener('touchend', onPointerUp)
}

// ---- Drag ----
function onTitleBarStart(e: MouseEvent | TouchEvent) {
  if (!props.draggable) return
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  const { x, y } = getXY(e)
  isDragging = true
  dragStartX = x
  dragStartY = y
  dragStartPosX = posX.value
  dragStartPosY = posY.value
  bringToFront()
  addListeners()
}

// ---- Resize ----
function onResizeStart(e: MouseEvent | TouchEvent, direction: ResizeDirection) {
  if (!props.resizable) return
  e.preventDefault()
  e.stopPropagation()
  const { x, y } = getXY(e)
  isResizing = true
  resizeDir = direction
  resizeStartX = x
  resizeStartY = y
  resizeStartW = winWidth.value
  resizeStartH = winHeight.value
  resizeStartPosX = posX.value
  resizeStartPosY = posY.value
  bringToFront()
  addListeners()
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  const { x, y } = getXY(e)

  if (isDragging) {
    const dx = x - dragStartX
    const dy = y - dragStartY
    const parent = windowRef.value?.parentElement
    const maxX = parent ? parent.clientWidth - winWidth.value : Infinity
    const maxY = parent ? parent.clientHeight - (minimized.value ? 40 : winHeight.value) : Infinity
    posX.value = Math.max(0, Math.min(maxX, dragStartPosX + dx))
    posY.value = Math.max(0, Math.min(maxY, dragStartPosY + dy))
  }

  if (isResizing) {
    const dx = x - resizeStartX
    const dy = y - resizeStartY
    const dir = resizeDir
    const parent = windowRef.value?.parentElement
    const parentW = parent ? parent.clientWidth : Infinity
    const parentH = parent ? parent.clientHeight : Infinity

    const clampW = (w: number) => Math.min(props.maxWidth ?? Infinity, Math.max(props.minWidth, w))
    const clampH = (h: number) => Math.min(props.maxHeight ?? Infinity, Math.max(props.minHeight, h))

    if (dir.includes('e')) {
      winWidth.value = Math.min(parentW - resizeStartPosX, clampW(resizeStartW + dx))
    }
    if (dir.includes('w')) {
      const newW = Math.min(resizeStartPosX + resizeStartW, clampW(resizeStartW - dx))
      posX.value = Math.max(0, resizeStartPosX + (resizeStartW - newW))
      winWidth.value = newW
    }
    if (dir.includes('s')) {
      winHeight.value = Math.min(parentH - resizeStartPosY, clampH(resizeStartH + dy))
    }
  }
}

function onPointerUp() {
  isDragging = false
  isResizing = false
  removeListeners()
}

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
  }
}

function toggleMinimize() {
  minimized.value = !minimized.value
  emit('minimize')
}

// ---- Focus on click ----
function onWindowMouseDown() {
  bringToFront()
}

// ---- Clamp to parent ----
function clampToParent() {
  const parent = windowRef.value?.parentElement
  if (!parent) return
  const pw = parent.clientWidth
  const ph = parent.clientHeight
  if (winWidth.value > pw) winWidth.value = Math.max(props.minWidth, pw)
  if (winHeight.value > ph) winHeight.value = Math.max(props.minHeight, ph)
  if (posX.value + winWidth.value > pw) posX.value = Math.max(0, pw - winWidth.value)
  if (posY.value + winHeight.value > ph) posY.value = Math.max(0, ph - winHeight.value)
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  clampToParent()
  const parent = windowRef.value?.parentElement
  if (parent) {
    resizeObserver = new ResizeObserver(clampToParent)
    resizeObserver.observe(parent)
  }
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
  (v) => { if (v) nextTick(clampToParent) },
)

// ---- Cleanup ----
onUnmounted(() => {
  removeListeners()
  resizeObserver?.disconnect()
})

// Resize handle definitions
const resizeHandles: { dir: ResizeDirection; class: string; cursor: string }[] = [
  { dir: 's', class: 'bottom-0 left-[20px] right-[20px] h-[8px]', cursor: 'cursor-ns-resize' },
  { dir: 'e', class: 'top-[20px] right-0 bottom-[20px] w-[8px]', cursor: 'cursor-ew-resize' },
  { dir: 'w', class: 'top-[20px] left-0 bottom-[20px] w-[8px]', cursor: 'cursor-ew-resize' },
  { dir: 'se', class: 'bottom-0 right-0 w-[20px] h-[20px]', cursor: 'cursor-nwse-resize' },
  { dir: 'sw', class: 'bottom-0 left-0 w-[20px] h-[20px]', cursor: 'cursor-nesw-resize' },
]
</script>

<template>
  <div
    v-if="modelValue"
    ref="windowRef"
    class="absolute flex flex-col rounded-xl bg-surface shadow-elevation-3 overflow-hidden"
    :style="windowStyle"
    @mousedown="onWindowMouseDown"
  >
    <!-- Title bar -->
    <div
      class="flex items-center gap-2 px-4 h-10 bg-surface-container select-none shrink-0"
      :class="{ 'cursor-move': draggable }"
      @mousedown="onTitleBarStart"
      @touchstart="onTitleBarStart"
    >
      <slot name="header">
        <MIcon v-if="icon" :name="icon" :size="18" class="text-on-surface-variant" />
        <span class="text-title-small font-medium text-on-surface truncate flex-1">
          {{ title }}
        </span>
      </slot>

      <slot name="actions" />

      <button
        v-if="minimizable"
        class="text-on-surface-variant hover:bg-on-surface/8 rounded-full w-7 h-7 flex items-center justify-center transition-colors"
        @click="toggleMinimize"
      >
        <MIcon :name="minimized ? 'open_in_full' : 'minimize'" :size="16" />
      </button>

      <button
        v-if="closable"
        class="text-on-surface-variant hover:bg-error/12 hover:text-error rounded-full w-7 h-7 flex items-center justify-center transition-colors"
        @click="close"
      >
        <MIcon name="close" :size="16" />
      </button>
    </div>

    <!-- Body -->
    <div
      v-show="!minimized"
      class="flex-1 overflow-auto"
    >
      <slot />
    </div>

    <!-- Resize handles -->
    <template v-if="resizable && !minimized">
      <div
        v-for="handle in resizeHandles"
        :key="handle.dir"
        class="absolute"
        :class="[handle.class, handle.cursor]"
        @mousedown="onResizeStart($event, handle.dir)"
        @touchstart="onResizeStart($event, handle.dir)"
      />
    </template>
  </div>
</template>

