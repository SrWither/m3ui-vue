<script setup lang="ts">
/**
 * Wraps a scrollable list and emits load when an IntersectionObserver sentinel at the bottom becomes visible —
 * hand it your own fetch-more logic.
 *
 * @slot default The content list itself
 * @slot loading Custom loading indicator, shown when loading is true
 * @slot end Custom end-of-list content, shown when ended is true
 * @slot idle Content shown when neither loading nor ended (empty by default)
 * @event load Emitted when the sentinel scrolls into view and more items should be fetched
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import MSpinner from './MSpinner.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    /** Currently loading more items — shows the loading slot */
    loading?: boolean
    /** Disable the load trigger entirely (no observer attached) */
    disabled?: boolean
    /** Distance in px from the sentinel before it triggers load */
    threshold?: number
    /** Text shown while loading (defaults to the locale string, 'Loading...') */
    loadingText?: string
    /** Text shown when ended (defaults to the locale string, 'No more items') */
    endText?: string
    /** No more items to load — shows the end slot and stops observing */
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
