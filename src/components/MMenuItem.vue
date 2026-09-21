<script setup lang="ts">
import { computed, inject, ref, useSlots } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(defineProps<{
  icon?: string
  shortcut?: string
  to?: string | Record<string, any>
  disabled?: boolean
  danger?: boolean
  /** Keep the menu open after this item is clicked (e.g. checkable/toggle items). */
  keepOpen?: boolean
}>(), {
  disabled: false,
  danger: false,
  keepOpen: false,
})

const emit = defineEmits<{ click: [] }>()

const slots = useSlots()
const tag = computed(() => props.to ? 'RouterLink' : 'button')
const hasChildren = computed(() => !!slots.children)
const menuClose = inject<(() => void) | null>('m-menu-close', null)
const nav = inject<{
  mode: 'flyout' | 'push'
  push: (entry: { icon?: string, header?: () => any, content?: () => any }) => void
} | null>('m-menu-nav', null)

const itemEl = ref<HTMLElement>()
const showSub = ref(false)
const subStyle = ref<Record<string, string>>({})

function positionSub() {
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

function toggleSub() {
  if (showSub.value) {
    showSub.value = false
    return
  }
  positionSub()
  showSub.value = true
}

function handleClick() {
  if (props.disabled) return

  if (hasChildren.value) {
    if (nav?.mode === 'push') {
      nav.push({ icon: props.icon, header: slots.default, content: slots.children })
    } else {
      toggleSub()
    }
    return
  }

  emit('click')
  if (!props.keepOpen) menuClose?.()
}

// Desktop hover convenience for the flyout variant — ignored on touch/pen so a
// tap doesn't fire a spurious pointerleave (relatedTarget is null on touch)
// and close the submenu before its click event can land.
function onPointerEnter(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !hasChildren.value || props.disabled) return
  positionSub()
  showSub.value = true
}

function onPointerLeave(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const related = e.relatedTarget as Element | null
  if (related?.closest('.m3-submenu')) return
  showSub.value = false
}

function onSubPointerLeave(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const related = e.relatedTarget as Element | null
  if (related?.closest('.m3-submenu') || itemEl.value?.contains(related as Node)) return
  showSub.value = false
}
</script>

<template>
  <div
    ref="itemEl"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <component
      :is="tag"
      :to="to || undefined"
      :type="to ? undefined : 'button'"
      class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-body-large transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
      :class="[
        disabled ? 'cursor-not-allowed opacity-[0.38] text-on-surface' : 'cursor-pointer',
        !disabled && danger ? 'text-error hover:bg-error/8' : '',
        !disabled && !danger ? 'text-on-surface hover:bg-on-surface/8' : '',
      ]"
      :disabled="disabled || undefined"
      :aria-haspopup="hasChildren ? 'menu' : undefined"
      :aria-expanded="hasChildren ? showSub : undefined"
      @click="handleClick"
    >
      <MIcon v-if="icon" :name="icon" :size="20" class="shrink-0" :class="danger ? 'text-error' : 'text-on-surface-variant'" />
      <span class="flex-1"><slot /></span>
      <span v-if="shortcut && !hasChildren" class="ml-4 shrink-0 text-label-small text-on-surface-variant opacity-60">{{ shortcut }}</span>
      <MIcon v-if="hasChildren" name="chevron_right" :size="18" class="shrink-0 text-on-surface-variant" />
    </component>

    <!-- Submenu (flyout variant only — "push" mode is rendered by the root MMenu/MContextMenu panel) -->
    <Teleport v-if="hasChildren && nav?.mode !== 'push'" to="body">
      <Transition
        enter-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-75"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showSub"
          class="m3-submenu min-w-44 rounded-xs shadow-elevation-2"
          :style="subStyle"
          @pointerleave="onSubPointerLeave"
        >
          <!-- overflow-hidden lives here, separate from shadow-elevation-2 above —
               overflow-hidden clips an element's own box-shadow too -->
          <div class="overflow-hidden rounded-xs bg-surface-container py-1">
            <slot name="children" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
