<script setup lang="ts">
import { computed, ref, useId, useSlots } from "vue";
import MIcon from "./MIcon.vue";
import { useFieldBg } from "../composables/useFieldBg";

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    label: string;
    type?: string;
    variant?: "filled" | "outlined";
    error?: string;
    hint?: string;
    disabled?: boolean;
    required?: boolean;
    multiline?: boolean;
    rows?: number;
    autocomplete?: string;
    leadingIcon?: string;
    clearable?: boolean;
    fieldBg?: string;
  }>(),
  {
    type: "text",
    variant: "filled",
    rows: 3,
    clearable: false,
  },
);

const emit = defineEmits<{ "update:modelValue": [string] }>();

const id = useId();
const slots = useSlots();

const fieldBgEl = ref<HTMLElement | null>(null);
const { resolvedFieldBg } = useFieldBg(fieldBgEl, () => props.fieldBg);

const showClear = computed(() => props.clearable && String(props.modelValue).length > 0 && !props.disabled)

const inputClasses = computed(() => {
  const hasTrailing = !!slots.trailing || props.clearable;
  const pl = props.leadingIcon ? "pl-12" : "pl-4";
  const pr = hasTrailing ? "pr-12" : "pr-4";
  const size = props.multiline ? "resize-y min-h-[56px]" : "h-14";
  const base = [
    "peer block w-full text-body-large text-on-surface outline-none placeholder:text-transparent",
    "transition-[border-color,border-width] duration-150",
    "disabled:cursor-not-allowed disabled:opacity-[0.38]",
    size,
    pl,
    pr,
  ];

  if (props.variant === "outlined") {
    return [
      ...base,
      "rounded-sm border bg-transparent py-4",
      props.error
        ? "border-error focus:border-2 focus:border-error"
        : "border-outline hover:border-on-surface focus:border-2 focus:border-primary",
    ].join(" ");
  }

  return [
    ...base,
    "rounded-t-sm bg-surface-container-highest border-b pt-6 pb-2",
    props.error
      ? "border-error focus:border-b-2 focus:border-error"
      : "border-on-surface-variant hover:border-on-surface focus:border-b-2 focus:border-primary",
  ].join(" ");
});

const labelClasses = computed(() => {
  const left = props.leadingIcon
    ? props.variant === "outlined"
      ? "left-11"
      : "left-12"
    : props.variant === "outlined"
      ? "left-3"
      : "left-4";

  const base = [
    "pointer-events-none absolute truncate transition-all duration-200",
    left,
    "right-4",
    "top-1/2 -translate-y-1/2 text-body-large",
  ];

  if (props.variant === "outlined") {
    // When floated: drop right-4 (right-auto) and cap max-width so the label
    // shrinks to its own text width. The bg then only covers the glyphs + px-1,
    // cutting the border just where the text sits instead of a long strip.
    return [
      ...base,
      "peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-label-small peer-focus:right-auto peer-focus:max-w-[calc(100%-1.5rem)] peer-focus:bg-[var(--field-bg)] peer-focus:px-1",
      "peer-[&:not(:placeholder-shown)]:-top-2.5 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:right-auto peer-[&:not(:placeholder-shown)]:max-w-[calc(100%-1.5rem)]",
      "peer-[&:not(:placeholder-shown)]:text-label-small peer-[&:not(:placeholder-shown)]:bg-[var(--field-bg)] peer-[&:not(:placeholder-shown)]:px-1",
      props.error
        ? "text-error peer-focus:text-error"
        : "text-on-surface-variant peer-focus:text-primary",
    ].join(" ");
  }

  // Filled: label floats to top-2 (slightly higher than before)
  return [
    ...base,
    "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-label-small",
    "peer-[&:not(:placeholder-shown)]:top-2 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-label-small",
    props.error
      ? "text-error peer-focus:text-error"
      : "text-on-surface-variant peer-focus:text-primary",
  ].join(" ");
});

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit("update:modelValue", target.value);
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <!--
      --field-bg: background behind the floating label in outlined mode, so it
      "cuts through" the border. Auto-detected from the nearest opaque ancestor
      (see resolveBg); overridable via the fieldBg prop; falls back to surface.
    -->
    <div
      ref="fieldBgEl"
      class="relative"
      :class="variant === 'outlined' ? 'mt-2' : ''"
      :style="variant === 'outlined' ? { '--field-bg': resolvedFieldBg } : undefined"
    >
      <div
        v-if="leadingIcon"
        class="pointer-events-none absolute left-3.5 text-on-surface-variant"
        :class="variant === 'filled' ? 'top-[57%] -translate-y-1/2' : 'top-[55%] -translate-y-1/2'"
      >
        <MIcon :name="leadingIcon" :size="20" />
      </div>

      <textarea
        v-if="multiline"
        :id="id"
        :value="String(modelValue)"
        :rows="rows"
        :disabled="disabled"
        :required="required"
        placeholder=" "
        :class="inputClasses"
        @input="onInput"
      />
      <input
        v-else
        :id="id"
        :type="type"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        placeholder=" "
        :class="inputClasses"
        @input="onInput"
      />

      <label :for="id" :class="labelClasses">
        {{ label }}<span v-if="required" class="text-error">&nbsp;*</span>
      </label>

      <div v-if="$slots.trailing" class="absolute right-2" :class="variant === 'filled' ? 'top-[57%] -translate-y-1/2' : 'top-[55%] -translate-y-1/2'">
        <slot name="trailing" />
      </div>
      <button
        v-else-if="showClear"
        type="button"
        class="absolute right-3 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        :class="variant === 'filled' ? 'top-[57%] -translate-y-1/2' : 'top-[55%] -translate-y-1/2'"
        @click="emit('update:modelValue', '')"
      >
        <MIcon name="close" :size="18" />
      </button>
    </div>

    <p v-if="error" class="px-4 text-body-small text-error">{{ error }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
