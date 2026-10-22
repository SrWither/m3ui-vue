<script lang="ts">
export interface TimelineItem {
  /** Stable key for the entry (defaults to its index): set it when entries are added or removed */
  key?: string | number;
  title: string;
  description?: string;
  date?: string;
  icon?: string;
  color?: "primary" | "secondary" | "tertiary" | "error" | "success";
  /** Any CSS color for the dot (and its line), over `color` */
  dotColor?: string;
  /**
   * Progress of a step: `done` (filled, a solid line to the next), `current` (filled, with a pulsing halo) or
   * `pending` (outlined, a dashed line). Over what the timeline's `current` gives it
   */
  status?: "done" | "current" | "pending";
}

export type TimelineStatus = NonNullable<TimelineItem["status"]>;
</script>

<script setup lang="ts" generic="T extends TimelineItem = TimelineItem">
/**
 * An event timeline with icon dots, dates, and colors — a single column, alternating left/right, or horizontal.
 * With `current` (or items' `status`) it tracks progress: done steps filled with a solid line, the current one
 * pulsing, the rest outlined with a dashed line. Every part can be replaced through slots, which receive
 * `{ item, index }`; your item type flows into them.
 *
 * @slot item Extra content under an entry's description (a card, chips, a button). With `bare`, the entry's whole
 *   content. `item-{index}` slots still work for a single entry and win over this one
 * @slot title Replaces an entry's title row (title and date)
 * @slot dot Replaces an entry's dot (an avatar, an image, a custom shape); the line still runs from it
 * @slot opposite Content across the line: on the empty side in the alternating layout, or in a column before the
 *   line in the single-column one (dates, times, amounts)
 */
import { computed, useSlots } from "vue";
import MIcon from "./MIcon.vue";

const props = withDefaults(
  defineProps<{
    /** Array of timeline entries — required */
    items: T[];
    /** Compact spacing between items */
    dense?: boolean;
    /** Alternate items left/right of a central line instead of a single left-aligned column (vertical only) */
    alternating?: boolean;
    /** Vertical (default) or horizontal: entries side by side along a line, scrolling sideways when they don't fit */
    orientation?: "vertical" | "horizontal";
    /** Leaves each entry's content to the `#item` slot: no title, description or date */
    bare?: boolean;
    /**
     * Makes it a progress timeline (an order's tracking, a setup's steps): the index of the current step. The ones
     * before are done, the ones after pending; an item's own `status` wins. `items.length` marks them all done
     */
    current?: number;
  }>(),
  { dense: false, alternating: false, orientation: "vertical", bare: false, current: undefined },
);

defineSlots<{
  item?: (props: { item: T; index: number }) => unknown;
  title?: (props: { item: T; index: number }) => unknown;
  dot?: (props: { item: T; index: number }) => unknown;
  opposite?: (props: { item: T; index: number }) => unknown;
  [name: `item-${number}`]: ((props: { item: T; index: number }) => unknown) | undefined;
}>();

const slots = useSlots();

// Literal class names: Tailwind only generates what appears in the source, so a class built at runtime
// (`bg-secondary` + '/30') rendered no line for anything but primary
const dotBg: Record<string, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  tertiary: "bg-tertiary text-on-tertiary",
  error: "bg-error text-on-error",
  success: "bg-success text-on-success",
};
const lineBg: Record<string, string> = {
  primary: "bg-primary/30",
  secondary: "bg-secondary/30",
  tertiary: "bg-tertiary/30",
  error: "bg-error/30",
  success: "bg-success/30",
};

const keyOf = (item: T, i: number) => item.key ?? i;
// Null when the timeline isn't about progress (no `current`, no `status`): the plain look
const statusOf = (item: T, i: number): TimelineStatus | null =>
  item.status ?? (props.current === undefined ? null : i < props.current ? "done" : i === props.current ? "current" : "pending");
const pending = (item: T, i: number) => statusOf(item, i) === "pending";
// The line after an entry is dashed (still to come) unless that entry is done and the next one is reached
const dashed = (i: number) => {
  const here = statusOf(props.items[i]!, i);
  if (here === null) return false;
  const next = props.items[i + 1];
  return here !== "done" || (!!next && statusOf(next, i + 1) === "pending");
};
// One dot slot size for every entry: with any icon (or a #dot), small dots sit centered in the same 36px, so dots,
// line and text stay aligned when entries mix both
const wide = computed(() => !!slots.dot || props.items.some((item) => item.icon));
// A `dotColor` paints over the role's background (inline style); the icon keeps the role's on-color
// A pending step is outlined, its icon in on-surface-variant
const dotClass = (item: T, i: number, size = item.icon ? "h-9 w-9" : "h-3 w-3") => [
  "relative",
  size,
  pending(item, i) ? "border-2 border-outline-variant bg-surface text-on-surface-variant" : dotBg[item.color ?? "primary"],
];
const dotStyle = (item: T, i: number) => (item.dotColor && !pending(item, i) ? { backgroundColor: item.dotColor } : undefined);
// In a progress timeline a done step's line is solid; otherwise the usual 30% tint
const lineClass = (item: T, i: number, vertical: boolean) => {
  if (dashed(i)) return vertical ? "border-l-2 border-dashed border-outline-variant" : "border-t-2 border-dashed border-outline-variant";
  if (item.dotColor) return "";
  return statusOf(item, i) === "done" ? dotBg[item.color ?? "primary"]!.split(" ")[0] : lineBg[item.color ?? "primary"];
};
const lineStyle = (item: T, i: number) => {
  if (!item.dotColor || dashed(i)) return undefined;
  return { backgroundColor: statusOf(item, i) === "done" ? item.dotColor : `color-mix(in srgb, ${item.dotColor} 30%, transparent)` };
};
// `item-{index}` (the original per-entry slot) wins over the generic `#item`
const itemSlot = (i: number) => (slots[`item-${i}`] ? `item-${i}` : slots.item ? "item" : null) as "item" | null;
const isLast = (i: number) => i === props.items.length - 1;
</script>

<template>
  <ol v-if="orientation === 'horizontal'" class="flex list-none overflow-x-auto p-0" role="list">
    <!-- Horizontal: entries side by side, the line running between their dots -->
    <li
      v-for="(item, i) in items"
      :key="keyOf(item, i)"
      :aria-current="statusOf(item, i) === 'current' ? 'step' : undefined"
      class="flex min-w-40 flex-1 flex-col"
    >
      <div class="flex items-center" :class="wide ? 'h-9' : 'h-3'">
        <span class="flex shrink-0 justify-center" :class="wide ? 'w-9' : ''">
        <slot name="dot" :item="item" :index="i">
          <span class="z-1 flex shrink-0 items-center justify-center rounded-full" :class="dotClass(item, i)" :style="dotStyle(item, i)">
            <span v-if="statusOf(item, i) === 'current'" aria-hidden="true" class="pointer-events-none absolute inset-0 rounded-full bg-inherit opacity-40 motion-safe:animate-ping" />
            <MIcon v-if="item.icon" :name="item.icon" :size="18" class="relative" />
          </span>
        </slot>
        </span>
        <span v-if="!isLast(i)" class="min-w-4 flex-1" :class="[dashed(i) ? 'h-0' : 'h-[2px]', lineClass(item, i, false)]" :style="lineStyle(item, i)" />
      </div>
      <!-- The gap to the next entry is the content's padding, so the line above runs all the way to its dot -->
      <div class="mt-3 min-w-0" :class="dense ? 'pr-3' : 'pr-6'">
        <template v-if="!bare">
          <slot name="title" :item="item" :index="i">
            <p class="text-body-large font-medium" :class="pending(item, i) ? 'text-on-surface-variant' : 'text-on-surface'">{{ item.title }}</p>
            <span v-if="item.date" class="text-label-small text-on-surface-variant">{{ item.date }}</span>
          </slot>
          <p v-if="item.description" class="mt-1 text-body-medium text-on-surface-variant">{{ item.description }}</p>
        </template>
        <div v-if="itemSlot(i)" :class="{ 'mt-2': !bare }">
          <slot :name="itemSlot(i)!" :item="item" :index="i" />
        </div>
      </div>
    </li>
  </ol>

  <ol v-else-if="!alternating" class="flex list-none flex-col p-0" role="list">
    <!-- Vertical, single column (with an optional #opposite column before the line) -->
    <li
      v-for="(item, i) in items"
      :key="keyOf(item, i)"
      :aria-current="statusOf(item, i) === 'current' ? 'step' : undefined"
      class="relative flex gap-4"
    >
      <!-- The gap to the next entry is padding on the text columns, not on the row: the line column stretches over
           the whole row and reaches the next dot -->
      <div v-if="$slots.opposite" class="w-24 shrink-0 text-right" :class="dense ? 'pb-4' : 'pb-8'">
        <slot name="opposite" :item="item" :index="i" />
      </div>

      <!-- Line + dot -->
      <div class="flex shrink-0 flex-col items-center" :class="{ 'w-9': wide }">
        <slot name="dot" :item="item" :index="i">
          <span class="z-1 flex shrink-0 items-center justify-center rounded-full" :class="dotClass(item, i)" :style="dotStyle(item, i)">
            <span v-if="statusOf(item, i) === 'current'" aria-hidden="true" class="pointer-events-none absolute inset-0 rounded-full bg-inherit opacity-40 motion-safe:animate-ping" />
            <MIcon v-if="item.icon" :name="item.icon" :size="18" class="relative" />
          </span>
        </slot>
        <span v-if="!isLast(i)" class="flex-1" :class="[dashed(i) ? 'w-0' : 'w-[2px]', lineClass(item, i, true)]" :style="[{ minHeight: '16px' }, lineStyle(item, i)]" />
      </div>

      <!-- Content -->
      <div class="-mt-0.5 min-w-0 flex-1" :class="dense ? 'pb-4' : 'pb-8'">
        <template v-if="!bare">
          <slot name="title" :item="item" :index="i">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-body-large font-medium" :class="pending(item, i) ? 'text-on-surface-variant' : 'text-on-surface'">{{ item.title }}</p>
              <span v-if="item.date" class="shrink-0 text-label-small text-on-surface-variant">{{ item.date }}</span>
            </div>
          </slot>
          <p v-if="item.description" class="mt-1 text-body-medium text-on-surface-variant">{{ item.description }}</p>
        </template>
        <div v-if="itemSlot(i)" :class="{ 'mt-2': !bare }">
          <slot :name="itemSlot(i)!" :item="item" :index="i" />
        </div>
      </div>
    </li>
  </ol>

  <ol v-else class="relative list-none p-0" role="list">
    <!-- Alternating: entries left and right of a central line -->
    <li
      v-for="(item, i) in items"
      :key="keyOf(item, i)"
      :aria-current="statusOf(item, i) === 'current' ? 'step' : undefined"
      class="flex items-stretch"
      :class="i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'"
    >
      <!-- Content side -->
      <div class="min-w-0 flex-1" :class="[i % 2 === 0 ? 'text-right' : 'text-left', dense ? 'pb-4' : 'pb-8']">
        <template v-if="!bare">
          <slot name="title" :item="item" :index="i">
            <p class="text-body-large font-medium" :class="pending(item, i) ? 'text-on-surface-variant' : 'text-on-surface'">{{ item.title }}</p>
          </slot>
          <p v-if="item.description" class="mt-1 text-body-medium text-on-surface-variant">{{ item.description }}</p>
          <span v-if="item.date && !$slots.title" class="mt-1 inline-block text-label-small text-on-surface-variant">{{ item.date }}</span>
        </template>
        <div v-if="itemSlot(i)" :class="{ 'mt-2': !bare }">
          <slot :name="itemSlot(i)!" :item="item" :index="i" />
        </div>
      </div>

      <!-- Center column: dot + continuous line -->
      <div class="flex w-14 shrink-0 flex-col items-center">
        <slot name="dot" :item="item" :index="i">
          <span
            class="z-1 flex shrink-0 items-center justify-center rounded-full"
            :class="dotClass(item, i, item.icon ? 'h-9 w-9' : 'h-3.5 w-3.5')"
            :style="dotStyle(item, i)"
          >
            <span v-if="statusOf(item, i) === 'current'" aria-hidden="true" class="pointer-events-none absolute inset-0 rounded-full bg-inherit opacity-40 motion-safe:animate-ping" />
            <MIcon v-if="item.icon" :name="item.icon" :size="18" class="relative" />
          </span>
        </slot>
        <span v-if="!isLast(i)" class="flex-1" :class="[dashed(i) ? 'w-0' : 'w-[2px]', lineClass(item, i, true)]" :style="lineStyle(item, i)" />
      </div>

      <!-- Opposite side -->
      <div class="min-w-0 flex-1" :class="[i % 2 === 0 ? 'text-left' : 'text-right', dense ? 'pb-4' : 'pb-8']">
        <slot name="opposite" :item="item" :index="i" />
      </div>
    </li>
  </ol>
</template>
