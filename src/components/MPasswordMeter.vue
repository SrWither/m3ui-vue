<script setup lang="ts">
import { computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    value: string
    /** 5 labels, weakest to strongest. */
    labels?: string[]
    /** Length considered "long enough" — also used (+4) as the "very long" bonus threshold. */
    minLength?: number
  }>(),
  {
    labels: () => ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'],
    minLength: 8,
  },
)

const emit = defineEmits<{ score: [number] }>()

function scorePassword(pw: string, minLength: number): number {
  let score = 0
  if (pw.length >= minLength) score++
  if (pw.length >= minLength + 4) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const hasValue = computed(() => props.value.length > 0)
const score = computed(() => scorePassword(props.value, props.minLength))
const filledCount = computed(() => (hasValue.value ? score.value + 1 : 0))

const COLORS = ['bg-error', 'bg-error', 'bg-tertiary', 'bg-primary', 'bg-success']
const TEXT_COLORS = ['text-error', 'text-error', 'text-tertiary', 'text-primary', 'text-success']

const barColor = computed(() => COLORS[score.value])
const textColor = computed(() => TEXT_COLORS[score.value])
const label = computed(() => props.labels[score.value] ?? '')

watch([() => props.value, score], () => emit('score', hasValue.value ? score.value : -1), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex gap-1">
      <div
        v-for="i in 5"
        :key="i"
        class="h-1 flex-1 rounded-full transition-colors duration-200"
        :class="i <= filledCount ? barColor : 'bg-surface-container-highest'"
      />
    </div>
    <p v-if="hasValue" class="text-body-small" :class="textColor">{{ label }}</p>
  </div>
</template>
