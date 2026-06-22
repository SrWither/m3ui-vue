<script setup lang="ts">
import { computed } from 'vue'
import MAvatar from './MAvatar.vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    text?: string
    sender?: string
    time?: string
    side?: 'left' | 'right'
    avatar?: string
    avatarSrc?: string
    status?: 'sent' | 'delivered' | 'read'
    color?: 'primary' | 'secondary' | 'tertiary'
    tail?: boolean
    size?: 'small' | 'medium' | 'large'
    maxWidth?: string
  }>(),
  { side: 'left', color: 'primary', tail: true, size: 'medium', maxWidth: '320px' },
)

const isRight = computed(() => props.side === 'right')

const sizeClass = computed(() => {
  if (props.size === 'small') return 'text-body-small'
  if (props.size === 'large') return 'text-body-large'
  return 'text-body-medium'
})

const colorMap: Record<string, { bg: string; text: string; timeCls: string }> = {
  primary: { bg: 'bg-primary', text: 'text-on-primary', timeCls: 'text-on-primary/60' },
  secondary: { bg: 'bg-secondary', text: 'text-on-secondary', timeCls: 'text-on-secondary/60' },
  tertiary: { bg: 'bg-tertiary', text: 'text-on-tertiary', timeCls: 'text-on-tertiary/60' },
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

const statusClasses = computed(() => {
  if (props.status === 'sent') return 'text-on-primary/40'
  if (props.status === 'delivered') return 'text-on-primary/60'
  if (props.status === 'read') return 'text-on-primary'
  return ''
})
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
        <p :class="sizeClass"><slot>{{ text }}</slot></p>

        <div v-if="time || (status && isRight)" class="flex items-center justify-end gap-1 mt-0.5">
          <span v-if="time" class="text-label-small" :class="timeClasses">{{ time }}</span>
          <MIcon
            v-if="status && isRight"
            :name="statusIcon!"
            :size="14"
            :class="statusClasses"
          />
        </div>
      </div>
    </div>
  </div>
</template>
