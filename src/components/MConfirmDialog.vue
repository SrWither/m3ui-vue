<script setup lang="ts">
/**
 * A pre-built confirmation dialog on top of MDialog — title, message, cancel/confirm buttons, a danger color
 * mode, and a loading state, so you don't have to hand-roll one for every "are you sure?" prompt.
 *
 * @event update:modelValue Emitted when the dialog should open/close — powers v-model
 * @event confirm Emitted when the confirm button is clicked — the dialog stays open until the caller sets
 *   modelValue to false (or clears loading)
 */
import MDialog from './MDialog.vue'
import MButton from './MButton.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** Open/closed state (v-model) */
    modelValue: boolean
    /** Dialog title */
    title: string
    /** Confirmation message body */
    message: string
    /** Confirm button label — falls back to the locale string when omitted */
    confirmLabel?: string
    /** Cancel button label — falls back to the locale string when omitted */
    cancelLabel?: string
    /** Error color on the confirm button, for destructive actions */
    danger?: boolean
    /** Shows a spinner on the confirm button and disables cancel */
    loading?: boolean
    /** Passed straight through to MDialog's `closable` — show/hide the header close (X) button. */
    closable?: boolean
  }>(),
  {
    danger: false,
    loading: false,
    closable: true,
  },
)

const locale = useLocale()

const emit = defineEmits<{ 'update:modelValue': [boolean]; confirm: [] }>()
</script>

<template>
  <MDialog
    :model-value="modelValue"
    :title="title"
    max-width="max-w-sm"
    :closable="closable"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-body-medium text-on-surface-variant">{{ message }}</p>
    <template #actions>
      <MButton variant="text" :disabled="loading" @click="emit('update:modelValue', false)">
        {{ cancelLabel ?? locale.cancel }}
      </MButton>
      <MButton :color="danger ? 'error' : 'primary'" :loading="loading" @click="emit('confirm')">
        {{ confirmLabel ?? locale.confirm }}
      </MButton>
    </template>
  </MDialog>
</template>
