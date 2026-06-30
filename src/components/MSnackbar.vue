<script setup lang="ts">
import { computed } from "vue";
import { useToast } from "../composables/useToast";
import MIcon from "./MIcon.vue";
import MSpinner from "./MSpinner.vue";
import { useLocale } from '../composables/useLocale';

const props = defineProps<{
  closeAriaLabel?: string
}>()

const locale = useLocale()

const { toasts, position, dismiss } = useToast();

const isTop = computed(() => position.value.startsWith("top"));

const containerClass = computed(() => {
  const base = "pointer-events-none fixed z-[300] flex flex-col";
  switch (position.value) {
    case "top-left":
      return `${base} top-4 left-4 items-start`;
    case "top-center":
      return `${base} top-4 left-1/2 -translate-x-1/2 items-center`;
    case "top-right":
      return `${base} top-4 right-4 items-end`;
    case "bottom-left":
      return `${base} bottom-4 left-4 items-start`;
    case "bottom-right":
      return `${base} bottom-4 right-4 items-end`;
    default:
      return `${base} bottom-4 left-1/2 -translate-x-1/2 items-center`;
  }
});

type VariantStyle = {
  container: string;
  icon: string;
  iconName: string;
  action: string;
  close: string;
  progress: string;
};

const variantStyles: Record<string, VariantStyle> = {
  info: {
    // secondary-container tokens are adaptive light/dark out of the box
    container:
      "bg-secondary-container text-on-secondary-container ring-1 ring-inset ring-on-secondary-container/8",
    icon: "text-on-secondary-container/70",
    iconName: "info",
    action: "text-on-secondary-container hover:bg-on-secondary-container/10",
    close: "text-on-secondary-container/60 hover:bg-on-secondary-container/10",
    progress: "bg-on-secondary-container/25",
  },
  success: {
    container:
      "bg-[#dcfce7] text-[#14532d] ring-1 ring-inset ring-[#14532d]/10 dark:bg-[#052e16] dark:text-[#bbf7d0] dark:ring-white/8",
    icon: "text-[#16a34a] dark:text-[#4ade80]",
    iconName: "check_circle",
    action: "text-[#166534] hover:bg-[#14532d]/10 dark:text-[#86efac] dark:hover:bg-white/10",
    close: "text-[#14532d]/50 hover:bg-[#14532d]/10 dark:text-[#bbf7d0]/50 dark:hover:bg-white/10",
    progress: "bg-[#16a34a]/35 dark:bg-[#4ade80]/30",
  },
  warning: {
    container:
      "bg-[#fefce8] text-[#713f12] ring-1 ring-inset ring-[#713f12]/10 dark:bg-[#2d1a00] dark:text-[#fde68a] dark:ring-white/8",
    icon: "text-[#d97706] dark:text-[#fcd34d]",
    iconName: "warning",
    action: "text-[#92400e] hover:bg-[#713f12]/10 dark:text-[#fcd34d] dark:hover:bg-white/10",
    close: "text-[#713f12]/50 hover:bg-[#713f12]/10 dark:text-[#fde68a]/50 dark:hover:bg-white/10",
    progress: "bg-[#d97706]/35 dark:bg-[#fcd34d]/30",
  },
  error: {
    // error-container tokens are adaptive light/dark out of the box
    container:
      "bg-error-container text-on-error-container ring-1 ring-inset ring-on-error-container/8",
    icon: "text-error dark:text-[#fca5a5]",
    iconName: "error",
    action: "text-on-error-container hover:bg-on-error-container/10",
    close: "text-on-error-container/60 hover:bg-on-error-container/10",
    progress: "bg-on-error-container/25",
  },
};

const getVariantStyle = (variant: string): VariantStyle =>
  variantStyles[variant] ?? variantStyles.info!;
</script>

<template>
  <div :class="containerClass">
    <TransitionGroup :name="isTop ? 'm3-toast-top' : 'm3-toast-bot'">
      <div v-for="t in toasts" :key="t.id" class="toast-row relative w-full min-w-64 max-w-xs">
        <Transition name="m3-badge">
          <span
            v-if="t.count >= 2"
            class="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-on-primary shadow-elevation-1"
          >
            <Transition name="m3-count" mode="out-in">
              <span :key="t.count">{{ t.count }}</span>
            </Transition>
          </span>
        </Transition>

        <div
          class="toast-inner pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-4 shadow-elevation-2"
          :class="t.color ? 'text-white ring-1 ring-inset ring-white/10' : getVariantStyle(t.variant).container"
          :style="t.color ? { backgroundColor: t.color } : undefined"
        >
          <MSpinner v-if="t.loading" :size="20" class="shrink-0" />
          <MIcon
            v-else-if="t.icon !== null"
            :name="t.icon ?? getVariantStyle(t.variant).iconName"
            :size="20"
            class="shrink-0"
            :class="t.color ? '' : getVariantStyle(t.variant).icon"
          />

          <p class="flex-1 text-body-medium leading-snug">{{ t.message }}</p>

          <div class="flex shrink-0 items-center gap-0.5">
            <button
              v-if="t.action"
              type="button"
              class="cursor-pointer rounded px-2 py-1 text-label-medium font-semibold transition-colors"
              :class="t.color ? 'text-white/90 hover:bg-white/15' : getVariantStyle(t.variant).action"
              @click="
                () => {
                  t.action!.onClick();
                  dismiss(t.id);
                }
              "
            >
              {{ t.action.label }}
            </button>

            <button
              type="button"
              class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
              :class="t.color ? 'text-white/60 hover:bg-white/15' : getVariantStyle(t.variant).close"
              :aria-label="closeAriaLabel ?? locale.close"
              @click="dismiss(t.id)"
            >
              <MIcon name="close" :size="18" />
            </button>
          </div>

          <!-- Countdown progress bar -->
          <div
            v-if="t.duration > 0"
            class="absolute right-0 bottom-0 left-0 h-0.5 origin-left"
            :class="t.color ? 'bg-white/30' : getVariantStyle(t.variant).progress"
            :style="{ animation: `m3-toast-progress ${t.duration}ms linear forwards` }"
          />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/*
  .toast-row is a grid container — animating grid-template-rows: 1fr → 0fr
  collapses height smoothly without position:absolute, so sibling toasts
  shift up gracefully instead of jumping.
*/
.toast-row {
  display: grid;
  grid-template-rows: 1fr;
  padding-bottom: 8px;
}
.toast-row > .toast-inner {
  min-height: 0; /* required for 0fr collapse */
}

/* ─── Bottom toasts ─────────────────────────────────────────────── */
.m3-toast-bot-enter-active {
  transition:
    grid-template-rows 220ms cubic-bezier(0.2, 0, 0, 1),
    padding-bottom 220ms cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}
.m3-toast-bot-enter-active > .toast-inner {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-toast-bot-enter-from {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-toast-bot-enter-from > .toast-inner {
  opacity: 0;
  transform: translateY(20px) scale(0.94);
}

.m3-toast-bot-leave-active {
  transition:
    grid-template-rows 300ms cubic-bezier(0.2, 0, 0, 1),
    padding-bottom 300ms cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}
.m3-toast-bot-leave-active > .toast-inner {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.m3-toast-bot-leave-to {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-toast-bot-leave-to > .toast-inner {
  opacity: 0;
  transform: scale(0.92);
}

/* ─── Top toasts ────────────────────────────────────────────────── */
.m3-toast-top-enter-active {
  transition:
    grid-template-rows 220ms cubic-bezier(0.2, 0, 0, 1),
    padding-bottom 220ms cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}
.m3-toast-top-enter-active > .toast-inner {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0, 0, 1);
}
.m3-toast-top-enter-from {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-toast-top-enter-from > .toast-inner {
  opacity: 0;
  transform: translateY(-20px) scale(0.94);
}

.m3-toast-top-leave-active {
  transition:
    grid-template-rows 300ms cubic-bezier(0.2, 0, 0, 1),
    padding-bottom 300ms cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}
.m3-toast-top-leave-active > .toast-inner {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.m3-toast-top-leave-to {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-toast-top-leave-to > .toast-inner {
  opacity: 0;
  transform: scale(0.92);
}

/* badge appear/disappear */
.m3-badge-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.m3-badge-leave-active  { transition: opacity 0.15s ease, transform 0.15s ease; }
.m3-badge-enter-from, .m3-badge-leave-to { opacity: 0; transform: scale(0.5); }

/* count number bump when incrementing */
.m3-count-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.m3-count-leave-active  { transition: opacity 0.08s ease, transform 0.08s ease; }
.m3-count-enter-from    { opacity: 0; transform: scale(1.5) translateY(-3px); }
.m3-count-leave-to      { opacity: 0; transform: scale(0.6) translateY(2px); }

@keyframes m3-toast-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
</style>
