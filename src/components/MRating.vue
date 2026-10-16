<script setup lang="ts">
/**
 * A star rating input with half increments and any Material Symbol icon. Not part of the official M3 spec, so
 * it's built from M3 primitives: filled/outlined icon pairs, a state layer on hover/press, and a focus ring.
 * Click or drag to rate (drag past the first icon to clear), or use the arrow keys, Home and End when focused.
 *
 * @event update:modelValue Emitted when the user rates by click, drag or keyboard (v-model). Dragging past the
 *   first icon emits 0
 */
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

// Not part of the official M3 spec — built from M3 primitives instead: filled/outlined
// Material Symbol pairs, on-surface-variant for the unselected icon, a 40px circular
// hover/press state layer (8%/10%) tinted with the active color, and a secondary focus ring.
const props = withDefaults(defineProps<{
  /** Current rating (v-model) */
  modelValue: number
  /** Maximum stars */
  max?: number
  /** Star size in px */
  size?: number
  /** Display-only: not focusable, exposed as role="img" with the value as its label */
  readonly?: boolean
  /** Disables interaction */
  disabled?: boolean
  /** One of the 4 M3 roles ('primary' | 'secondary' | 'tertiary' | 'error'), or any other CSS color string */
  color?: string
  /** Material Symbol icon */
  icon?: string
  /**
   * Allow half-star values (click the left half of an icon). Fractional values always render exactly, with or
   * without this prop
   */
  halfIncrements?: boolean
}>(), { max: 5, size: 28, color: 'primary', icon: 'star', halfIncrements: false })

const emit = defineEmits<{ 'update:modelValue': [number] }>()

const ROLE_COLORS: Record<string, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error',
}

const colorClass = computed(() => ROLE_COLORS[props.color] ?? '')
const customStyle = computed(() => (props.color in ROLE_COLORS ? undefined : { color: props.color }))

const interactive = computed(() => !props.readonly && !props.disabled)
const step = computed(() => (props.halfIncrements ? 0.5 : 1))

const rootEl = ref<HTMLElement | null>(null)
const itemEls: HTMLElement[] = []

// Pointer preview: `value` is what the rating would become, `index` is the item under the
// pointer (drives the state layer). Null when the pointer isn't over the component.
const hover = ref<{ index: number; value: number } | null>(null)
const pressed = ref(false)

const clamp = (v: number) => Math.min(props.max, Math.max(0, v))

const displayValue = computed(() =>
  !pressed.value && hover.value ? hover.value.value : clamp(props.modelValue || 0),
)

// Per-item fill fraction (0..1). Arbitrary fractions render exactly (e.g. a readonly 4.3
// average shows 30% of the 5th icon), not just whole/half steps.
const fills = computed(() =>
  Array.from({ length: props.max }, (_, i) => Math.min(1, Math.max(0, displayValue.value - i))),
)

function pointerTarget(e: PointerEvent): { index: number; value: number } | null {
  if (!itemEls.length) return null
  const rtl = rootEl.value ? getComputedStyle(rootEl.value).direction === 'rtl' : false
  const first = itemEls[0]!.getBoundingClientRect()
  // Dragging past the start edge clears to 0 — the only pointer path to an empty rating.
  if (pressed.value && (rtl ? e.clientX > first.right : e.clientX < first.left)) {
    return { index: 0, value: 0 }
  }
  for (let i = 0; i < itemEls.length; i++) {
    const r = itemEls[i]!.getBoundingClientRect()
    const isLast = i === itemEls.length - 1
    if (!isLast && (rtl ? e.clientX < r.left : e.clientX > r.right)) continue
    const frac = rtl ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width
    const value = props.halfIncrements && frac < 0.5 ? i + 0.5 : i + 1
    return { index: i, value }
  }
  return null
}

function commit(v: number) {
  const next = clamp(v)
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onPointerDown(e: PointerEvent) {
  if (!interactive.value || e.button !== 0) return
  pressed.value = true
  rootEl.value?.setPointerCapture(e.pointerId)
  const t = pointerTarget(e)
  hover.value = t
  if (t) commit(t.value)
}

function onPointerMove(e: PointerEvent) {
  if (!interactive.value) return
  if (!pressed.value && e.pointerType !== 'mouse') return
  const t = pointerTarget(e)
  hover.value = t
  if (pressed.value && t) commit(t.value)
}

function onPointerUp(e: PointerEvent) {
  if (!pressed.value) return
  pressed.value = false
  rootEl.value?.releasePointerCapture(e.pointerId)
  if (e.pointerType !== 'mouse') hover.value = null
}

function onPointerLeave() {
  if (!pressed.value) hover.value = null
}

function onKeydown(e: KeyboardEvent) {
  if (!interactive.value) return
  const rtl = rootEl.value ? getComputedStyle(rootEl.value).direction === 'rtl' : false
  const current = clamp(props.modelValue || 0)
  let next: number
  switch (e.key) {
    case 'ArrowUp':
      next = current + step.value
      break
    case 'ArrowDown':
      next = current - step.value
      break
    case 'ArrowRight':
      next = current + (rtl ? -step.value : step.value)
      break
    case 'ArrowLeft':
      next = current + (rtl ? step.value : -step.value)
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = props.max
      break
    default:
      return
  }
  e.preventDefault()
  // Snap to the step grid so an off-grid modelValue (e.g. 3.7) moves to a valid value.
  commit(Math.round(next / step.value) * step.value)
}

function stateLayerClass(i: number) {
  if (!interactive.value || hover.value?.index !== i) return 'opacity-0'
  return pressed.value ? 'opacity-[0.10]' : 'opacity-[0.08]'
}

const valueText = computed(() => `${clamp(props.modelValue || 0)} / ${props.max}`)
</script>

<template>
  <div
    ref="rootEl"
    class="inline-flex select-none items-center gap-0.5 rounded-full outline-none ring-secondary focus-visible:ring-2"
    :class="interactive ? 'cursor-pointer touch-pan-y' : 'cursor-default'"
    :role="readonly ? 'img' : 'slider'"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="readonly ? valueText : undefined"
    :aria-valuemin="readonly ? undefined : 0"
    :aria-valuemax="readonly ? undefined : max"
    :aria-valuenow="readonly ? undefined : clamp(modelValue || 0)"
    :aria-valuetext="readonly ? undefined : valueText"
    :aria-disabled="disabled || undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerLeave"
    @keydown="onKeydown"
  >
    <span
      v-for="(fill, i) in fills"
      :key="i"
      :ref="(el) => { if (el) itemEls[i] = el as HTMLElement }"
      class="relative inline-flex shrink-0"
      :style="{ width: `${size + 4}px`, height: `${size + 4}px` }"
    >
      <!-- State layer: overhangs the item by 4px per side (size 28 → 40px circle) without
           changing the component's footprint; only one is visible at a time. -->
      <span
        class="pointer-events-none absolute -inset-1 rounded-full bg-current transition-opacity duration-150"
        :class="[colorClass, stateLayerClass(i)]"
        :style="customStyle"
      />
      <span class="absolute inset-0.5">
        <!-- Unfilled part (outlined glyph), clipped from the end side -->
        <span class="absolute inset-y-0 end-0 overflow-hidden" :style="{ width: `${(1 - fill) * 100}%` }">
          <MIcon
            :name="icon"
            :size="size"
            class="absolute end-0 top-0"
            :class="disabled ? 'text-on-surface/38' : 'text-on-surface-variant'"
          />
        </span>
        <!-- Filled part (FILL 1 glyph), clipped from the start side — this is what renders
             half (or any fractional) values with any icon, not just `star`. -->
        <span class="absolute inset-y-0 start-0 overflow-hidden" :style="{ width: `${fill * 100}%` }">
          <MIcon
            :name="icon"
            :size="size"
            class="absolute start-0 top-0"
            :class="disabled ? 'text-on-surface/38' : colorClass"
            :style="[disabled ? undefined : customStyle, { fontVariationSettings: `'FILL' 1` }]"
          />
        </span>
      </span>
    </span>
  </div>
</template>
