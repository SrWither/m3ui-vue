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

// Just the fill color, reused for the hover/press state layer's tint below.
const checkedBgColor: Record<string, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

/*
 * RadioButtonTokens: UnselectedIconColor = OnSurfaceVariant at rest, but
 * Unselected{Focus,Hover,Pressed}IconColor are all OnSurface — the ring+dot darkens on
 * interaction, same as MCheckbox's unselected border does. SelectedIconColor stays Primary
 * through every interaction state (no darkening once checked). Disabled dims via the
 * blanket `opacity-[0.38]` already on <label> below (equivalent to the real
 * Disabled{Selected,Unselected}IconOpacity = 0.38, just applied to the whole row rather
 * than the icon specifically — numerically the same result for the icon itself).
 */
const iconColorClasses = computed(() => {
  if (props.disabled) return "text-on-surface-variant";
  if (isChecked.value) return checkedColor[props.color];
  return "text-on-surface-variant group-hover:text-on-surface group-active:text-on-surface peer-focus-visible:text-on-surface";
});
</script>

<template>
  <label
    :for="id"
    class="group inline-flex items-center gap-3 select-none"
    :class="disabled ? 'cursor-not-allowed opacity-[0.38]' : 'cursor-pointer'"
  >
    <!--
      RadioButtonTokens.StateLayerSize = 40dp (was 48px). Unlike MCheckbox/MChip,
      RadioButtonTokens has NO FocusIndicatorColor at all — the real radio doesn't get a
      separate colored ring on focus, only this state-layer circle (which also reacts to
      focus, not just hover/press) plus the icon color darkening above. So no focus-ring
      span here, just `peer-focus-visible:` added to this same state-layer's opacity.
    -->
    <span class="relative -m-2.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
      <!--
        Input stays nested inside this `relative` span (a true sibling of the state-layer
        span below, satisfying `peer-*`'s sibling-combinator requirement) rather than hoisted
        up to <label> — moving a sr-only, `position: absolute` input away from a nearby
        positioned ancestor breaks the browser's native focus-scroll behavior (see MCheckbox's
        CHANGELOG entry for the real bug this caused there).
      -->
      <input
        :id="id"
        type="radio"
        class="peer sr-only"
        :checked="isChecked"
        :disabled="disabled"
        @change="emit('update:modelValue', value)"
      />
      <span
        v-if="!disabled"
        class="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-[0.08] group-active:opacity-[0.12] peer-focus-visible:opacity-[0.08]"
        :class="isChecked ? checkedBgColor[color] : 'bg-on-surface'"
      />

      <span class="relative flex h-5 w-5">
        <!--
          SVG radio: vector circles sharing center (10,10) stay round + concentric
          at any zoom. Outer ring uses r=8 (not 9) so the 2px stroke (7..9) leaves
          ~1px of clearance to the viewBox edge — prevents the border getting
          clipped at certain zoom levels.
        -->
        <svg
          viewBox="0 0 20 20"
          class="h-full w-full transition-colors duration-150"
          :class="iconColorClasses"
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
