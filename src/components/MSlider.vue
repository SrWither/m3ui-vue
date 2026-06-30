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

const sizeMap = {
  xs: { track: 16, thumbW: 4, thumbH: 28, dot: 4, gap: 6, hitArea: 38, radius: 6, iconSize: 14 },
  sm: { track: 28, thumbW: 4, thumbH: 36, dot: 5, gap: 6, hitArea: 46, radius: 8, iconSize: 16 },
  md: { track: 54, thumbW: 5, thumbH: 56, dot: 5, gap: 6, hitArea: 66, radius: 12, iconSize: 20 },
  lg: { track: 72, thumbW: 5, thumbH: 72, dot: 6, gap: 8, hitArea: 82, radius: 14, iconSize: 24 },
  xl: { track: 96, thumbW: 6, thumbH: 90, dot: 7, gap: 8, hitArea: 100, radius: 18, iconSize: 28 },
}

const s = computed(() => sizeMap[props.size] ?? sizeMap.xs)

const ct = computed(() => {
  const map: Record<string, { active: string; inactive: string }> = {
    primary: { active: 'var(--color-primary)', inactive: 'var(--color-primary-container)' },
    secondary: { active: 'var(--color-secondary)', inactive: 'var(--color-secondary-container)' },
    tertiary: { active: 'var(--color-tertiary)', inactive: 'var(--color-tertiary-container)' },
    error: { active: 'var(--color-error)', inactive: 'var(--color-error-container)' },
  }
  return map[props.color] ?? map.primary!
})

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

const r = computed(() => s.value.radius)
const nd = computed(() => dragging.value === false)
const tr = computed(() => nd.value ? '75ms ease' : '0s')

function thumbPos(pct: number) {
  const tw = isVertical.value ? s.value.thumbH : s.value.thumbW
  const th = isVertical.value ? s.value.thumbW : s.value.thumbH
  const br = Math.min(tw, th) / 2
  const base: Record<string, string> = {
    position: 'absolute',
    width: `${tw}px`,
    height: `${th}px`,
    borderRadius: `${br}px`,
    backgroundColor: ct.value.active,
    zIndex: '2',
    transition: nd.value ? 'left 75ms ease, bottom 75ms ease, transform 80ms ease' : 'transform 80ms ease',
  }
  if (isVertical.value) {
    base.left = '50%'
    base.bottom = `${pct}%`
    base.transform = `translateX(-50%) translateY(50%) scaleX(${dragging.value !== false ? 1.08 : 1})`
  } else {
    base.left = `${pct}%`
    base.top = '50%'
    base.transform = `translateX(-50%) translateY(-50%) scaleY(${dragging.value !== false ? 1.08 : 1})`
  }
  return base
}

function tooltipPos(pct: number) {
  const offsetH = s.value.track / 2 + 36
  const offsetV = s.value.track / 2 + 40
  if (isVertical.value) {
    return { left: `calc(50% - ${offsetV}px)`, bottom: `${pct}%`, transform: 'translateY(50%)', transition: nd.value ? 'bottom ' + tr.value : 'none' }
  }
  return { left: `${pct}%`, top: `calc(50% - ${offsetH}px)`, transform: 'translateX(-50%)', transition: nd.value ? 'left ' + tr.value : 'none' }
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
                ? { left: 0, right: 0, bottom: 0, height: `calc(${pctLo}% - ${s.gap}px)` }
                : { top: 0, bottom: 0, left: 0, width: `calc(${pctLo}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.active, transition: `all ${tr}`,
            }" />
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, top: 0, height: `calc(${100 - pctLo}% - ${s.gap}px)` }
                : { top: 0, bottom: 0, right: 0, width: `calc(${100 - pctLo}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
          </template>

          <!-- Centered: active from center -->
          <template v-else-if="variant === 'centered'">
            <!-- Active: from center to thumb (with gap from thumb) -->
            <div class="absolute" :style="{
              ...(isVertical
                ? pctLo >= centerPct
                  ? { left: 0, right: 0, bottom: `${centerPct}%`, height: `calc(${pctLo - centerPct}% - ${s.gap}px)` }
                  : { left: 0, right: 0, bottom: `calc(${pctLo}% + ${s.gap}px)`, height: `calc(${centerPct - pctLo}% - ${s.gap}px)` }
                : pctLo >= centerPct
                  ? { top: 0, bottom: 0, left: `${centerPct}%`, width: `calc(${pctLo - centerPct}% - ${s.gap}px)` }
                  : { top: 0, bottom: 0, left: `calc(${pctLo}% + ${s.gap}px)`, width: `calc(${centerPct - pctLo}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.active, transition: `all ${tr}`,
            }" />
            <!-- Inactive: above/right of thumb -->
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, top: 0, height: `calc(${100 - Math.max(pctLo, centerPct)}% - ${s.gap}px)` }
                : { top: 0, bottom: 0, right: 0, width: `calc(${100 - Math.max(pctLo, centerPct)}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
            <!-- Inactive: below/left of thumb -->
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: 0, height: `calc(${Math.min(pctLo, centerPct)}% - ${s.gap}px)` }
                : { top: 0, bottom: 0, left: 0, width: `calc(${Math.min(pctLo, centerPct)}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
          </template>

          <!-- Range: active between thumbs -->
          <template v-else-if="variant === 'range'">
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: 0, height: `calc(${pctLo}% - ${s.gap}px)` }
                : { top: 0, bottom: 0, left: 0, width: `calc(${pctLo}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.inactive, transition: `all ${tr}`,
            }" />
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, bottom: `calc(${pctLo}% + ${s.gap}px)`, height: `calc(${pctHi - pctLo}% - ${s.gap * 2}px)` }
                : { top: 0, bottom: 0, left: `calc(${pctLo}% + ${s.gap}px)`, width: `calc(${pctHi - pctLo}% - ${s.gap * 2}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.active, transition: `all ${tr}`,
            }" />
            <div class="absolute" :style="{
              ...(isVertical
                ? { left: 0, right: 0, top: 0, height: `calc(${100 - pctHi}% - ${s.gap}px)` }
                : { top: 0, bottom: 0, right: 0, width: `calc(${100 - pctHi}% - ${s.gap}px)` }
              ),
              borderRadius: `${r}px`, backgroundColor: ct.inactive, transition: `all ${tr}`,
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
                ? { left: '50%', bottom: `${s.radius}px`, transform: 'translateX(-50%)' }
                : { top: '50%', left: `${s.radius}px`, transform: 'translateY(-50%)' }
              ),
              transition: 'color 150ms ease',
            }"
          />
          <div
            v-else-if="!stops"
            class="absolute rounded-full"
            :style="{
              width: `${s.dot}px`, height: `${s.dot}px`,
              backgroundColor: (variant === 'standard' && pctLo > 0) || (variant === 'range' && pctLo > 0) ? ct.inactive : ct.active,
              ...(isVertical
                ? { left: '50%', bottom: `${s.radius}px`, transform: 'translateX(-50%)' }
                : { top: '50%', left: `${s.radius}px`, transform: 'translateY(-50%)' }
              ),
              transition: 'background-color 150ms ease',
            }"
          />
          <!-- End dot -->
          <div
            v-if="!stops"
            class="absolute rounded-full"
            :style="{
              width: `${s.dot}px`, height: `${s.dot}px`,
              backgroundColor: (variant === 'standard' && pctLo >= 100) || (variant === 'range' && pctHi >= 100) ? ct.active : ct.inactive,
              ...(isVertical
                ? { left: '50%', top: `${s.radius}px`, transform: 'translateX(-50%)' }
                : { top: '50%', right: `${s.radius}px`, transform: 'translateY(-50%)' }
              ),
              transition: 'background-color 150ms ease',
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
                ...(isVertical
                  ? { left: '50%', bottom: `${pos}%`, transform: 'translateX(-50%) translateY(50%)' }
                  : { top: '50%', left: `${pos}%`, transform: 'translateX(-50%) translateY(-50%)' }
                ),
              }"
            />
          </template>
        </div>

        <!-- Thumb(s) -->
        <div class="pointer-events-none" :style="thumbPos(pctLo)" />
        <div v-if="isRange" class="pointer-events-none" :style="thumbPos(pctHi)" />

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
