<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  rich?: boolean
}>(), { placement: 'top', delay: 600, rich: false })

const visible = ref(false)
const tipEl = ref<HTMLElement>()
const triggerEl = ref<HTMLElement>()
const tipStyle = ref<Record<string, string>>({})
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function cancelTimers() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

async function show() {
  cancelTimers()
  showTimer = setTimeout(async () => {
    visible.value = true
    await nextTick()
    reposition()
  }, props.delay)
}

function hide() {
  cancelTimers()
  if (props.rich) {
    hideTimer = setTimeout(() => { visible.value = false }, 120)
  } else {
    visible.value = false
  }
}

function onTipEnter() {
  if (!props.rich) return
  cancelTimers()
}

function onTipLeave() {
  if (!props.rich) return
  cancelTimers()
  visible.value = false
}

function onScroll() {
  if (visible.value) {
    cancelTimers()
    visible.value = false
  }
}

function reposition() {
  if (!triggerEl.value || !tipEl.value) return
  const tr = triggerEl.value.getBoundingClientRect()
  const tt = tipEl.value.getBoundingClientRect()
  const GAP = 8

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
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  cancelTimers()
})
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
      <!-- Plain tooltip -->
      <div
        v-if="visible && !rich && text"
        ref="tipEl"
        class="pointer-events-none fixed z-400 max-w-[220px] rounded bg-inverse-surface px-3 py-1.5 text-label-medium text-inverse-on-surface shadow-elevation-2"
        :style="tipStyle"
        role="tooltip"
      >
        {{ text }}
      </div>

      <!-- Rich tooltip -->
      <div
        v-else-if="visible && rich"
        ref="tipEl"
        class="fixed z-400 max-w-[320px] rounded-xl bg-surface-container shadow-elevation-3 ring-1 ring-outline-variant"
        :style="tipStyle"
        role="tooltip"
        @mouseenter="onTipEnter"
        @mouseleave="onTipLeave"
      >
        <div v-if="text" class="px-4 pt-3 pb-1 text-title-small font-medium text-on-surface">
          {{ text }}
        </div>
        <div class="px-4 py-2 text-body-medium text-on-surface-variant">
          <slot name="content" />
        </div>
        <div v-if="$slots.actions" class="flex justify-end gap-2 px-4 pb-3">
          <slot name="actions" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
