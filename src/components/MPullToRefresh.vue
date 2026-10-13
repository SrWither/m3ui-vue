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

function canStart() {
  return !props.disabled && !props.refreshing && !committed && !!scrollEl.value && scrollEl.value.scrollTop <= 0;
}

function beginPull(y: number) {
  startY = y;
  pulling = true;
  pullDistance = 0;
}

// Returns true when the move is part of a pull (caller should block native scrolling).
function movePull(y: number): boolean {
  const raw = y - startY;
  if (raw <= 0) {
    pullDistance = 0;
    hideIndicator(false);
    return false;
  }
  if (!isPulling.value) isPulling.value = true;
  const maxPull = props.threshold * MAX_PULL_MULTIPLIER;
  pullDistance = Math.min(
    raw <= props.threshold ? raw : props.threshold + (raw - props.threshold) * RESISTANCE,
    maxPull,
  );
  previewIndicator(pullDistance);
  return true;
}

function finishPull() {
  if (!pulling) return;
  pulling = false;
  isPulling.value = false;
  if (pullDistance >= props.threshold) {
    committed = true;
    settleIndicator(true);
    emit("refresh");
  } else {
    hideIndicator(true);
  }
  pullDistance = 0;
}

// Mouse/pen: pointer events. Touch is handled separately below — a touch's
// `touch-action` is resolved by the browser when the finger lands, before any
// pointerdown handler runs, so it can't be switched to `none` mid-gesture: the
// browser starts a native pan and fires pointercancel, snapping the indicator
// back. The only reliable way to own a touch drag is a non-passive touchmove
// that calls preventDefault().
function onPointerDown(e: PointerEvent) {
  if (e.pointerType === "touch" || e.button !== 0 || !canStart()) return;
  pointerId = e.pointerId;
  beginPull(e.clientY);
  scrollEl.value!.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!pulling || e.pointerId !== pointerId) return;
  movePull(e.clientY);
}

function onPointerEnd(e: PointerEvent) {
  if (!pulling || e.pointerId !== pointerId) return;
  pointerId = null;
  if (scrollEl.value?.hasPointerCapture(e.pointerId)) scrollEl.value.releasePointerCapture(e.pointerId);
  finishPull();
}

let touchId: number | null = null;
// Whether this touch gesture has been claimed as a pull (vs. a normal scroll).
let touchClaimed = false;

function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1 || !canStart()) return;
  const t = e.touches[0]!;
  touchId = t.identifier;
  touchClaimed = false;
  beginPull(t.clientY);
}

function onTouchMove(e: TouchEvent) {
  if (!pulling || touchId === null) return;
  const t = Array.from(e.changedTouches).find((x) => x.identifier === touchId);
  if (!t) return;
  if (!touchClaimed) {
    // First move decides: dragging up (or the list has scrolled since touchstart)
    // is a normal scroll — let the browser have the rest of the gesture.
    if (t.clientY <= startY || (scrollEl.value?.scrollTop ?? 0) > 0) {
      if (t.clientY < startY) {
        pulling = false;
        touchId = null;
      }
      return;
    }
    touchClaimed = true;
  }
  // Once claimed, keep blocking native scroll for the whole gesture (even if the
  // finger moves back up) — browsers don't reliably hand a prevented gesture back.
  if (e.cancelable) e.preventDefault();
  movePull(t.clientY);
}

function onTouchEnd(e: TouchEvent) {
  if (touchId === null) return;
  if (!Array.from(e.changedTouches).some((x) => x.identifier === touchId)) return;
  touchId = null;
  touchClaimed = false;
  finishPull();
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
// exactly such a re-render right as a pull starts and finishes), stomping whatever
// transform we'd just applied back to its bound value.
onMounted(() => {
  hideIndicator(false);
  const el = scrollEl.value;
  if (!el) return;
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  // Must be non-passive: preventDefault() here is what stops the native scroll.
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("touchend", onTouchEnd);
  el.addEventListener("touchcancel", onTouchEnd);
});
onBeforeUnmount(() => {
  pulling = false;
  const el = scrollEl.value;
  if (!el) return;
  el.removeEventListener("touchstart", onTouchStart);
  el.removeEventListener("touchmove", onTouchMove);
  el.removeEventListener("touchend", onTouchEnd);
  el.removeEventListener("touchcancel", onTouchEnd);
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
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
    >
      <slot />
    </div>
  </div>
</template>
