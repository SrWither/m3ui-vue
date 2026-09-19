<script setup lang="ts">
import { computed, ref } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    label?: string
    color?: 'primary' | 'secondary' | 'tertiary' | 'error'
    /**
     * M3 officially has two Switch variants: with a check icon inside the thumb (the
     * `thumbContent` slot filled), and without (Compose's actual default — `thumbContent`
     * defaults to `null`). Defaults to `true` here to keep this component's existing look;
     * pass `false` for the plain/no-icon variant.
     */
    icon?: boolean
  }>(),
  { disabled: false, color: 'primary', icon: true },
)

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

// Same 4 named colors as MRadio/MCheckbox's color prop.
const trackClasses: Record<string, string> = {
  primary: 'border-primary bg-primary',
  secondary: 'border-secondary bg-secondary',
  tertiary: 'border-tertiary bg-tertiary',
  error: 'border-error bg-error',
}
// Selected handle: resting = on-{color} (OnPrimary etc.), hover/focus/press = {color}-container
// (SwitchTokens.Selected{Hover,Focus,Pressed}HandleColor = PrimaryContainer, NOT OnPrimary —
// the handle itself recolors on interaction, distinct from the track staying put).
const thumbClasses: Record<string, string> = {
  primary: 'bg-on-primary group-hover:bg-primary-container group-active:bg-primary-container peer-focus-visible:bg-primary-container',
  secondary: 'bg-on-secondary group-hover:bg-secondary-container group-active:bg-secondary-container peer-focus-visible:bg-secondary-container',
  tertiary: 'bg-on-tertiary group-hover:bg-tertiary-container group-active:bg-tertiary-container peer-focus-visible:bg-tertiary-container',
  error: 'bg-on-error group-hover:bg-error-container group-active:bg-error-container peer-focus-visible:bg-error-container',
}
// Unselected handle: resting = outline, hover/focus/press = on-surface-variant — a fixed
// color regardless of the `color` prop, since the unselected state never carries it.
const unselectedThumbClasses =
  'bg-outline group-hover:bg-on-surface-variant group-active:bg-on-surface-variant peer-focus-visible:bg-on-surface-variant'

// Icon-on-handle color is a DIFFERENT role from the handle's own fill (SelectedIconColor =
// OnPrimaryContainer, not OnPrimary) — it needs to read against whatever the handle is
// currently showing (on-primary at rest, primary-container on hover/press), and
// on-primary-container works against both.
const iconClasses: Record<string, string> = {
  primary: 'text-on-primary-container',
  secondary: 'text-on-secondary-container',
  tertiary: 'text-on-tertiary-container',
  error: 'text-on-error-container',
}

// State layer + focus ring tint, same idea as the handle color map above but for the
// larger 40px circle that trails the thumb (see stateLayerStyle below) rather than the
// handle itself — reuses the selected color's own base tone (bg-primary etc.), not the
// container variant, matching StateLayerShape's plain-color state-layer convention used
// for MCheckbox/MChip/MRadio elsewhere in this library.
const stateLayerBg: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
}

// Real handle grows from 24dp (selected) / 16dp (unselected) to a shared 28dp while
// pressed (SwitchTokens.Pressed{Handle}Width/Height) — via `scale()` on the same fixed-size
// box the 16dp unselected state already uses `scale(0.667)` for, not by changing width/
// height directly (which would fight the JS-computed inline `transform` below on
// specificity, the same class-vs-inline-style trap already hit once this session).
// Needs real pointerdown/up tracking (not a CSS `active:` utility) because that transform
// is computed in JS, not a plain class, so CSS pseudo-classes can't reach into it.
const isPressed = ref(false)
function onPointerDown() {
  if (!props.disabled) isPressed.value = true
}
function onPointerEnd() {
  isPressed.value = false
}

const thumbScale = computed(() => {
  if (isPressed.value) return 28 / 24
  return props.modelValue ? 1 : 16 / 24
})

// All thumb transforms live here so each direction can use its own easing curve.
// translateY(-50%) vertically centres the thumb in the 32px track.
// ON  → spring cubic-bezier: overshoots ~2px then settles → satisfying "click"
// OFF → M3 standard decelerate: clean snap back, no undershoot
const thumbStyle = computed(() => ({
  transform: `translateY(-50%) translateX(${props.modelValue ? 18 : 0}px) scale(${thumbScale.value})`,
  transition: props.modelValue
    ? 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 280ms ease'
    : 'transform 240ms cubic-bezier(0.2, 0, 0, 1),          background-color 240ms ease',
}))

// StateLayerSize/StateLayerShape = 40dp circle, CornerFull — positioned to trail the
// thumb's own translateX so it's centered on the thumb at both ends of the track, not a
// static overlay covering the whole switch the way MCheckbox/MRadio's does (those don't
// have a moving part). Base offset -4px accounts for the 40px circle being 8px taller/wider
// than the 32px track and 24px thumb it's centered on.
const stateLayerStyle = computed(() => ({
  transform: `translateX(${props.modelValue ? 18 : 0}px)`,
  transition: props.modelValue
    ? 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)'
    : 'transform 240ms cubic-bezier(0.2, 0, 0, 1)',
}))
</script>

<template>
  <label
    class="group inline-flex items-center gap-3 select-none"
    :class="disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer'"
    @pointerdown="onPointerDown"
    @pointerup="onPointerEnd"
    @pointerleave="onPointerEnd"
    @pointercancel="onPointerEnd"
  >
    <span class="relative -my-2 inline-flex h-12 shrink-0 items-center">
      <span
        class="relative inline-flex h-8 w-[52px] items-center rounded-full border-2 transition-colors duration-200"
        :class="modelValue ? trackClasses[color] : 'border-outline bg-surface-container-highest'"
      >
        <input
          type="checkbox"
          class="peer sr-only"
          :checked="modelValue"
          :disabled="disabled"
          @change="emit('update:modelValue', !modelValue)"
        />

        <!-- Hover/press/focus state layer + focus ring, both tracking the thumb's position (see stateLayerStyle doc above) -->
        <span
          v-if="!disabled"
          class="pointer-events-none absolute top-1/2 -left-1 h-10 w-10 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-[0.08] group-active:opacity-[0.12] peer-focus-visible:opacity-[0.08]"
          :class="modelValue ? stateLayerBg[color] : 'bg-on-surface-variant'"
          :style="stateLayerStyle"
        />
        <span
          v-if="!disabled"
          class="pointer-events-none absolute top-1/2 -left-1 h-10 w-10 -translate-y-1/2 rounded-full ring-0 ring-secondary transition-[box-shadow] duration-150 peer-focus-visible:ring-2"
          :style="stateLayerStyle"
        />

        <!-- Thumb: position + size animated via inline style (allows per-direction easing) -->
        <span
          class="absolute left-1 top-1/2 flex h-6 w-6 items-center justify-center rounded-full will-change-transform"
          :class="modelValue ? [thumbClasses[color], 'shadow-sm'] : unselectedThumbClasses"
          :style="thumbStyle"
        >
          <Transition
            enter-active-class="transition-opacity duration-150 delay-[120ms]"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-75"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <MIcon v-if="modelValue && icon" name="check" :size="14" :class="iconClasses[color]" />
          </Transition>
        </span>
      </span>
    </span>
    <span v-if="label" class="text-body-large text-on-surface">{{ label }}</span>
  </label>
</template>
