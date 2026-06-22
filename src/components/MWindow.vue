<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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

// ---- Drag ----
function onTitleBarMouseDown(e: MouseEvent) {
  if (!props.draggable) return
  // Ignore clicks on buttons inside the title bar
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  isDragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartPosX = posX.value
  dragStartPosY = posY.value
  bringToFront()
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// ---- Resize ----
function onResizeMouseDown(e: MouseEvent, direction: ResizeDirection) {
  if (!props.resizable) return
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
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  e.preventDefault()

  if (isDragging) {
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    const parent = windowRef.value?.parentElement
    const maxX = parent ? parent.clientWidth - winWidth.value : Infinity
    const maxY = parent ? parent.clientHeight - (minimized.value ? 40 : winHeight.value) : Infinity
    posX.value = Math.max(0, Math.min(maxX, dragStartPosX + dx))
    posY.value = Math.max(0, Math.min(maxY, dragStartPosY + dy))
  }

  if (isResizing) {
    const dx = e.clientX - resizeStartX
    const dy = e.clientY - resizeStartY
    const dir = resizeDir
    const parent = windowRef.value?.parentElement
    const parentW = parent ? parent.clientWidth : Infinity
    const parentH = parent ? parent.clientHeight : Infinity

    // East
    if (dir.includes('e')) {
      const maxW = parentW - resizeStartPosX
      winWidth.value = Math.min(maxW, Math.max(props.minWidth, resizeStartW + dx))
    }
    // West
    if (dir.includes('w')) {
      const maxW = resizeStartPosX + resizeStartW
      const newW = Math.min(maxW, Math.max(props.minWidth, resizeStartW - dx))
      posX.value = Math.max(0, resizeStartPosX + (resizeStartW - newW))
      winWidth.value = newW
    }
    // South
    if (dir.includes('s')) {
      const maxH = parentH - resizeStartPosY
      winHeight.value = Math.min(maxH, Math.max(props.minHeight, resizeStartH + dy))
    }
    // North
    if (dir === 'n' || dir === 'ne' || dir === 'nw') {
      const maxH = resizeStartPosY + resizeStartH
      const newH = Math.min(maxH, Math.max(props.minHeight, resizeStartH - dy))
      posY.value = Math.max(0, resizeStartPosY + (resizeStartH - newH))
      winHeight.value = newH
    }
  }
}

function onMouseUp() {
  isDragging = false
  isResizing = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
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

// ---- Sync initial props ----
watch(
  () => props.x,
  (v) => { posX.value = v },
)
watch(
  () => props.y,
  (v) => { posY.value = v },
)

// ---- Cleanup ----
onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

// Resize handle definitions
const resizeHandles: { dir: ResizeDirection; class: string; cursor: string }[] = [
  { dir: 'n', class: 'top-0 left-[10px] right-[10px] h-[5px]', cursor: 'cursor-ns-resize' },
  { dir: 's', class: 'bottom-0 left-[10px] right-[10px] h-[5px]', cursor: 'cursor-ns-resize' },
  { dir: 'e', class: 'top-[10px] right-0 bottom-[10px] w-[5px]', cursor: 'cursor-ew-resize' },
  { dir: 'w', class: 'top-[10px] left-0 bottom-[10px] w-[5px]', cursor: 'cursor-ew-resize' },
  { dir: 'ne', class: 'top-0 right-0 w-[12px] h-[12px]', cursor: 'cursor-nesw-resize' },
  { dir: 'nw', class: 'top-0 left-0 w-[12px] h-[12px]', cursor: 'cursor-nwse-resize' },
  { dir: 'se', class: 'bottom-0 right-0 w-[12px] h-[12px]', cursor: 'cursor-nwse-resize' },
  { dir: 'sw', class: 'bottom-0 left-0 w-[12px] h-[12px]', cursor: 'cursor-nesw-resize' },
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
      @mousedown="onTitleBarMouseDown"
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
        @mousedown="onResizeMouseDown($event, handle.dir)"
      />
    </template>
  </div>
</template>

<style scoped>
.flex-col {
  transition: height 0.2s ease;
}
</style>
