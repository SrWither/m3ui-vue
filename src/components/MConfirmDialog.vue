<script setup lang="ts">
import MDialog from './MDialog.vue'
import MButton from './MButton.vue'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
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
