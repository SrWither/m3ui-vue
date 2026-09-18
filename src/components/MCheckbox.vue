<script setup lang="ts">
import MIcon from "./MIcon.vue";

withDefaults(
  defineProps<{
    modelValue: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    label?: string;
    color?: "primary" | "secondary" | "tertiary" | "error";
  }>(),
  { indeterminate: false, disabled: false, color: "primary" },
);

const emit = defineEmits<{ "update:modelValue": [boolean] }>();

// Same 4 named colors + fallback shape as MRadio's checkedColor map.
const checkedClasses: Record<string, string> = {
  primary: "border-primary bg-primary text-on-primary",
  secondary: "border-secondary bg-secondary text-on-secondary",
  tertiary: "border-tertiary bg-tertiary text-on-tertiary",
  error: "border-error bg-error text-on-error",
};
</script>

<template>
  <label
    class="inline-flex items-center gap-2 select-none"
    :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
  >
    <span class="relative -m-[15px] inline-flex h-12 w-12 shrink-0 items-center justify-center">
      <span
        class="relative inline-flex h-4.5 w-4.5 items-center justify-center rounded-[3px] border-2 transition-colors"
        :class="
          disabled
            ? (modelValue || indeterminate ? 'border-on-surface/38 bg-on-surface/38 text-surface' : 'border-on-surface/38 text-transparent')
            : (modelValue || indeterminate ? checkedClasses[color] : 'border-on-surface-variant text-transparent')
        "
      >
        <input
          type="checkbox"
          class="sr-only"
          :checked="modelValue"
          :disabled="disabled"
          @change="emit('update:modelValue', !modelValue)"
        />
        <MIcon
          :name="indeterminate ? 'remove' : 'check'"
          :size="14"
          class="transition-[opacity,transform] duration-150"
          :class="modelValue || indeterminate ? 'scale-100 opacity-100' : 'scale-0 opacity-0'"
        />
      </span>
    </span>
    <span
      v-if="label || $slots.default"
      class="text-body-large"
      :class="disabled ? 'text-on-surface/38' : 'text-on-surface'"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
