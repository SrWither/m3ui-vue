<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Which edge of the trigger the dropdown aligns to. */
    align?: 'left' | 'right'
  }>(),
  { align: 'right' },
)

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const dropdownEl = ref<HTMLElement | null>(null)
const dropStyle = ref<Record<string, string>>({})

function computePos() {
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const openAbove = spaceBelow < 200 && rect.top > spaceBelow

  const style: Record<string, string> = {
    maxHeight: `${Math.min(openAbove ? rect.top - 12 : spaceBelow, 400)}px`,
  }

  if (openAbove) {
    style.bottom = `${window.innerHeight - rect.top + 4}px`
  } else {
    style.top = `${rect.bottom + 4}px`
  }

  if (props.align === 'right') {
    style.right = `${window.innerWidth - rect.right}px`
  } else {
    style.left = `${rect.left}px`
  }

  dropStyle.value = style
}

function toggle() {
  if (!open.value) computePos()
  open.value = !open.value
}

function close() {
  open.value = false
}

defineExpose({ close, open })

function onOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (!triggerEl.value?.contains(t) && !dropdownEl.value?.contains(t)) close()
}

function onScroll(e: Event) {
  if (!open.value) return
  if (dropdownEl.value?.contains(e.target as Node)) return
  if (!triggerEl.value) return
  const rect = triggerEl.value.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) { close(); return }
  computePos()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('mousedown', onOutsideClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onOutsideClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll, true)
})

const origin = computed(() =>
  props.align === 'right' ? 'top right' : 'top left',
)
</script>

<template>
  <div ref="triggerEl" class="inline-block" @click="toggle">
    <slot name="trigger" :open="open" />
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-[opacity,transform] duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-[opacity,transform] duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        ref="dropdownEl"
        class="fixed z-[500] min-w-48 overflow-y-auto overflow-x-hidden rounded-xs bg-surface-container py-1 shadow-elevation-2"
        :style="{ ...dropStyle, transformOrigin: origin }"
        @click="close"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
