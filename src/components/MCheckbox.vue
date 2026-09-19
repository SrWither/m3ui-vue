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
</script>

<template>
  <label
    class="group inline-flex items-center gap-2 select-none"
    :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
  >
    <!--
      CheckboxTokens.StateLayerSize = 40dp (was 48px), StateLayerShape = CornerFull. The
      negative margin cancels the touch target's own overhang past the visible 18px box
      (40-18)/2 = 11px per side, so it doesn't push the label text over.
    -->
    <span class="relative -m-[11px] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
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
        :disabled="disabled"
        @change="emit('update:modelValue', !modelValue)"
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
        v-if="!disabled"
        class="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-[0.08] group-active:opacity-[0.12]"
        :class="modelValue || indeterminate ? checkedBgClasses[color] : 'bg-on-surface'"
      />
      <!-- Keyboard-focus ring (FocusIndicatorColor = secondary) -->
      <span
        v-if="!disabled"
        class="pointer-events-none absolute inset-0 rounded-full ring-0 ring-secondary transition-[box-shadow] duration-150 peer-focus-visible:ring-2"
      />

      <span
        class="relative inline-flex h-4.5 w-4.5 items-center justify-center rounded-[2px] border-2 transition-colors"
        :class="
          disabled
            ? (modelValue || indeterminate ? 'border-on-surface/38 bg-on-surface/38 text-surface' : 'border-on-surface/38 text-transparent')
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
    <span
      v-if="label || $slots.default"
      class="text-body-large"
      :class="disabled ? 'text-on-surface/38' : 'text-on-surface'"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
