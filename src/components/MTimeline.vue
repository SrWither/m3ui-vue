<script setup lang="ts">
import MIcon from "./MIcon.vue";

export interface TimelineItem {
  title: string;
  description?: string;
  date?: string;
  icon?: string;
  color?: "primary" | "secondary" | "tertiary" | "error" | "success";
  dotColor?: string;
}

withDefaults(
  defineProps<{
    items: TimelineItem[];
    dense?: boolean;
    alternating?: boolean;
  }>(),
  { dense: false, alternating: false },
);

const dotBg: Record<string, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  tertiary: "bg-tertiary text-on-tertiary",
  error: "bg-error text-on-error",
  success: "bg-success text-on-success",
};
</script>

<template>
  <div :class="alternating ? 'relative' : 'flex flex-col'">
    <!-- Standard layout -->
    <template v-if="!alternating">
      <div
        v-for="(item, i) in items"
        :key="i"
        class="relative flex gap-4"
        :class="dense ? 'pb-4' : 'pb-8'"
      >
        <!-- Line + dot -->
        <div class="flex flex-col items-center">
          <div
            class="z-[1] flex shrink-0 items-center justify-center rounded-full"
            :class="[item.icon ? 'h-9 w-9' : 'h-3 w-3', dotBg[item.color ?? 'primary']]"
            :style="item.dotColor ? { backgroundColor: item.dotColor } : undefined"
          >
            <MIcon v-if="item.icon" :name="item.icon" :size="18" />
          </div>
          <div
            v-if="i < items.length - 1"
            class="w-[2px] flex-1"
            :class="dotBg[item.color ?? 'primary']!.split(' ')[0] + '/30'"
            style="min-height: 16px"
          />
        </div>

        <!-- Content -->
        <div :class="item.icon ? '' : 'pt-0'" class="-mt-0.5 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-body-large font-medium text-on-surface">{{ item.title }}</p>
            <span v-if="item.date" class="shrink-0 text-label-small text-on-surface-variant">{{
              item.date
            }}</span>
          </div>
          <p v-if="item.description" class="mt-1 text-body-medium text-on-surface-variant">
            {{ item.description }}
          </p>
          <div v-if="$slots[`item-${i}`]" class="mt-2">
            <slot :name="`item-${i}`" :item="item" />
          </div>
        </div>
      </div>
    </template>

    <!-- Alternating layout -->
    <template v-else>
      <div
        v-for="(item, i) in items"
        :key="i"
        class="flex items-stretch"
        :class="i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'"
      >
        <!-- Content side -->
        <div
          class="flex-1"
          :class="[i % 2 === 0 ? 'text-right' : 'text-left', dense ? 'pb-4' : 'pb-8']"
        >
          <p class="text-body-large font-medium text-on-surface">{{ item.title }}</p>
          <p v-if="item.description" class="mt-1 text-body-medium text-on-surface-variant">
            {{ item.description }}
          </p>
          <span
            v-if="item.date"
            class="mt-1 inline-block text-label-small text-on-surface-variant"
            >{{ item.date }}</span
          >
        </div>

        <!-- Center column: dot + continuous line -->
        <div class="flex w-14 shrink-0 flex-col items-center">
          <div
            class="z-[1] flex shrink-0 items-center justify-center rounded-full"
            :class="[item.icon ? 'h-9 w-9' : 'h-3.5 w-3.5', dotBg[item.color ?? 'primary']]"
            :style="item.dotColor ? { backgroundColor: item.dotColor } : undefined"
          >
            <MIcon v-if="item.icon" :name="item.icon" :size="18" />
          </div>
          <div v-if="i < items.length - 1" class="w-[2px] flex-1 bg-outline-variant" />
        </div>

        <!-- Empty side -->
        <div class="flex-1" />
      </div>
    </template>
  </div>
</template>
