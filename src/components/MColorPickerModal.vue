<script setup lang="ts">
/**
 * A color picker in a dialog: saturation/brightness area, hue (and optional opacity) slider, eyedropper,
 * HEX/RGB/HSL fields, recent colors and preset swatches. Built on MDialog; the color is only applied on confirm,
 * and the preview shows it next to the original.
 *
 * @event update:modelValue Emitted when a color is confirmed — powers v-model. Only fires on confirm, not while
 *   dragging
 * @event update:show Emitted when the dialog opens or closes — powers v-model:show
 */
import { ref, watch } from 'vue'
import MButton from './MButton.vue'
import MDialog from './MDialog.vue'
import MColorPanel from './_MColorPanel.vue'
import { useLocale } from '../composables/useLocale'
import { defaultColorPresets, normalizeHex, pushRecentColor } from '../composables/_colorUtils'

const props = withDefaults(defineProps<{
  /** Selected color in hex format (v-model). `#rrggbb`, or `#rrggbbaa` when `alpha` is on and the color isn't opaque. */
  modelValue: string
  /** Controls dialog visibility (v-model:show) */
  show?: boolean
  /** Preset color swatches shown in the dialog */
  presets?: string[]
  /** Dialog title; defaults to the locale's `selectColor` */
  title?: string
  /** Adds an opacity slider and an alpha channel to the value */
  alpha?: boolean
  /** Remember confirmed colors and show them above the presets (stored in localStorage, shared by every picker). */
  recent?: boolean
  /** How many recent colors to keep. */
  recentLimit?: number
  /** Show a button to pick a color from the screen, where the browser supports it (Chrome, Edge). */
  eyedropper?: boolean
}>(), {
  show: false,
  presets: () => defaultColorPresets,
  alpha: false,
  recent: true,
  recentLimit: 7,
  eyedropper: true,
})

const t = useLocale()
const emit = defineEmits<{
  'update:modelValue': [string]
  'update:show': [boolean]
}>()

// The color being picked; becomes the value only on confirm
const draft = ref(props.modelValue)

watch(() => props.show, (open) => {
  if (open) draft.value = props.modelValue
}, { immediate: true })

function cancel() { emit('update:show', false) }

function confirm() {
  const picked = normalizeHex(draft.value) || draft.value
  if (props.recent) pushRecentColor(picked, props.recentLimit)
  emit('update:modelValue', picked)
  emit('update:show', false)
}
</script>

<template>
  <MDialog
    :model-value="show"
    :title="title || t.selectColor"
    max-width="328px"
    :closable="false"
    @update:model-value="!$event && cancel()"
  >
    <MColorPanel
      v-model="draft"
      :presets="presets"
      :alpha="alpha"
      :recent="recent"
      :eyedropper="eyedropper"
      :original="modelValue"
    />
    <template #actions>
      <MButton variant="text" @click="cancel">{{ t.cancel }}</MButton>
      <MButton variant="text" @click="confirm">{{ t.confirm }}</MButton>
    </template>
  </MDialog>
</template>
