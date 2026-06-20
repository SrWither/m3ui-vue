<script setup lang="ts">
import { ref } from 'vue'
import { allEmojis, emojiCategories, randomEmoji } from '../data/emojis'

const props = withDefaults(
  defineProps<{
    emoji?: string
    size?: number
    label?: string
    randomOnHover?: boolean
    /** Limit random pool to a category id (e.g. 'smileys', 'animals') */
    category?: string
    disabled?: boolean
  }>(),
  { emoji: '😀', size: 28, randomOnHover: true, disabled: false },
)

const emit = defineEmits<{
  click: [emoji: string]
}>()

const displayed = ref(props.emoji)

function getPool() {
  if (props.category) {
    const cat = emojiCategories.find((c) => c.id === props.category)
    return cat?.emojis ?? allEmojis
  }
  return allEmojis
}

function onEnter() {
  if (!props.randomOnHover || props.disabled) return
  displayed.value = randomEmoji(getPool())
}

function onLeave() {
}

function onClick() {
  if (props.disabled) return
  emit('click', displayed.value)
}
</script>

<template>
  <button
    type="button"
    class="inline-flex cursor-pointer items-center justify-center rounded-full transition-transform duration-100 hover:scale-110 active:scale-95"
    :class="disabled ? 'cursor-not-allowed opacity-38' : ''"
    :style="{ width: `${size + 12}px`, height: `${size + 12}px`, fontSize: `${size}px` }"
    :aria-label="label ?? `Emoji ${emoji}`"
    :disabled="disabled"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @click="onClick"
  >
    <span class="leading-none">{{ displayed }}</span>
  </button>
</template>
