<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    /** Whether the toggle button is checked/selected — v-model. */
    checked: boolean
    variant?: 'filled' | 'tonal' | 'outlined' | 'elevated'
    disabled?: boolean
    icon?: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    variant: 'filled',
    disabled: false,
    size: 'sm',
  },
)

const emit = defineEmits<{ 'update:checked': [boolean] }>()

// Same 5-tier expressive sizing as MButton — ToggleButton.kt reuses the exact same
// Button{XSmall,Small,Medium,Large,XLarge}Tokens (ContainerHeight/IconSize/IconLabelSpace all
// verbatim identical), confirmed against the real source rather than assumed. Padding is
// deliberately reused from MButton's own (already-audited) px values rather than porting
// ToggleButtonDefaults' own separate ToggleButtonStartPadding/EndPadding constants, which
// resolve to the same pixel values at every tier this library implements.
const sizeMap = {
  xs: { h: 'h-8', text: 'text-label-large', icon: 20, gap: 'gap-1', px: 'px-3', checkedRadius: 12, pressedRadius: 8 },
  sm: { h: 'h-10', text: 'text-label-large', icon: 20, gap: 'gap-2', px: 'px-4', checkedRadius: 12, pressedRadius: 6 },
  md: { h: 'h-14', text: 'text-title-medium', icon: 24, gap: 'gap-2', px: 'px-6', checkedRadius: 16, pressedRadius: 12 },
  lg: { h: 'h-24', text: 'text-headline-small', icon: 32, gap: 'gap-3', px: 'px-12', checkedRadius: 28, pressedRadius: 16 },
  xl: { h: 'h-[136px]', text: 'text-headline-large', icon: 40, gap: 'gap-4', px: 'px-16', checkedRadius: 28, pressedRadius: 16 },
}

const s = computed(() => sizeMap[props.size] ?? sizeMap.sm)
const sizeClasses = computed(() => `${s.value.h} ${s.value.text} ${s.value.gap} ${s.value.px}`)

const base =
  'relative inline-flex items-center justify-center font-medium ' +
  'whitespace-nowrap overflow-hidden transition-[box-shadow,background-color,color] duration-150 select-none cursor-pointer ' +
  'disabled:cursor-not-allowed disabled:shadow-none disabled:text-on-surface/38 ' +
  "before:content-[''] before:pointer-events-none before:absolute before:inset-0 " +
  'before:bg-current before:opacity-0 before:transition-opacity before:duration-150 ' +
  'enabled:hover:before:opacity-[0.08] enabled:active:before:opacity-[0.12]'

// FilledButtonTokens/TonalButtonTokens/ElevatedButtonTokens/OutlinedButtonTokens: unchecked
// containers are neutral (SurfaceContainer / SecondaryContainer / SurfaceContainerLow /
// transparent-with-border), NOT the same tone the checked state uses — despite the class doc
// comment loosely saying it "switches between primary and tonal colors", the actual unchecked
// token for the filled variant is SurfaceContainer, not a tonal color at all. Checked outlined
// is the odd one out: it fills solid with InverseSurface/InverseOnSurface, not Primary.
const containerClasses = computed(() => {
  switch (props.variant) {
    case 'filled':
      return props.checked
        ? 'bg-primary text-on-primary'
        : 'bg-surface-container text-on-surface-variant'
    case 'tonal':
      return props.checked
        ? 'bg-secondary text-on-secondary'
        : 'bg-secondary-container text-on-secondary-container'
    case 'elevated':
      return props.checked
        ? 'bg-primary text-on-primary shadow-elevation-1 enabled:hover:shadow-elevation-2'
        : 'bg-surface-container-low text-primary shadow-elevation-1 enabled:hover:shadow-elevation-2'
    case 'outlined':
      return props.checked
        ? 'bg-inverse-surface text-inverse-on-surface'
        : 'border border-outline-variant text-on-surface-variant'
    default:
      return ''
  }
})

// DisabledContainerOpacity = 0.1 across every variant's tokens. OutlinedButtonTokens has no
// container color at all when unchecked (border-only), so its disabled treatment dims the
// border instead — same distinction MButton's own outlined variant already makes.
const disabledContainerClasses = computed(() => {
  if (props.variant === 'outlined' && !props.checked) return 'disabled:border-outline-variant/10'
  return 'disabled:bg-on-surface/10'
})

const rootEl = ref<HTMLElement | null>(null)
const pressed = ref(false)

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return
  pressed.value = true
  createRipple(e)
}
function onPointerUp() { pressed.value = false }

function createRipple(event: PointerEvent) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const el = document.createElement('span')
  el.className = 'm3-ripple'
  el.style.cssText = `width:${d}px;height:${d}px;top:${event.clientY - rect.top - d / 2}px;left:${event.clientX - rect.left - d / 2}px`
  button.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

function toggle() {
  if (props.disabled) return
  emit('update:checked', !props.checked)
}

// Real per-frame spring, not a CSS transition — matches this library's established convention
// (MShape, MProgressBar, MTabs, etc.) for anything the real M3 source drives with an actual
// spring. ToggleButton.kt isn't gated behind @ExperimentalMaterial3ExpressiveApi (it's a stable,
// non-experimental composable despite belonging to the Expressive redesign), so its shape-morph
// spec is MotionSchemeKeyTokens.FastSpatial resolved from the *Standard* scheme: dampingRatio
// 0.9, stiffness 1400. damping = 2 × dampingRatio × √stiffness ≈ 67.5.
const STIFFNESS = 1400
const DAMPING = 2 * 0.9 * Math.sqrt(STIFFNESS)

const targetRadius = computed(() => {
  if (pressed.value) return s.value.pressedRadius
  return props.checked ? s.value.checkedRadius : 9999
})

let currentRadius = targetRadius.value
let velocity = 0
let rafId = 0

function applyRadius() {
  if (rootEl.value) rootEl.value.style.borderRadius = `${currentRadius}px`
}

function animate() {
  if (rafId) return
  let last = performance.now()
  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const target = targetRadius.value
    const force = STIFFNESS * (target - currentRadius)
    const friction = DAMPING * velocity
    velocity += (force - friction) * dt
    currentRadius += velocity * dt
    if (Math.abs(target - currentRadius) < 0.1 && Math.abs(velocity) < 0.1) {
      currentRadius = target
      velocity = 0
      applyRadius()
      rafId = 0
      return
    }
    applyRadius()
    rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}

watch(targetRadius, animate)
onMounted(applyRadius)
onUnmounted(() => cancelAnimationFrame(rafId))
</script>

<template>
  <button
    ref="rootEl"
    type="button"
    role="button"
    :aria-pressed="checked"
    :disabled="disabled"
    :class="[base, sizeClasses, containerClasses, disabledContainerClasses]"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @pointercancel="onPointerUp"
    @click="toggle"
  >
    <MIcon v-if="icon" :name="icon" :size="s.icon" />
    <slot />
  </button>
</template>
