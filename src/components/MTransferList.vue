<script lang="ts">
export interface TransferItem {
  value: string | number
  label: string
  icon?: string
  /** Optional second line under the label (an email, a role, a short description). */
  description?: string
}
</script>

<script setup lang="ts" generic="T extends TransferItem = TransferItem">
/**
 * Move items between two panes, with select-all, optional search and v-model on the values in the target pane.
 * Check rows and use the arrows, or double-click a row (or press Enter on its checkbox) to send it straight
 * across. When the component is narrow, the panes stack and the arrows point up and down.
 *
 * @slot item Custom row content. Without bare it replaces the icon and text and keeps the checkbox, highlight
 *   and hover; with bare it draws the whole row. side is 'source' or 'target', toggle() checks the row, move()
 *   sends it to the other pane. Buttons, links, fields and elements with data-transfer-action keep their own
 *   clicks
 * @slot source-empty Custom content when the source pane is empty
 * @slot target-empty Custom content when the target pane is empty
 * @event update:modelValue Emitted whenever items move between panes (v-model)
 */
import { computed, ref } from 'vue'
import MIconButton from './MIconButton.vue'
import MTransferPane from './_MTransferPane.vue'
import { useLocale } from '../composables/useLocale'

const locale = useLocale()

type Value = string | number

const props = withDefaults(defineProps<{
  /** Values in the target (right or bottom) pane (v-model) */
  modelValue: Value[]
  /** Full list of items; see `TransferItem` (or your own type extending it) */
  items: T[]
  /** Source pane title (defaults to the locale string) */
  sourceTitle?: string
  /** Target pane title (defaults to the locale string) */
  targetTitle?: string
  /** Show a search field in each pane. It matches the label and the description */
  filterable?: boolean
  /** Search field placeholder (defaults to the locale string) */
  searchPlaceholder?: string
  /** Text when a pane is empty (defaults to the locale string) */
  emptyText?: string
  /** Aria label for the move-all-right button (defaults to the locale string) */
  moveAllRightLabel?: string
  /** Aria label for the move-selected-right button (defaults to the locale string) */
  moveRightLabel?: string
  /** Aria label for the move-selected-left button (defaults to the locale string) */
  moveLeftLabel?: string
  /** Aria label for the move-all-left button (defaults to the locale string) */
  moveAllLeftLabel?: string
  /** Height of each list's scroll area (any CSS length). */
  listHeight?: string
  /**
   * Fully custom rows: the `#item` slot draws the whole row (no checkbox, padding, min height
   * or background). The row stays clickable, focusable (Space checks it, Enter moves it) and
   * animated; use the slot's `checked` to style the checked state.
   */
  bare?: boolean
}>(), {
  filterable: false,
  listHeight: '280px',
  bare: false,
})

defineSlots<{
  /**
   * Custom row content. Without `bare` it replaces the icon and text, keeping the checkbox,
   * highlight and hover. Buttons, links, fields and `[data-transfer-action]` elements inside
   * keep their own clicks instead of checking the row.
   */
  item?: (props: {
    /** Your item, with any extra fields it carries. */
    item: T
    checked: boolean
    /** Which pane the row is in. */
    side: 'source' | 'target'
    /** Check or uncheck the row. */
    toggle: () => void
    /** Send just this row to the other pane. */
    move: () => void
  }) => unknown
  'source-empty'?: () => unknown
  'target-empty'?: () => unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [Value[]] }>()

const checkedSource = ref<Set<Value>>(new Set())
const checkedTarget = ref<Set<Value>>(new Set())
const sourceSearch = ref('')
const targetSearch = ref('')

function matches(item: TransferItem, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return item.label.toLowerCase().includes(needle) || !!item.description?.toLowerCase().includes(needle)
}

const sourceItems = computed(() => {
  const selected = new Set(props.modelValue)
  return props.items.filter((i) => !selected.has(i.value) && matches(i, sourceSearch.value))
})

const targetItems = computed(() => {
  const selected = new Set(props.modelValue)
  return props.items.filter((i) => selected.has(i.value) && matches(i, targetSearch.value))
})

function toggleIn(set: typeof checkedSource, value: Value) {
  const s = new Set(set.value)
  s.has(value) ? s.delete(value) : s.add(value)
  set.value = s
}

// Select-all acts on what's visible (i.e. what the search left).
function toggleAllIn(set: typeof checkedSource, visible: TransferItem[]) {
  const allChecked = visible.length > 0 && visible.every((i) => set.value.has(i.value))
  const s = new Set(set.value)
  for (const i of visible) allChecked ? s.delete(i.value) : s.add(i.value)
  set.value = s
}

const toggleSource = (v: Value) => toggleIn(checkedSource, v)
const toggleTarget = (v: Value) => toggleIn(checkedTarget, v)
const toggleAllSource = () => toggleAllIn(checkedSource, sourceItems.value)
const toggleAllTarget = () => toggleAllIn(checkedTarget, targetItems.value)

function moveRight() {
  emit('update:modelValue', [...props.modelValue, ...checkedSource.value])
  checkedSource.value = new Set()
}
function moveLeft() {
  const remove = checkedTarget.value
  emit('update:modelValue', props.modelValue.filter((v) => !remove.has(v)))
  checkedTarget.value = new Set()
}
function moveAllRight() {
  emit('update:modelValue', [...props.modelValue, ...sourceItems.value.map((i) => i.value)])
  checkedSource.value = new Set()
}
function moveAllLeft() {
  const remove = new Set(targetItems.value.map((i) => i.value))
  emit('update:modelValue', props.modelValue.filter((v) => !remove.has(v)))
  checkedTarget.value = new Set()
}

// Double-click / Enter on a row moves just that item across.
function activateSource(value: Value) {
  emit('update:modelValue', [...props.modelValue, value])
  const s = new Set(checkedSource.value)
  s.delete(value)
  checkedSource.value = s
}
function activateTarget(value: Value) {
  emit('update:modelValue', props.modelValue.filter((v) => v !== value))
  const s = new Set(checkedTarget.value)
  s.delete(value)
  checkedTarget.value = s
}
</script>

<template>
  <!--
    Container query, not a viewport breakpoint: the panes sit side by side whenever the
    component itself is wide enough (@xl = 36rem), and stack with up/down arrows otherwise,
    whatever the screen size.
  -->
  <div class="@container">
    <div class="flex flex-col items-stretch gap-3 @xl:flex-row">
      <MTransferPane
        :title="sourceTitle ?? locale.available"
        :items="sourceItems"
        :checked="checkedSource"
        :filterable="filterable"
        :search="sourceSearch"
        :search-placeholder="searchPlaceholder ?? locale.search"
        :empty-text="emptyText ?? locale.noItems"
        :list-height="listHeight"
        enter-from="end"
        :select-all-label="locale.selectAll"
        :clear-search-label="locale.clearSearch"
        :bare="bare"
        @toggle="toggleSource"
        @toggle-all="toggleAllSource"
        @activate="activateSource"
        @update:search="sourceSearch = $event"
      >
        <template v-if="$slots.item" #item="row"><slot name="item" v-bind="row" :item="row.item as T" side="source" /></template>
        <template v-if="$slots['source-empty']" #empty><slot name="source-empty" /></template>
      </MTransferPane>

      <!-- Transfer buttons: tonal for the checked items, outlined for "all" -->
      <div class="flex items-center justify-center gap-2 @xl:flex-col">
        <MIconButton
          icon="keyboard_double_arrow_right"
          variant="outlined"
          class="rotate-90 @xl:rotate-0"
          :label="moveAllRightLabel ?? locale.moveAllRight"
          :disabled="!sourceItems.length"
          @click="moveAllRight"
        />
        <MIconButton
          icon="chevron_right"
          variant="tonal"
          class="rotate-90 @xl:rotate-0"
          :label="moveRightLabel ?? locale.moveRight"
          :disabled="!checkedSource.size"
          @click="moveRight"
        />
        <MIconButton
          icon="chevron_left"
          variant="tonal"
          class="rotate-90 @xl:rotate-0"
          :label="moveLeftLabel ?? locale.moveLeft"
          :disabled="!checkedTarget.size"
          @click="moveLeft"
        />
        <MIconButton
          icon="keyboard_double_arrow_left"
          variant="outlined"
          class="rotate-90 @xl:rotate-0"
          :label="moveAllLeftLabel ?? locale.moveAllLeft"
          :disabled="!targetItems.length"
          @click="moveAllLeft"
        />
      </div>

      <MTransferPane
        :title="targetTitle ?? locale.selected"
        :items="targetItems"
        :checked="checkedTarget"
        :filterable="filterable"
        :search="targetSearch"
        :search-placeholder="searchPlaceholder ?? locale.search"
        :empty-text="emptyText ?? locale.noItems"
        :list-height="listHeight"
        enter-from="start"
        :select-all-label="locale.selectAll"
        :clear-search-label="locale.clearSearch"
        :bare="bare"
        @toggle="toggleTarget"
        @toggle-all="toggleAllTarget"
        @activate="activateTarget"
        @update:search="targetSearch = $event"
      >
        <template v-if="$slots.item" #item="row"><slot name="item" v-bind="row" :item="row.item as T" side="target" /></template>
        <template v-if="$slots['target-empty']" #empty><slot name="target-empty" /></template>
      </MTransferPane>
    </div>
  </div>
</template>
