<script setup lang="ts">
import { watch } from 'vue'
import MIconButton from './MIconButton.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
    persistent?: boolean
  }>(),
  {
    maxWidth: 'max-w-md',
    persistent: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function close() {
  if (props.persistent) return
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="m3-dialog">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="close"
      >
        <div
          class="dialog-box flex max-h-[90vh] w-full flex-col rounded-xl bg-surface-container-high shadow-elevation-3"
          :class="maxWidth"
        >
          <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
            <h2 class="text-headline-small text-on-surface">
              <slot name="title">{{ title }}</slot>
            </h2>
            <MIconButton v-if="!persistent" icon="close" label="Cerrar" @click="close" />
          </div>
          <div class="overflow-y-auto px-6 py-2 text-body-medium text-on-surface-variant">
            <slot />
          </div>
          <div v-if="$slots.actions" class="flex justify-end gap-2 px-6 py-4">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.m3-dialog-enter-active,
.m3-dialog-leave-active {
  transition: opacity 0.15s ease;
}
.m3-dialog-enter-from,
.m3-dialog-leave-to {
  opacity: 0;
}
.m3-dialog-enter-active .dialog-box,
.m3-dialog-leave-active .dialog-box {
  transition: transform 0.15s ease;
}
.m3-dialog-enter-from .dialog-box,
.m3-dialog-leave-to .dialog-box {
  transform: scale(0.95);
}
</style>
