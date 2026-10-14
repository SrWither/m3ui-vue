<script setup lang="ts">
// Private helper for MTransferList: one pane (header with select-all, search, list).
// Both panes render through this so the source and target never drift apart.
import { computed, onBeforeUpdate, ref } from 'vue'
import MIcon from './MIcon.vue'
import MCheckbox from './MCheckbox.vue'
import type { TransferItem } from './MTransferList.vue'

type Value = string | number

const props = defineProps<{
  title: string
  items: TransferItem[]
  checked: Set<Value>
  filterable: boolean
  search: string
  searchPlaceholder: string
  emptyText: string
  listHeight: string
  /** Side new items slide in from: the source pane receives from the end, the target from the start. */
  enterFrom: 'start' | 'end'
  selectAllLabel: string
  clearSearchLabel: string
  /** The `#item` slot draws the whole row: no checkbox, padding, min height or background. */
  bare: boolean
}>()

defineSlots<{
  item?: (props: { item: TransferItem; checked: boolean; toggle: () => void; move: () => void }) => unknown
  empty?: () => unknown
}>()

const emit = defineEmits<{
  toggle: [Value]
  toggleAll: []
  activate: [Value]
  'update:search': [string]
}>()

const checkedVisible = computed(() => props.items.filter((i) => props.checked.has(i.value)).length)
const allChecked = computed(() => props.items.length > 0 && checkedVisible.value === props.items.length)
const someChecked = computed(() => checkedVisible.value > 0 && !allChecked.value)

// Leaving rows go `position: absolute` so the rest can slide up, but with no `top` each one
// falls back to its static position, which shifts as its siblings leave the flow too: on a
// "move all" every row collapsed onto the first slot while fading out. Snapshot every row's
// offset before the update (once the first leave starts, later measurements are already
// wrong) and pin each leaving row there.
const listEl = ref<HTMLElement>()
const rowBoxes = new WeakMap<Element, { top: number; left: number; width: number }>()
onBeforeUpdate(() => {
  listEl.value?.querySelectorAll<HTMLElement>(':scope > ul > li').forEach((li) =>
    rowBoxes.set(li, { top: li.offsetTop, left: li.offsetLeft, width: li.offsetWidth }),
  )
})
function pinLeaving(el: Element) {
  const box = rowBoxes.get(el)
  if (!box) return
  // Left and width too: a `bare` list is padded, so `left: 0; right: 0` would widen the row.
  Object.assign((el as HTMLElement).style, { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, right: 'auto' })
}

// Controls inside custom `#item` content (buttons, links, fields, or anything marked with
// `data-transfer-action`) keep their own clicks and keys instead of toggling or moving the row.
const CONTROL = 'button, a, select, textarea, [contenteditable], [data-transfer-action], input:not([type="checkbox"])'
const fromControl = (e: Event) => !!(e.target as Element).closest(CONTROL)

function onRowClick(e: MouseEvent, value: Value) {
  // The checkbox handles its own clicks (its label + input); toggling here too is exactly
  // the old double-toggle bug, where the box showed checked but the state wasn't.
  if ((e.target as Element).closest('label') || fromControl(e)) return
  emit('toggle', value)
}
function onRowActivate(e: Event, value: Value) {
  if (fromControl(e)) return
  e.preventDefault()
  emit('activate', value)
}
// `bare` rows have no checkbox, so the row itself is the focusable checkbox: Space toggles.
function onRowSpace(e: KeyboardEvent, value: Value) {
  if (!props.bare || e.target !== e.currentTarget) return
  e.preventDefault()
  emit('toggle', value)
}
</script>

<template>
  <section class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface-container-low">
    <!-- Header: select-all + title + count -->
    <header class="flex items-center gap-4 px-4 pt-3 pb-2">
      <MCheckbox
        :model-value="allChecked"
        :indeterminate="someChecked"
        :disabled="!items.length"
        :aria-label="selectAllLabel"
        @update:model-value="emit('toggleAll')"
      />
      <h3 class="min-w-0 flex-1 truncate text-title-medium text-on-surface">{{ title }}</h3>
      <span class="shrink-0 text-label-medium tabular-nums text-on-surface-variant">
        {{ checkedVisible }}/{{ items.length }}
      </span>
    </header>

    <!-- Search -->
    <div v-if="filterable" class="px-3 pb-2">
      <div
        class="flex h-10 items-center gap-2 rounded-full bg-surface-container-high pr-1 pl-3 focus-within:ring-2 focus-within:ring-secondary"
      >
        <MIcon name="search" :size="20" class="shrink-0 text-on-surface-variant" />
        <input
          :value="search"
          type="text"
          :placeholder="searchPlaceholder"
          class="min-w-0 flex-1 bg-transparent text-body-medium text-on-surface caret-primary outline-none placeholder:text-on-surface-variant"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="search"
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
          :aria-label="clearSearchLabel"
          @click="emit('update:search', '')"
        >
          <MIcon name="close" :size="18" />
        </button>
      </div>
    </div>

    <!-- List -->
    <div ref="listEl" class="relative overflow-y-auto overscroll-contain" :style="{ height: listHeight }">
      <TransitionGroup
        tag="ul"
        :name="`m3-tl-${enterFrom}`"
        class="relative"
        :class="bare ? 'flex flex-col gap-2 p-2' : 'py-1'"
        @before-leave="pinLeaving"
      >
        <li
          v-for="item in items"
          :key="item.value"
          class="group relative cursor-pointer select-none"
          :class="bare
            ? 'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-secondary'
            : ['flex min-h-14 items-center gap-4 px-4 py-2 transition-colors duration-150', checked.has(item.value) ? 'bg-secondary-container' : '']"
          :tabindex="bare ? 0 : undefined"
          :role="bare ? 'checkbox' : undefined"
          :aria-checked="bare ? checked.has(item.value) : undefined"
          :aria-label="bare ? item.label : undefined"
          @click="onRowClick($event, item.value)"
          @dblclick="onRowActivate($event, item.value)"
          @keydown.enter="onRowActivate($event, item.value)"
          @keydown.space="onRowSpace($event, item.value)"
        >
          <!-- bare: the slot draws the whole row -->
          <slot
            v-if="bare"
            name="item"
            :item="item"
            :checked="checked.has(item.value)"
            :toggle="() => emit('toggle', item.value)"
            :move="() => emit('activate', item.value)"
          />
          <template v-else>
            <span
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-[0.08]"
              :class="checked.has(item.value) ? 'bg-on-secondary-container' : 'bg-on-surface'"
            />
            <MCheckbox
              class="relative"
              :model-value="checked.has(item.value)"
              :aria-label="item.label"
              @update:model-value="emit('toggle', item.value)"
            />
            <!-- #item replaces the icon and text; the row (checkbox, highlight, hover) stays -->
            <div v-if="$slots.item" class="relative min-w-0 flex-1">
              <slot
                name="item"
                :item="item"
                :checked="checked.has(item.value)"
                :toggle="() => emit('toggle', item.value)"
                :move="() => emit('activate', item.value)"
              />
            </div>
            <template v-else>
              <span
                v-if="item.icon"
                class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
                :class="checked.has(item.value) ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-on-surface-variant'"
              >
                <MIcon :name="item.icon" :size="20" />
              </span>
              <span class="relative min-w-0 flex-1">
                <span
                  class="block truncate text-body-large"
                  :class="checked.has(item.value) ? 'text-on-secondary-container' : 'text-on-surface'"
                >{{ item.label }}</span>
                <span
                  v-if="item.description"
                  class="block truncate text-body-medium"
                  :class="checked.has(item.value) ? 'text-on-secondary-container/80' : 'text-on-surface-variant'"
                >{{ item.description }}</span>
              </span>
            </template>
          </template>
        </li>
      </TransitionGroup>

      <div
        v-if="!items.length"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <slot name="empty">
          <MIcon :name="search ? 'search_off' : 'inbox'" :size="32" class="text-on-surface-variant/60" />
          <p class="text-body-medium text-on-surface-variant">{{ emptyText }}</p>
        </slot>
      </div>
    </div>
  </section>
</template>

<style scoped>
.m3-tl-start-move,
.m3-tl-end-move {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.m3-tl-start-enter-active,
.m3-tl-end-enter-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.m3-tl-start-leave-active,
.m3-tl-end-leave-active {
  transition: opacity 0.15s ease;
  position: absolute;
  left: 0;
  right: 0;
}
.m3-tl-start-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}
.m3-tl-end-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.m3-tl-start-leave-to,
.m3-tl-end-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .m3-tl-start-move,
  .m3-tl-end-move,
  .m3-tl-start-enter-active,
  .m3-tl-end-enter-active,
  .m3-tl-start-leave-active,
  .m3-tl-end-leave-active {
    transition: none;
  }
}
</style>
