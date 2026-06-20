<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

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
    (entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting && !props.loading && !props.ended && !props.disabled) {
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
      <slot v-if="loading" name="loading">
        <div class="flex items-center gap-3">
          <MSpinner :size="20" class="text-primary" />
          <span class="text-body-medium text-on-surface-variant">{{ loadingText ?? locale.loadingMore }}</span>
        </div>
      </slot>
      <slot v-else-if="ended" name="end">
        <p class="text-body-small text-on-surface-variant">
          {{ endText ?? locale.noMoreItems }}
        </p>
      </slot>
      <slot v-else name="idle" />
    </div>
  </div>
</template>
