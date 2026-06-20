<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

export interface TourStep {
  target: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const props = defineProps<{
  modelValue: boolean
  steps: TourStep[]
  prevLabel?: string
  nextLabel?: string
  finishLabel?: string
}>()

const locale = useLocale()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  finish: []
}>()

const currentStep = ref(0)
const tooltipStyle = ref<Record<string, string>>({})
const arrowStyle = ref<Record<string, string>>({})
const placement = ref<'top' | 'bottom' | 'left' | 'right'>('bottom')

const step = computed(() => props.steps[currentStep.value])
const isFirst = computed(() => currentStep.value === 0)
const isLast = computed(() => currentStep.value === props.steps.length - 1)

let scrollRaf = 0

function onScrollOrResize() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(positionTooltip)
}

function startListeners() {
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
}

function stopListeners() {
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
  cancelAnimationFrame(scrollRaf)
}

function positionTooltip() {
  if (!step.value) return
  const el = document.querySelector(step.value.target) as HTMLElement | null
  if (!el) return

  const rect = el.getBoundingClientRect()
  const pad = 12
  const arrowSize = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const edge = 8
  const tooltipW = Math.min(320, vw - edge * 2)
  const approxH = 220

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

  tooltipStyle.value = s
  arrowStyle.value = a
}

function scrollToTarget() {
  if (!step.value) return
  const el = document.querySelector(step.value.target) as HTMLElement | null
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function highlightTarget() {
  if (!step.value) return
  document.querySelectorAll('.m3-tour-highlight').forEach((el) => el.classList.remove('m3-tour-highlight'))
  const el = document.querySelector(step.value.target)
  el?.classList.add('m3-tour-highlight')
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
  currentStep.value = 0
  emit('update:modelValue', false)
}

watch([() => props.modelValue, currentStep], () => {
  if (props.modelValue) {
    nextTick(() => {
      highlightTarget()
      scrollToTarget()
      positionTooltip()
    })
  }
})

watch(() => props.modelValue, (v) => {
  if (v) startListeners()
  else { stopListeners(); clearHighlight() }
})

onBeforeUnmount(() => { stopListeners(); clearHighlight() })
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="m3-tour">
      <div v-if="modelValue && step" class="fixed inset-0 z-200 bg-black/40" @click="close" />
    </Transition>

    <!-- Tooltip -->
    <Transition name="m3-tour">
      <div
        v-if="modelValue && step"
        class="fixed z-202 w-80 max-w-[calc(100vw-1rem)] rounded-xl bg-surface-container-high p-5 shadow-elevation-3"
        :style="tooltipStyle"
      >
        <!-- Arrow -->
        <div class="h-0 w-0" :style="arrowStyle" />

        <!-- Step indicator -->
        <div class="mb-2 flex items-center justify-between">
          <span class="text-label-small text-on-surface-variant">
            {{ currentStep + 1 }} / {{ steps.length }}
          </span>
          <button
            type="button"
            class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
            @click="close"
          >
            <MIcon name="close" :size="16" />
          </button>
        </div>

        <h3 class="mb-1 text-title-medium font-medium text-on-surface">{{ step.title }}</h3>
        <p class="mb-4 text-body-medium text-on-surface-variant">{{ step.content }}</p>

        <!-- Progress dots -->
        <div class="mb-4 flex justify-center gap-1.5">
          <div
            v-for="(_, i) in steps"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-200"
            :class="i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-outline-variant'"
          />
        </div>

        <!-- Actions -->
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

.m3-tour-enter-active,
.m3-tour-leave-active {
  transition: opacity 0.2s ease;
}
.m3-tour-enter-from,
.m3-tour-leave-to {
  opacity: 0;
}
</style>
