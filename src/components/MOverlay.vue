<script setup lang="ts">
/**
 * Full-screen overlay with scrim and teleport to body. A generic low-level building block — content is entirely
 * up to you via the default slot. Your class, role and aria attributes go on the content layer (over the scrim),
 * so `class="flex items-center justify-center bg-black"` lays out and paints the slot.
 *
 * @slot default Content shown over the scrim.
 * @event update:modelValue Emitted with false when the scrim is clicked (or Escape is pressed with closeOnEscape),
 *   for v-model support
 */
import { computed } from 'vue'
import { useEscapeStack } from '../composables/_useEscapeStack'
import { useScrollLock } from '../composables/_useScrollLock'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Controls visibility (v-model) */
    modelValue?: boolean
    /** Show dark backdrop */
    scrim?: boolean
    /** Z-index value */
    zIndex?: number
    /**
     * Closes on Escape. It shares the library's Escape stack with MDialog and the sheets, so a dialog or menu opened
     * over it takes Escape first
     */
    closeOnEscape?: boolean
    /** Locks the page's scroll while open (shared with the library's other modal surfaces, so stacking is safe) */
    lockScroll?: boolean
    /** Name of a `<Transition>` (your CSS classes) to play instead of the default fade */
    transition?: string
  }>(),
  { modelValue: true, scrim: true, zIndex: 50, closeOnEscape: false, lockScroll: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const style = computed(() => ({
  zIndex: props.zIndex,
}))

function close() {
  emit('update:modelValue', false)
}

useEscapeStack(() => props.closeOnEscape && props.modelValue, close)
useScrollLock(() => props.lockScroll && props.modelValue)

const fade = {
  enterActiveClass: 'transition-opacity duration-200',
  leaveActiveClass: 'transition-opacity duration-150',
  enterFromClass: 'opacity-0',
  leaveToClass: 'opacity-0',
}
</script>

<template>
  <Teleport to="body">
    <Transition appear v-bind="transition ? { name: transition } : fade">
      <div v-if="modelValue" class="fixed inset-0" :style="style">
        <div
          v-if="scrim"
          class="absolute inset-0 bg-scrim/32"
          @click="close"
        />
        <div class="relative h-full w-full" v-bind="$attrs">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
