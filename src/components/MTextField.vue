<script setup lang="ts">
/**
 * The standard single- or multi-line text input, filled or outlined, with floating label.
 *
 * @slot trailing Custom trailing content (e.g. an icon button) — replaces the built-in clear button when
 *   present
 * @event update:modelValue Emitted on every keystroke — powers v-model
 * @event debounced Emitted debounce ms after the user stops typing (only when debounce > 0)
 */
import { computed, ref, useId, useSlots } from "vue";
import MIcon from "./MIcon.vue";
import { useAutoGrow } from "../composables/useAutoGrow";
import { useFieldBg } from "../composables/useFieldBg";
import { useDebounce } from "../composables/useDebounce";
import { useLocale } from '../composables/useLocale'

const locale = useLocale()
const props = withDefaults(
  defineProps<{
    /** Bound value (v-model) */
    modelValue: string | number;
    /** Field label */
    label: string;
    /** HTML input type */
    type?: string;
    /** Visual style */
    variant?: "filled" | "outlined";
    /** Puts the field in error state (red border and label) */
    error?: boolean;
    /** Error message shown below the field (only visible when error is true) */
    errorLabel?: string;
    /** Hint text shown below the field */
    hint?: string;
    /** Disables the field */
    disabled?: boolean;
    /** Marks as required — adds a red asterisk after the label */
    required?: boolean;
    /** Renders a textarea instead of an input */
    multiline?: boolean;
    /** Textarea rows (when multiline); with autoGrow, the fewest it shrinks to */
    rows?: number;
    /** Multiline only: grows with the text from `rows` up to `maxRows`, instead of a fixed height with a drag handle */
    autoGrow?: boolean;
    /** With autoGrow, the most rows it grows to before scrolling. Unset grows without limit */
    maxRows?: number;
    /** Passed through to the native autocomplete attribute */
    autocomplete?: string;
    /** Material Symbol shown before the input */
    leadingIcon?: string;
    /** Show a clear button when the field has a value */
    clearable?: boolean;
    /**
     * Overrides the auto-detected background color used to cut the floating label out of the outlined border
     */
    fieldBg?: string;
    /** Delay (ms) before firing the @debounced event. v-model always updates immediately */
    debounce?: number;
  }>(),
  {
    type: "text",
    variant: "filled",
    rows: 3,
    clearable: false,
    debounce: 0,
  },
);

const emit = defineEmits<{ "update:modelValue": [string]; debounced: [string] }>();

const id = useId();
const slots = useSlots();

const fieldBgEl = ref<HTMLElement | null>(null);
const { resolvedFieldBg } = useFieldBg(fieldBgEl, () => props.fieldBg);

const { debounced: emitDebounced, cancel: cancelDebounce } = useDebounce((v: string) => emit("debounced", v), props.debounce)

const textareaEl = ref<HTMLTextAreaElement | null>(null);
useAutoGrow(() => (props.multiline && props.autoGrow ? textareaEl.value : null), {
  minRows: () => props.rows,
  maxRows: () => props.maxRows,
  value: () => props.modelValue,
});

const showClear = computed(() => props.clearable && String(props.modelValue).length > 0 && !props.disabled)

const inputClasses = computed(() => {
  const hasTrailing = !!slots.trailing || props.clearable;
  const pl = props.leadingIcon ? "pl-12" : "pl-4";
  const pr = hasTrailing ? "pr-12" : "pr-4";
  const size = props.multiline ? (props.autoGrow ? "resize-none min-h-[56px]" : "resize-y min-h-[56px]") : "h-14";
  const base = [
    "peer block w-full text-body-large text-on-surface outline-none placeholder:text-transparent",
    "transition-[border-color,border-width] duration-150",
    "disabled:cursor-not-allowed disabled:text-on-surface/38",
    props.error ? "caret-error" : "caret-primary",
    size,
    pl,
    pr,
  ];

  if (props.variant === "outlined") {
    return [
      ...base,
      "rounded-xs border bg-transparent py-4",
      props.error
        ? "border-error focus:border-2 focus:border-error"
        : "border-outline hover:border-on-surface focus:border-2 focus:border-primary",
      "disabled:border-on-surface/12",
    ].join(" ");
  }

  return [
    ...base,
    // Multiline: the label's 24px band is a transparent top border rather than padding, so text scrolled up is
    // clipped below the label (at the padding box) instead of running behind it; the background still fills it
    props.multiline
      ? "rounded-t-xs bg-surface-container-highest border-b border-t-24 border-t-transparent pb-2"
      : "rounded-t-xs bg-surface-container-highest border-b pt-6 pb-2",
    props.error
      ? "border-b-error focus:border-b-2 focus:border-b-error"
      : "border-b-on-surface-variant hover:border-b-on-surface focus:border-b-2 focus:border-b-primary",
    "disabled:border-b-on-surface/38 disabled:bg-[color-mix(in_srgb,var(--color-on-surface)_4%,var(--color-surface-container-highest))]",
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

  const unfloatedTop = props.variant === 'filled' ? 'top-[53%]' : 'top-1/2'
  const base = [
    "pointer-events-none absolute truncate transition-all duration-200",
    left,
    "right-4",
    `${unfloatedTop} -translate-y-1/2 text-body-large`,
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
      "peer-disabled:text-on-surface/38",
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
    "peer-disabled:text-on-surface/38",
  ].join(" ");
});

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit("update:modelValue", target.value);
  if (props.debounce > 0) emitDebounced(target.value)
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
        class="pointer-events-none absolute left-3.5"
        :class="[
          multiline ? 'top-[55%] -translate-y-1/2' : variant === 'filled' ? 'top-4.5' : 'top-4',
          disabled ? 'text-on-surface/38' : 'text-on-surface-variant',
        ]"
      >
        <MIcon :name="leadingIcon" :size="24" />
      </div>

      <textarea
        v-if="multiline"
        ref="textareaEl"
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

      <div v-if="$slots.trailing" class="absolute right-2 top-1/2 -translate-y-1/2">
        <slot name="trailing" />
      </div>
      <button
        :aria-label="locale.clear"
        v-else-if="showClear"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
        @click="cancelDebounce(); emit('update:modelValue', '')"
      >
        <MIcon name="close" :size="18" />
      </button>
    </div>

    <p v-if="error && errorLabel" class="px-4 text-body-small text-error">{{ errorLabel }}</p>
    <p v-else-if="hint" class="px-4 text-body-small text-on-surface-variant">{{ hint }}</p>
  </div>
</template>
