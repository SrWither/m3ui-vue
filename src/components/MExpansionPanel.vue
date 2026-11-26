<script setup lang="ts">
/**
 * A collapsible section with a smooth height animation (`MCollapse`). Works controlled via v-model, or uncontrolled by
 * simply omitting modelValue. The header takes text props or slots of your own (a colored icon, a title with
 * highlighted parts, a badge before the chevron); `expandable: false` makes it a plain row with nothing to open, and
 * `flush` lets the body run edge to edge (a list).
 *
 * @slot default Panel body content, revealed with a height animation when open
 * @slot leading The header's start, instead of `icon` (an avatar, a colored icon)
 * @slot title The title, instead of the `title` text (highlighted parts, a chip)
 * @slot subtitle The line below the title, instead of the `subtitle` text
 * @slot trailing Content before the chevron (a count, a status, a button)
 * @event update:modelValue Emitted when the panel is toggled — only meaningful when modelValue is passed
 *   (controlled usage); powers v-model
 * @event after-open The open animation finished
 * @event after-close The close animation finished
 */
import { computed, ref, useId } from 'vue'
import MCollapse from './MCollapse.vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  /** Panel header text (or the `#title` slot) */
  title?: string
  /** Secondary text in the header, below the title */
  subtitle?: string
  /** Leading Material Symbol icon in the header */
  icon?: string
  /**
   * Open/closed state (v-model). Omit it entirely to let the panel manage its own open state internally
   * (uncontrolled).
   */
  modelValue?: boolean
  /** Disables toggling (dimmed) */
  disabled?: boolean
  /** Whether it opens at all: false shows a plain header row, no chevron, not a button (not dimmed, unlike `disabled`) */
  expandable?: boolean
  /** The body with no padding or divider, for edge-to-edge content such as a list */
  flush?: boolean
  /** Unmount the body while closed */
  unmountOnClose?: boolean
  /** Visual style of the panel container */
  variant?: 'outlined' | 'filled' | 'elevated'
}>(), { modelValue: undefined, disabled: false, expandable: true, flush: false, unmountOnClose: false, variant: 'outlined' })

const emit = defineEmits<{ 'update:modelValue': [boolean]; 'after-open': []; 'after-close': [] }>()

const bodyId = useId()
const internal = ref(false)
const isOpen = computed(() =>
  props.expandable && (props.modelValue !== undefined ? props.modelValue : internal.value),
)

function toggle() {
  if (props.disabled || !props.expandable) return
  const next = !isOpen.value
  if (props.modelValue !== undefined) emit('update:modelValue', next)
  else internal.value = next
}

const wrapperClass = computed(() => {
  if (props.variant === 'filled')   return 'bg-surface-container-low rounded-md'
  if (props.variant === 'elevated') return 'bg-surface-container-low rounded-md shadow-elevation-1'
  return 'rounded-md border border-outline-variant'
})
</script>

<template>
  <div :class="wrapperClass" class="overflow-hidden">
    <!-- Header: a button when it opens, a plain row when it doesn't -->
    <component
      :is="expandable ? 'button' : 'div'"
      :type="expandable ? 'button' : undefined"
      class="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:bg-on-surface/10"
      :class="expandable ? [
        disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer hover:bg-on-surface/4',
        isOpen ? 'bg-on-surface/4' : '',
      ] : ''"
      :aria-expanded="expandable ? isOpen : undefined"
      :aria-controls="expandable ? bodyId : undefined"
      :disabled="expandable ? disabled : undefined"
      @click="toggle"
    >
      <slot name="leading">
        <MIcon v-if="icon" :name="icon" :size="22" class="shrink-0 text-on-surface-variant" />
      </slot>
      <div class="flex-1 min-w-0">
        <div class="text-body-large font-medium text-on-surface"><slot name="title">{{ title }}</slot></div>
        <div v-if="subtitle || $slots.subtitle" class="text-body-small text-on-surface-variant"><slot name="subtitle">{{ subtitle }}</slot></div>
      </div>
      <slot name="trailing" />
      <MIcon
        v-if="expandable"
        name="expand_more"
        :size="22"
        class="shrink-0 text-on-surface-variant transition-transform duration-200"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </component>

    <MCollapse
      v-if="expandable"
      :id="bodyId"
      :open="isOpen"
      :unmount-on-close="unmountOnClose"
      @after-open="emit('after-open')"
      @after-close="emit('after-close')"
    >
      <div v-if="flush" class="border-t border-outline-variant/60"><slot /></div>
      <div v-else class="border-t border-outline-variant/60 px-5 py-4">
        <slot />
      </div>
    </MCollapse>
  </div>
</template>
