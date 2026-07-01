<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, provide, ref } from 'vue'

const visible = ref(false)
const adjustedPos = ref({ x: 0, y: 0 })
const panelEl = ref<HTMLElement | null>(null)

async function showAt(x: number, y: number) {
  adjustedPos.value = { x, y }
  visible.value = true
  await nextTick()
  if (!panelEl.value) return
  const el = panelEl.value
  adjustedPos.value = {
    x: Math.min(x, window.innerWidth - el.offsetWidth - 8),
    y: Math.min(y, window.innerHeight - el.offsetHeight - 8),
  }
}

function show(e: MouseEvent) {
  e.preventDefault()
  showAt(e.clientX, e.clientY)
}

function hide() {
  visible.value = false
}

provide('m-menu-close', hide)
defineExpose({ show, showAt, hide })

function onDocMouseDown(e: MouseEvent) {
  if (!visible.value) return
  const t = e.target as Node
  if (panelEl.value?.contains(t)) return
  if ((t as Element).closest?.('.m3-submenu')) return
  hide()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') hide()
}

function onScroll() {
  if (visible.value) hide()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div @contextmenu="show">
    <slot name="trigger" />
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
        v-if="visible"
        ref="panelEl"
        class="fixed z-[500] min-w-48 overflow-hidden rounded-lg bg-surface-container py-1 shadow-elevation-2"
        :style="{ left: `${adjustedPos.x}px`, top: `${adjustedPos.y}px`, transformOrigin: 'top left' }"
        @contextmenu.prevent
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
