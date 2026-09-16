<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: number | [number, number]
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    label?: string
    showValue?: boolean
    showTooltip?: boolean
    orientation?: 'horizontal' | 'vertical'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    variant?: 'standard' | 'centered' | 'range'
    stops?: boolean
    icon?: string
    color?: 'primary' | 'secondary' | 'tertiary' | 'error'
    /** Custom color (hex, rgb(), a CSS var, etc.) for the filled/active portion of the track and the corner dot. Defaults to `color`'s M3 token. */
    fillColor?: string
    /** Replaces the draggable bar thumb with an icon. */
    thumbIcon?: string
    /** Custom color (hex, rgb(), a CSS var, etc.) for the thumb (bar or icon). Defaults to `color`'s M3 token. */
    thumbColor?: string
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    showValue: false,
    showTooltip: false,
    orientation: 'horizontal',
    size: 'xs',
    variant: 'standard',
    stops: false,
    color: 'primary',
  },
)

const emit = defineEmits<{ 'update:modelValue': [number | [number, number]] }>()

const trackEl = ref<HTMLElement>()
const dragging = ref<false | 'single' | 0 | 1>(false)
const isVertical = computed(() => props.orientation === 'vertical')
const isRange = computed(() => props.variant === 'range')
const isCentered = computed(() => props.variant === 'centered')

const val = computed(() => {
  if (isRange.value) {
    const v = props.modelValue as [number, number]
    return { lo: Math.min(v[0], v[1]), hi: Math.max(v[0], v[1]) }
  }
  return { lo: props.modelValue as number, hi: props.modelValue as number }
})

function toPct(v: number) {
  const range = props.max - props.min
  return range === 0 ? 0 : ((v - props.min) / range) * 100
}

const pctLo = computed(() => toPct(val.value.lo))
const pctHi = computed(() => toPct(val.value.hi))
const centerPct = computed(() => toPct(0))

// Start/end anchor dots hide once the fill has actually covered their spot —
// visible while that corner is still "unreached" track, hidden once passed.
// Standard never gets a start indicator at all (matches the official M3
// slider: only the far/unreached end is ever marked).
const startDotHidden = computed(() => {
  if (props.variant === 'centered') return Math.min(pctLo.value, centerPct.value) <= 0
  if (props.variant === 'range') return pctLo.value <= 0
  return true
})
const endDotHidden = computed(() => {
  if (props.variant === 'centered') return Math.max(pctLo.value, centerPct.value) >= 100
  if (props.variant === 'range') return pctHi.value >= 100
  return pctLo.value >= 100
})

const sizeMap = {
  xs: { track: 16, thumbW: 4, thumbH: 32, dot: 4, gap: 7, hitArea: 38, radius: 6, dotInset: 12, thumbInset: 5, iconSize: 14, thumbIconSize: 22 },
  sm: { track: 28, thumbW: 4, thumbH: 40, dot: 5, gap: 7, hitArea: 46, radius: 8, dotInset: 13, thumbInset: 6, iconSize: 16, thumbIconSize: 28 },
  md: { track: 54, thumbW: 5, thumbH: 62, dot: 5, gap: 8, hitArea: 66, radius: 12, dotInset: 15, thumbInset: 7, iconSize: 20, thumbIconSize: 42 },
  lg: { track: 72, thumbW: 5, thumbH: 78, dot: 6, gap: 10, hitArea: 82, radius: 14, dotInset: 17, thumbInset: 8, iconSize: 24, thumbIconSize: 52 },
  xl: { track: 96, thumbW: 6, thumbH: 98, dot: 7, gap: 10, hitArea: 100, radius: 18, dotInset: 19, thumbInset: 9, iconSize: 28, thumbIconSize: 66 },
}

const s = computed(() => sizeMap[props.size] ?? sizeMap.xs)

// The corner `icon` is much bigger than the plain dot, so dotInset alone
// isn't enough clearance from the thumb's resting spot — it reads as jammed
// into the corner right at 0%/100%. Give it its own, thumb-aware inset. This
// only meaningfully changes the "not yet reached" look; once the thumb has
// moved past, it's already far away regardless of the exact inset.
const iconInset = computed(() => s.value.thumbInset + s.value.thumbW / 2 + s.value.iconSize / 2 + 3)

// A thumbIcon is much wider along the travel axis than the plain bar, so the
// fixed track gap isn't enough to clear it — it'd visually touch the fill on
// both sides. Widen the gap to the icon's own half-width when thumbIcon is set.
const gap = computed(() => {
  if (!props.thumbIcon) return s.value.gap
  return Math.max(s.value.gap, s.value.thumbIconSize / 2 + 4)
})

const paletteMap: Record<string, { active: string; inactive: string }> = {
  primary: { active: 'var(--color-primary)', inactive: 'var(--color-primary-container)' },
  secondary: { active: 'var(--color-secondary)', inactive: 'var(--color-secondary-container)' },
  tertiary: { active: 'var(--color-tertiary)', inactive: 'var(--color-tertiary-container)' },
  error: { active: 'var(--color-error)', inactive: 'var(--color-error-container)' },
}
// `fillColor`/`thumbColor` accept a custom CSS color (hex, rgb(), a var, …) —
// not just an M3 role — that's the point of a "custom color" prop, otherwise
// it'd just duplicate `color`. A known role name still works as a shortcut.
// For a custom color there's no ready-made "container" tone, so the inactive
// shade is derived by mixing it down against the current surface.
function resolvePalette(custom: string | undefined, base: 'primary' | 'secondary' | 'tertiary' | 'error') {
  const value = custom ?? base
  if (value in paletteMap) return paletteMap[value]!
  return { active: value, inactive: `color-mix(in srgb, ${value} 30%, var(--color-surface-container-highest))` }
}
// `ct` (fill + corner dot) and `thumbCt` (thumb bar/icon) each fall back to the
// base `color` prop, but can be overridden independently via `fillColor`/`thumbColor`.
const ct = computed(() => resolvePalette(props.fillColor, props.color))
const thumbCt = computed(() => resolvePalette(props.thumbColor, props.color))

function clamp(v: number) {
  const stepped = Math.round((v - props.min) / props.step) * props.step + props.min
  return Math.max(props.min, Math.min(props.max, +stepped.toFixed(10)))
}

function ratioFromEvent(e: PointerEvent) {
  if (!trackEl.value) return 0
  const rect = trackEl.value.getBoundingClientRect()
  if (isVertical.value) return 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

function valueFromEvent(e: PointerEvent) {
  return clamp(props.min + ratioFromEvent(e) * (props.max - props.min))
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return
  e.preventDefault()
  const v = valueFromEvent(e)
  if (isRange.value) {
    const cur = props.modelValue as [number, number]
    const dist0 = Math.abs(v - cur[0])
    const dist1 = Math.abs(v - cur[1])
    const idx: 0 | 1 = dist0 <= dist1 ? 0 : 1
    dragging.value = idx
    const next: [number, number] = [cur[0], cur[1]]
    next[idx] = v
    emit('update:modelValue', next)
  } else {
    dragging.value = 'single'
    emit('update:modelValue', v)
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (dragging.value === false) return
  const v = valueFromEvent(e)
  if (isRange.value) {
    const cur = props.modelValue as [number, number]
    const next: [number, number] = [cur[0], cur[1]]
    next[dragging.value as 0 | 1] = v
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', v)
  }
}

function onPointerUp() {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

function onKeyDown(e: KeyboardEvent) {
  if (props.disabled) return
  const d: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
  const delta = d[e.key]
  if (delta !== undefined) {
    e.preventDefault()
    if (isRange.value) {
      const cur = props.modelValue as [number, number]
      emit('update:modelValue', [clamp(cur[0] + delta * props.step), cur[1]])
    } else {
      emit('update:modelValue', clamp((props.modelValue as number) + delta * props.step))
    }
  }
  if (e.key === 'Home') { e.preventDefault(); emit('update:modelValue', isRange.value ? [props.min, (props.modelValue as [number, number])[1]] : props.min) }
  if (e.key === 'End') { e.preventDefault(); emit('update:modelValue', isRange.value ? [(props.modelValue as [number, number])[0], props.max] : props.max) }
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})

const stopPositions = computed(() => {
  if (!props.stops) return []
  const positions: number[] = []
  const range = props.max - props.min
  const iconClearPct = props.icon ? (s.value.iconSize + s.value.radius) / 2 : 0
  for (let v = props.min + props.step; v < props.max; v += props.step) {
    const pct = ((v - props.min) / range) * 100
    if (props.icon && pct < iconClearPct) continue
    positions.push(pct)
  }
  return positions.length <= 28 ? positions : []
})

// Standard variant: the fill pill always keeps a gap on the side facing the
// thumb, even at 0%/100% — matches the official M3 slider, which never lets
// the track touch the handle.
// Standard variant fill edges must track the thumb's *clamped* position, not
// the raw pct — otherwise, near 0%/100% where the thumb is pinned by
// thumbInset, the pill (still sized off the raw value) creeps past the pinned
// thumb and swallows the gap that's supposed to stay visible there.
function fillActiveSize(pct: number) {
  return `calc(${clampedPos(pct)} - ${gap.value}px)`
}
function fillInactiveSize(pct: number) {
  return `calc(100% - ${clampedPos(pct)} - ${gap.value}px)`
}

// Range & centered variants: same fix as above — any fill edge that sits at a
// real draggable thumb must anchor to its clamped (thumbInset-aware) position,
// not the raw pct, or the fill creeps past a thumb pinned near 0%/100% and
// swallows the gap that's supposed to stay visible there.

// Range: both pctLo and pctHi are thumbs.
function rangeInactiveBeforeSize() {
  return `calc(${clampedPos(pctLo.value)} - ${gap.value}px)`
}
function rangeActiveStart() {
  return `calc(${clampedPos(pctLo.value)} + ${gap.value}px)`
}
function rangeActiveSize() {
  return `calc(${clampedPos(pctHi.value)} - ${clampedPos(pctLo.value)} - ${gap.value * 2}px)`
}
function rangeInactiveAfterSize() {
  return `calc(100% - ${clampedPos(pctHi.value)} - ${gap.value}px)`
}

// Centered: only pctLo is a thumb — centerPct is a fixed anchor, never inset.
function centeredActiveStart() {
  return pctLo.value >= centerPct.value
    ? `${centerPct.value}%`
    : `calc(${clampedPos(pctLo.value)} + ${gap.value}px)`
}
function centeredActiveSize() {
  return pctLo.value >= centerPct.value
    ? `calc(${clampedPos(pctLo.value)} - ${centerPct.value}% - ${gap.value}px)`
    : `calc(${centerPct.value}% - ${clampedPos(pctLo.value)} - ${gap.value}px)`
}
function centeredFarInactiveSize() {
  return pctLo.value >= centerPct.value
    ? `calc(100% - ${clampedPos(pctLo.value)} - ${gap.value}px)`
    : `calc(100% - ${centerPct.value}% - ${gap.value}px)`
}
function centeredNearInactiveSize() {
  return pctLo.value <= centerPct.value
    ? `calc(${clampedPos(pctLo.value)} - ${gap.value}px)`
    : `calc(${centerPct.value}% - ${gap.value}px)`
}

const r = computed(() => s.value.radius)
const smallR = computed(() => Math.max(2, r.value / 4))

// A segment bounded by a gap on *both* sides — range's middle (active)
// segment between the two thumbs, and centered's active segment (its far
// side sits at the fixed center junction, its near side at the thumb gap;
// it never touches a real track end since the near/far inactive segments
// always cover those) — goes square on every corner, never a rounded cap.
function pillRadiusSquareBoth() {
  return `${smallR.value}px`
}

// The pill's outer end (away from the thumb/gap) stays fully rounded like a
// cap; the end facing a thumb-gap goes square, matching the official M3
// slider's track segments.
function pillRadiusOuterStart() {
  return isVertical.value
    ? `${smallR.value}px ${smallR.value}px ${r.value}px ${r.value}px`
    : `${r.value}px ${smallR.value}px ${smallR.value}px ${r.value}px`
}
function pillRadiusOuterEnd() {
  return isVertical.value
    ? `${r.value}px ${r.value}px ${smallR.value}px ${smallR.value}px`
    : `${smallR.value}px ${r.value}px ${r.value}px ${smallR.value}px`
}
const nd = computed(() => dragging.value === false)
const tr = computed(() => nd.value ? '75ms ease' : '0s')

// Keeps the thumb from ever touching the very ends of the track. Sits closer
// to the edge than the corner dot (dot stays visible further in, toward
// center) — only bites near 0%/100%; elsewhere it's a no-op (thumb still
// tracks pct% exactly, staying flush with the fill edge as always).
function clampedPos(pct: number) {
  const inset = s.value.thumbInset
  return `clamp(${inset}px, ${pct}%, calc(100% - ${inset}px))`
}

function thumbPos(pct: number) {
  const tw = isVertical.value ? s.value.thumbH : s.value.thumbW
  const th = isVertical.value ? s.value.thumbW : s.value.thumbH
  const br = Math.min(tw, th) / 2
  const isDragging = dragging.value !== false
  const base: Record<string, string> = {
    position: 'absolute',
    width: `${tw}px`,
    height: `${th}px`,
    borderRadius: `${br}px`,
    backgroundColor: thumbCt.value.active,
    zIndex: '2',
    transition: nd.value ? 'left 75ms ease, bottom 75ms ease, transform 80ms ease' : 'transform 80ms ease',
  }
  // Pressed state pinches the thumb thinner along the travel axis (like the
  // official M3 slider handle) while slightly growing the cross axis.
  const grow = isDragging ? 1.08 : 1
  const narrow = isDragging ? 0.6 : 1
  if (isVertical.value) {
    base.left = '50%'
    base.bottom = clampedPos(pct)
    base.transform = `translateX(-50%) translateY(50%) scaleX(${grow}) scaleY(${narrow})`
  } else {
    base.left = clampedPos(pct)
    base.top = '50%'
    base.transform = `translateX(-50%) translateY(-50%) scaleY(${grow}) scaleX(${narrow})`
  }
  return base
}

// Icon-thumb variant: same clamped position, but grows slightly on press
// instead of pinching thin (an icon can't sensibly narrow).
function thumbIconPos(pct: number) {
  const isDragging = dragging.value !== false
  const scale = isDragging ? 1.15 : 1
  const base: Record<string, string> = {
    position: 'absolute',
    color: thumbCt.value.active,
    zIndex: '2',
    transition: nd.value ? 'left 75ms ease, bottom 75ms ease, transform 80ms ease' : 'transform 80ms ease',
  }
  if (isVertical.value) {
    base.left = '50%'
    base.bottom = clampedPos(pct)
    base.transform = `translateX(-50%) translateY(50%) scale(${scale})`
  } else {
    base.left = clampedPos(pct)
    base.top = '50%'
    base.transform = `translateX(-50%) translateY(-50%) scale(${scale})`
  }
  return base
}

function tooltipPos(pct: number) {
  const offsetH = s.value.track / 2 + 36
  const offsetV = s.value.track / 2 + 40
  if (isVertical.value) {
    return { left: `calc(50% - ${offsetV}px)`, bottom: clampedPos(pct), transform: 'translateY(50%)', transition: nd.value ? 'bottom ' + tr.value : 'none' }
  }
  return { left: clampedPos(pct), top: `calc(50% - ${offsetH}px)`, transform: 'translateX(-50%)', transition: nd.value ? 'left ' + tr.value : 'none' }
}

const displayValue = computed(() => {
  if (isRange.value) return `${val.value.lo} – ${val.value.hi}`
  return String(props.modelValue)
})

const tooltipValue = computed(() => {
  if (isRange.value && typeof dragging.value === 'number')
    return (props.modelValue as [number, number])[dragging.value]
  return props.modelValue
})

const tooltipPct = computed(() => {
  if (isRange.value && typeof dragging.value === 'number')
    return toPct((props.modelValue as [number, number])[dragging.value])
  return pctLo.value
})
</script>

<template>
  <div class="flex select-none" :class="isVertical ? 'h-full flex-col items-center' : 'flex-col gap-1'">
    <div v-if="label || showValue" class="flex items-center justify-between">
      <span v-if="label" class="text-label-large text-on-surface">{{ label }}</span>
      <span v-if="showValue" class="tabular-nums text-label-large text-on-surface-variant">{{ displayValue }}</span>
    </div>

    <div class="flex items-center" :class="isVertical ? 'flex-1 flex-col' : ''">
      <!-- Track area -->
      <div
        ref="trackEl"
        role="slider"
        tabindex="0"
        :aria-valuenow="isRange ? undefined : (modelValue as number)"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-disabled="disabled || undefined"
        :aria-orientation="orientation"
        class="relative touch-none cursor-pointer outline-none"
        :class="disabled && 'cursor-not-allowed opacity-[0.38]'"
        :style="isVertical
          ? { width: `${s.hitArea}px`, minHeight: '160px', height: '100%' }
          : { height: `${s.hitArea}px`, width: '100%' }
        "
        @pointerdown="onPointerDown"
        @keydown="onKeyDown"
      >
        <!-- Track container -->
        <div
          class="absolute"
          :style="isVertical
            ? { left: '50%', top: '0', bottom: '0', width: `${s.track}px`, transform: 'translateX(-50%)', borderRadius: `${r}px` }
            : { top: '50%', left: '0', right: '0', height: `${s.track}px`, transform: 'translateY(-50%)', borderRadius: `${r}px` }
          "
        >
          <!-- Standard: active from left/bottom -->
          <template v-if="variant === 'standard'">
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: 0, height: fillActiveSize(pctLo) }
                : { top: 0, bottom: 0, left: 0, width: fillActiveSize(pctLo) }
              ),
              borderRadius: pillRadiusOuterStart(), backgroundColor: ct.active, transition: `all ${tr}`,
            }" />
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, top: 0, height: fillInactiveSize(pctLo) }
                : { top: 0, bottom: 0, right: 0, width: fillInactiveSize(pctLo) }
              ),
              borderRadius: pillRadiusOuterEnd(), backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
          </template>

          <!-- Centered: active from center -->
          <template v-else-if="variant === 'centered'">
            <!-- Active: from center to thumb (thumb edge uses its clamped position) -->
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: centeredActiveStart(), height: centeredActiveSize() }
                : { top: 0, bottom: 0, left: centeredActiveStart(), width: centeredActiveSize() }
              ),
              borderRadius: pillRadiusSquareBoth(), backgroundColor: ct.active, transition: `all ${tr}`,
            }" />
            <!-- Inactive: above/right of thumb -->
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, top: 0, height: centeredFarInactiveSize() }
                : { top: 0, bottom: 0, right: 0, width: centeredFarInactiveSize() }
              ),
              borderRadius: pillRadiusOuterEnd(), backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
            <!-- Inactive: below/left of thumb -->
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: 0, height: centeredNearInactiveSize() }
                : { top: 0, bottom: 0, left: 0, width: centeredNearInactiveSize() }
              ),
              borderRadius: pillRadiusOuterStart(), backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
          </template>

          <!-- Range: active between thumbs (both edges use their clamped position) -->
          <template v-else-if="variant === 'range'">
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: 0, height: rangeInactiveBeforeSize() }
                : { top: 0, bottom: 0, left: 0, width: rangeInactiveBeforeSize() }
              ),
              borderRadius: pillRadiusOuterStart(), backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: rangeActiveStart(), height: rangeActiveSize() }
                : { top: 0, bottom: 0, left: rangeActiveStart(), width: rangeActiveSize() }
              ),
              borderRadius: pillRadiusSquareBoth(), backgroundColor: ct.active, transition: `all ${tr}`,
            }" />
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, top: 0, height: rangeInactiveAfterSize() }
                : { top: 0, bottom: 0, right: 0, width: rangeInactiveAfterSize() }
              ),
              borderRadius: pillRadiusOuterEnd(), backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
          </template>

          <!-- Start dot / icon -->
          <MIcon
            v-if="icon"
            :name="icon"
            :size="s.iconSize"
            class="absolute z-[1]"
            :style="{
              color: (variant === 'standard' && pctLo > 0) || (variant === 'range' && pctLo > 0) ? ct.inactive : ct.active,
              ...(isVertical
                ? { left: '50%', bottom: `${iconInset}px`, transform: 'translateX(-50%)' }
                : { top: '50%', left: `${iconInset}px`, transform: 'translateY(-50%)' }
              ),
              transition: 'color 150ms ease',
            }"
          />
          <div
            v-else-if="!stops"
            class="absolute rounded-full"
            :style="{
              width: `${s.dot}px`, height: `${s.dot}px`,
              backgroundColor: ct.active,
              opacity: startDotHidden ? 0 : 1,
              ...(isVertical
                ? { left: '50%', bottom: `${s.dotInset}px`, transform: 'translateX(-50%)' }
                : { top: '50%', left: `${s.dotInset}px`, transform: 'translateY(-50%)' }
              ),
              transition: 'opacity 150ms ease',
            }"
          />
          <!-- End dot -->
          <div
            v-if="!stops"
            class="absolute rounded-full"
            :style="{
              width: `${s.dot}px`, height: `${s.dot}px`,
              backgroundColor: ct.active,
              opacity: endDotHidden ? 0 : 1,
              ...(isVertical
                ? { left: '50%', top: `${s.dotInset}px`, transform: 'translateX(-50%)' }
                : { top: '50%', right: `${s.dotInset}px`, transform: 'translateY(-50%)' }
              ),
              transition: 'opacity 150ms ease',
            }"
          />

          <!-- Stops (skip first and last to avoid duplicating end dots) -->
          <template v-if="stops">
            <div
              v-for="(pos, i) in stopPositions"
              :key="i"
              class="absolute rounded-full"
              :style="{
                width: `${s.dot}px`, height: `${s.dot}px`,
                backgroundColor: pos <= pctLo ? ct.inactive : ct.active,
                opacity: Math.abs(pos - pctLo) < 0.01 || (isRange && Math.abs(pos - pctHi) < 0.01) ? 0 : 1,
                ...(isVertical
                  ? { left: '50%', bottom: `${pos}%`, transform: 'translateX(-50%) translateY(50%)' }
                  : { top: '50%', left: `${pos}%`, transform: 'translateX(-50%) translateY(-50%)' }
                ),
              }"
            />
          </template>
        </div>

        <!-- Thumb(s) -->
        <template v-if="thumbIcon">
          <MIcon :name="thumbIcon" :size="s.thumbIconSize" class="pointer-events-none" :style="thumbIconPos(pctLo)" />
          <MIcon v-if="isRange" :name="thumbIcon" :size="s.thumbIconSize" class="pointer-events-none" :style="thumbIconPos(pctHi)" />
        </template>
        <template v-else>
          <div class="pointer-events-none" :style="thumbPos(pctLo)" />
          <div v-if="isRange" class="pointer-events-none" :style="thumbPos(pctHi)" />
        </template>

        <!-- Tooltip -->
        <Transition
          enter-active-class="transition-opacity duration-100"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-75"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showTooltip && dragging !== false"
            class="pointer-events-none absolute z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-inverse-surface px-2 text-label-small tabular-nums text-inverse-on-surface"
            :style="tooltipPos(tooltipPct)"
          >
            {{ tooltipValue }}
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
