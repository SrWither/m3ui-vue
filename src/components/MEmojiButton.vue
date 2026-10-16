<script setup lang="ts">
/**
 * A single emoji button that cycles through a random pool on hover (Discord-style) and emits whichever emoji is
 * showing when clicked.
 *
 * @event click Emitted on click with the currently displayed emoji (whatever hover last cycled to)
 */
import { ref } from 'vue'
import { allEmojis, emojiCategories, randomEmoji } from '../data/emojis'

const props = withDefaults(
  defineProps<{
    /** Default/current emoji shown before any hover cycling or click */
    emoji?: string
    /** Emoji font size in pixels (the button itself is size + 12px) */
    size?: number
    /** Accessible label — defaults to 'Emoji {emoji}' */
    label?: string
    /** Cycle to a random emoji on hover (Discord-style) */
    randomOnHover?: boolean
    /** Limit random pool to a category id (e.g. 'smileys', 'animals') */
    category?: string
    /** Disables interaction */
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
