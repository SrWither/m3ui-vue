<script setup lang="ts">
import { watch } from 'vue'
import MIconButton from './MIconButton.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
    persistent?: boolean
    fullscreen?: boolean
    closeLabel?: string
  }>(),
  {
    maxWidth: 'max-w-md',
    persistent: false,
    fullscreen: false,
  },
)

const locale = useLocale()

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
    <!-- Basic dialog -->
    <Transition v-if="!fullscreen" name="m3-dialog">
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
            <MIconButton v-if="!persistent" icon="close" :label="closeLabel ?? locale.close" @click="close" />
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

    <!-- Fullscreen dialog -->
    <Transition v-else name="m3-dialog-fs">
      <div
        v-if="modelValue"
        class="dialog-fs fixed inset-0 z-50 flex flex-col bg-surface"
      >
        <div class="flex h-14 shrink-0 items-center gap-2 px-2">
          <MIconButton v-if="!persistent" icon="close" :label="closeLabel ?? locale.close" @click="close" />
          <h2 class="flex-1 text-title-large font-medium text-on-surface">
            <slot name="title">{{ title }}</slot>
          </h2>
          <div v-if="$slots.actions" class="flex items-center gap-2">
            <slot name="actions" />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4 text-body-medium text-on-surface-variant">
          <slot />
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

.m3-dialog-fs-enter-active,
.m3-dialog-fs-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease;
}
.m3-dialog-fs-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.m3-dialog-fs-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
