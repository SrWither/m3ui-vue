<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    label?: string;
    showValue?: boolean;
    color?: "primary" | "secondary" | "tertiary" | "error";
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    showValue: false,
    color: "primary",
  },
);

const emit = defineEmits<{
  "update:modelValue": [number];
}>();

const trackEl = ref<HTMLElement>();
const dragging = ref(false);

const pct = computed(() => {
  const range = props.max - props.min;
  return range === 0 ? 0 : ((props.modelValue - props.min) / range) * 100;
});

const colors: Record<string, { active: string; inactive: string; thumb: string }> = {
  primary: {
    active: "bg-primary",
    inactive: "bg-primary-container",
    thumb: "bg-primary",
  },
  secondary: {
    active: "bg-secondary",
    inactive: "bg-secondary-container",
    thumb: "bg-secondary",
  },
  tertiary: {
    active: "bg-tertiary",
    inactive: "bg-tertiary-container",
    thumb: "bg-tertiary",
  },
  error: {
    active: "bg-error",
    inactive: "bg-error-container",
    thumb: "bg-error",
  },
};

function clamp(v: number) {
  const stepped = Math.round((v - props.min) / props.step) * props.step + props.min;

  return Math.max(props.min, Math.min(props.max, stepped));
}

function valueFromX(clientX: number) {
  if (!trackEl.value) return props.modelValue;

  const rect = trackEl.value.getBoundingClientRect();

  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

  return clamp(props.min + ratio * (props.max - props.min));
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled) return;

  e.preventDefault();

  dragging.value = true;

  emit("update:modelValue", valueFromX(e.clientX));

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;

  emit("update:modelValue", valueFromX(e.clientX));
}

function onPointerUp() {
  dragging.value = false;

  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
}

function onKeyDown(e: KeyboardEvent) {
  if (props.disabled) return;

  const delta = {
    ArrowRight: 1,
    ArrowUp: 1,
    ArrowLeft: -1,
    ArrowDown: -1,
  }[e.key];

  if (delta !== undefined) {
    e.preventDefault();

    emit("update:modelValue", clamp(props.modelValue + delta * props.step));
  }

  if (e.key === "Home") {
    e.preventDefault();
    emit("update:modelValue", props.min);
  }

  if (e.key === "End") {
    e.preventDefault();
    emit("update:modelValue", props.max);
  }
}

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
});

const thumbStyle = computed(() => ({
  left: `${pct.value}%`,
  top: "50%",
  transform: `translateX(-50%) translateY(-50%) scale(${dragging.value ? 1.15 : 1})`,
  transition: dragging.value ? "transform 80ms ease" : "left 75ms ease, transform 80ms ease",
}));
</script>

<template>
  <div class="flex flex-col gap-1 select-none">
    <div v-if="label || showValue" class="flex items-center justify-between">
      <span v-if="label" class="text-label-large text-on-surface">
        {{ label }}
      </span>

      <span v-if="showValue" class="tabular-nums text-label-large text-on-surface-variant">
        {{ modelValue }}
      </span>
    </div>

    <div
      ref="trackEl"
      role="slider"
      tabindex="0"
      :aria-valuenow="modelValue"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-disabled="disabled || undefined"
      class="relative flex h-10 w-full touch-none cursor-pointer items-center outline-none"
      :class="disabled && 'cursor-not-allowed opacity-[0.38]'"
      @pointerdown="onPointerDown"
      @keydown="onKeyDown"
    >
      <div class="relative h-1 w-full rounded-full" :class="colors[color]!.inactive">
        <div
          class="h-full rounded-full"
          :class="colors[color]!.active"
          :style="{
            width: `${pct}%`,
            transition: dragging ? 'none' : 'width 75ms ease',
          }"
        />
      </div>

      <div
        class="pointer-events-none absolute h-5 w-5 rounded-full shadow-elevation-1"
        :class="colors[color]!.thumb"
        :style="thumbStyle"
      />
    </div>
  </div>
</template>
