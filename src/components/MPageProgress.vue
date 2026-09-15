<script setup lang="ts">
import { getCurrentInstance, onMounted, onUnmounted } from "vue";
import { usePageProgress } from "../composables/usePageProgress";

const props = withDefaults(
  defineProps<{
    color?: "primary" | "secondary" | "tertiary" | "error";
    thickness?: number;
    /** Auto-wire to vue-router's navigation guards when a router is detected. Set to `false` to drive it entirely by hand via `usePageProgress()`. */
    auto?: boolean;
    position?: "top" | "bottom";
  }>(),
  { color: "primary", thickness: 3, auto: true, position: "top" },
);

const { progress, isActive, start, done } = usePageProgress();

const colorMap: Record<"primary" | "secondary" | "tertiary" | "error", string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

const unregister: Array<() => void> = [];

onMounted(() => {
  if (!props.auto) return;

  // Duck-typed vue-router detection — avoids a hard dependency on the package.
  const router = getCurrentInstance()?.appContext.config.globalProperties.$router;
  if (!router) return;

  unregister.push(router.beforeEach(() => { start(); }));
  unregister.push(router.afterEach(() => { done(); }));
  unregister.push(router.onError(() => { done(); }));
});

onUnmounted(() => {
  unregister.forEach((fn) => fn());
  unregister.length = 0;
});
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 z-[9999] overflow-hidden transition-opacity duration-300"
    :class="[position === 'top' ? 'top-0' : 'bottom-0', isActive ? 'opacity-100' : 'opacity-0']"
    :style="{ height: `${thickness}px` }"
    role="progressbar"
    aria-hidden="true"
    :aria-valuenow="isActive ? Math.round(progress) : undefined"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="h-full rounded-r-full transition-[width] duration-200 ease-out"
      :class="colorMap[color]"
      :style="{ width: `${progress}%` }"
    />
  </div>
</template>
