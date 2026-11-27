<script setup lang="ts">
/**
 * A checkbox with checked, indeterminate, and disabled states, and 4 semantic color options.
 *
 * @slot default Custom label content — overrides the label prop when provided
 * @event update:modelValue Emitted with the new checked state.
 * @event blur Emitted when the checkbox loses focus
 */
import { ref } from "vue";
import MIcon from "./MIcon.vue";
import { useFieldValidation } from "../composables/_useFieldValidation";
import type { ValidateOn, ValidationRule } from "../composables/validation";

const props = withDefaults(
  defineProps<{
    /** Checked state (v-model) */
    modelValue: boolean;
    /** Indeterminate state */
    indeterminate?: boolean;
    /** Disables the checkbox */
    disabled?: boolean;
    /** Label text — overridden by the default slot when present */
    label?: string;
    /** Checked/indeterminate color */
    color?: "primary" | "secondary" | "tertiary" | "error";
    /** Accessible name for the input when there's no visible label (e.g. a list row's checkbox). */
    ariaLabel?: string;
    /** Error state. A string is also the message */
    error?: boolean | string;
    /** Error message shown when `error` is true */
    errorLabel?: string;
    /** Must be ticked, inside an `MForm` or with `rules` */
    required?: boolean;
    /** Validation rules (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[];
    /** When the rules are checked and shown: on leaving it (default), on change, or only on submit */
    validateOn?: ValidateOn;
    /** The key of this field in its `MForm` */
    name?: string;
  }>(),
  { indeterminate: false, disabled: false, color: "primary" },
);

const emit = defineEmits<{ "update:modelValue": [boolean]; blur: [FocusEvent] }>();

const inputEl = ref<HTMLInputElement | null>(null);

const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => props.rules,
  required: () => props.required,
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  disabled: () => props.disabled,
  focus: () => { inputEl.value?.focus() },
  el: () => inputEl.value,
  setValue: (v) => emit("update:modelValue", v as boolean),
});
/** Its own `disabled` or its MForm's */
const isDisabled = validation.disabled;
const { hasError, message: errorMessage, messageId } = validation;

// Same 4 named colors + fallback shape as MRadio's checkedColor map. M3's real
// CheckboxTokens only define Primary (SelectedContainerColor) and Error (as an error
// STATE, not a color variant) — secondary/tertiary are a deliberate library extension on
// top of the spec, same status as MSlider's `color`/`icon` props.
const checkedClasses: Record<string, string> = {
  primary: "border-primary bg-primary text-on-primary",
  secondary: "border-secondary bg-secondary text-on-secondary",
  tertiary: "border-tertiary bg-tertiary text-on-tertiary",
  error: "border-error bg-error text-on-error",
};

// Just the fill color, reused for the hover/press state layer's tint below.
const checkedBgClasses: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

// CheckboxTokens' error state: Error container / OnError icon when ticked, Error outline when not
const errorCheckedClasses = "border-error bg-error text-on-error";

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
});
</script>

<template>
  <label
    class="group inline-flex gap-2 select-none"
    :class="[isDisabled ? 'cursor-not-allowed' : 'cursor-pointer', errorMessage ? 'items-start' : 'items-center']"
  >
    <!--
      CheckboxTokens.StateLayerSize = 40dp (was 48px), StateLayerShape = CornerFull. The
      negative margin cancels the touch target's own overhang past the visible 18px box
      (40-18)/2 = 11px per side, so it doesn't push the label text over.
    -->
    <!-- With a message under the text, the box lines up with the text's first line instead of the middle -->
    <span
      class="relative -m-[11px] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      :style="errorMessage ? { marginTop: '-8px' } : undefined"
    >
      <!--
        Input must stay nested INSIDE this `relative` span (a true sibling of the state-layer
        /focus-ring spans below, satisfying `peer-*`'s sibling-combinator requirement, but not
        hoisted all the way up to be a direct child of <label>): a sr-only, `position: absolute`
        input with no nearby positioned ancestor made the browser's native focus-scroll
        algorithm treat a distant `overflow: hidden` ancestor as the thing to scroll into view
        on click, which — since that ancestor wasn't meant to scroll at all — blew out to its
        max scrollTop and pushed the entire page off-screen. Real bug, found by testing in the
        docs site; MSwitch's input, nested the same way this one now is again, never had it.
      -->
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="isDisabled"
        ref="inputEl"
        :name="name"
        :required="required"
        :aria-label="ariaLabel"
        :aria-invalid="hasError || undefined"
        :aria-describedby="errorMessage ? messageId : undefined"
        @change="emit('update:modelValue', !modelValue)"
        @blur="validation.onBlur(); emit('blur', $event)"
      />
      <!--
        Hover/press state layer (8%/12%), tinted with the checkbox's own indicator color
        (primary/color prop when checked, on-surface when not) — same `before:`-overlay
        spirit as MButton/MCard/MIconButton, just a real sibling span here since the parent
        span is already used for centering/sizing. `group-*` (not a plain `hover:`) so
        hovering anywhere over the row (including the label text) triggers it, not just
        the small 18px glyph itself.
      -->
      <span
        v-if="!isDisabled"
        class="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-[0.08] group-active:opacity-[0.12]"
        :class="hasError ? 'bg-error' : modelValue || indeterminate ? checkedBgClasses[color] : 'bg-on-surface'"
      />
      <!-- Keyboard-focus ring (FocusIndicatorColor = secondary) -->
      <span
        v-if="!isDisabled"
        class="pointer-events-none absolute inset-0 rounded-full ring-0 ring-secondary transition-[box-shadow] duration-150 peer-focus-visible:ring-2"
      />

      <span
        class="relative inline-flex h-4.5 w-4.5 items-center justify-center rounded-[2px] border-2 transition-colors"
        :class="
          isDisabled
            ? (modelValue || indeterminate ? 'border-on-surface/38 bg-on-surface/38 text-surface' : 'border-on-surface/38 text-transparent')
            : hasError
              ? (modelValue || indeterminate ? errorCheckedClasses : 'border-error text-transparent')
              : (modelValue || indeterminate ? checkedClasses[color] : 'border-on-surface-variant text-transparent group-hover:border-on-surface group-active:border-on-surface')
        "
      >
        <MIcon
          :name="indeterminate ? 'remove' : 'check'"
          :size="18"
          class="transition-[opacity,transform] duration-150"
          :class="modelValue || indeterminate ? 'scale-100 opacity-100' : 'scale-0 opacity-0'"
        />
      </span>
    </span>
    <span v-if="label || $slots.default || errorMessage" class="flex flex-col">
      <span
        v-if="label || $slots.default"
        class="text-body-large"
        :class="isDisabled ? 'text-on-surface/38' : 'text-on-surface'"
      >
        <slot>{{ label }}</slot><span v-if="required" class="text-error">&nbsp;*</span>
      </span>
      <span v-if="errorMessage" :id="messageId" role="alert" class="text-body-small text-error">{{ errorMessage }}</span>
    </span>
  </label>
</template>
