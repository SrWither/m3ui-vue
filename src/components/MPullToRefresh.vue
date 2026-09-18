<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import MLoadingIndicator from "./MLoadingIndicator.vue";

const props = withDefaults(
  defineProps<{
    refreshing?: boolean;
    disabled?: boolean;
    threshold?: number;
    size?: number;
    color?: "primary" | "secondary" | "tertiary" | "error";
  }>(),
  { refreshing: false, disabled: false, threshold: 64, size: 36, color: "primary" },
);

const emit = defineEmits<{ refresh: [] }>();

// Beyond `threshold`, the drag keeps following the pointer but scaled down —
// same "rubber band" feel as MLightbox's swipe-to-navigate.
const MAX_PULL_MULTIPLIER = 1.8;
const RESISTANCE = 0.45;

const scrollEl = ref<HTMLElement | null>(null);
const indicatorEl = ref<HTMLElement | null>(null);
const isPulling = ref(false);

let pointerId: number | null = null;
let startY = 0;
let pulling = false;
let pullDistance = 0;
// True once a drag has crossed the threshold and been released (or refreshing
// was set programmatically) — the indicator stays pinned until it clears.
let committed = false;

// Fixed resting inset once settled/refreshing — deliberately small and
// independent of `threshold`/`size` math, so it always reads as "just inside
// the edge" rather than wherever the drag happened to end up.
const SETTLE_GAP = 12;

function setTransition(el: HTMLElement, animate: boolean) {
  el.style.transition = animate ? "transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease" : "none";
}

// Live preview while actively dragging — slides in from above (clipped/
// hidden by the container's overflow) and grows with the pull.
function previewIndicator(distance: number) {
  const el = indicatorEl.value;
  if (!el) return;
  setTransition(el, false);
  const progress = Math.min(1, distance / props.threshold);
  el.style.transform = `translateY(${distance - props.size}px) scale(${0.5 + progress * 0.5})`;
  el.style.opacity = `${progress}`;
}

function settleIndicator(animate: boolean) {
  const el = indicatorEl.value;
  if (!el) return;
  setTransition(el, animate);
  el.style.transform = `translateY(${SETTLE_GAP}px) scale(1)`;
  el.style.opacity = "1";
}

function hideIndicator(animate: boolean) {
  const el = indicatorEl.value;
  if (!el) return;
  setTransition(el, animate);
  el.style.transform = `translateY(-${props.size}px) scale(0.5)`;
  el.style.opacity = "0";
}

function onPointerDown(e: PointerEvent) {
  if (props.disabled || props.refreshing || committed || e.button !== 0) return;
  if (!scrollEl.value || scrollEl.value.scrollTop > 0) return;
  pointerId = e.pointerId;
  startY = e.clientY;
  pulling = true;
  isPulling.value = true;
  // Declare up front (before any touchmove fires) that this element handles
  // its own touch gestures now — waiting and calling preventDefault() from
  // inside pointermove is too late on some mobile browsers, which may have
  // already started resolving the touch as a native scroll/pull-to-refresh
  // and cancel our pointer sequence out from under us. Note this only fully
  // holds up in contexts without a competing OS/browser-chrome gesture layer
  // (Capacitor/Electron shells, desktop mouse) — a real mobile browser tab
  // can still occasionally win that race and cancel the drag.
  scrollEl.value.style.touchAction = "none";
  scrollEl.value.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!pulling || e.pointerId !== pointerId) return;
  const raw = e.clientY - startY;
  if (raw <= 0) {
    // Dragging back upward — not a pull. Hand touch scrolling back so the
    // rest of this gesture can scroll the list normally.
    pullDistance = 0;
    hideIndicator(false);
    if (scrollEl.value) scrollEl.value.style.touchAction = "";
    return;
  }
  e.preventDefault();
  const maxPull = props.threshold * MAX_PULL_MULTIPLIER;
  pullDistance = Math.min(
    raw <= props.threshold ? raw : props.threshold + (raw - props.threshold) * RESISTANCE,
    maxPull,
  );
  previewIndicator(pullDistance);
}

function endPull(e: PointerEvent) {
  if (!pulling || e.pointerId !== pointerId) return;
  pulling = false;
  isPulling.value = false;
  if (scrollEl.value) {
    scrollEl.value.style.touchAction = "";
    if (scrollEl.value.hasPointerCapture(e.pointerId)) scrollEl.value.releasePointerCapture(e.pointerId);
  }

  if (pullDistance >= props.threshold) {
    committed = true;
    settleIndicator(true);
    emit("refresh");
  } else {
    hideIndicator(true);
  }
  pullDistance = 0;
}

// Also settles the indicator when a refresh is triggered programmatically
// (not from a drag) and releases it once the caller clears `refreshing`.
watch(
  () => props.refreshing,
  (refreshing) => {
    if (refreshing) {
      if (!committed) {
        committed = true;
        settleIndicator(true);
      }
    } else if (committed) {
      committed = false;
      hideIndicator(true);
    }
  },
);

// The indicator's transform/opacity are owned entirely by the functions
// above, written directly to the DOM — never bound reactively in the
// template. A reactive `:style` there would fight this: Vue re-patches any
// style property it tracks on every re-render of this component (and
// `isPulling` toggling — used below for the `select-none` class — forces
// exactly such a re-render right at pointerdown/endPull), stomping whatever
// transform we'd just applied back to its bound value.
onMounted(() => hideIndicator(false));
onBeforeUnmount(() => {
  pulling = false;
});
</script>

<template>
  <div class="relative overflow-hidden">
    <div
      ref="indicatorEl"
      class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center opacity-0"
    >
      <MLoadingIndicator :size="size" :color="color" contained />
    </div>

    <div
      ref="scrollEl"
      class="h-full overflow-y-auto overscroll-y-contain"
      :class="{ 'select-none': isPulling }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endPull"
      @pointercancel="endPull"
    >
      <slot />
    </div>
  </div>
</template>
