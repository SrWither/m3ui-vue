<script setup lang="ts">
import MIcon from "./MIcon.vue";

withDefaults(
  defineProps<{
    modelValue: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    label?: string;
  }>(),
  { indeterminate: false, disabled: false },
);

const emit = defineEmits<{ "update:modelValue": [boolean] }>();
</script>

<template>
  <label
    class="inline-flex items-center gap-2 select-none"
    :class="disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer'"
  >
    <span
      class="relative inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[3px] border-2 transition-colors"
      :class="
        modelValue || indeterminate
          ? 'border-primary bg-primary text-on-primary'
          : 'border-on-surface-variant text-transparent'
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
    <span v-if="label || $slots.default" class="text-body-large text-on-surface">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
