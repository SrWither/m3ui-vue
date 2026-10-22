<script setup lang="ts">
/**
 * A pill-shaped search input that filters in place: a list, a table, a grid of products. Unlike MSearchBar, it never
 * expands into a results view; it's just the field, in M3's search bar colors and shape.
 *
 * Your `class` and `style` go on the pill; every other attribute (`name`, `autocomplete`, `aria-*`, listeners like
 * `@focus` or `@keydown`) goes on the `<input>`.
 *
 * @slot leading Replaces the search icon (an avatar, a back or menu button…). Spaced for a 40px icon button, as in
 *   M3's search bar: its icon lands 16px from the edge, like the default one, and the text at the same place
 * @slot trailing Extra content after the clear button (a mic button, a filter menu…)
 * @event update:modelValue The text, on every keystroke — powers v-model
 * @event search Enter was pressed, with the text
 * @event clear The clear button (or Escape) emptied the field
 */
import { computed, ref, useAttrs } from 'vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** The text (v-model) */
    modelValue?: string
    /** Placeholder. Defaults to the locale's `search` */
    placeholder?: string
    /** Accessible name when there's no visible label. Defaults to the placeholder */
    label?: string
    /** Leading icon, a Material Symbol. Set to '' for none */
    icon?: string
    /** Height: `sm` 40px (body-medium text), `md` 48px, `lg` 56px (M3's search bar) */
    size?: 'sm' | 'md' | 'lg'
    /** Shows a clear button while there's text */
    clearable?: boolean
    /**
     * Escape empties the field (keeping the key from closing a dialog or menu around it); on an empty field it
     * leaves it and lets the key through
     */
    clearOnEscape?: boolean
    /** Disables the field */
    disabled?: boolean
  }>(),
  { modelValue: '', icon: 'search', size: 'lg', clearable: true, clearOnEscape: true, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [string]; search: [string]; clear: [] }>()

const locale = useLocale()
const attrs = useAttrs()
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})

const inputEl = ref<HTMLInputElement>()
const placeholderText = computed(() => props.placeholder ?? locale.search)
const iconSize = computed(() => (props.size === 'sm' ? 20 : props.size === 'md' ? 22 : 24))

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
function clear() {
  emit('update:modelValue', '')
  emit('clear')
  inputEl.value?.focus()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') emit('search', props.modelValue)
  else if (e.key === 'Escape' && props.clearOnEscape) {
    if (props.modelValue) {
      // Handled here: a dialog or overlay around the field keeps its Escape for the next press
      e.stopPropagation()
      e.preventDefault()
      emit('update:modelValue', '')
      emit('clear')
    } else inputEl.value?.blur()
  }
}

defineExpose({
  /** The `<input>` element */
  inputEl,
  /** Focuses the input */
  focus: (options?: FocusOptions) => inputEl.value?.focus(options),
  /** Takes focus away from the input */
  blur: () => inputEl.value?.blur(),
})
</script>

<template>
  <label
    class="m3-search-field flex min-w-0 items-center text-on-surface focus-within:ring-2 focus-within:ring-secondary"
    :class="[`m3-search-field-${size}`, { 'm3-search-field-slotted': $slots.leading }, disabled ? 'cursor-not-allowed opacity-38' : 'cursor-text']"
    v-bind="rootAttrs"
  >
    <!-- A slotted 40px button sits 8px in and 4px from the text: its icon then lines up with the default one -->
    <span v-if="$slots.leading" class="-me-2 flex shrink-0 items-center"><slot name="leading" /></span>
    <MIcon v-else-if="icon" :name="icon" :size="iconSize" class="shrink-0 text-on-surface-variant" />
    <input
      ref="inputEl"
      :value="modelValue"
      type="search"
      :placeholder="placeholderText"
      :aria-label="label ?? placeholderText"
      :disabled="disabled"
      enterkeyhint="search"
      class="min-w-0 flex-1 bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden"
      :class="size === 'sm' ? 'text-body-medium' : 'text-body-large'"
      v-bind="inputAttrs"
      @input="onInput"
      @keydown="onKeydown"
    />
    <button
      v-if="clearable && modelValue && !disabled"
      type="button"
      class="-mr-1 flex shrink-0 cursor-pointer rounded-full p-1 text-on-surface-variant hover:bg-on-surface/8"
      :aria-label="locale.clearSearch"
      @click="clear"
    >
      <MIcon name="close" :size="iconSize - 2" />
    </button>
    <slot name="trailing" />
  </label>
</template>

<style>
/* Default color, shape, spacing and height in the base layer, so a consumer's bg-*, rounded-*, px-*, gap-* or h-* wins */
@layer base {
  .m3-search-field {
    gap: 12px;
    padding-inline: 16px;
    background-color: var(--color-surface-container-high);
    border-radius: 9999px;
  }
  .m3-search-field-slotted { padding-inline-start: 8px; }
  .m3-search-field-sm { height: 40px; }
  .m3-search-field-md { height: 48px; }
  .m3-search-field-lg { height: 56px; }
}
</style>
