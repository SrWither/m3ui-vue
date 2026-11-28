<script lang="ts">
import type { ValidationRule } from '../composables/validation'

/** The kinds of field a form schema can hold. `heading` and `divider` only lay the form out */
export type FormFieldType =
  | 'text' | 'email' | 'password' | 'tel' | 'url' | 'textarea' | 'number'
  | 'select' | 'autocomplete' | 'radio' | 'checkbox' | 'switch'
  | 'date' | 'time' | 'slider' | 'rating' | 'phone'
  | 'heading' | 'divider'

/** A choice of a select, autocomplete or radio group */
export interface FormFieldOption {
  label: string
  value: string | number | boolean
}

/** Shows a field only while another field's value matches */
export interface FormFieldCondition {
  /** The other field's name */
  field: string
  /** Its value is this */
  equals?: unknown
  /** Its value isn't this */
  notEquals?: unknown
  /** Its value is one of these */
  in?: unknown[]
  /** It has a value (true) or is empty (false) */
  filled?: boolean
}

/** One field of a form schema: plain JSON, so it can be stored, sent and built with MFormBuilder */
export interface FormFieldSchema {
  type: FormFieldType
  /** The value's key (required for every type but heading and divider) */
  name?: string
  label?: string
  placeholder?: string
  /** Help under the field */
  hint?: string
  /** A heading's text under its title */
  description?: string
  required?: boolean
  disabled?: boolean
  /** Its value before the user changes it */
  default?: unknown
  /** select, autocomplete, radio: the choices (a plain string is its own label and value) */
  options?: (FormFieldOption | string)[]
  /** number, slider: limits. date: earliest/latest as `YYYY-MM-DD` strings */
  min?: number | string
  max?: number | string
  step?: number
  /** text-like fields: length limits */
  minLength?: number
  maxLength?: number
  /** text-like fields: a regular expression the value must match (as a string, without slashes) */
  pattern?: string
  /** The message when `pattern` doesn't match */
  patternMessage?: string
  /** textarea: visible lines */
  rows?: number
  /** How much of the row it takes on a wide form (stacked on a narrow one). Default `full` */
  width?: 'full' | 'half' | 'third' | 'two-thirds'
  /** A Material Symbol at the start of text-like fields */
  icon?: string
  /** Show it only when this (or all of these) holds */
  visibleWhen?: FormFieldCondition | FormFieldCondition[]
  /** More rules, in code (not JSON): validators, zod/valibot schemas, functions */
  rules?: ValidationRule[]
}

/** A whole form: its fields in order, and its buttons' text */
export interface FormSchema {
  title?: string
  description?: string
  fields: FormFieldSchema[]
  /** The submit button's text */
  submitLabel?: string
  /** Show a reset button with this text */
  resetLabel?: string
}

/** Whether a field takes a value (headings and dividers don't) */
export const isValueField = (f: FormFieldSchema) => f.type !== 'heading' && f.type !== 'divider'

/** A field's options as `{ label, value }` */
export const normalizeOptions = (options: FormFieldSchema['options']): FormFieldOption[] =>
  (options ?? []).map((o) => (typeof o === 'string' ? { label: o, value: o } : o))

/** What a field holds before anything is typed */
export function emptyValue(f: FormFieldSchema): unknown {
  if (f.default !== undefined) return f.default
  if (f.type === 'checkbox' || f.type === 'switch') return false
  if (f.type === 'slider') return typeof f.min === 'number' ? f.min : 0
  if (f.type === 'rating') return 0
  if (f.type === 'number' || f.type === 'select' || f.type === 'autocomplete' || f.type === 'radio' || f.type === 'date' || f.type === 'time') return null
  return ''
}

/** Whether a field shows, given the form's values */
export function fieldVisible(f: FormFieldSchema, values: Record<string, unknown>): boolean {
  if (!f.visibleWhen) return true
  const list = Array.isArray(f.visibleWhen) ? f.visibleWhen : [f.visibleWhen]
  return list.every((c) => {
    const v = values[c.field]
    if (c.filled !== undefined) {
      const filled = !(v == null || v === '' || v === false || (Array.isArray(v) && !v.length))
      if (filled !== c.filled) return false
    }
    if ('equals' in c && c.equals !== undefined && v !== c.equals) return false
    if ('notEquals' in c && c.notEquals !== undefined && v === c.notEquals) return false
    if (c.in && !c.in.includes(v)) return false
    return true
  })
}
</script>

<script setup lang="ts">
/**
 * Renders a form from a JSON schema (`FormSchema`): text, number, select, radio, checkbox, switch, date, time,
 * slider, rating and phone fields, headings and dividers, laid out in rows (`width`), with their rules
 * (`required`, lengths, `pattern`, email/url by type) checked by MForm, and fields that show only when another
 * field has some value (`visibleWhen`). Build schemas by hand, from a backend, or with MFormBuilder. A hidden field
 * isn't validated and its value isn't submitted.
 *
 * @slot field-{name} Replaces one field. Scope: `{ field, value, update }` (call `update(value)`)
 * @slot actions Replaces the buttons. Scope: `{ reset }`
 * @event submit The form passed its checks: the values of the fields on show, by name
 * @event invalid Submit was blocked: the messages by field name
 */
import { computed, ref, watch } from 'vue'
import MForm from './MForm.vue'
import MTextField from './MTextField.vue'
import MNumberField from './MNumberField.vue'
import MSelect from './MSelect.vue'
import MAutocomplete from './MAutocomplete.vue'
import MRadioGroup from './MRadioGroup.vue'
import MCheckbox from './MCheckbox.vue'
import MSwitch from './MSwitch.vue'
import MDatePicker from './MDatePicker.vue'
import MTimePicker from './MTimePicker.vue'
import MSlider from './MSlider.vue'
import MRating from './MRating.vue'
import MPhoneInput from './MPhoneInput.vue'
import MDivider from './MDivider.vue'
import MButton from './MButton.vue'
import { email, maxLength, minLength, pattern, url } from '../composables/validation'
import type { ValidateOn } from '../composables/validation'
import { useLocale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** The form to render */
    schema: FormSchema
    /** The values by field name (v-model). Missing ones start from each field's `default` */
    modelValue?: Record<string, unknown>
    /** When fields check their rules (MForm's) */
    validateOn?: ValidateOn
    /** Wait this long (ms) after typing stops before re-checking */
    validateDebounce?: number
    /** Errors from outside (a server's), by field name */
    errors?: Record<string, string | string[] | null | undefined>
    /** Disables every field and the buttons */
    disabled?: boolean
    /** Show the submit (and reset) buttons */
    actions?: boolean
    /** The submit button shows a spinner and can't be pressed */
    loading?: boolean
  }>(),
  { modelValue: undefined, actions: true },
)

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, unknown>]
  submit: [values: Record<string, unknown>]
  invalid: [errors: Record<string, string>]
}>()

const locale = useLocale()
const form = ref<InstanceType<typeof MForm>>()

/** Its own copy, so it works without v-model too */
const local = ref<Record<string, unknown>>({})
function seed() {
  const next: Record<string, unknown> = { ...(props.modelValue ?? local.value) }
  for (const f of props.schema.fields) if (f.name && isValueField(f) && !(f.name in next)) next[f.name] = emptyValue(f)
  local.value = next
  return next
}
seed()
watch(() => props.modelValue, (v) => { if (v && v !== local.value) seed() })
watch(() => props.schema.fields.map((f) => `${f.name}:${f.type}`).join(), () => {
  const before = JSON.stringify(local.value)
  const next = seed()
  if (JSON.stringify(next) !== before) emit('update:modelValue', next)
})
// Fields the schema starts with: the parent's v-model gets their defaults
if (props.modelValue && Object.keys(local.value).some((k) => !(k in props.modelValue!))) emit('update:modelValue', local.value)

function set(name: string, value: unknown) {
  local.value = { ...local.value, [name]: value }
  emit('update:modelValue', local.value)
}

const visible = computed(() => props.schema.fields.filter((f) => fieldVisible(f, local.value)))

const span: Record<NonNullable<FormFieldSchema['width']>, string> = {
  full: 'col-span-12',
  half: 'col-span-12 @lg:col-span-6',
  third: 'col-span-12 @lg:col-span-4',
  'two-thirds': 'col-span-12 @lg:col-span-8',
}

function rulesFor(f: FormFieldSchema): ValidationRule[] {
  const out: ValidationRule[] = []
  if (f.type === 'email') out.push(email())
  if (f.type === 'url') out.push(url())
  if (f.minLength != null) out.push(minLength(f.minLength))
  if (f.maxLength != null) out.push(maxLength(f.maxLength))
  if (f.pattern) {
    try { out.push(pattern(new RegExp(f.pattern), f.patternMessage)) } catch { /* a bad expression is ignored */ }
  }
  return [...out, ...(f.rules ?? [])]
}

/** The component and props for each kind of field */
function control(f: FormFieldSchema): { is: unknown; props: Record<string, unknown> } {
  const common = {
    name: f.name,
    label: f.label,
    required: f.required,
    disabled: f.disabled,
    rules: rulesFor(f),
    hint: f.hint,
  }
  const text = { ...common, placeholder: f.placeholder, leadingIcon: f.icon }
  switch (f.type) {
    case 'textarea': return { is: MTextField, props: { ...text, multiline: true, rows: f.rows ?? 3, autoGrow: true } }
    case 'number': return { is: MNumberField, props: { ...text, min: num(f.min), max: num(f.max), step: f.step } }
    case 'select': return { is: MSelect, props: { ...text, options: normalizeOptions(f.options), clearable: !f.required } }
    case 'autocomplete': return { is: MAutocomplete, props: { ...text, options: normalizeOptions(f.options), clearable: !f.required } }
    case 'radio': return { is: MRadioGroup, props: { ...common, hint: undefined, options: normalizeOptions(f.options) } }
    case 'checkbox': return { is: MCheckbox, props: { ...common, hint: undefined } }
    case 'switch': return { is: MSwitch, props: { ...common, hint: undefined } }
    case 'date': return { is: MDatePicker, props: { ...text, leadingIcon: undefined, min: str(f.min), max: str(f.max) } }
    case 'time': return { is: MTimePicker, props: { ...text, leadingIcon: undefined } }
    case 'slider': return { is: MSlider, props: { ...common, hint: undefined, min: num(f.min) ?? 0, max: num(f.max) ?? 100, step: f.step ?? 1, showValue: true } }
    case 'rating': return { is: MRating, props: { ...common, label: undefined, hint: undefined, max: num(f.max) ?? 5 } }
    case 'phone': return { is: MPhoneInput, props: { ...text, leadingIcon: undefined } }
    default: return { is: MTextField, props: { ...text, type: f.type === 'text' ? undefined : f.type } }
  }
}
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined)
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

function onSubmit() {
  // The values of the fields on show, flat by name as the schema names them
  const out: Record<string, unknown> = {}
  for (const f of visible.value) if (f.name && isValueField(f)) out[f.name] = local.value[f.name]
  emit('submit', out)
}

defineExpose({
  /** Checks every field on show (or the named ones) and shows their messages; resolves to whether they pass */
  validate: (...args: Parameters<NonNullable<typeof form.value>['validate']>) => form.value!.validate(...args),
  /** Clears the messages */
  resetValidation: (names?: string[]) => form.value?.resetValidation(names),
  /** The values, defaults included */
  values: computed(() => local.value),
})
</script>

<template>
  <MForm
    ref="form"
    class="m3-form-renderer @container"
    :validate-on="validateOn"
    :validate-debounce="validateDebounce"
    :errors="errors"
    :disabled="disabled"
    @submit="onSubmit"
    @invalid="emit('invalid', $event)"
  >
    <div v-if="schema.title || schema.description" class="mb-4">
      <h2 v-if="schema.title" class="text-headline-small text-on-surface">{{ schema.title }}</h2>
      <p v-if="schema.description" class="mt-1 text-body-medium text-on-surface-variant">{{ schema.description }}</p>
    </div>
    <div class="grid grid-cols-12 gap-x-4 gap-y-5">
      <template v-for="(f, i) in visible" :key="f.name ?? `${f.type}-${i}`">
        <div v-if="f.type === 'heading'" class="col-span-12 pt-2">
          <h3 class="text-title-medium text-on-surface">{{ f.label }}</h3>
          <p v-if="f.description" class="mt-0.5 text-body-medium text-on-surface-variant">{{ f.description }}</p>
        </div>
        <MDivider v-else-if="f.type === 'divider'" class="col-span-12" />
        <div v-else :class="span[f.width ?? 'full']" :data-field="f.name">
          <slot
            :name="`field-${f.name}`"
            :field="f"
            :value="local[f.name!]"
            :update="(v: unknown) => set(f.name!, v)"
          >
            <div v-if="f.type === 'rating'" class="flex flex-col gap-1">
              <span class="text-body-medium text-on-surface-variant">{{ f.label }}<span v-if="f.required" aria-hidden="true"> *</span></span>
              <component :is="control(f).is" v-bind="control(f).props" :model-value="local[f.name!]" :aria-label="f.label" @update:model-value="set(f.name!, $event)" />
            </div>
            <component
              :is="control(f).is"
              v-else
              v-bind="control(f).props"
              :model-value="local[f.name!]"
              class="w-full"
              @update:model-value="set(f.name!, $event)"
            />
          </slot>
        </div>
      </template>
    </div>
    <div v-if="actions" class="mt-6 flex justify-end gap-2">
      <slot name="actions" :reset="() => form?.reset()">
        <MButton v-if="schema.resetLabel" type="reset" variant="text" :disabled="disabled">{{ schema.resetLabel }}</MButton>
        <MButton type="submit" :loading="loading" :disabled="disabled">{{ schema.submitLabel ?? locale.formSubmit }}</MButton>
      </slot>
    </div>
  </MForm>
</template>
