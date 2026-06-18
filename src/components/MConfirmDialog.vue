<script setup lang="ts">
import MDialog from './MDialog.vue'
import MButton from './MButton.vue'

withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    loading?: boolean
  }>(),
  {
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    danger: false,
    loading: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [boolean]; confirm: [] }>()
</script>

<template>
  <MDialog
    :model-value="modelValue"
    :title="title"
    max-width="max-w-sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-body-medium text-on-surface-variant">{{ message }}</p>
    <template #actions>
      <MButton variant="text" :disabled="loading" @click="emit('update:modelValue', false)">
        {{ cancelLabel }}
      </MButton>
      <MButton :color="danger ? 'error' : 'primary'" :loading="loading" @click="emit('confirm')">
        {{ confirmLabel }}
      </MButton>
    </template>
  </MDialog>
</template>
