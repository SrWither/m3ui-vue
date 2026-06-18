<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import MSpinner from './MSpinner.vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    disabled?: boolean
    threshold?: number
    loadingText?: string
    endText?: string
    ended?: boolean
  }>(),
  {
    loading: false,
    disabled: false,
    threshold: 100,
    loadingText: 'Cargando...',
    endText: 'No hay más elementos',
    ended: false,
  },
)

const emit = defineEmits<{ load: [] }>()

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function createObserver() {
  if (observer) observer.disconnect()
  if (props.disabled || props.ended) return

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !props.loading && !props.ended && !props.disabled) {
        emit('load')
      }
    },
    { rootMargin: `0px 0px ${props.threshold}px 0px` },
  )

  if (sentinelRef.value) observer.observe(sentinelRef.value)
}

onMounted(createObserver)

watch(() => [props.disabled, props.ended], createObserver)

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div>
    <slot />

    <div ref="sentinelRef" class="flex items-center justify-center py-4">
      <div v-if="loading" class="flex items-center gap-3">
        <MSpinner :size="20" class="text-primary" />
        <span class="text-body-medium text-on-surface-variant">{{ loadingText }}</span>
      </div>
      <p v-else-if="ended" class="text-body-small text-on-surface-variant">
        {{ endText }}
      </p>
      <slot v-else name="idle" />
    </div>
  </div>
</template>
