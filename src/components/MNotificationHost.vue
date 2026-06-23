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
      <div v-for="n in notifications" :key="n.id" class="notif-row w-full">
        <div
          class="notif-inner pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 shadow-elevation-2"
          :class="getStyle(n.variant).bg"
        >
          <MSpinner v-if="n.loading" :size="18" class="shrink-0" />
          <MIcon
            v-else
            :name="n.icon ?? getStyle(n.variant).iconName"
            :size="18"
            class="shrink-0"
            :class="getStyle(n.variant).icon"
          />
          <p class="flex-1 text-body-small leading-snug">{{ n.message }}</p>
          <button
            type="button"
            class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-inverse-on-surface/50 transition-colors hover:bg-inverse-on-surface/10"
            @click="dismiss(n.id)"
          >
            <MIcon name="close" :size="14" />
          </button>
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
</style>
