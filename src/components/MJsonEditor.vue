<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MCodeEditor from './MCodeEditor.vue'
import MIcon from './MIcon.vue'
import { useLocale } from '../composables/useLocale'

export interface JsonEditorLabels {
  valid?: string
  invalid?: string
  format?: string
  minify?: string
}

const locale = useLocale()

const props = withDefaults(
  defineProps<{
    modelValue: unknown
    readonly?: boolean
    minHeight?: string
    maxHeight?: string
    labels?: JsonEditorLabels
  }>(),
  {
    readonly: false,
    minHeight: '200px',
    maxHeight: '600px',
  },
)

const l = computed<Required<JsonEditorLabels>>(() => ({
  valid: locale.jsonValid,
  invalid: locale.jsonInvalid,
  format: locale.jsonFormat,
  minify: locale.jsonMinify,
  ...props.labels,
}))

const emit = defineEmits<{ 'update:modelValue': [unknown] }>()

const rawText = ref(JSON.stringify(props.modelValue, null, 2))
const parseError = ref<string | null>(null)

const isValid = computed(() => !parseError.value)

watch(() => props.modelValue, (val) => {
  let current: unknown
  try {
    current = JSON.parse(rawText.value)
  } catch {
    current = undefined
  }
  // Only resync from outside when the actual data changed, not just its formatting —
  // otherwise the round-trip from formatJson/minifyJson emitting would immediately
  // overwrite the newly (re)formatted text with a pretty-printed copy.
  if (JSON.stringify(current) === JSON.stringify(val)) return
  rawText.value = JSON.stringify(val, null, 2)
  parseError.value = null
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
            {{ isValid ? l.valid : l.invalid }}
          </span>

          <button
            v-if="!readonly"
            type="button"
            :title="l.format"
            class="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-label-medium text-on-surface-variant transition-colors hover:bg-on-surface/8"
            @click="formatJson"
          >
            <MIcon name="format_indent_increase" :size="16" />
            {{ l.format }}
          </button>
          <button
            v-if="!readonly"
            type="button"
            :title="l.minify"
            class="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-label-medium text-on-surface-variant transition-colors hover:bg-on-surface/8"
            @click="minifyJson"
          >
            <MIcon name="compress" :size="16" />
            {{ l.minify }}
          </button>
        </div>
      </template>
    </MCodeEditor>

    <p v-if="parseError" class="px-3 py-1.5 text-body-small text-error">
      {{ parseError }}
    </p>
  </div>
</template>
