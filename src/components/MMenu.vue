<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from 'vue'

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

function focusableItems() {
  if (!dropdownEl.value) return []
  return Array.from(
    dropdownEl.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
  )
}

function focusFirstItem() {
  nextTick(() => focusableItems()[0]?.focus())
}

function moveFocus(dir: 1 | -1) {
  const items = focusableItems()
  if (!items.length) return
  const idx = items.indexOf(document.activeElement as HTMLElement)
  const next = idx === -1
    ? (dir === 1 ? items[0] : items[items.length - 1])
    : items[(idx + dir + items.length) % items.length]
  next?.focus()
}

function toggle() {
  if (!open.value) computePos()
  open.value = !open.value
  if (open.value) focusFirstItem()
}

function close() {
  open.value = false
}

provide('m-menu-close', close)
defineExpose({ close, open })

function onOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (triggerEl.value?.contains(t)) return
  if (dropdownEl.value?.contains(t)) return
  if ((t as Element).closest?.('.m3-submenu')) return
  close()
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
  if (e.key === 'Escape') { close(); return }
  if (!open.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
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
      enter-active-class="transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.05,0.7,0.1,1)]"
      enter-from-class="opacity-0 scale-[0.8]"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.3,0,0.8,0.15)]"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-[0.8]"
    >
      <div
        v-if="open"
        ref="dropdownEl"
        class="fixed z-500 min-w-48 overflow-hidden rounded-xs bg-surface-container shadow-elevation-2"
        :style="{ ...dropStyle, transformOrigin: origin }"
      >
        <div class="overflow-y-auto py-1" :style="{ maxHeight: dropStyle.maxHeight }">
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
