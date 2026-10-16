<script setup lang="ts">
/**
 * A spinner-and-text overlay, either layered on top of a piece of content via the `#content` slot, or covering
 * the whole viewport with `fullscreen`.
 *
 * @slot default Extra content shown below the spinner/text, in either mode
 * @slot content The content the overlay is layered on top of (only used when fullscreen is false)
 */
import MSpinner from './MSpinner.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  /** Show/hide the overlay */
  visible: boolean
  /** Loading text message shown below the spinner */
  text?: string
  /** Cover the entire viewport via Teleport, instead of overlaying just the #content slot */
  fullscreen?: boolean
  /** Solid surface background instead of a translucent, blurred one */
  opaque?: boolean
  /** Spinner size in px */
  spinnerSize?: number
}>(), { fullscreen: false, opaque: false, spinnerSize: 40 })
</script>

<template>
  <Teleport v-if="fullscreen" to="body">
    <Transition
      appear
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        v-bind="$attrs"
        class="fixed inset-0 z-300 flex flex-col items-center justify-center gap-4"
        :class="opaque ? 'bg-surface' : 'bg-surface/80 backdrop-blur-sm'"
      >
        <MSpinner :size="spinnerSize" class="text-primary" />
        <p v-if="text" class="text-body-large text-on-surface-variant">{{ text }}</p>
        <slot />
      </div>
    </Transition>
  </Teleport>

  <div v-else v-bind="$attrs" class="relative">
    <slot name="content" />
    <Transition
      appear
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[inherit]"
        :class="opaque ? 'bg-surface' : 'bg-surface/80 backdrop-blur-sm'"
      >
        <MSpinner :size="spinnerSize" class="text-primary" />
        <p v-if="text" class="text-body-medium text-on-surface-variant">{{ text }}</p>
        <slot />
      </div>
    </Transition>
  </div>
</template>
