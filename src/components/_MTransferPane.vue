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
const rowTops = new WeakMap<Element, number>()
onBeforeUpdate(() => {
  listEl.value?.querySelectorAll(':scope > ul > li').forEach((li) => rowTops.set(li, (li as HTMLElement).offsetTop))
})
function pinLeaving(el: Element) {
  const top = rowTops.get(el)
  if (top !== undefined) (el as HTMLElement).style.top = `${top}px`
}

function onRowClick(e: MouseEvent, value: Value) {
  // The checkbox handles its own clicks (its label + input); toggling here too is exactly
  // the old double-toggle bug, where the box showed checked but the state wasn't.
  if ((e.target as Element).closest('label')) return
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
      <TransitionGroup tag="ul" :name="`m3-tl-${enterFrom}`" class="relative py-1" @before-leave="pinLeaving">
        <li
          v-for="item in items"
          :key="item.value"
          class="group relative flex min-h-14 cursor-pointer select-none items-center gap-4 px-4 py-2 transition-colors duration-150"
          :class="checked.has(item.value) ? 'bg-secondary-container' : ''"
          @click="onRowClick($event, item.value)"
          @dblclick="emit('activate', item.value)"
          @keydown.enter.prevent="emit('activate', item.value)"
        >
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
