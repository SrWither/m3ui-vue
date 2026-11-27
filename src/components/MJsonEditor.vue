<script setup lang="ts">
/**
 * A JSON-aware editor built on top of MCodeEditor — validates as you type and adds format/minify shortcuts.
 *
 * @event update:modelValue Emitted with the parsed value whenever the text is valid JSON — powers v-model
 * @event blur Emitted when focus leaves the editor
 */
import { ref, computed, inject, provide, watch } from 'vue'
import { FORM_KEY, useFieldValidation, useFocusLeave, type FormContext } from '../composables/_useFieldValidation'
import type { ValidateOn, ValidationRule } from '../composables/validation'
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
// jsonRule is always there: `required` alone (no MForm, no rules) keeps today's behavior
const inForm = !!inject(FORM_KEY, null)

const props = withDefaults(
  defineProps<{
    /** JSON data (v-model, any valid JSON) */
    modelValue: unknown
    /** Read-only mode */
    readonly?: boolean
    /** Error state. A string is also the message */
    error?: boolean | string
    /** Error message shown when `error` is true */
    errorLabel?: string
    /** Inside an `MForm` or with `rules`, it can't be empty (null) */
    required?: boolean
    /** Validation rules (functions or a Standard Schema); see `MForm` */
    rules?: ValidationRule | ValidationRule[]
    /** When the rules are checked and shown: on leaving it (default), on change, or only on submit */
    validateOn?: ValidateOn
    /** Wait this long (ms) after the value stops changing before re-checking (one request for an async rule, not one per key). Defaults to its `MForm`'s */
    validateDebounce?: number
    /** The key of this field in its `MForm` */
    name?: string
    /** Min height */
    minHeight?: string
    /** Max height */
    maxHeight?: string
    /**
     * Overrides for the valid/invalid badge and format/minify button text (see `JsonEditorLabels`) — defaults come
     * from useLocale()
     */
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

const emit = defineEmits<{ 'update:modelValue': [unknown]; blur: [] }>()

const rawText = ref(JSON.stringify(props.modelValue, null, 2))
const parseError = ref<string | null>(null)

const isValid = computed(() => !parseError.value)

// Text that doesn't parse is one more rule: it blocks an MForm submit
const jsonRule: ValidationRule = () => !parseError.value || l.value.invalid
const rootEl = ref<HTMLElement | null>(null)
const validation = useFieldValidation({
  value: () => props.modelValue,
  rules: () => [...(props.rules ? (Array.isArray(props.rules) ? props.rules : [props.rules]) : []), jsonRule],
  required: () => props.required && (inForm || !!props.rules),
  error: () => props.error,
  errorLabel: () => props.errorLabel,
  name: () => props.name,
  validateOn: () => props.validateOn,
  validateDebounce: () => props.validateDebounce,
  disabled: () => props.readonly,
  focus: () => { rootEl.value?.querySelector<HTMLElement>('.cm-content')?.focus() },
  el: () => rootEl.value,
  setValue: (v) => emit('update:modelValue', v),
})
const { hasError, message: errorMessage, messageId } = validation
const onFocusOut = useFocusLeave(() => rootEl.value, () => {
  validation.onBlur()
  emit('blur')
})
// The inner MCodeEditor edits text, not this value: keep it out of the form
provide(FORM_KEY, null as unknown as FormContext)

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

defineExpose({
  /** Checks its rules and shows the result; resolves to whether they pass */
  validate: validation.validate,
  /** Hides its validation error (until the next check) */
  resetValidation: validation.resetValidation,
})
</script>

<template>
  <div ref="rootEl" class="flex flex-col gap-0" @focusout="onFocusOut">
    <MCodeEditor
      :model-value="rawText"
      language="json"
      :error="hasError && !parseError"
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
    <!-- The parse error above already says what's wrong with the text -->
    <p v-else-if="errorMessage" :id="messageId" role="alert" class="px-3 py-1.5 text-body-small text-error">{{ errorMessage }}</p>
  </div>
</template>
