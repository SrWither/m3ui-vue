<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import MButton from './MButton.vue'
import MIcon from './MIcon.vue'

export interface TourStep {
  target: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    steps: TourStep[]
  }>(),
  {},
)

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

function positionTooltip() {
  if (!step.value) return
  const el = document.querySelector(step.value.target) as HTMLElement | null
  if (!el) return

  const rect = el.getBoundingClientRect()
  const pad = 12
  const arrowSize = 8
  const p = step.value.placement ?? 'bottom'
  placement.value = p

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const s: Record<string, string> = {}
  const a: Record<string, string> = { position: 'absolute' }

  switch (p) {
    case 'bottom':
      s.top = `${rect.bottom + pad}px`
      s.left = `${rect.left + rect.width / 2}px`
      s.transform = 'translateX(-50%)'
      a.top = `-${arrowSize}px`
      a.left = '50%'
      a.transform = 'translateX(-50%)'
      a.borderBottom = `${arrowSize}px solid var(--color-surface-container-high)`
      a.borderLeft = `${arrowSize}px solid transparent`
      a.borderRight = `${arrowSize}px solid transparent`
      break
    case 'top':
      s.bottom = `${window.innerHeight - rect.top + pad}px`
      s.left = `${rect.left + rect.width / 2}px`
      s.transform = 'translateX(-50%)'
      a.bottom = `-${arrowSize}px`
      a.left = '50%'
      a.transform = 'translateX(-50%)'
      a.borderTop = `${arrowSize}px solid var(--color-surface-container-high)`
      a.borderLeft = `${arrowSize}px solid transparent`
      a.borderRight = `${arrowSize}px solid transparent`
      break
    case 'left':
      s.top = `${rect.top + rect.height / 2}px`
      s.right = `${window.innerWidth - rect.left + pad}px`
      s.transform = 'translateY(-50%)'
      a.top = '50%'
      a.right = `-${arrowSize}px`
      a.transform = 'translateY(-50%)'
      a.borderLeft = `${arrowSize}px solid var(--color-surface-container-high)`
      a.borderTop = `${arrowSize}px solid transparent`
      a.borderBottom = `${arrowSize}px solid transparent`
      break
    case 'right':
      s.top = `${rect.top + rect.height / 2}px`
      s.left = `${rect.right + pad}px`
      s.transform = 'translateY(-50%)'
      a.top = '50%'
      a.left = `-${arrowSize}px`
      a.transform = 'translateY(-50%)'
      a.borderRight = `${arrowSize}px solid var(--color-surface-container-high)`
      a.borderTop = `${arrowSize}px solid transparent`
      a.borderBottom = `${arrowSize}px solid transparent`
      break
  }

  tooltipStyle.value = s
  arrowStyle.value = a
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
  clearHighlight()
  currentStep.value = 0
  emit('update:modelValue', false)
}

watch([() => props.modelValue, currentStep], () => {
  if (props.modelValue) {
    nextTick(() => {
      highlightTarget()
      positionTooltip()
    })
  }
})

watch(() => props.modelValue, (v) => {
  if (!v) clearHighlight()
})

onBeforeUnmount(clearHighlight)
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="m3-tour">
      <div v-if="modelValue && step" class="fixed inset-0 z-[200] bg-black/40" @click="close" />
    </Transition>

    <!-- Tooltip -->
    <Transition name="m3-tour">
      <div
        v-if="modelValue && step"
        class="fixed z-[202] w-80 rounded-xl bg-surface-container-high p-5 shadow-elevation-3"
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
            Anterior
          </MButton>
          <span v-else />
          <MButton @click="goNext">
            {{ isLast ? 'Finalizar' : 'Siguiente' }}
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
