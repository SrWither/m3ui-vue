<script setup lang="ts">
/**
 * A guided, step-by-step walkthrough that highlights a page element per step with an auto-positioned tooltip
 * and a dimming scrim.
 *
 * With `interactive` the page stays usable: no scrim, the target gets a ring drawn over it (the element itself is
 * left alone) and the ring and the tooltip follow it every frame, for targets that move (a canvas being panned, a
 * panel opening). With `v-model:step` the page drives the steps itself (a tutorial that moves on when the user has
 * done what a step asks, or skips the ones already done), and the `content`/`actions` slots replace the text and
 * the buttons.
 *
 * @slot content Replaces a step's title and text. Scope: `{ step, index }`
 * @slot indicator Replaces the "2 / 5" over the step. Scope: `{ index, count }`
 * @slot progress Replaces the progress dots. Scope: `{ index, count }`
 * @slot actions Replaces the Previous/Next buttons. Scope: `{ step, index, isFirst, isLast, next, prev, close }`
 * @event update:modelValue Emitted when the tour opens or closes (Escape-less — closed via the X button,
 *   clicking the scrim, or finishing) — powers v-model
 * @event update:step Emitted when the current step changes (v-model:step)
 * @event finish Emitted when the user completes the last step (clicks the finish button)
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

export interface TourStep {
  /**
   * The element to highlight and point at: a CSS selector, or a function returning the element (looked up again
   * on every frame in `interactive` mode, so it can change). None, or none found: the tooltip sits in the viewport,
   * on its `placement` side (centered without one)
   */
  target?: string | (() => Element | null | undefined)
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const props = defineProps<{
  /** Show/hide the tour (v-model) */
  modelValue: boolean
  /** Ordered list of steps; see `TourStep` */
  steps: TourStep[]
  /** Label for the Previous button (defaults to the locale string, 'Previous') */
  prevLabel?: string
  /** Label for the Next button (defaults to the locale string, 'Next') */
  nextLabel?: string
  /** Label for the final step's button (defaults to the locale string, 'Finish') */
  finishLabel?: string
  /** The current step's index (v-model:step); without it the tour keeps its own */
  step?: number
  /**
   * Leaves the page usable while the tour is open: no scrim, a ring drawn over the target instead of lifting the
   * target itself, tooltip and ring following the target as it moves, no scrolling to it
   */
  interactive?: boolean
}>()

const locale = useLocale()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'update:step': [number]
  finish: []
}>()

const ownStep = ref(0)
const currentStep = computed({
  get: () => props.step ?? ownStep.value,
  set: (v: number) => {
    ownStep.value = v
    emit('update:step', v)
  },
})
const tooltipEl = ref<HTMLElement | null>(null)
/** The ring over the target in interactive mode (fixed, viewport coordinates) */
const ringStyle = ref<Record<string, string> | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
const arrowStyle = ref<Record<string, string>>({})
const placement = ref<'top' | 'bottom' | 'left' | 'right'>('bottom')

const step = computed(() => props.steps[currentStep.value])
const isFirst = computed(() => currentStep.value === 0)
const isLast = computed(() => currentStep.value === props.steps.length - 1)

let scrollRaf = 0
let followRaf = 0

function targetOf(st: TourStep | undefined): HTMLElement | null {
  const t = st?.target
  if (!t) return null
  const el = typeof t === 'string' ? document.querySelector(t) : t()
  // Not laid out (display: none, or a closed panel's leftover): as if there were none
  return el && el.getClientRects().length ? (el as HTMLElement) : null
}
const same = (a: Record<string, string> | null, b: Record<string, string> | null) => JSON.stringify(a) === JSON.stringify(b)
function follow() {
  positionTooltip()
  followRaf = requestAnimationFrame(follow)
}
function onScrollOrResize() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(positionTooltip)
}

function startListeners() {
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
  if (props.interactive) {
    cancelAnimationFrame(followRaf)
    followRaf = requestAnimationFrame(follow)
  }
}

function stopListeners() {
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
  cancelAnimationFrame(scrollRaf)
  cancelAnimationFrame(followRaf)
  ringStyle.value = null
}

function positionTooltip() {
  if (!step.value) return
  const el = targetOf(step.value)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const edge = 8
  const tooltipW = Math.min(320, vw - edge * 2)
  // Its real height once it's there (a slot can make it any height)
  const approxH = tooltipEl.value?.offsetHeight || 220

  if (!el) {
    // Nothing to point at: on its side of the viewport, or in the middle
    const side = step.value.placement
    const s: Record<string, string> = { width: `${tooltipW}px` }
    if (side === 'left' || side === 'right') {
      s[side] = `${edge * 2}px`
      s.top = '50%'
      s.transform = 'translateY(-50%)'
    } else {
      s.left = `${(vw - tooltipW) / 2}px`
      if (side === 'top') s.top = `${edge * 2}px`
      else if (side === 'bottom') s.bottom = `${edge * 2}px`
      else {
        s.top = '50%'
        s.transform = 'translateY(-50%)'
      }
    }
    if (!same(tooltipStyle.value, s)) tooltipStyle.value = s
    if (!same(arrowStyle.value, { display: 'none' })) arrowStyle.value = { display: 'none' }
    if (ringStyle.value) ringStyle.value = null
    return
  }

  const rect = el.getBoundingClientRect()
  const pad = 12
  const arrowSize = 8
  if (props.interactive) {
    const r = { left: `${rect.left - 4}px`, top: `${rect.top - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px` }
    if (!same(ringStyle.value, r)) ringStyle.value = r
  }

  let p = step.value.placement ?? 'bottom'

  // Auto-flip if not enough space on the preferred side
  if (p === 'bottom' && vh - rect.bottom < approxH + pad && rect.top > vh - rect.bottom) p = 'top'
  else if (p === 'top' && rect.top < approxH + pad && vh - rect.bottom > rect.top) p = 'bottom'
  else if (p === 'right' && vw - rect.right < tooltipW + pad && rect.left > vw - rect.right) p = 'left'
  else if (p === 'left' && rect.left < tooltipW + pad && vw - rect.right > rect.left) p = 'right'

  // On narrow screens, force horizontal placements to vertical
  if ((p === 'left' || p === 'right') && vw < tooltipW + rect.width + pad * 2 + edge * 2) {
    p = vh - rect.bottom >= rect.top ? 'bottom' : 'top'
  }

  placement.value = p

  const s: Record<string, string> = {}
  const a: Record<string, string> = { position: 'absolute' }
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  if (p === 'bottom' || p === 'top') {
    let left = centerX - tooltipW / 2
    left = Math.max(edge, Math.min(left, vw - tooltipW - edge))
    s.left = `${left}px`
    s.width = `${tooltipW}px`

    const arrowLeft = Math.max(arrowSize + 4, Math.min(centerX - left, tooltipW - arrowSize - 4))
    a.left = `${arrowLeft}px`
    a.transform = 'translateX(-50%)'
    a.borderLeft = `${arrowSize}px solid transparent`
    a.borderRight = `${arrowSize}px solid transparent`

    if (p === 'bottom') {
      s.top = `${rect.bottom + pad}px`
      a.top = `-${arrowSize}px`
      a.borderBottom = `${arrowSize}px solid var(--color-surface-container-high)`
    } else {
      s.bottom = `${vh - rect.top + pad}px`
      a.bottom = `-${arrowSize}px`
      a.borderTop = `${arrowSize}px solid var(--color-surface-container-high)`
    }
  } else {
    let top = centerY
    top = Math.max(edge + approxH / 2, Math.min(top, vh - edge - approxH / 2))
    s.top = `${top}px`
    s.transform = 'translateY(-50%)'

    a.top = `${Math.max(arrowSize + 4, Math.min(centerY - top + approxH / 2, approxH - arrowSize - 4))}px`
    a.transform = 'translateY(-50%)'
    a.borderTop = `${arrowSize}px solid transparent`
    a.borderBottom = `${arrowSize}px solid transparent`

    if (p === 'right') {
      s.left = `${rect.right + pad}px`
      a.left = `-${arrowSize}px`
      a.borderRight = `${arrowSize}px solid var(--color-surface-container-high)`
    } else {
      s.right = `${vw - rect.left + pad}px`
      a.right = `-${arrowSize}px`
      a.borderLeft = `${arrowSize}px solid var(--color-surface-container-high)`
    }
  }

  if (!same(tooltipStyle.value, s)) tooltipStyle.value = s
  if (!same(arrowStyle.value, a)) arrowStyle.value = a
}

function scrollToTarget() {
  if (!step.value || props.interactive) return
  targetOf(step.value)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function highlightTarget() {
  if (!step.value) return
  document.querySelectorAll('.m3-tour-highlight').forEach((el) => el.classList.remove('m3-tour-highlight'))
  if (props.interactive) return
  targetOf(step.value)?.classList.add('m3-tour-highlight')
}

function clearHighlight() {
  document.querySelectorAll('.m3-tour-highlight').forEach((el) => el.classList.remove('m3-tour-highlight'))
}

function goNext() {
  if (isLast.value) {
    close()
    emit('finish')
  } else {
    currentStep.value++
  }
}

function goPrev() {
  if (!isFirst.value) currentStep.value--
}

function close() {
  stopListeners()
  clearHighlight()
  if (props.step === undefined) ownStep.value = 0
  emit('update:modelValue', false)
}

function show() {
  if (props.modelValue) {
    nextTick(() => {
      highlightTarget()
      scrollToTarget()
      positionTooltip()
    })
  }
}
watch([() => props.modelValue, currentStep], show)

watch(() => props.modelValue, (v) => {
  if (v) startListeners()
  else { stopListeners(); clearHighlight() }
})
// Mounted already open: no watcher has run yet
onMounted(() => {
  if (!props.modelValue) return
  startListeners()
  show()
})
watch(() => props.interactive, () => {
  if (props.modelValue) {
    stopListeners()
    startListeners()
    highlightTarget()
  }
})

onBeforeUnmount(() => { stopListeners(); clearHighlight() })
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="m3-tour" appear>
      <div v-if="modelValue && step && !interactive" class="fixed inset-0 z-200 bg-scrim/32" @click="close" />
    </Transition>

    <!-- The target's ring (interactive) -->
    <div v-if="modelValue && step && interactive && ringStyle" class="m3-tour-ring pointer-events-none fixed z-201 rounded-xl" :style="ringStyle" aria-hidden="true" />

    <!-- Tooltip -->
    <Transition name="m3-tour" appear>
      <div
        v-if="modelValue && step"
        ref="tooltipEl"
        :role="interactive ? 'region' : 'dialog'"
        :aria-label="step.title"
        class="fixed z-202 w-80 max-w-[calc(100vw-1rem)] rounded-xl bg-surface-container-high p-5 shadow-elevation-3"
        :style="tooltipStyle"
      >
        <!-- Arrow -->
        <div class="h-0 w-0" :style="arrowStyle" />

        <!-- Step indicator -->
        <div class="mb-2 flex items-center justify-between">
          <slot name="indicator" :index="currentStep" :count="steps.length">
            <span class="text-label-small text-on-surface-variant">
              {{ currentStep + 1 }} / {{ steps.length }}
            </span>
          </slot>
          <button
            :aria-label="locale.close"
            type="button"
            class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
            @click="close"
          >
            <MIcon name="close" :size="16" />
          </button>
        </div>

        <slot name="content" :step="step" :index="currentStep">
          <h3 class="mb-1 text-title-medium font-medium text-on-surface">{{ step.title }}</h3>
          <p class="mb-4 text-body-medium text-on-surface-variant">{{ step.content }}</p>
        </slot>

        <!-- Progress dots -->
        <slot name="progress" :index="currentStep" :count="steps.length">
        <div class="mb-4 flex justify-center gap-1.5">
          <div
            v-for="(_, i) in steps"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-200"
            :class="i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-outline-variant'"
          />
        </div>
        </slot>

        <!-- Actions -->
        <slot name="actions" :step="step" :index="currentStep" :is-first="isFirst" :is-last="isLast" :next="goNext" :prev="goPrev" :close="close">
        <div class="flex justify-between">
          <MButton
            v-if="!isFirst"
            variant="text"
            @click="goPrev"
          >
            {{ prevLabel ?? locale.previous }}
          </MButton>
          <span v-else />
          <MButton @click="goNext">
            {{ isLast ? (finishLabel ?? locale.finish) : (nextLabel ?? locale.next) }}
          </MButton>
        </div>
        </slot>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.m3-tour-highlight {
  position: relative;
  z-index: 201 !important;
  box-shadow: 0 0 0 4px var(--color-primary);
  border-radius: 8px;
}

.m3-tour-ring {
  box-shadow: 0 0 0 3px var(--color-primary), 0 0 0 8px color-mix(in srgb, var(--color-primary) 24%, transparent);
  animation: m3-tour-ring 1.6s ease-in-out infinite;
}
@keyframes m3-tour-ring {
  50% { box-shadow: 0 0 0 3px var(--color-primary), 0 0 0 12px color-mix(in srgb, var(--color-primary) 0%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .m3-tour-ring { animation: none; }
}

.m3-tour-enter-active,
.m3-tour-leave-active {
  transition: opacity 0.2s ease;
}
.m3-tour-enter-from,
.m3-tour-leave-to {
  opacity: 0;
}
</style>
