<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    scrim?: boolean
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
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0" :style="style">
        <div
          v-if="scrim"
          class="absolute inset-0 bg-black/50"
          @click="handleScrimClick"
        />
        <div class="relative h-full w-full">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
