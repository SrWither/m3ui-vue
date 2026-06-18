<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import MIcon from "./MIcon.vue";
import MContextMenuPanel from "./_MContextMenuPanel.vue";
import type { ContextMenuItem } from "./MContextMenu.vue";

const props = defineProps<{
  items: ContextMenuItem[];
  x: number;
  y: number;
}>();

const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
const panelX = ref(props.x);
const panelY = ref(props.y);
const activeIndex = ref<number | null>(null);
const subPos = ref({ x: 0, y: 0 });

onMounted(async () => {
  await nextTick();
  if (!panel.value) return;
  const el = panel.value;
  panelX.value = Math.min(props.x, window.innerWidth - el.offsetWidth - 8);
  panelY.value = Math.min(props.y, window.innerHeight - el.offsetHeight - 8);
});

function onItemMouseEnter(index: number, item: ContextMenuItem, e: MouseEvent) {
  if (item.divider || item.disabled) {
    activeIndex.value = null;
    return;
  }
  if (!item.children?.length) {
    activeIndex.value = null;
    return;
  }

  activeIndex.value = index;
  const itemEl = e.currentTarget as HTMLElement;
  const itemRect = itemEl.getBoundingClientRect();
  const panelRect = panel.value!.getBoundingClientRect();

  let x = panelRect.right;
  let y = itemRect.top;
  if (x + 220 > window.innerWidth) x = panelRect.left - 220;
  if (y + 300 > window.innerHeight) y = Math.max(8, window.innerHeight - 300);

  subPos.value = { x, y };
}

function onItemClick(item: ContextMenuItem) {
  if (item.disabled || item.divider || item.children?.length) return;
  item.onClick?.();
  emit("close");
}

function onPanelMouseLeave(e: MouseEvent) {
  // Don't close if the mouse moved to another context menu panel (sibling sub-panel)
  const related = e.relatedTarget as Element | null;
  if (related?.closest(".m3-ctx-panel")) return;
  activeIndex.value = null;
}
</script>

<template>
  <div
    ref="panel"
    class="m3-ctx-panel absolute z-[201] min-w-[200px] rounded-sm bg-surface-container shadow-elevation-2"
    :style="{ left: `${panelX}px`, top: `${panelY}px` }"
    @mouseleave="onPanelMouseLeave"
  >
    <div class="overflow-hidden rounded-sm py-1">
      <template v-for="(item, i) in items" :key="i">
        <hr v-if="item.divider" class="my-1 border-outline-variant" />

        <component
          v-else
          :is="item.to && !item.disabled ? 'RouterLink' : 'div'"
          :to="item.to && !item.disabled ? item.to : undefined"
          class="relative flex cursor-default select-none items-center gap-3 px-4 py-2.5 text-body-large"
          :class="[
            item.disabled
              ? 'cursor-not-allowed opacity-38 text-on-surface'
              : item.danger
                ? 'cursor-pointer text-error hover:bg-error/8'
                : 'cursor-pointer text-on-surface hover:bg-on-surface/8',
            activeIndex === i && !item.disabled
              ? item.danger
                ? 'bg-error/8'
                : 'bg-on-surface/8'
              : '',
          ]"
          @mouseenter="onItemMouseEnter(i, item, $event)"
          @click="onItemClick(item)"
        >
          <MIcon
            v-if="item.icon"
            :name="item.icon"
            :size="18"
            class="shrink-0"
            :class="item.danger ? 'text-error' : 'text-on-surface-variant'"
          />
          <span v-else class="w-[18px] shrink-0" />

          <span class="flex-1">{{ item.label }}</span>

          <span
            v-if="item.shortcut"
            class="text-label-small text-on-surface-variant"
          >
            {{ item.shortcut }}
          </span>

          <MIcon
            v-if="item.children?.length"
            name="chevron_right"
            :size="18"
            class="shrink-0 text-on-surface-variant"
          />
        </component>
      </template>
    </div>
  </div>

  <!-- Sub-panel: sibling in the same Teleport layer.
       No <Transition> wrapper — MContextMenuPanel is a fragment and cannot be
       animated by Vue's Transition (produces a console warning). -->
  <MContextMenuPanel
    v-if="activeIndex !== null && items[activeIndex]?.children?.length"
    :key="activeIndex"
    :items="items[activeIndex]!.children!"
    :x="subPos.x"
    :y="subPos.y"
    @close="emit('close')"
  />
</template>
