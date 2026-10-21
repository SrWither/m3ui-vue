<script setup lang="ts">
/**
 * A row of an MList: headline with optional overline, supporting text, a leading icon, avatar or image, and
 * trailing text, icon, checkbox or switch. It can be a link, be clickable or expand to show nested items.
 *
 * @slot leading Custom leading element, replacing the icon/avatar/image/icon-container
 * @slot overline Custom overline content, replacing the overline prop
 * @slot default Custom content replacing the title/subtitle/description text block
 * @slot children Nested content revealed when expandable is set and the item is expanded
 * @slot trailing Custom trailing element, replacing the icon/text/switch/checkbox
 * @event click Fires on any click, including on an expandable item (right before it toggles)
 * @event update:trailingValue Fires when a trailing switch/checkbox is toggled (trailing='switch' | 'checkbox')
 * @event update:expanded Fires when an expandable item is toggled open/closed
 */
import { computed, getCurrentInstance, h, inject, ref, useId, watch, type FunctionalComponent } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { ComputedRef } from 'vue'
import MIcon from './MIcon.vue'
import MAvatar from './MAvatar.vue'
import MCheckbox from './MCheckbox.vue'
import MSwitch from './MSwitch.vue'
import { useSpring } from '../composables/_useSpring'

export type ListItemLeading = 'icon' | 'avatar' | 'checkbox' | 'radio' | 'image' | 'icon-container'
export type ListItemTrailing = 'icon' | 'text' | 'switch' | 'checkbox'

const props = withDefaults(
  defineProps<{
    /** Primary text (headline) */
    title?: string
    /** Small label above the title */
    overline?: string
    /** Secondary text (line 2) */
    subtitle?: string
    /** Tertiary text (line 3) */
    description?: string
    /** Number of text lines — auto-detected from which text props/parent MList lines are set when omitted */
    lines?: 1 | 2 | 3
    /** Leading Material Symbol icon */
    icon?: string
    /**
     * Leading element type — auto-resolves to 'icon'/'avatar'/'image' from icon/avatarName/image when omitted
     */
    leading?: ListItemLeading
    /** Name for the avatar (when leading='avatar') */
    avatarName?: string
    /** Image URL (when leading='image') */
    image?: string
    /** Icon container background color (when leading='icon-container') */
    iconContainerColor?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success'
    /** Trailing icon name */
    trailingIcon?: string
    /** Trailing text label */
    trailingText?: string
    /** Trailing element type — auto-resolves from trailingIcon/trailingText when omitted */
    trailing?: ListItemTrailing
    /** Value for a trailing switch/checkbox (v-model:trailingValue) */
    trailingValue?: boolean
    /** Selection value — compared against the parent MList selected prop */
    value?: string | number
    /** Force the active/highlighted state regardless of parent list selection */
    active?: boolean
    /** Disabled state (38% opacity, blocks interaction) */
    disabled?: boolean
    /** Force interactive styling/behavior (auto-true when href, to, @click, selectable, or expandable apply) */
    clickable?: boolean
    /** Link URL — renders the item as an `<a>` */
    href?: string
    /** Vue Router destination — renders the item as a router-link */
    to?: string | object
    /** Show an expand/collapse chevron revealing the #children slot */
    expandable?: boolean
    /** Control the expanded state (v-model:expanded) — otherwise managed internally */
    expanded?: boolean
  }>(),
  { active: false, disabled: false, expandable: false },
)

const emit = defineEmits<{
  click: [e: MouseEvent]
  'update:trailingValue': [value: boolean]
  'update:expanded': [value: boolean]
}>()

// Root attrs go on the row (the element that looks like the item), which is wrapped in an <li> for links and buttons
defineOptions({ inheritAttrs: false })
// `click` is a declared emit, so a listener for it never shows up in attrs: read it off the vnode
const instance = getCurrentInstance()
const hasClickListener = () => !!instance?.vnode.props?.onClick

const internalExpanded = ref(props.expanded ?? false)
watch(() => props.expanded, (v) => { if (v !== undefined) internalExpanded.value = v })
const isExpanded = computed(() => internalExpanded.value)

const list = inject<{
  segmentPosition: (el: Element | null | undefined) => 'single' | 'first' | 'middle' | 'last' | undefined
  dense: ComputedRef<boolean>
  nav: ComputedRef<boolean>
  segmented: ComputedRef<boolean>
  selectable: ComputedRef<boolean>
  selected: ComputedRef<string | number | null | undefined>
  dividers: ComputedRef<boolean | 'inset'>
  lines: ComputedRef<1 | 2 | 3 | undefined>
  select: (value: string | number) => void
} | null>('m-list', null)

const resolvedLines = computed(() => {
  if (props.lines) return props.lines
  if (list?.lines.value) return list.lines.value
  if (props.description || (props.overline && props.subtitle)) return 3
  if (props.subtitle || props.overline) return 2
  return 1
})

const isClickable = computed(() =>
  props.clickable || props.href || props.to || hasClickListener() || list?.selectable.value || props.expandable,
)

// What the row is for assistive technology and the keyboard. In a selectable list, an option of its listbox
// (MList moves focus between them with the arrows); a link stays a link and a clickable row is a button, each
// inside an <li> since a list can only hold list items; anything else is a plain list item.
const isOption = computed(() => !!list?.selectable.value && props.value != null && !props.href && !props.to && !props.expandable)
const isLink = computed(() => !!(props.href || props.to))
const isButton = computed(() => !isOption.value && !isLink.value && !props.expandable && (props.clickable || hasClickListener()))
const wrapped = computed(() => isLink.value || isButton.value)
const rowRole = computed(() => (isOption.value ? 'option' : isButton.value ? 'button' : isLink.value ? undefined : 'listitem'))
const rowTabindex = computed(() => {
  if (isOption.value) return isActive.value && !props.disabled ? 0 : -1
  if (isButton.value) return props.disabled ? -1 : 0
  return undefined
})
function onRowKeyDown(e: KeyboardEvent) {
  if (!isOption.value && !isButton.value) return
  if ((e.key !== 'Enter' && e.key !== ' ') || e.target !== e.currentTarget) return
  e.preventDefault()
  handleClick(e as unknown as MouseEvent)
}

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
const isSegmented = computed(() => list?.segmented.value ?? false)
const hasDivider = computed(() => list?.dividers.value ?? false)

// ListTokens: ItemSelectedLabelTextColor/ItemSelectedLeadingIconColor/etc = OnSecondaryContainer
const activeTextClass = computed(() => (isActive.value ? 'text-on-secondary-container' : 'text-on-surface'))
const activeIconClass = computed(() => (isActive.value ? 'text-on-secondary-container' : 'text-on-surface-variant'))

// ListTokens: ItemOneLineContainerHeight/TwoLine/ThreeLine = 56/72/88dp; dense is a library
// extension with no spec token, so it keeps its own compact padding instead of this floor.
const minHeightClass = computed(() => {
  if (isDense.value) return ''
  return resolvedLines.value === 3 ? 'min-h-22' : resolvedLines.value === 2 ? 'min-h-18' : 'min-h-14'
})

const containerClasses = computed(() => [
  'mli-row relative flex w-full items-center gap-4 text-left',
  // Corner radius: a pill in nav lists, otherwise sprung by expressiveRadii below
  isSegmented.value ? 'bg-surface-container px-4' : isNav.value ? 'rounded-full px-4' : 'px-4',
  isDense.value
    ? 'py-1'
    : resolvedLines.value === 3 ? 'py-3' : 'py-2',
  minHeightClass.value,
  isClickable.value && !props.disabled && 'cursor-pointer transition-colors duration-150 hover:bg-on-surface/8 active:bg-on-surface/12',
  // ListTokens: ItemSelectedContainerColor = SecondaryContainer, applies to any selected list
  // item, not just nav/segmented contexts.
  isActive.value && 'bg-secondary-container text-on-secondary-container',
  props.disabled && 'opacity-[0.38] pointer-events-none',
])

// ── Expressive shape morph ──────────────────────────────────────────────────────────────────
// The current (non-deprecated) ListItem overloads morph the container's corners by interaction, with
// ListItemDefaults.shapes(): ListTokens.ItemContainerExpressiveShape CornerExtraSmall (4dp) at rest,
// ItemHovered… CornerMedium (8dp), ItemPressed/Focused/Selected… CornerLarge (16dp), priority
// pressed > selected > focused > hovered (shapeForInteraction). SegmentedListItem's segmentedShapes() swaps
// only the resting shape's outer corners for ListTokens.ContainerShape (CornerLarge) on the first and last
// item of a run; the interaction shapes stay the same. Animated with MotionSchemeKeyTokens.FastSpatial.
// Nav lists keep their pill (that's NavigationDrawerItem's shape, which doesn't morph).
const rootEl = ref<Element | ComponentPublicInstance | null>(null)
// The <li> around a link or button row (the list's child, for segment runs); other rows are the <li> themselves
const wrapperEl = ref<Element | null>(null)
const RowWrapper: FunctionalComponent = (_, { slots }) =>
  wrapped.value
    ? h('li', { role: 'listitem', ref: (e) => { wrapperEl.value = e as Element | null } }, slots.default?.())
    : slots.default?.()
const shapeEl = ref<HTMLElement | null>(null)
const el = (r: Element | ComponentPublicInstance | null) => (r && '$el' in r ? (r.$el as Element) : r)
const hovered = ref(false)
const pressed = ref(false)
const focused = ref(false)

const REST = 4
const HOVERED = 8
const LARGE = 16

const segmentPosition = computed(() => (isSegmented.value ? list?.segmentPosition(wrapped.value ? wrapperEl.value : el(rootEl.value)) : undefined))

const expressiveRadii = computed<number[]>(() => {
  if (isNav.value) return []
  const interactive = isClickable.value && !props.disabled
  const r = interactive && pressed.value ? LARGE
    : isActive.value ? LARGE
      : interactive && focused.value ? LARGE
        : interactive && hovered.value ? HOVERED
          : null
  if (r !== null) return [r, r, r, r]
  const pos = segmentPosition.value
  const top = pos === 'first' || pos === 'single' ? LARGE : REST
  const bottom = pos === 'last' || pos === 'single' ? LARGE : REST
  return [top, top, bottom, bottom]
})

const { snap } = useSpring(() => expressiveRadii.value, (v) => {
  const target = shapeEl.value ?? (el(rootEl.value) as HTMLElement | null)
  if (!target) return
  target.style.borderRadius = v.length ? v.map((n) => `${n}px`).join(' ') : ''
})
// A change of place in the list (or of list style) isn't an interaction: jump there
watch([segmentPosition, isNav], () => snap())

function onPointerEnter(e: PointerEvent) { if (e.pointerType !== 'touch') hovered.value = true }
function onPointerLeave() { hovered.value = false; pressed.value = false }
function onPointerDown(e: PointerEvent) { if (e.button === 0) pressed.value = true }
function onPointerUp() { pressed.value = false }
function onFocus(e: FocusEvent) { focused.value = (e.currentTarget as Element).matches(':focus-visible') }
function onBlur() { focused.value = false }

const tag = computed(() => {
  if (props.href) return 'a'
  if (props.to) return 'router-link'
  if (isButton.value) return 'div'
  return 'li'
})

const linkProps = computed(() => {
  if (props.href) return { href: props.href }
  if (props.to) return { to: props.to }
  return {}
})

// An expandable item's header is a button (the row stays the list item): reachable and operable from the
// keyboard, telling assistive technology whether its children are shown
const childrenId = useId()
function onHeaderKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  if (e.target !== e.currentTarget) return
  e.preventDefault()
  handleClick(e as unknown as MouseEvent)
}

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
  <li v-if="expandable" ref="rootEl" v-bind="$attrs" role="listitem">
    <div
      ref="shapeEl"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-expanded="isExpanded"
      :aria-controls="childrenId"
      :aria-disabled="disabled || undefined"
      class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
      :class="containerClasses"
      @click="handleClick"
      @keydown="onHeaderKeyDown"
      @focus="onFocus"
      @blur="onBlur"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- Leading -->
      <slot name="leading">
        <MIcon v-if="resolvedLeading === 'icon'" :name="icon!" :size="24" class="shrink-0" :class="activeIconClass" />
      </slot>

      <!-- Content -->
      <div class="min-w-0 flex-1">
        <slot name="overline">
          <p v-if="overline" class="truncate text-label-small" :class="activeIconClass">{{ overline }}</p>
        </slot>
        <slot>
          <p class="truncate text-body-large" :class="activeTextClass">{{ title }}</p>
          <p v-if="subtitle && resolvedLines >= 2" class="text-body-medium" :class="[activeIconClass, resolvedLines === 2 && 'truncate']">
            {{ subtitle }}
          </p>
        </slot>
      </div>

      <!-- Expand icon -->
      <MIcon
        :name="isExpanded ? 'expand_less' : 'expand_more'"
        :size="20"
        class="shrink-0"
        :class="activeIconClass"
      />
    </div>

    <!-- Children with collapse animation -->
    <Transition name="mli-expand">
      <div v-if="isExpanded" :id="childrenId" class="mli-expand-grid">
        <div class="mli-expand-body">
          <slot name="children" />
        </div>
      </div>
    </Transition>
  </li>

  <RowWrapper v-else>
    <component
      :is="tag"
      :class="containerClasses"
      ref="rootEl"
      v-bind="{ ...linkProps, ...$attrs }"
      :role="rowRole"
      :tabindex="rowTabindex"
      :aria-selected="isOption ? isActive : undefined"
      :aria-disabled="(isOption || isButton) && disabled ? 'true' : undefined"
      @click="handleClick"
      @keydown="onRowKeyDown"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @focus="onFocus"
      @blur="onBlur"
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
          <MIcon :name="icon!" :size="24" class="shrink-0" :class="activeIconClass" />
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
        <slot name="overline">
          <p v-if="overline" class="truncate text-label-small" :class="activeIconClass">{{ overline }}</p>
        </slot>
        <slot>
          <p class="truncate text-body-large" :class="activeTextClass">{{ title }}</p>
          <p v-if="subtitle && resolvedLines >= 2" class="text-body-medium" :class="[activeIconClass, resolvedLines === 2 && 'truncate']">
            {{ subtitle }}
          </p>
          <p v-if="description && resolvedLines >= 3" class="line-clamp-2 text-body-small" :class="activeIconClass">
            {{ description }}
          </p>
        </slot>
      </div>

      <!-- Trailing -->
      <slot name="trailing">
        <template v-if="resolvedTrailing === 'icon'">
          <MIcon :name="trailingIcon!" :size="24" class="shrink-0" :class="activeIconClass" />
        </template>
        <template v-else-if="resolvedTrailing === 'text'">
          <span class="shrink-0 text-label-small" :class="activeIconClass">{{ trailingText }}</span>
        </template>
        <template v-else-if="resolvedTrailing === 'switch'">
          <MSwitch :model-value="!!trailingValue" @update:model-value="handleTrailingToggle" />
        </template>
        <template v-else-if="resolvedTrailing === 'checkbox'">
          <MCheckbox :model-value="!!trailingValue" @update:model-value="handleTrailingToggle" />
        </template>
      </slot>
    </component>
  </RowWrapper>
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
