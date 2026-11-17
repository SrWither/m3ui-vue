<script setup lang="ts">
/**
 * Compares two images (or any two pieces of content) stacked on top of each other, split by a handle the user
 * drags: a renovation, a photo edit, a redesign. Clicking anywhere moves the split there; the handle is a slider
 * for the keyboard (arrows, Page Up/Down, Home/End).
 *
 * The root has no size of its own beyond the images: give it a width (and an `aspectRatio`, or a height through
 * `class`) to make it a fixed box.
 *
 * @slot before Content of the "before" side, replacing the `before` image
 * @slot after Content of the "after" side, replacing the `after` image
 * @slot handle Replaces the round grip in the middle of the divider. Slot props: `{ position, dragging }`
 * @event update:modelValue Emitted while dragging or stepping with the keyboard — powers v-model (0–100)
 * @event change Emitted once when a drag or a key press ends, with the final position
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Split position as a percentage (v-model). Without v-model the component keeps its own, starting here */
    modelValue?: number
    /** Image URL of the "before" side (left, or top when vertical) */
    before?: string
    /** Image URL of the "after" side (right, or bottom when vertical) */
    after?: string
    /** Alt text of the "before" image */
    beforeAlt?: string
    /** Alt text of the "after" image */
    afterAlt?: string
    /** Label chip on the "before" side. Defaults to the locale's "Before"; pass an empty string to hide it */
    beforeLabel?: string
    /** Label chip on the "after" side. Defaults to the locale's "After"; pass an empty string to hide it */
    afterLabel?: string
    /** Direction the divider moves in */
    orientation?: 'horizontal' | 'vertical'
    /** Moves the split with the pointer on hover, without pressing (mouse only; touch still drags) */
    hover?: boolean
    /** CSS aspect-ratio of the box, e.g. "16 / 9". Unset sizes to the "after" content */
    aspectRatio?: string
    /** Hides the round grip, leaving only the divider line */
    hideHandle?: boolean
    /** Percentage moved by an arrow key (Page Up/Down move 10×) */
    step?: number
    /** Disables dragging and the keyboard */
    disabled?: boolean
  }>(),
  {
    modelValue: undefined,
    orientation: 'horizontal',
    hover: false,
    hideHandle: false,
    step: 1,
    disabled: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [number]; change: [number] }>()

const rootEl = ref<HTMLElement | null>(null)
const inner = ref(clamp(props.modelValue ?? 50))
watch(() => props.modelValue, (v) => { if (v !== undefined) inner.value = clamp(v) })
const position = computed(() => inner.value)
const dragging = ref(false)
const vertical = computed(() => props.orientation === 'vertical')

const beforeText = computed(() => props.beforeLabel ?? locale.compareBefore)
const afterText = computed(() => props.afterLabel ?? locale.compareAfter)

function clamp(v: number) {
  return Math.min(100, Math.max(0, v))
}

function set(v: number) {
  const next = Math.round(clamp(v) * 100) / 100
  if (next === inner.value) return
  inner.value = next
  emit('update:modelValue', next)
}

function fromPointer(e: PointerEvent) {
  const r = rootEl.value?.getBoundingClientRect()
  if (!r) return
  const p = vertical.value
    ? ((e.clientY - r.top) / (r.height || 1)) * 100
    : ((e.clientX - r.left) / (r.width || 1)) * 100
  set(p)
}

let activePointer: number | null = null

function onPointerDown(e: PointerEvent) {
  if (props.disabled || e.button > 0) return
  activePointer = e.pointerId
  dragging.value = true
  try { rootEl.value?.setPointerCapture(e.pointerId) } catch { /* not capturable (synthetic) */ }
  fromPointer(e)
  // Keep focus on the handle so the keyboard continues from where the pointer left it
  handleEl.value?.focus({ preventScroll: true })
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (props.disabled) return
  if (dragging.value && e.pointerId === activePointer) fromPointer(e)
  else if (props.hover && !dragging.value && e.pointerType === 'mouse') fromPointer(e)
}

function endDrag(e: PointerEvent) {
  if (e.pointerId !== activePointer) return
  activePointer = null
  dragging.value = false
  emit('change', inner.value)
}

const handleEl = ref<HTMLElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  const big = props.step * 10
  const back = vertical.value ? 'ArrowUp' : 'ArrowLeft'
  const fwd = vertical.value ? 'ArrowDown' : 'ArrowRight'
  let next: number | null = null
  if (e.key === back || (!vertical.value && e.key === 'ArrowDown') || (vertical.value && e.key === 'ArrowLeft')) next = inner.value - props.step
  else if (e.key === fwd || (!vertical.value && e.key === 'ArrowUp') || (vertical.value && e.key === 'ArrowRight')) next = inner.value + props.step
  else if (e.key === 'PageDown') next = inner.value - big
  else if (e.key === 'PageUp') next = inner.value + big
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = 100
  if (next === null) return
  e.preventDefault()
  set(next)
  emit('change', inner.value)
}

onBeforeUnmount(() => { activePointer = null })

// The "before" layer is clipped to the part left of (above) the divider
const beforeClip = computed(() =>
  vertical.value ? `inset(0 0 ${100 - position.value}% 0)` : `inset(0 ${100 - position.value}% 0 0)`,
)
</script>

<template>
  <div
    ref="rootEl"
    class="m3-before-after overflow-hidden select-none"
    :class="[
      vertical ? 'touch-pan-x' : 'touch-pan-y',
      disabled ? 'cursor-default' : vertical ? 'cursor-row-resize' : 'cursor-col-resize',
    ]"
    :style="aspectRatio ? { aspectRatio } : undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @dragstart.prevent
  >
    <!-- After: the full layer underneath, which also sizes the box when no aspect ratio is given -->
    <div class="m3-before-after__layer" :class="aspectRatio ? 'absolute inset-0' : 'relative'">
      <slot name="after">
        <img v-if="after" :src="after" :alt="afterAlt ?? afterText" draggable="false" class="block h-full w-full object-cover" />
      </slot>
    </div>

    <!-- Before: same box on top, clipped at the divider -->
    <div class="absolute inset-0" :style="{ clipPath: beforeClip }">
      <slot name="before">
        <img v-if="before" :src="before" :alt="beforeAlt ?? beforeText" draggable="false" class="block h-full w-full object-cover" />
      </slot>
    </div>

    <span
      v-if="beforeText"
      class="pointer-events-none absolute rounded-full bg-inverse-surface/70 px-3 py-1 text-label-large text-inverse-on-surface backdrop-blur-sm transition-opacity duration-150"
      :class="vertical ? 'left-1/2 top-3 -translate-x-1/2' : 'left-3 top-3'"
      :style="{ opacity: position < 12 ? 0 : 1 }"
    >{{ beforeText }}</span>
    <span
      v-if="afterText"
      class="pointer-events-none absolute rounded-full bg-inverse-surface/70 px-3 py-1 text-label-large text-inverse-on-surface backdrop-blur-sm transition-opacity duration-150"
      :class="vertical ? 'bottom-3 left-1/2 -translate-x-1/2' : 'right-3 top-3'"
      :style="{ opacity: position > 88 ? 0 : 1 }"
    >{{ afterText }}</span>

    <!-- Divider + handle -->
    <div
      class="pointer-events-none absolute"
      :class="vertical ? 'inset-x-0 h-0' : 'inset-y-0 w-0'"
      :style="vertical ? { top: `${position}%` } : { left: `${position}%` }"
    >
      <div
        class="m3-before-after__line absolute shadow-elevation-1"
        :class="vertical ? 'inset-x-0 -top-px h-0.5' : 'inset-y-0 -left-px w-0.5'"
      />
      <div
        ref="handleEl"
        role="slider"
        :tabindex="disabled ? undefined : 0"
        :aria-label="locale.compareSlider"
        :aria-orientation="orientation"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(position)"
        :aria-disabled="disabled || undefined"
        class="m3-before-after__handle pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 outline-none"
        :class="vertical ? 'left-1/2 top-0' : 'left-0 top-1/2'"
        @keydown="onKeydown"
      >
        <slot name="handle" :position="position" :dragging="dragging">
          <div
            v-if="!hideHandle"
            class="m3-before-after__grip flex h-10 w-10 items-center justify-center rounded-full shadow-elevation-2 transition-transform duration-150"
            :class="[dragging ? 'scale-110' : '', vertical ? 'rotate-90' : '']"
          >
            <MIcon name="code" :size="24" />
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<style>
@layer base {
  .m3-before-after {
    position: relative;
  }
}
.m3-before-after__handle:focus-visible > * {
  outline: 3px solid var(--color-secondary);
  outline-offset: 2px;
}
/* White in both themes: the divider sits on photos, where a theme surface color can vanish */
.m3-before-after__line {
  background: #fff;
}
.m3-before-after__grip {
  background: #fff;
  color: #1d1b20;
}
.m3-before-after__layer > img {
  pointer-events: none;
}
</style>
