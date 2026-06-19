<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}>(), { placement: 'top', delay: 600 })

const visible = ref(false)
const tipEl = ref<HTMLElement>()
const triggerEl = ref<HTMLElement>()
const tipStyle = ref<Record<string, string>>({})
let timer: ReturnType<typeof setTimeout> | null = null

async function show() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    visible.value = true
    await nextTick()
    reposition()
  }, props.delay)
}

function hide() {
  if (timer) { clearTimeout(timer); timer = null }
  visible.value = false
}

function onScroll() {
  if (visible.value) hide()
}

function reposition() {
  if (!triggerEl.value || !tipEl.value) return
  const tr = triggerEl.value.getBoundingClientRect()
  const tt = tipEl.value.getBoundingClientRect()
  const GAP = 6

  let top = 0, left = 0
  switch (props.placement) {
    case 'top':    top = tr.top - tt.height - GAP;   left = tr.left + (tr.width - tt.width) / 2; break
    case 'bottom': top = tr.bottom + GAP;             left = tr.left + (tr.width - tt.width) / 2; break
    case 'left':   top = tr.top + (tr.height - tt.height) / 2; left = tr.left - tt.width - GAP; break
    case 'right':  top = tr.top + (tr.height - tt.height) / 2; left = tr.right + GAP; break
  }

  top  = Math.max(6, Math.min(top,  window.innerHeight - tt.height - 6))
  left = Math.max(6, Math.min(left, window.innerWidth  - tt.width  - 6))
  tipStyle.value = { top: `${top}px`, left: `${left}px` }
}

onMounted(() => window.addEventListener('scroll', onScroll, true))
onUnmounted(() => window.removeEventListener('scroll', onScroll, true))
</script>

<template>
  <span
    ref="triggerEl"
    class="inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible && text"
        ref="tipEl"
        class="pointer-events-none fixed z-400 max-w-[220px] rounded bg-inverse-surface px-3 py-1.5 text-label-medium text-inverse-on-surface shadow-elevation-2"
        :style="tipStyle"
        role="tooltip"
      >
        {{ text }}
      </div>
    </Transition>
  </Teleport>
</template>
