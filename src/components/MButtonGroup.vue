<script setup lang="ts">
/**
 * A set of buttons that share selection state — standard (separated) or connected (joined into one pill),
 * single or multi select, any value type.
 *
 * @event update:modelValue Emitted on selection change — powers v-model
 */
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'
import { FAST_SPATIAL, useSpring } from '../composables/_useSpring'
import { vRipple } from '../directives/vRipple'

export interface ButtonGroupOption {
  value: unknown
  label?: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  /** Selected value(s) — any type (v-model) */
  modelValue: unknown
  /** The options to choose from; see `ButtonGroupOption`. */
  options: ButtonGroupOption[]
  /** Standard (separated) or connected (joined) */
  variant?: 'standard' | 'connected'
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Allow multiple selections */
  multiSelect?: boolean
  /** At least one must be selected */
  selectionRequired?: boolean
  /** Selected button color */
  color?: 'primary' | 'secondary' | 'tertiary'
  /** Any CSS color for the press ripple; defaults to the button's content color */
  rippleColor?: string
}>(), {
  variant: 'standard',
  size: 'sm',
  multiSelect: false,
  selectionRequired: false,
  color: 'primary',
})

const emit = defineEmits<{ 'update:modelValue': [unknown] }>()

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function isSelected(value: unknown) {
  if (props.modelValue == null) return false
  if (Array.isArray(props.modelValue)) return props.modelValue.some(v => eq(v, value))
  return eq(props.modelValue, value)
}

function toggle(opt: ButtonGroupOption) {
  if (opt.disabled) return
  if (props.multiSelect) {
    const arr = Array.isArray(props.modelValue) ? [...props.modelValue] : props.modelValue != null ? [props.modelValue] : []
    const idx = arr.findIndex(v => eq(v, opt.value))
    if (idx >= 0) {
      if (props.selectionRequired && arr.length <= 1) return
      arr.splice(idx, 1)
    } else {
      arr.push(opt.value)
    }
    emit('update:modelValue', arr)
  } else {
    if (isSelected(opt.value) && !props.selectionRequired) {
      emit('update:modelValue', null)
    } else {
      emit('update:modelValue', opt.value)
    }
  }
}

// pad: ButtonDefaults content padding per tier, also the most a neighbor can be compressed by (animateWidth's
// default compressionLimit). checked/pressed: ToggleButtonDefaults.shapesFor() radii, as in MToggleButton (the
// standard group's items are ToggleButtons). The button group spec only has the small tier; lg/xl are library
// sizes and reuse the medium radii.
const sizeMap = {
  xs: { h: 'h-8', px: 'px-3', text: 'text-label-medium', icon: 16, check: 14, height: 32, pad: 12, checked: 12, pressed: 8 },
  sm: { h: 'h-10', px: 'px-4', text: 'text-label-large', icon: 18, check: 16, height: 40, pad: 16, checked: 12, pressed: 6 },
  md: { h: 'h-14', px: 'px-6', text: 'text-title-medium', icon: 20, check: 18, height: 56, pad: 24, checked: 16, pressed: 12 },
  lg: { h: 'h-16', px: 'px-7', text: 'text-title-large', icon: 22, check: 20, height: 64, pad: 28, checked: 16, pressed: 12 },
  xl: { h: 'h-20', px: 'px-8', text: 'text-headline-small', icon: 24, check: 22, height: 80, pad: 32, checked: 16, pressed: 12 },
}

const s = computed(() => sizeMap[props.size] ?? sizeMap.sm)

const selectedColors = computed(() => {
  const map = {
    primary: 'bg-primary text-on-primary',
    secondary: 'bg-secondary text-on-secondary',
    tertiary: 'bg-tertiary text-on-tertiary',
  }
  return map[props.color] ?? map.primary
})

const unselectedColors = 'bg-surface-container-highest text-on-surface'


const buttons: (HTMLElement | null)[] = []
const pressedIndex = ref(-1)

function onPointerDown(e: PointerEvent, i: number) {
  if (e.button !== 0 || props.options[i]?.disabled) return
  measureWidths()
  pressedIndex.value = i
}
function onPointerUp() {
  pressedIndex.value = -1
}

// ── Shapes ──────────────────────────────────────────────────────────────────────────────────
// Both variants morph like ToggleButton's shapeByInteraction(): pressed > checked > resting, on
// MotionSchemeKeyTokens.FastSpatial.
// Standard: ToggleButtonDefaults shapes, a pill that squares off when checked and more when pressed.
// Connected (ButtonGroupDefaults.connected*ButtonShapes, ConnectedButtonGroupSmallTokens): outer corners
// full, inner corners InnerCornerCornerSize (8dp) → PressedInnerCornerCornerSize (4dp) while pressed, and a
// checked button becomes a full pill (connectedButtonCheckedShape = CornerFull).
const CONNECTED_INNER = 8
const CONNECTED_PRESSED_INNER = 4

function radiiFor(i: number): number[] {
  const full = s.value.height / 2
  const pressed = pressedIndex.value === i
  const checked = isSelected(props.options[i]!.value)
  if (props.variant === 'standard') {
    const r = pressed ? s.value.pressed : checked ? s.value.checked : full
    return [r, r, r, r]
  }
  if (!pressed && checked) return [full, full, full, full]
  const inner = pressed ? CONNECTED_PRESSED_INNER : CONNECTED_INNER
  const start = i === 0 ? full : inner
  const end = i === props.options.length - 1 ? full : inner
  return [start, end, end, start]
}

useSpring(
  () => props.options.flatMap((_, i) => radiiFor(i)),
  (v) => {
    buttons.forEach((el, i) => {
      if (el) el.style.borderRadius = `${v[i * 4]}px ${v[i * 4 + 1]}px ${v[i * 4 + 2]}px ${v[i * 4 + 3]}px`
    })
  },
  FAST_SPATIAL,
)

// ── Width: the pressed button grows, its neighbors give way (standard only) ──────────────────
// ButtonGroup's layout with ButtonGroupScope.animateWidth: the pressed item grows by expandedRatio
// (ButtonGroupDefaults.ExpandedRatio = 0.15) of its width, taken from its neighbors and capped by how much
// each can be compressed (its content padding). A middle item splits the growth between both sides.
// The connected samples don't use animateWidth, so the connected variant keeps its widths.
const EXPANDED_RATIO = 0.15
let natural: number[] = []
let widthsActive = false

function measureWidths() {
  if (widthsActive) return
  natural = props.options.map((_, i) => buttons[i]?.offsetWidth ?? 0)
}

function widthsFor(progress: readonly number[]): number[] {
  const w = [...natural]
  const pad = s.value.pad
  const last = w.length - 1
  for (let i = 0; i < w.length; i++) {
    const p = progress[i] ?? 0
    if (p === 0) continue
    let growth: number
    if (i > 0 && i < last) {
      const g = Math.round(p * Math.min((EXPANDED_RATIO * w[i]!) / 2, pad))
      const left = Math.min(g, w[i - 1]!)
      const right = Math.min(g, w[i + 1]!)
      w[i - 1]! -= left
      w[i + 1]! -= right
      growth = left + right
    } else if (i === 0) {
      const g = Math.round(p * Math.min(EXPANDED_RATIO * w[i]!, pad))
      growth = Math.min(g, w[i + 1]!)
      w[i + 1]! -= growth
    } else {
      const g = Math.round(p * Math.min(EXPANDED_RATIO * w[i]!, pad))
      growth = Math.min(g, w[i - 1]!)
      w[i - 1]! -= growth
    }
    w[i]! += growth
  }
  return w
}

useSpring(
  () => props.options.map((_, i) => (props.variant === 'standard' && props.options.length > 1 && pressedIndex.value === i ? 1 : 0)),
  (progress) => {
    widthsActive = progress.some((p) => p !== 0)
    const w = widthsActive && natural.length === props.options.length ? widthsFor(progress) : null
    buttons.forEach((el, i) => {
      if (el) el.style.width = w ? `${w[i]}px` : ''
    })
  },
  FAST_SPATIAL,
)
</script>

<template>
  <div
    class="inline-flex"
    :class="variant === 'standard' ? 'gap-3' : 'gap-0.5'"
    role="group"
  >
    <button
      v-for="(opt, i) in options"
      :key="String(opt.value)"
      type="button"
      :ref="(el) => { buttons[i] = el as HTMLElement | null }"
      class="btn-group-item relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden font-medium whitespace-nowrap transition-[background-color,color] duration-200"
      :class="[
        s.h, s.px, s.text,
        opt.disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer',
        isSelected(opt.value) ? selectedColors : unselectedColors,
      ]"
      :disabled="opt.disabled"
      :aria-pressed="isSelected(opt.value)"
      v-ripple="{ disabled: opt.disabled, color: rippleColor }"
      @pointerdown="onPointerDown($event, i)"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @pointercancel="onPointerUp"
      @click="toggle(opt)"
    >
      <MIcon
        v-if="isSelected(opt.value)"
        name="check"
        :size="s.check"
      />
      <MIcon v-else-if="opt.icon" :name="opt.icon" :size="s.icon" />
      <span v-if="opt.label">{{ opt.label }}</span>
    </button>
  </div>
</template>

