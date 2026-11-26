<script setup lang="ts">
/**
 * Shows and hides its content with a height animation to the content's exact size (grid rows 0fr → 1fr, so nothing
 * overshoots or needs measuring). While closed the content is `inert`: no Tab stop, hidden from screen readers.
 * `unmountOnClose` drops it once closed (and mounts it again on open). With reduced motion it switches at once. The
 * building block `MExpansionPanel` uses; reach for it for any "show more" of your own.
 *
 * @slot default The content
 * @event after-open The open animation finished
 * @event after-close The close animation finished (the content is unmounted after it with `unmountOnClose`)
 */
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Shown or not */
    open: boolean
    /** Unmount the content once closed (it keeps its state otherwise) */
    unmountOnClose?: boolean
    /** The animation's length, in ms */
    duration?: number
  }>(),
  { unmountOnClose: false, duration: 300 },
)

const emit = defineEmits<{ 'after-open': []; 'after-close': [] }>()

const rendered = ref(props.open || !props.unmountOnClose)
let fallback: ReturnType<typeof setTimeout> | undefined

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function settle() {
  clearTimeout(fallback)
  fallback = undefined
  if (props.open) emit('after-open')
  else {
    if (props.unmountOnClose) rendered.value = false
    emit('after-close')
  }
}

watch(() => props.open, (open) => {
  if (open) rendered.value = true
  clearTimeout(fallback)
  // No transitionend comes without motion; a timer covers a transition that never runs (hidden, display: none)
  if (reduced() || props.duration <= 0) settle()
  else fallback = setTimeout(settle, props.duration + 50)
})

function onEnd(e: TransitionEvent) {
  if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows' && fallback !== undefined) settle()
}

onBeforeUnmount(() => clearTimeout(fallback))
</script>

<template>
  <div
    class="m3-collapse"
    :class="{ 'm3-collapse--open': open }"
    :style="{ transitionDuration: `${duration}ms` }"
    @transitionend="onEnd"
  >
    <div class="m3-collapse__body" :inert="!open || undefined">
      <slot v-if="rendered" />
    </div>
  </div>
</template>

<style>
/* Grid rows 0fr → 1fr animate to the content's exact height */
.m3-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition-property: grid-template-rows;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
.m3-collapse--open {
  grid-template-rows: 1fr;
}
.m3-collapse__body {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .m3-collapse {
    transition: none;
  }
}
</style>
