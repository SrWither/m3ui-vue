<script setup lang="ts">
/**
 * A chat message bubble — sender name, avatar, timestamp, and read status, for left (received) or right (sent)
 * messages.
 *
 * @slot default Custom content inside the bubble, replacing the text prop — images, files, buttons, or any
 *   layout
 */
import { computed } from 'vue'
import MAvatar from './MAvatar.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** Message text (or use the default slot for custom content) */
    text?: string
    /** Sender name shown above the bubble (left-side only) */
    sender?: string
    /** Timestamp string (e.g. "10:32") */
    time?: string
    /** Left = received, right = sent */
    side?: 'left' | 'right'
    /** Avatar name — shows an MAvatar with these initials (left-side only) */
    avatar?: string
    /** Message status icon next to the timestamp (right-side only) */
    status?: 'sent' | 'delivered' | 'read'
    /** Bubble color for sent (right-side) messages */
    color?: 'primary' | 'secondary' | 'tertiary'
    /** Show the bubble tail (a sharper corner on the side nearest the sender) */
    tail?: boolean
    /** Text size (body-small / body-medium / body-large) */
    size?: 'small' | 'medium' | 'large'
    /** Max bubble width (px, %, or var()) — supports a CSS variable for responsive control */
    maxWidth?: string
    /** Shows a live indicator instead of the content: bouncing dots while the other person types, or a mic with a moving waveform while they record audio. */
    typing?: 'text' | 'audio'
  }>(),
  { side: 'left', color: 'primary', tail: true, size: 'medium', maxWidth: '320px' },
)

const t = useLocale()

const isRight = computed(() => props.side === 'right')

const sizeClass = computed(() => {
  if (props.size === 'small') return 'text-body-small'
  if (props.size === 'large') return 'text-body-large'
  return 'text-body-medium'
})

const colorMap: Record<string, { bg: string; text: string; timeCls: string; status: Record<'sent' | 'delivered' | 'read', string> }> = {
  primary: {
    bg: 'bg-primary', text: 'text-on-primary', timeCls: 'text-on-primary/60',
    status: { sent: 'text-on-primary/40', delivered: 'text-on-primary/60', read: 'text-on-primary' },
  },
  secondary: {
    bg: 'bg-secondary', text: 'text-on-secondary', timeCls: 'text-on-secondary/60',
    status: { sent: 'text-on-secondary/40', delivered: 'text-on-secondary/60', read: 'text-on-secondary' },
  },
  tertiary: {
    bg: 'bg-tertiary', text: 'text-on-tertiary', timeCls: 'text-on-tertiary/60',
    status: { sent: 'text-on-tertiary/40', delivered: 'text-on-tertiary/60', read: 'text-on-tertiary' },
  },
}

// Accent for the typing indicator's mic on the neutral (left) bubble; on the right
// bubble everything already uses the bubble's on-color.
const accentMap: Record<string, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
}

const bubbleClasses = computed(() => {
  const classes = ['rounded-2xl', 'px-3', 'py-2']

  if (isRight.value) {
    const c = colorMap[props.color]!
    classes.push(c.bg, c.text)
    if (props.tail) classes.push('rounded-br-sm')
  } else {
    classes.push('bg-surface-container-high', 'text-on-surface')
    if (props.tail) classes.push('rounded-bl-sm')
  }

  return classes
})

const timeClasses = computed(() =>
  isRight.value ? colorMap[props.color]!.timeCls : 'text-on-surface-variant',
)

const statusIcon = computed(() => {
  if (!props.status) return null
  return props.status === 'sent' ? 'check' : 'done_all'
})

// Was hardcoded to on-primary, so the checks didn't match a secondary/tertiary bubble.
const statusClasses = computed(() => (props.status ? colorMap[props.color]!.status[props.status] : ''))

const micClass = computed(() => (isRight.value ? '' : accentMap[props.color]))

const typingLabel = computed(() => (props.typing === 'audio' ? t.chatRecordingAudio : t.chatTyping))
</script>

<template>
  <div class="flex gap-2" :class="isRight ? 'justify-end' : 'justify-start'">
    <MAvatar
      v-if="avatar && !isRight"
      :name="avatar"
      :size="32"
      class="shrink-0 mt-auto"
    />

    <div class="w-fit" :style="{ maxWidth: maxWidth }">
      <p v-if="sender && !isRight" class="text-label-small font-medium text-on-surface-variant mb-0.5 ml-1">
        {{ sender }}
      </p>

      <div :class="bubbleClasses">
        <!-- Typing / recording indicator -->
        <div
          v-if="typing"
          role="status"
          :aria-label="sender ? `${sender}: ${typingLabel}` : typingLabel"
          class="flex h-5 items-center"
          :class="typing === 'audio' ? 'gap-2' : 'gap-1 px-1'"
        >
          <template v-if="typing === 'text'">
            <span v-for="i in 3" :key="i" class="m3-typing-dot h-2 w-2 rounded-full bg-current opacity-60" :style="{ animationDelay: `${(i - 1) * 160}ms` }" />
          </template>
          <template v-else>
            <MIcon name="mic" :size="18" class="m3-typing-mic" :class="micClass" style="font-variation-settings: 'FILL' 1" />
            <span class="flex h-4 items-center gap-[3px]" aria-hidden="true">
              <span
                v-for="i in 7"
                :key="i"
                class="m3-typing-bar h-full w-[3px] rounded-full bg-current opacity-70"
                :style="{ animationDelay: `${[0, 320, 120, 480, 220, 400, 60][i - 1]}ms` }"
              />
            </span>
          </template>
        </div>

        <template v-else>
          <!-- div, not p: the slot often holds block content (images, buttons, cards) -->
          <div :class="sizeClass"><slot>{{ text }}</slot></div>

          <div v-if="time || (status && isRight)" class="flex items-center justify-end gap-1 mt-0.5">
            <span v-if="time" class="text-label-small" :class="timeClasses">{{ time }}</span>
            <MIcon
              v-if="status && isRight"
              :name="statusIcon!"
              :size="14"
              :class="statusClasses"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.m3-typing-dot {
  animation: m3-typing-dot 1.2s ease-in-out infinite;
}
@keyframes m3-typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.m3-typing-mic {
  animation: m3-typing-mic 1.4s ease-in-out infinite;
}
@keyframes m3-typing-mic {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.9); }
}

.m3-typing-bar {
  transform-origin: center;
  animation: m3-typing-bar 0.9s ease-in-out infinite;
}
@keyframes m3-typing-bar {
  0%, 100% { transform: scaleY(0.25); }
  50% { transform: scaleY(1); }
}

@media (prefers-reduced-motion: reduce) {
  .m3-typing-dot,
  .m3-typing-mic,
  .m3-typing-bar {
    animation: none;
  }
  .m3-typing-bar {
    transform: scaleY(0.6);
  }
}
</style>
