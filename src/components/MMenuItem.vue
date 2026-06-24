<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  icon?: string
  to?: string | Record<string, any>
  disabled?: boolean
  danger?: boolean
}>(), {
  disabled: false,
  danger: false,
})

const emit = defineEmits<{ click: [] }>()

const slots = useSlots()
const tag = computed(() => props.to ? 'RouterLink' : 'button')
const hasChildren = computed(() => !!slots.children)
const menuClose = inject<(() => void) | null>('m-menu-close', null)

function handleClick() {
  if (props.disabled || hasChildren.value) return
  emit('click')
  menuClose?.()
}
const showSub = ref(false)
const itemEl = ref<HTMLElement>()
const subStyle = ref<Record<string, string>>({})

function onMouseEnter() {
  if (!hasChildren.value || props.disabled) return
  showSub.value = true
  if (!itemEl.value) return
  const rect = itemEl.value.getBoundingClientRect()
  const right = rect.right + 200 > window.innerWidth
  subStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    ...(right
      ? { right: `${window.innerWidth - rect.left}px` }
      : { left: `${rect.right}px` }),
    zIndex: '501',
  }
}

function onMouseLeave(e: MouseEvent) {
  const related = e.relatedTarget as Element | null
  if (related?.closest('.m3-submenu')) return
  showSub.value = false
}

function onSubLeave(e: MouseEvent) {
  const related = e.relatedTarget as Element | null
  if (related?.closest('.m3-submenu') || itemEl.value?.contains(related as Node)) return
  showSub.value = false
}
</script>

<template>
  <div
    ref="itemEl"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <component
      :is="tag"
      :to="to || undefined"
      :type="to ? undefined : 'button'"
      class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-body-large transition-colors"
      :class="[
        disabled ? 'cursor-not-allowed opacity-[0.38] text-on-surface' : 'cursor-pointer',
        !disabled && danger ? 'text-error hover:bg-error/8' : '',
        !disabled && !danger ? 'text-on-surface hover:bg-on-surface/8' : '',
      ]"
      :disabled="disabled || undefined"
      @click="handleClick"
    >
      <MIcon v-if="icon" :name="icon" :size="20" class="shrink-0" :class="danger ? 'text-error' : 'text-on-surface-variant'" />
      <span class="flex-1"><slot /></span>
      <MIcon v-if="hasChildren" name="chevron_right" :size="18" class="shrink-0 text-on-surface-variant" />
    </component>

    <!-- Submenu -->
    <Teleport v-if="hasChildren" to="body">
      <Transition
        enter-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-75"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showSub"
          class="m3-submenu min-w-44 overflow-hidden rounded-lg bg-surface-container py-1 shadow-elevation-2"
          :style="subStyle"
          @mouseleave="onSubLeave"
        >
          <slot name="children" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
