<script setup lang="ts">
import { computed } from 'vue'
import { useNotification } from '../composables/useNotification'
import MIcon from './MIcon.vue'
import MSpinner from './MSpinner.vue'

const { notifications, position, dismiss } = useNotification()

const isTop = computed(() => position.value.startsWith('top'))

const containerClass = computed(() => {
  const base = 'pointer-events-none fixed z-[300] flex flex-col'
  switch (position.value) {
    case 'top-left': return `${base} top-4 left-4 items-start`
    case 'top-center': return `${base} top-4 left-1/2 -translate-x-1/2 items-center`
    case 'top-right': return `${base} top-4 right-4 items-end`
    case 'bottom-left': return `${base} bottom-4 left-4 items-start`
    case 'bottom-right': return `${base} bottom-4 right-4 items-end`
    default: return `${base} bottom-4 left-1/2 -translate-x-1/2 items-center`
  }
})

const variantStyles: Record<string, { bg: string; icon: string; iconName: string }> = {
  info: {
    bg: 'bg-inverse-surface text-inverse-on-surface',
    icon: 'text-inverse-on-surface/70',
    iconName: 'info',
  },
  success: {
    bg: 'bg-inverse-surface text-inverse-on-surface',
    icon: 'text-[#4ade80]',
    iconName: 'check_circle',
  },
  warning: {
    bg: 'bg-inverse-surface text-inverse-on-surface',
    icon: 'text-[#fcd34d]',
    iconName: 'warning',
  },
  error: {
    bg: 'bg-inverse-surface text-inverse-on-surface',
    icon: 'text-[#f87171]',
    iconName: 'error',
  },
}

const getStyle = (variant: string) => variantStyles[variant] ?? variantStyles.info!
</script>

<template>
  <div :class="containerClass">
    <TransitionGroup :name="isTop ? 'm3-notif-top' : 'm3-notif-bot'">
      <div v-for="n in notifications" :key="n.id" class="notif-row relative w-full min-w-56 max-w-sm">
        <Transition name="m3-badge">
          <span
            v-if="n.count >= 2"
            class="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-on-primary shadow-elevation-1"
          >
            <Transition name="m3-count" mode="out-in">
              <span :key="n.count">{{ n.count }}</span>
            </Transition>
          </span>
        </Transition>

        <div
          class="notif-inner pointer-events-auto flex items-center gap-2.5 rounded px-4 py-3 shadow-elevation-2"
          :class="getStyle(n.variant).bg"
        >
          <MSpinner v-if="n.loading" :size="18" class="shrink-0" />
          <MIcon
            v-else-if="n.icon !== null"
            :name="n.icon ?? getStyle(n.variant).iconName"
            :size="18"
            class="shrink-0"
            :class="getStyle(n.variant).icon"
          />
          <p class="flex-1 text-body-medium leading-snug">{{ n.message }}</p>
          <div class="flex shrink-0 items-center gap-1">
            <button
              v-if="n.action"
              type="button"
              class="cursor-pointer rounded px-2 py-1 text-label-medium font-semibold text-inverse-primary transition-colors hover:bg-inverse-on-surface/10"
              @click="n.action!.onClick(); dismiss(n.id)"
            >
              {{ n.action.label }}
            </button>
            <button
              v-if="n.closable !== false"
              type="button"
              class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-inverse-on-surface/50 transition-colors hover:bg-inverse-on-surface/10"
              @click="dismiss(n.id)"
            >
              <MIcon name="close" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.notif-row {
  display: grid;
  grid-template-rows: 1fr;
  padding-bottom: 6px;
}
.notif-row > .notif-inner {
  min-height: 0;
}

.m3-notif-bot-enter-active {
  transition: grid-template-rows 200ms ease, padding-bottom 200ms ease;
  overflow: hidden;
}
.m3-notif-bot-enter-active > .notif-inner {
  transition: opacity 150ms ease, transform 200ms ease;
}
.m3-notif-bot-enter-from {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-notif-bot-enter-from > .notif-inner {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}

.m3-notif-bot-leave-active {
  transition: grid-template-rows 250ms ease, padding-bottom 250ms ease;
  overflow: hidden;
}
.m3-notif-bot-leave-active > .notif-inner {
  transition: opacity 150ms ease, transform 150ms ease;
}
.m3-notif-bot-leave-to {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-notif-bot-leave-to > .notif-inner {
  opacity: 0;
  transform: scale(0.93);
}

.m3-notif-top-enter-active {
  transition: grid-template-rows 200ms ease, padding-bottom 200ms ease;
  overflow: hidden;
}
.m3-notif-top-enter-active > .notif-inner {
  transition: opacity 150ms ease, transform 200ms ease;
}
.m3-notif-top-enter-from {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-notif-top-enter-from > .notif-inner {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.m3-notif-top-leave-active {
  transition: grid-template-rows 250ms ease, padding-bottom 250ms ease;
  overflow: hidden;
}
.m3-notif-top-leave-active > .notif-inner {
  transition: opacity 150ms ease, transform 150ms ease;
}
.m3-notif-top-leave-to {
  grid-template-rows: 0fr;
  padding-bottom: 0;
}
.m3-notif-top-leave-to > .notif-inner {
  opacity: 0;
  transform: scale(0.93);
}

.m3-badge-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.m3-badge-leave-active  { transition: opacity 0.15s ease, transform 0.15s ease; }
.m3-badge-enter-from, .m3-badge-leave-to { opacity: 0; transform: scale(0.5); }

.m3-count-enter-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.m3-count-leave-active  { transition: opacity 0.08s ease, transform 0.08s ease; }
.m3-count-enter-from    { opacity: 0; transform: scale(1.5) translateY(-3px); }
.m3-count-leave-to      { opacity: 0; transform: scale(0.6) translateY(2px); }
</style>
