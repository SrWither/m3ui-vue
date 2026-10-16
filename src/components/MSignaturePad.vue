<script setup lang="ts">
/**
 * A bordered canvas that captures pointer strokes for signature capture. There's no v-model, since a signature
 * isn't a simple value — read it out via events or the exposed methods.
 *
 * @event end Fires after a stroke ends, with a PNG data: URL of the canvas
 * @event change Fires alongside end, and also after undo() — same data: URL payload
 * @event begin Fires on the first pointerdown of a new stroke
 */
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Canvas width in px */
    width?: number
    /** Canvas height in px */
    height?: number
    /** Stroke width */
    lineWidth?: number
    /** Stroke color */
    color?: string
    /** Canvas background color */
    background?: string
    /** Container border style */
    variant?: 'filled' | 'outlined'
    /** Disables drawing */
    disabled?: boolean
  }>(),
  {
    width: 400,
    height: 200,
    lineWidth: 2.5,
    color: '#000000',
    background: '#ffffff',
    variant: 'outlined',
    disabled: false,
  },
)

const emit = defineEmits<{ begin: []; end: [string]; change: [string] }>()

type Point = { x: number; y: number }

const canvasEl = ref<HTMLCanvasElement | null>(null)
const strokes = ref<Point[][]>([])
const drawing = ref(false)
const empty = computed(() => strokes.value.length === 0)

function getContext() {
  return canvasEl.value?.getContext('2d') ?? null
}

function redraw() {
  const ctx = getContext()
  const canvas = canvasEl.value
  if (!ctx || !canvas) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = props.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = props.color
  ctx.lineWidth = props.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of strokes.value) {
    if (stroke.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0]!.x, stroke[0]!.y)
    for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }
}

function pointFromEvent(e: PointerEvent): Point {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return
  drawing.value = true
  strokes.value.push([pointFromEvent(e)])
  emit('begin')
  canvasEl.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!drawing.value) return
  strokes.value[strokes.value.length - 1]!.push(pointFromEvent(e))
  redraw()
}

function onPointerUp() {
  if (!drawing.value) return
  drawing.value = false
  const dataUrl = toDataURL()
  emit('end', dataUrl)
  emit('change', dataUrl)
}

function clear() {
  strokes.value = []
  redraw()
}

function undo() {
  strokes.value = strokes.value.slice(0, -1)
  redraw()
  emit('change', toDataURL())
}

function isEmpty(): boolean {
  return empty.value
}

function toDataURL(type?: string, quality?: number): string {
  return canvasEl.value?.toDataURL(type, quality) ?? ''
}

watch([() => props.color, () => props.background, () => props.lineWidth], redraw)

onMounted(redraw)

defineExpose({ clear, undo, isEmpty, toDataURL })

const containerClasses = computed(() => {
  if (props.variant === 'outlined') {
    return 'rounded-sm border border-outline'
  }
  return 'rounded-t-sm bg-surface-container-highest border-b border-on-surface-variant'
})
</script>

<template>
  <div
    class="inline-block touch-none"
    :class="[containerClasses, disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-crosshair']"
  >
    <canvas
      ref="canvasEl"
      :width="width"
      :height="height"
      role="img"
      aria-label="Signature pad"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
  </div>
</template>
