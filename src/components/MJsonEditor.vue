<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MCodeEditor from './MCodeEditor.vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: unknown
    readonly?: boolean
    minHeight?: string
    maxHeight?: string
  }>(),
  {
    readonly: false,
    minHeight: '200px',
    maxHeight: '600px',
  },
)

const emit = defineEmits<{ 'update:modelValue': [unknown] }>()

const rawText = ref(JSON.stringify(props.modelValue, null, 2))
const parseError = ref<string | null>(null)

const isValid = computed(() => !parseError.value)

watch(() => props.modelValue, (val) => {
  const incoming = JSON.stringify(val, null, 2)
  if (incoming !== rawText.value) {
    rawText.value = incoming
    parseError.value = null
  }
})

function onTextUpdate(text: string) {
  rawText.value = text
  try {
    const parsed = JSON.parse(text)
    parseError.value = null
    emit('update:modelValue', parsed)
  } catch (e) {
    parseError.value = (e as Error).message
  }
}

function formatJson() {
  try {
    const parsed = JSON.parse(rawText.value)
    rawText.value = JSON.stringify(parsed, null, 2)
    parseError.value = null
    emit('update:modelValue', parsed)
  } catch {
    // keep error state
  }
}

function minifyJson() {
  try {
    const parsed = JSON.parse(rawText.value)
    rawText.value = JSON.stringify(parsed)
    parseError.value = null
    emit('update:modelValue', parsed)
  } catch {
    // keep error state
  }
}
</script>

<template>
  <div class="flex flex-col gap-0">
    <MCodeEditor
      :model-value="rawText"
      language="json"
      :readonly="readonly"
      :min-height="minHeight"
      :max-height="maxHeight"
      @update:model-value="onTextUpdate"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <!-- Validation badge -->
          <span
            class="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-small"
            :class="isValid ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'"
          >
            <MIcon :name="isValid ? 'check_circle' : 'error'" :size="14" />
            {{ isValid ? 'Válido' : 'Inválido' }}
          </span>

          <button
            v-if="!readonly"
            type="button"
            title="Formatear"
            class="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-label-medium text-on-surface-variant transition-colors hover:bg-on-surface/8"
            @click="formatJson"
          >
            <MIcon name="format_indent_increase" :size="16" />
            Formatear
          </button>
          <button
            v-if="!readonly"
            type="button"
            title="Minificar"
            class="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-label-medium text-on-surface-variant transition-colors hover:bg-on-surface/8"
            @click="minifyJson"
          >
            <MIcon name="compress" :size="16" />
            Minificar
          </button>
        </div>
      </template>
    </MCodeEditor>

    <p v-if="parseError" class="px-3 py-1.5 text-body-small text-error">
      {{ parseError }}
    </p>
  </div>
</template>
