<script setup lang="ts">
/**
 * A bordered canvas that captures pointer strokes for signature capture. There's no v-model, since a signature
 * isn't a simple value — read it out via events or the exposed methods.
 *
 * @event end Fires after a stroke ends, with a PNG data: URL of the canvas
 * @event change Fires alongside end, and also after undo() — same data: URL payload
 * @event begin Fires on the first pointerdown of a new stroke
 *
 * In an `MForm` it validates as a field whose value is the PNG data: URL (null while empty): `required` asks for a
 * signature, and the form's values carry it under `name`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useFieldValidation } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'

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
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Inside an `MForm` or with `rules`, a signature must be drawn */
    required?: boolean
    /** Validation rules (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: after each stroke (default), or only on submit */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm` */
    name?: string
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

// Pad + its message: attributes go on the pad
defineOptions({ inheritAttrs: false })

const emit = defineEmits<{ begin: []; end: [string]; change: [string] }>()

/** The signature as a data: URL, null while empty: what validation checks and an MForm submits */
const signature = ref<string | null>(null)
const rootEl = ref<HTMLElement | null>(null)
const validation = useFieldValidation({
  value: () => signature.value,
  rules: () => props.rules,
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  validateDebounce: () => props.validateDebounce,
  disabled: () => props.disabled,
  // A canvas takes no focus: bring it into view instead
  focus: () => rootEl.value?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
  el: () => rootEl.value,
  // MForm's reset(): back to empty
  setValue: () => clear(),
})
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled
const { hasError, message: errorMessage, messageId } = validation

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
  if (isDisabled.value) return
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
  signature.value = dataUrl
  emit('end', dataUrl)
  emit('change', dataUrl)
  // A finished stroke counts as having used the field
  validation.onBlur()
}

function clear() {
  strokes.value = []
  signature.value = null
  redraw()
}

function undo() {
  strokes.value = strokes.value.slice(0, -1)
  redraw()
  const dataUrl = toDataURL()
  signature.value = empty.value ? null : dataUrl
  emit('change', dataUrl)
}

function isEmpty(): boolean {
  return empty.value
}

function toDataURL(type?: string, quality?: number): string {
  return canvasEl.value?.toDataURL(type, quality) ?? ''
}

watch([() => props.color, () => props.background, () => props.lineWidth], redraw)

onMounted(redraw)

defineExpose({
  clear,
  undo,
  isEmpty,
  toDataURL,
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})

const containerClasses = computed(() => {
  if (props.variant === 'outlined') {
    return ['rounded-sm border', hasError.value ? 'border-error' : 'border-outline']
  }
  return ['rounded-t-sm bg-surface-container-highest border-b', hasError.value ? 'border-error' : 'border-on-surface-variant']
})
</script>

<template>
  <div
    ref="rootEl"
    v-bind="$attrs"
    class="inline-block touch-none"
    :class="[containerClasses, isDisabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-crosshair']"
  >
    <canvas
      ref="canvasEl"
      :width="width"
      :height="height"
      role="img"
      aria-label="Signature pad"
      :aria-invalid="hasError || undefined"
      :aria-describedby="errorMessage ? messageId : undefined"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
  </div>
  <p v-if="errorMessage" :id="messageId" role="alert" class="mt-1 text-body-small text-error">{{ errorMessage }}</p>
</template>
