<script setup lang="ts">
/**
 * An item of an MMenu or MContextMenu: icon, label and a shortcut hint. Put more items in its `#children` slot
 * to make it open a submenu. With `selected` it's one choice of several (Compose's SelectableDropdownMenuItem),
 * with `checked` an on/off setting (CheckableDropdownMenuItem): tertiary-container and rounder while on, with a
 * check that slides in.
 *
 * @slot default Item label text.
 * @slot children Nested submenu items. In the parent MMenu's default 'flyout' mode, clicking or hovering (mouse
 *   only) the item opens a side panel — supports unlimited nesting depth. In 'push' mode, clicking the item
 *   instead swaps the whole menu panel to the submenu with a back header; hover does nothing.
 * @event click Emitted when a leaf item (no #children) is clicked. Not emitted for disabled items or for items
 *   with #children, since clicking those just opens/toggles the submenu instead.
 * @event update:checked Emitted on click when `checked` is set, with the new value — powers v-model:checked
 */
import { computed, inject, nextTick, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'
import MIcon from './MIcon.vue'
import { FAST_EFFECTS, FAST_SPATIAL, useSpring } from '../composables/_useSpring'
import { POPUP_MARGIN, fitPopup } from '../composables/_popupPosition'

const props = withDefaults(defineProps<{
  /** Material Symbol icon name */
  icon?: string
  /** Keyboard shortcut hint displayed on the right (e.g. "Ctrl+C") — hidden when the item has #children */
  shortcut?: string
  /** Vue Router destination — renders as RouterLink instead of button */
  to?: string | Record<string, any>
  /** Disables the item */
  disabled?: boolean
  /** Danger/destructive styling (error color) */
  danger?: boolean
  /** Keep the menu open after this item is clicked. Defaults to true for `checked` items, false otherwise */
  keepOpen?: boolean
  /** Makes it one choice of several (radio-like): selected look while true. Leave unset for a plain item */
  selected?: boolean
  /** Makes it an on/off setting (v-model:checked, checkbox-like): checked look while true. Leave unset for a plain item */
  checked?: boolean
  /**
   * Icon shown while selected or checked. Defaults to a check that slides in when the item has no `icon`;
   * with an `icon`, that icon stays and turns filled
   */
  selectedIcon?: string
}>(), {
  disabled: false,
  danger: false,
  keepOpen: undefined,
  selected: undefined,
  checked: undefined,
})

const emit = defineEmits<{ click: [], 'update:checked': [boolean] }>()

const checkable = computed(() => props.checked !== undefined)
const selectable = computed(() => checkable.value || props.selected !== undefined)
const on = computed(() => !!(props.checked ?? props.selected))
// Without an `icon`, the selected icon (a check by default) only shows while on and slides the label aside
const slidingIcon = computed(() => selectable.value && !props.icon)
const onIcon = computed(() => props.selectedIcon ?? (props.icon ? undefined : 'check'))

// Where this item sits in a run of consecutive selectable/checkable siblings, MenuDefaults.itemShape(index,
// count): the first rounds its top corners, the last its bottom ones, a lone one stays square-ish
const position = ref<'single' | 'first' | 'middle' | 'last'>('single')
function measurePosition() {
  const el = itemEl.value
  if (!el || !selectable.value) return
  const choice = (n: Element | null) => !!n?.hasAttribute('data-m3-menu-choice')
  const prev = choice(el.previousElementSibling)
  const next = choice(el.nextElementSibling)
  position.value = prev && next ? 'middle' : prev ? 'last' : next ? 'first' : 'single'
}

// Item shapes (SegmentedMenuTokens, MenuDefaults' leading/middle/trailing/standalone item shapes): ItemShape
// 4dp, CornerMedium 12dp on the group's outer corners, ItemSelectedShape 12dp all round; corners morph on
// FastSpatial. The sliding icon expands on FastSpatial and fades on FastEffects (AnimatedVisibility's
// expandHorizontally + fadeIn).
const ICON_SPACE = 32 // 20dp icon + 12dp to the label
function radii(): number[] {
  if (on.value) return [12, 12, 12, 12]
  const top = position.value === 'first' ? 12 : 4
  const bottom = position.value === 'last' ? 12 : 4
  return [top, top, bottom, bottom]
}
const { snap } = useSpring(
  () => (selectable.value ? [...radii(), slidingIcon.value && on.value ? ICON_SPACE : 0] : []),
  ([tl, tr, br, bl, width]) => {
    const el = controlEl.value instanceof HTMLElement ? controlEl.value : controlEl.value?.$el
    if (el && bl !== undefined) el.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`
    if (iconSlotEl.value && width !== undefined) iconSlotEl.value.style.width = `${width}px`
  },
  FAST_SPATIAL,
)
// A position change comes from the layout (items added, removed, the menu opening): jump, don't morph
watch(position, () => snap())

let siblingsObserver: MutationObserver | null = null
onMounted(() => {
  measurePosition()
  const parent = itemEl.value?.parentElement
  if (!parent) return
  siblingsObserver = new MutationObserver(measurePosition)
  siblingsObserver.observe(parent, { childList: true })
})
onUnmounted(() => siblingsObserver?.disconnect())
watch(selectable, () => nextTick(measurePosition))
useSpring(
  () => (slidingIcon.value ? [on.value ? 1 : 0] : []),
  ([opacity]) => { if (iconSlotEl.value && opacity !== undefined) iconSlotEl.value.style.opacity = String(opacity) },
  FAST_EFFECTS,
)

const slots = useSlots()
const tag = computed(() => props.to ? 'RouterLink' : 'button')
const hasChildren = computed(() => !!slots.children)
const menuClose = inject<(() => void) | null>('m-menu-close', null)
const nav = inject<{
  mode: 'flyout' | 'push'
  push: (entry: { icon?: string, header?: () => any, content?: () => any }) => void
} | null>('m-menu-nav', null)

const itemEl = ref<HTMLElement>()
// The button, or a RouterLink instance when `to` is set
const controlEl = ref<HTMLElement | { $el: HTMLElement }>()
const iconSlotEl = ref<HTMLElement>()
const showSub = ref(false)
const subStyle = ref<Record<string, string>>({})

// To the item's right, else its left, else clamped on screen (see _popupPosition.ts); placeSub() settles it once
// the submenu is in the DOM and its size is known, before it paints
function positionSub() {
  if (!itemEl.value) return
  const rect = itemEl.value.getBoundingClientRect()
  subStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.right}px`,
    maxWidth: `${window.innerWidth - 2 * POPUP_MARGIN}px`,
    zIndex: '501',
  }
}

function placeSub(el: Element) {
  if (!itemEl.value) return
  const sub = el as HTMLElement
  const rect = itemEl.value.getBoundingClientRect()
  // Measured at the window's left edge, where nothing narrows it
  sub.style.left = '0px'
  const w = sub.offsetWidth
  const h = sub.offsetHeight
  const left = fitPopup([rect.right, rect.left - w], w, window.innerWidth)
  const top = fitPopup([rect.top, rect.bottom - h], h, window.innerHeight)
  subStyle.value = { ...subStyle.value, left: `${left}px`, top: `${top}px` }
  sub.style.left = `${left}px`
  sub.style.top = `${top}px`
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

  if (checkable.value) emit('update:checked', !props.checked)
  emit('click')
  if (!(props.keepOpen ?? checkable.value)) menuClose?.()
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
    :data-m3-menu-choice="selectable || undefined"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <!-- Selectable/checkable items sit 4dp in from the edges (DropdownMenuSelectableItemPadding) with 12dp
         inside, so their label lines up with plain items; the state layer is a pseudo-element so it can
         tint the selected container too -->
    <component
      :is="tag"
      ref="controlEl"
      :to="to || undefined"
      :type="to ? undefined : 'button'"
      :role="selectable ? (checkable ? 'menuitemcheckbox' : 'menuitemradio') : undefined"
      :aria-checked="selectable ? on : undefined"
      class="flex items-center gap-3 py-2.5 text-left text-body-large transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary"
      :class="selectable
        ? [
          'relative mx-1 w-[calc(100%-0.5rem)] px-3 duration-150 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-current before:opacity-0 before:transition-opacity',
          on ? 'bg-tertiary-container text-on-tertiary-container' : 'text-on-surface',
          disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer hover:before:opacity-[0.08] active:before:opacity-[0.12]',
        ]
        : [
          'w-full px-4',
          disabled ? 'cursor-not-allowed opacity-[0.38] text-on-surface' : 'cursor-pointer',
          !disabled && danger ? 'text-error hover:bg-error/8' : '',
          !disabled && !danger ? 'text-on-surface hover:bg-on-surface/8' : '',
        ]"
      :disabled="disabled || undefined"
      :aria-haspopup="hasChildren ? 'menu' : undefined"
      :aria-expanded="hasChildren ? showSub : undefined"
      @click="handleClick"
    >
      <!-- -mr-3 cancels the flex gap, so the label sits flush while the slot is closed -->
      <span v-if="slidingIcon" ref="iconSlotEl" class="-mr-3 flex shrink-0 overflow-hidden" style="width: 0; opacity: 0">
        <MIcon :name="onIcon!" :size="20" class="shrink-0" />
      </span>
      <MIcon
        v-else-if="icon"
        :name="on && onIcon ? onIcon : icon"
        :filled="on && !onIcon"
        :size="20"
        class="shrink-0"
        :class="selectable ? (on ? '' : 'text-on-surface-variant') : danger ? 'text-error' : 'text-on-surface-variant'"
      />
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
        @enter="placeSub"
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
