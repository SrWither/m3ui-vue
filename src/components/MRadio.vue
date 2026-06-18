<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: unknown;
    value: unknown;
    label?: string;
    disabled?: boolean;
    color?: "primary" | "secondary" | "tertiary" | "error";
  }>(),
  { disabled: false, color: "primary" },
);

const emit = defineEmits<{ "update:modelValue": [unknown] }>();
const id = useId();
const isChecked = computed(() => props.modelValue === props.value);

// Ring + dot color when checked, applied via currentColor on the SVG.
const checkedColor: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  error: "text-error",
};
</script>

<template>
  <label
    :for="id"
    class="inline-flex items-center gap-3 select-none"
    :class="disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer'"
  >
    <span class="relative flex h-5 w-5 shrink-0">
      <input
        :id="id"
        type="radio"
        class="sr-only"
        :checked="isChecked"
        :disabled="disabled"
        @change="emit('update:modelValue', value)"
      />

      <!--
        SVG radio: vector circles sharing center (10,10) stay round + concentric
        at any zoom. Outer ring uses r=8 (not 9) so the 2px stroke (7..9) leaves
        ~1px of clearance to the viewBox edge — prevents the border getting
        clipped at certain zoom levels.
      -->
      <svg
        viewBox="0 0 20 20"
        class="h-full w-full transition-colors duration-150"
        :class="isChecked ? checkedColor[color] : 'text-on-surface-variant'"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" />
        <!--
          Dot scaled via CSS, but the transform-origin is pinned to the circle's
          own bounding box center (transform-box: fill-box). Without this, the SVG
          element origin is (0,0) of the viewBox, so scale() grows from a corner
          and the dot visibly slides to the center. fill-box fixes the origin to
          the dot itself, so it grows symmetrically in place.
        -->
        <circle
          class="m3-radio-dot"
          :class="{ 'is-checked': isChecked }"
          cx="10"
          cy="10"
          r="4.5"
          fill="currentColor"
        />
      </svg>
    </span>

    <span v-if="label" class="text-body-large text-on-surface">{{ label }}</span>
  </label>
</template>

<style scoped>
.m3-radio-dot {
  transform: scale(0);
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 150ms ease;
}
.m3-radio-dot.is-checked {
  transform: scale(1);
}
</style>
