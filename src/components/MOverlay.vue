<script setup lang="ts">
/**
 * Full-screen overlay with scrim and teleport to body. A generic low-level building block — content is entirely
 * up to you via the default slot.
 *
 * @slot default Content shown over the scrim.
 * @event update:modelValue Emitted with false when the scrim is clicked, for v-model support
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Controls visibility (v-model) */
    modelValue?: boolean
    /** Show dark backdrop */
    scrim?: boolean
    /** Z-index value */
    zIndex?: number
  }>(),
  { modelValue: true, scrim: true, zIndex: 50 },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const style = computed(() => ({
  zIndex: props.zIndex,
}))

function handleScrimClick() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      appear
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0" :style="style">
        <div
          v-if="scrim"
          class="absolute inset-0 bg-scrim/32"
          @click="handleScrimClick"
        />
        <div class="relative h-full w-full">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
