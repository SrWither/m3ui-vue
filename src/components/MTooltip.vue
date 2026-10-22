<script setup lang="ts">
/**
 * A hover/focus-triggered label — plain text, or a rich variant with a title, detailed content, and action
 * buttons.
 *
 * @slot default The trigger element the tooltip is anchored to
 * @slot content Rich-tooltip body content (only used when rich is true)
 * @slot actions Rich-tooltip action buttons row (only used when rich is true)
 */
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { createTooltipTrigger, placeTooltip } from '../composables/_tooltipTrigger'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Tooltip text (plain variant), or the rich variant's title line */
  text?: string
  /** Tooltip position relative to the trigger */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Show delay in ms after hover/focus */
  delay?: number
  /**
   * Rich tooltip with a #content slot and optional #actions. Stays open when hovering the tooltip itself
   * instead of closing immediately.
   */
  rich?: boolean
}>(), { placement: 'top', delay: 600, rich: false })

const visible = ref(false)
const tipEl = ref<HTMLElement>()
const triggerEl = ref<HTMLElement>()
const tipStyle = ref<Record<string, string>>({})

// Hover, long press, keyboard focus, Escape and scroll: see _tooltipTrigger.ts (shared with v-tooltip)
let trigger: ReturnType<typeof createTooltipTrigger> | undefined

async function open() {
  visible.value = true
  await nextTick()
  reposition()
}

function onTipEnter() {
  if (props.rich) trigger?.cancel()
}

function onTipLeave() {
  if (props.rich) trigger?.closeNow()
}

function reposition() {
  if (!triggerEl.value || !tipEl.value) return
  const { top, left } = placeTooltip(triggerEl.value, tipEl.value, props.placement)
  tipStyle.value = { top: `${top}px`, left: `${left}px` }
}

onMounted(() => {
  trigger = createTooltipTrigger(triggerEl.value!, {
    delay: () => props.delay,
    rich: () => props.rich,
    visible: () => visible.value,
    open,
    close: () => { visible.value = false },
    tip: () => tipEl.value,
  })
})
onUnmounted(() => trigger?.destroy())
</script>

<template>
  <span
    ref="triggerEl"
    v-bind="$attrs"
    class="inline-flex"
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
        class="pointer-events-none fixed z-400 min-h-6 min-w-10 max-w-[200px] rounded bg-inverse-surface px-2 py-1 text-body-small text-inverse-on-surface"
        :style="tipStyle"
        role="tooltip"
      >
        {{ text }}
      </div>

      <!-- Rich tooltip -->
      <div
        v-else-if="visible && rich"
        ref="tipEl"
        class="fixed z-400 max-w-[320px] rounded-xl bg-surface-container shadow-elevation-2"
        :style="tipStyle"
        role="tooltip"
        @mouseenter="onTipEnter"
        @mouseleave="onTipLeave"
      >
        <div v-if="text" class="px-4 pt-3 pb-1 text-title-small font-medium text-on-surface-variant">
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
