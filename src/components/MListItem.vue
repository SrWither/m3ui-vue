<script setup lang="ts">
import { computed, inject, ref, useAttrs } from 'vue'
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
const isExpanded = computed(() => props.expanded ?? internalExpanded.value)

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
  'relative flex w-full items-center gap-4 text-left',
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
  return 'li'
})

const linkProps = computed(() => {
  if (props.href) return { href: props.href }
  if (props.to) return { to: props.to }
  return {}
})

function handleClick(e: MouseEvent) {
  if (props.disabled) return
  if (props.expandable) {
    internalExpanded.value = !internalExpanded.value
    emit('update:expanded', internalExpanded.value)
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
  <div>
    <component
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
        <template v-if="resolvedTrailing === 'expand'">
          <MIcon
            :name="isExpanded ? 'expand_less' : 'expand_more'"
            :size="24"
            class="shrink-0 text-on-surface-variant transition-transform duration-200"
          />
        </template>
        <template v-else-if="resolvedTrailing === 'icon'">
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

    <!-- Expandable children -->
    <Transition
      enter-active-class="transition-[grid-template-rows] duration-200 ease-out"
      leave-active-class="transition-[grid-template-rows] duration-150 ease-in"
      enter-from-class="grid-rows-[0fr]"
      enter-to-class="grid-rows-[1fr]"
      leave-from-class="grid-rows-[1fr]"
      leave-to-class="grid-rows-[0fr]"
    >
      <div v-if="expandable && isExpanded" class="grid grid-rows-[1fr]">
        <div class="overflow-hidden">
          <div :class="resolvedLeading ? 'pl-14' : 'pl-4'">
            <slot name="children" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
