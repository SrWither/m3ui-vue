<script setup lang="ts">
import { computed, inject, ref, useAttrs, watch } from 'vue'
import type { ComputedRef } from 'vue'
import MIcon from './MIcon.vue'
import MAvatar from './MAvatar.vue'
import MCheckbox from './MCheckbox.vue'
import MSwitch from './MSwitch.vue'

export type ListItemLeading = 'icon' | 'avatar' | 'checkbox' | 'radio' | 'image' | 'icon-container'
export type ListItemTrailing = 'icon' | 'text' | 'switch' | 'checkbox'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    description?: string
    lines?: 1 | 2 | 3
    icon?: string
    leading?: ListItemLeading
    avatarName?: string
    image?: string
    iconContainerColor?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
    trailingIcon?: string
    trailingText?: string
    trailing?: ListItemTrailing
    trailingValue?: boolean
    value?: string | number
    active?: boolean
    disabled?: boolean
    clickable?: boolean
    href?: string
    to?: string | object
    expandable?: boolean
    expanded?: boolean
  }>(),
  { active: false, disabled: false, expandable: false },
)

const emit = defineEmits<{
  click: [e: MouseEvent]
  'update:trailingValue': [value: boolean]
  'update:expanded': [value: boolean]
}>()

const attrs = useAttrs()

const internalExpanded = ref(props.expanded ?? false)
watch(() => props.expanded, (v) => { if (v !== undefined) internalExpanded.value = v })
const isExpanded = computed(() => internalExpanded.value)

const list = inject<{
  dense: ComputedRef<boolean>
  nav: ComputedRef<boolean>
  selectable: ComputedRef<boolean>
  selected: ComputedRef<string | number | null | undefined>
  dividers: ComputedRef<boolean | 'inset'>
  lines: ComputedRef<1 | 2 | 3 | undefined>
  select: (value: string | number) => void
} | null>('m-list', null)

const resolvedLines = computed(() => {
  if (props.lines) return props.lines
  if (list?.lines.value) return list.lines.value
  if (props.description) return 3
  if (props.subtitle) return 2
  return 1
})

const isClickable = computed(() =>
  props.clickable || props.href || props.to || !!attrs.onClick || list?.selectable.value || props.expandable,
)

const isActive = computed(() => {
  if (props.active) return true
  if (list?.selectable.value && props.value != null) return list.selected.value === props.value
  return false
})

const resolvedLeading = computed(() => {
  if (props.leading) return props.leading
  if (props.icon) return 'icon'
  if (props.avatarName) return 'avatar'
  if (props.image) return 'image'
  return null
})

const resolvedTrailing = computed(() => {
  if (props.expandable) return 'expand'
  if (props.trailing) return props.trailing
  if (props.trailingIcon) return 'icon'
  if (props.trailingText) return 'text'
  return null
})

const iconContainerClasses: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  error: 'bg-error-container text-on-error-container',
  success: 'bg-success-container text-on-success-container',
}

const isDense = computed(() => list?.dense.value ?? false)
const isNav = computed(() => list?.nav.value ?? false)
const hasDivider = computed(() => list?.dividers.value ?? false)

const containerClasses = computed(() => [
  'mli-row relative flex w-full items-center gap-4 text-left',
  isNav.value ? 'rounded-full px-4' : 'px-4',
  isDense.value
    ? 'py-1'
    : resolvedLines.value === 3 ? 'py-3' : 'py-2',
  isClickable.value && !props.disabled && 'cursor-pointer transition-colors duration-150 hover:bg-on-surface/8 active:bg-on-surface/12',
  isActive.value && (isNav.value
    ? 'bg-secondary-container text-on-secondary-container'
    : 'bg-on-surface/8'),
  props.disabled && 'opacity-[0.38] pointer-events-none',
])

const tag = computed(() => {
  if (props.href) return 'a'
  if (props.to) return 'router-link'
  if (props.expandable) return 'div'
  return 'li'
})

const linkProps = computed(() => {
  if (props.href) return { href: props.href }
  if (props.to) return { to: props.to }
  return {}
})

function toggleExpand(e: MouseEvent) {
  if (props.disabled) return
  internalExpanded.value = !internalExpanded.value
  emit('update:expanded', internalExpanded.value)
  emit('click', e)
}

function handleClick(e: MouseEvent) {
  if (props.disabled) return
  if (props.expandable) {
    toggleExpand(e)
    return
  }
  if (list?.selectable.value && props.value != null) {
    list.select(props.value)
  }
  emit('click', e)
}

function handleTrailingToggle() {
  emit('update:trailingValue', !props.trailingValue)
}
</script>

<template>
  <li v-if="expandable" role="listitem">
    <div :class="containerClasses" @click="handleClick">
      <!-- Leading -->
      <slot name="leading">
        <MIcon v-if="resolvedLeading === 'icon'" :name="icon!" :size="24" class="shrink-0 text-on-surface-variant" />
      </slot>

      <!-- Content -->
      <div class="min-w-0 flex-1">
        <slot>
          <p class="truncate text-body-large text-on-surface">{{ title }}</p>
          <p v-if="subtitle && resolvedLines >= 2" class="text-body-medium text-on-surface-variant" :class="resolvedLines === 2 && 'truncate'">
            {{ subtitle }}
          </p>
        </slot>
      </div>

      <!-- Expand icon -->
      <MIcon
        :name="isExpanded ? 'expand_less' : 'expand_more'"
        :size="20"
        class="shrink-0 text-on-surface-variant"
      />
    </div>

    <!-- Children with collapse animation -->
    <Transition name="mli-expand">
      <div v-if="isExpanded" class="mli-expand-grid">
        <div class="mli-expand-body">
          <slot name="children" />
        </div>
      </div>
    </Transition>
  </li>

  <component
    v-else
    :is="tag"
    :class="containerClasses"
    v-bind="linkProps"
    role="listitem"
    @click="handleClick"
  >
    <!-- Divider -->
    <div
      v-if="hasDivider"
      class="absolute top-0 right-0 h-px bg-outline-variant"
      :class="hasDivider === 'inset' ? 'left-16' : 'left-0'"
    />

    <!-- Leading -->
    <slot name="leading">
      <template v-if="resolvedLeading === 'icon'">
        <MIcon :name="icon!" :size="24" class="shrink-0 text-on-surface-variant" />
      </template>
      <template v-else-if="resolvedLeading === 'icon-container'">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          :class="iconContainerClasses[iconContainerColor || 'primary']"
        >
          <MIcon :name="icon!" :size="24" />
        </div>
      </template>
      <template v-else-if="resolvedLeading === 'avatar'">
        <MAvatar :name="avatarName!" :size="40" class="shrink-0" />
      </template>
      <template v-else-if="resolvedLeading === 'image'">
        <img :src="image" alt="" class="h-14 w-14 shrink-0 rounded-md object-cover">
      </template>
      <template v-else-if="resolvedLeading === 'checkbox'">
        <MCheckbox :model-value="isActive" class="shrink-0" />
      </template>
    </slot>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <slot>
        <p class="truncate text-body-large text-on-surface">{{ title }}</p>
        <p v-if="subtitle && resolvedLines >= 2" class="text-body-medium text-on-surface-variant" :class="resolvedLines === 2 && 'truncate'">
          {{ subtitle }}
        </p>
        <p v-if="description && resolvedLines >= 3" class="line-clamp-2 text-body-small text-on-surface-variant">
          {{ description }}
        </p>
      </slot>
    </div>

    <!-- Trailing -->
    <slot name="trailing">
      <template v-if="resolvedTrailing === 'icon'">
        <MIcon :name="trailingIcon!" :size="24" class="shrink-0 text-on-surface-variant" />
      </template>
      <template v-else-if="resolvedTrailing === 'text'">
        <span class="shrink-0 text-label-small text-on-surface-variant">{{ trailingText }}</span>
      </template>
      <template v-else-if="resolvedTrailing === 'switch'">
        <MSwitch :model-value="!!trailingValue" @update:model-value="handleTrailingToggle" />
      </template>
      <template v-else-if="resolvedTrailing === 'checkbox'">
        <MCheckbox :model-value="!!trailingValue" @update:model-value="handleTrailingToggle" />
      </template>
    </slot>
  </component>
</template>

<style>
.mli-expand-grid {
  display: grid;
  grid-template-rows: 1fr;
}
.mli-expand-body {
  min-height: 0;
  overflow: hidden;
  padding-left: 2rem;
}

.mli-expand-enter-active {
  transition: grid-template-rows 300ms cubic-bezier(0.2, 0, 0, 1);
}
.mli-expand-enter-active > .mli-expand-body {
  transition: opacity 200ms 80ms cubic-bezier(0.2, 0, 0, 1);
}
.mli-expand-enter-from {
  grid-template-rows: 0fr;
}
.mli-expand-enter-from > .mli-expand-body {
  opacity: 0;
}

.mli-expand-leave-active {
  transition: grid-template-rows 250ms cubic-bezier(0.4, 0, 1, 1);
}
.mli-expand-leave-active > .mli-expand-body {
  transition: opacity 120ms cubic-bezier(0.4, 0, 1, 1);
}
.mli-expand-leave-to {
  grid-template-rows: 0fr;
}
.mli-expand-leave-to > .mli-expand-body {
  opacity: 0;
}
</style>
