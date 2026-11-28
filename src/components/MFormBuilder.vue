<script setup lang="ts">
/**
 * Design a form without code: add fields from a palette, drag them into order, set each one's label, name, rules,
 * width, choices and when it shows, then try it in the preview. `v-model` is a `FormSchema` (plain JSON), the same
 * one `MFormRenderer` draws: store it, send it to a backend, render it anywhere. Not an M3 spec component.
 *
 * @event update:modelValue The schema changed
 */
import { computed, ref, toRaw, watch } from 'vue'
import MDragDropList from './MDragDropList.vue'
import MFormRenderer from './MFormRenderer.vue'
import { isValueField, normalizeOptions, type FormFieldSchema, type FormFieldType, type FormSchema } from './MFormRenderer.vue'
import MIcon from './MIcon.vue'
import MIconButton from './MIconButton.vue'
import MSegmentedButton from './MSegmentedButton.vue'
import MTextField from './MTextField.vue'
import MNumberField from './MNumberField.vue'
import MSelect from './MSelect.vue'
import MSwitch from './MSwitch.vue'
import MButton from './MButton.vue'
import { useLocale, type M3Locale } from '../composables/useLocale'

const props = withDefaults(
  defineProps<{
    /** The form being built (v-model) */
    modelValue?: FormSchema
    /** The field types in the palette, in order. All by default */
    types?: FormFieldType[]
  }>(),
  { modelValue: () => ({ fields: [] }) },
)

const emit = defineEmits<{ 'update:modelValue': [schema: FormSchema] }>()

const locale = useLocale()

const TYPES: { type: FormFieldType; icon: string; key: keyof M3Locale }[] = [
  { type: 'text', icon: 'short_text', key: 'formFieldText' },
  { type: 'textarea', icon: 'notes', key: 'formFieldTextarea' },
  { type: 'email', icon: 'alternate_email', key: 'formFieldEmail' },
  { type: 'number', icon: 'pin', key: 'formFieldNumber' },
  { type: 'phone', icon: 'call', key: 'formFieldPhone' },
  { type: 'tel', icon: 'dialpad', key: 'formFieldTel' },
  { type: 'url', icon: 'link', key: 'formFieldUrl' },
  { type: 'password', icon: 'password', key: 'formFieldPassword' },
  { type: 'select', icon: 'arrow_drop_down_circle', key: 'formFieldSelect' },
  { type: 'autocomplete', icon: 'manage_search', key: 'formFieldAutocomplete' },
  { type: 'radio', icon: 'radio_button_checked', key: 'formFieldRadio' },
  { type: 'checkbox', icon: 'check_box', key: 'formFieldCheckbox' },
  { type: 'switch', icon: 'toggle_on', key: 'formFieldSwitch' },
  { type: 'date', icon: 'calendar_today', key: 'formFieldDate' },
  { type: 'time', icon: 'schedule', key: 'formFieldTime' },
  { type: 'slider', icon: 'linear_scale', key: 'formFieldSlider' },
  { type: 'rating', icon: 'star', key: 'formFieldRating' },
  { type: 'heading', icon: 'title', key: 'formFieldHeading' },
  { type: 'divider', icon: 'horizontal_rule', key: 'formFieldDivider' },
]
const palette = computed(() => (props.types ? props.types.map((t) => TYPES.find((x) => x.type === t)!).filter(Boolean) : TYPES))
const typeInfo = (t: FormFieldType) => TYPES.find((x) => x.type === t) ?? TYPES[0]!
const typeName = (t: FormFieldType) => locale[typeInfo(t).key] as string

// Each field gets an id of its own for the list (a name can change, headings have none)
let seq = 0
interface Item { id: number; field: FormFieldSchema }
const items = ref<Item[]>([])
let lastEmitted: FormSchema | null = null
watch(() => props.modelValue, (schema) => {
  // Our own emit coming back (perhaps wrapped in the parent's reactive proxy): keep the ids and the selection
  if (toRaw(schema) === lastEmitted) return
  items.value = schema.fields.map((field) => ({ id: ++seq, field }))
}, { immediate: true })

function emitSchema(patch: Partial<FormSchema> = {}) {
  const next: FormSchema = { ...props.modelValue, ...patch, fields: items.value.map((i) => i.field) }
  lastEmitted = next
  emit('update:modelValue', next)
}

const selectedId = ref<number | null>(null)
const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null)

const usedNames = () => new Set(items.value.map((i) => i.field.name).filter(Boolean))
function uniqueName(base: string) {
  const used = usedNames()
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n++
  return `${base}${n}`
}
/** "Email address" → "emailAddress" */
const slug = (label: string) => {
  const words = label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  return words.map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('') || 'field'
}

function add(type: FormFieldType) {
  const label = typeName(type)
  const field: FormFieldSchema = { type }
  if (type === 'divider') { /* nothing more */ }
  else if (type === 'heading') field.label = label
  else {
    field.label = label
    field.name = uniqueName(slug(label))
    if (type === 'select' || type === 'radio' || type === 'autocomplete') field.options = ['Option 1', 'Option 2', 'Option 3']
    if (type === 'slider') Object.assign(field, { min: 0, max: 100, step: 1 })
    if (type === 'rating') field.max = 5
  }
  const item = { id: ++seq, field }
  const at = selected.value ? items.value.indexOf(selected.value) + 1 : items.value.length
  items.value = [...items.value.slice(0, at), item, ...items.value.slice(at)]
  selectedId.value = item.id
  emitSchema()
}

function update(patch: Partial<FormFieldSchema>) {
  const item = selected.value
  if (!item) return
  const field = { ...item.field, ...patch }
  // An empty value removes the key, so the JSON stays small
  for (const k of Object.keys(patch) as (keyof FormFieldSchema)[]) {
    const v = field[k]
    if (v === '' || v === undefined || v === null || v === false || (Array.isArray(v) && !v.length)) delete field[k]
  }
  // The name follows the label until it's edited by hand
  if ('label' in patch && item.field.name && item.field.name === uniqueNameFor(item, slug(item.field.label ?? ''))) {
    field.name = uniqueNameFor(item, slug(patch.label ?? ''))
  }
  items.value = items.value.map((i) => (i === item ? { ...i, field } : i))
  emitSchema()
}
function uniqueNameFor(item: Item, base: string) {
  const used = new Set(items.value.filter((i) => i !== item).map((i) => i.field.name).filter(Boolean))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n++
  return `${base}${n}`
}

function remove(item: Item) {
  const i = items.value.indexOf(item)
  items.value = items.value.filter((x) => x !== item)
  if (selectedId.value === item.id) selectedId.value = items.value[Math.min(i, items.value.length - 1)]?.id ?? null
  emitSchema()
}
function duplicate(item: Item) {
  const field: FormFieldSchema = JSON.parse(JSON.stringify(item.field))
  if (field.name) field.name = uniqueName(field.name)
  const copy = { id: ++seq, field }
  const at = items.value.indexOf(item) + 1
  items.value = [...items.value.slice(0, at), copy, ...items.value.slice(at)]
  selectedId.value = copy.id
  emitSchema()
}
function reorder(list: Item[]) {
  items.value = list
  emitSchema()
}

// ── inspector helpers ──
const has = (f: FormFieldSchema, ...types: FormFieldType[]) => types.includes(f.type)
const TEXTLIKE: FormFieldType[] = ['text', 'textarea', 'email', 'password', 'tel', 'url']
const optionsText = computed(() =>
  normalizeOptions(selected.value?.field.options).map((o) => (o.label === String(o.value) ? o.label : `${o.label}=${o.value}`)).join('\n'),
)
function setOptions(text: string) {
  const options = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const eq = l.lastIndexOf('=')
    if (eq <= 0) return l
    const value = l.slice(eq + 1).trim()
    return { label: l.slice(0, eq).trim(), value: /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value }
  })
  update({ options })
}
const widthOptions = computed(() => [
  { value: 'full', label: locale.formBuilderWidthFull },
  { value: 'two-thirds', label: locale.formBuilderWidthTwoThirds },
  { value: 'half', label: locale.formBuilderWidthHalf },
  { value: 'third', label: locale.formBuilderWidthThird },
])
const numOrUndef = (v: unknown) => (v === null || v === '' || v === undefined ? undefined : Number(v))

// visibleWhen: one condition, "field is value"
const conditionFields = computed(() =>
  items.value.filter((i) => i !== selected.value && i.field.name && isValueField(i.field))
    .map((i) => ({ value: i.field.name!, label: i.field.label || i.field.name! })),
)
const condition = computed(() => {
  const c = selected.value?.field.visibleWhen
  return Array.isArray(c) ? c[0] : c
})
const conditionSource = computed(() => items.value.find((i) => i.field.name === condition.value?.field)?.field)
const conditionChoices = computed(() => {
  const f = conditionSource.value
  if (!f) return null
  if (f.type === 'checkbox' || f.type === 'switch') return [{ value: true, label: 'true' }, { value: false, label: 'false' }]
  if (f.options) return normalizeOptions(f.options)
  return null
})
function setConditionField(name: unknown) {
  if (!name) return update({ visibleWhen: undefined })
  update({ visibleWhen: { field: String(name), equals: condition.value?.field === name ? condition.value.equals : undefined } })
}
function setConditionValue(v: unknown) {
  if (!condition.value) return
  const src = conditionSource.value
  const value = typeof v === 'string' && src?.type === 'number' && v !== '' ? Number(v) : v
  update({ visibleWhen: { field: condition.value.field, equals: value === '' ? undefined : value } })
}

// ── views ──
const view = ref<'edit' | 'preview' | 'json'>('edit')
const views = computed(() => [
  { value: 'edit', label: locale.formBuilderEdit, icon: 'edit' },
  { value: 'preview', label: locale.formBuilderPreview, icon: 'visibility' },
  { value: 'json', label: locale.formBuilderJson, icon: 'data_object' },
])
const json = computed(() => JSON.stringify(props.modelValue, null, 2))
const copied = ref(false)
async function copyJson() {
  try {
    await navigator.clipboard.writeText(json.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* no clipboard access */ }
}
const previewValues = ref<Record<string, unknown>>({})
const submitted = ref<Record<string, unknown> | null>(null)
watch(view, () => { submitted.value = null })

const summary = (f: FormFieldSchema) => {
  const bits: string[] = []
  if (f.name) bits.push(f.name)
  if (f.width && f.width !== 'full') bits.push(widthOptions.value.find((w) => w.value === f.width)?.label ?? f.width)
  if (f.visibleWhen) bits.push('⤷ ' + (Array.isArray(f.visibleWhen) ? f.visibleWhen[0]?.field : f.visibleWhen.field))
  return bits.join(' · ')
}

defineExpose({
  /** Adds a field of this type (after the selected one) */
  add,
  /** Selects a field by its index in the schema */
  select: (index: number) => { selectedId.value = items.value[index]?.id ?? null },
})
</script>

<template>
  <div class="m3-form-builder @container rounded-xl border border-outline-variant bg-surface text-on-surface">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant px-3 py-2">
      <MSegmentedButton v-model="view" :options="views" density="compact" />
      <MButton v-if="view === 'json'" variant="tonal" :icon="copied ? 'check' : 'content_copy'" @click="copyJson">
        {{ copied ? locale.formBuilderCopied : locale.formBuilderCopy }}
      </MButton>
    </div>

    <!-- Edit: palette, fields, inspector -->
    <div v-if="view === 'edit'" class="grid min-h-0 flex-1 grid-cols-1 @3xl:grid-cols-[13rem_1fr_19rem]">
      <section class="border-b border-outline-variant p-3 @3xl:border-r @3xl:border-b-0" :aria-label="locale.formBuilderAddField">
        <h3 class="mb-2 px-1 text-title-small text-on-surface-variant">{{ locale.formBuilderAddField }}</h3>
        <div class="flex flex-wrap gap-1 @3xl:flex-col @3xl:flex-nowrap">
          <button
            v-for="t in palette"
            :key="t.type"
            type="button"
            class="flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-label-large text-on-surface-variant transition-colors hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-primary @3xl:rounded-lg"
            :data-type="t.type"
            @click="add(t.type)"
          >
            <MIcon :name="t.icon" :size="20" />
            {{ locale[t.key] }}
          </button>
        </div>
      </section>

      <section class="min-w-0 overflow-auto bg-surface-container-low p-3">
        <p v-if="!items.length" class="px-4 py-12 text-center text-body-medium text-on-surface-variant">{{ locale.formBuilderEmpty }}</p>
        <MDragDropList v-else :model-value="items" bare class="flex flex-col gap-2" @update:model-value="reorder($event as Item[])">
          <template #default="{ item, dragging }">
            <div
              class="m3-form-builder-field flex items-center gap-2 rounded-lg border bg-surface px-2 py-2 transition-colors"
              :class="[
                (item as Item).id === selectedId ? 'border-primary shadow-[inset_0_0_0_1px_var(--color-primary)]' : 'border-outline-variant',
                dragging ? 'shadow-elevation-3' : '',
              ]"
              :data-field-id="(item as Item).id"
              role="button"
              tabindex="0"
              :aria-pressed="(item as Item).id === selectedId"
              @click="selectedId = (item as Item).id"
              @keydown.enter.self="selectedId = (item as Item).id"
            >
              <MIcon name="drag_indicator" :size="20" class="cursor-grab text-on-surface-variant" />
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                <MIcon :name="typeInfo((item as Item).field.type).icon" :size="20" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-body-large">
                  {{ (item as Item).field.type === 'divider' ? typeName('divider') : (item as Item).field.label || typeName((item as Item).field.type) }}
                  <span v-if="(item as Item).field.required" class="text-error">*</span>
                </div>
                <div class="truncate text-body-small text-on-surface-variant">
                  {{ typeName((item as Item).field.type) }}<template v-if="summary((item as Item).field)"> · {{ summary((item as Item).field) }}</template>
                </div>
              </div>
              <MIconButton icon="content_copy" :label="locale.formBuilderDuplicate" size="sm" @click.stop="duplicate(item as Item)" />
              <MIconButton icon="delete" :label="locale.formBuilderDelete" size="sm" @click.stop="remove(item as Item)" />
            </div>
          </template>
        </MDragDropList>
      </section>

      <section class="flex flex-col gap-4 border-t border-outline-variant p-4 @3xl:border-t-0 @3xl:border-l">
        <template v-if="selected">
          <h3 class="flex items-center gap-2 text-title-small text-on-surface-variant">
            <MIcon :name="typeInfo(selected.field.type).icon" :size="20" /> {{ typeName(selected.field.type) }}
          </h3>
          <template v-if="selected.field.type !== 'divider'">
            <MTextField :model-value="selected.field.label ?? ''" :label="selected.field.type === 'heading' ? locale.formBuilderTitle : locale.formBuilderLabel" @update:model-value="update({ label: $event as string })" />
          </template>
          <MTextField v-if="selected.field.type === 'heading'" :model-value="selected.field.description ?? ''" :label="locale.formBuilderDescription" multiline auto-grow @update:model-value="update({ description: $event as string })" />
          <template v-if="isValueField(selected.field)">
            <MTextField :model-value="selected.field.name ?? ''" :label="locale.formBuilderName" @update:model-value="update({ name: ($event as string).replace(/\s+/g, '') })" />
            <MSwitch :model-value="!!selected.field.required" :label="locale.formBuilderRequired" @update:model-value="update({ required: $event as boolean })" />
            <MTextField
              v-if="has(selected.field, ...TEXTLIKE, 'number', 'select', 'autocomplete', 'date', 'time', 'phone')"
              :model-value="selected.field.placeholder ?? ''"
              :label="locale.formBuilderPlaceholder"
              @update:model-value="update({ placeholder: $event as string })"
            />
            <MTextField
              v-if="!has(selected.field, 'checkbox', 'switch', 'radio', 'slider', 'rating')"
              :model-value="selected.field.hint ?? ''"
              :label="locale.formBuilderHint"
              @update:model-value="update({ hint: $event as string })"
            />
            <MTextField
              v-if="has(selected.field, 'select', 'autocomplete', 'radio')"
              :model-value="optionsText"
              :label="locale.formBuilderOptions"
              multiline
              auto-grow
              :rows="4"
              @update:model-value="setOptions($event as string)"
            />
            <div v-if="has(selected.field, 'number', 'slider', 'rating')" class="grid grid-cols-3 gap-2">
              <MNumberField v-if="selected.field.type !== 'rating'" :model-value="numOrUndef(selected.field.min) ?? null" :label="locale.formBuilderMin" @update:model-value="update({ min: numOrUndef($event) })" />
              <MNumberField :model-value="numOrUndef(selected.field.max) ?? null" :label="locale.formBuilderMax" @update:model-value="update({ max: numOrUndef($event) })" />
              <MNumberField v-if="selected.field.type !== 'rating'" :model-value="selected.field.step ?? null" :label="locale.formBuilderStep" @update:model-value="update({ step: numOrUndef($event) })" />
            </div>
            <template v-if="has(selected.field, ...TEXTLIKE)">
              <div class="grid grid-cols-2 gap-2">
                <MNumberField :model-value="selected.field.minLength ?? null" :label="locale.formBuilderMinLength" :min="0" @update:model-value="update({ minLength: numOrUndef($event) })" />
                <MNumberField :model-value="selected.field.maxLength ?? null" :label="locale.formBuilderMaxLength" :min="0" @update:model-value="update({ maxLength: numOrUndef($event) })" />
              </div>
              <MTextField :model-value="selected.field.pattern ?? ''" :label="locale.formBuilderPattern" @update:model-value="update({ pattern: $event as string })" />
              <MTextField v-if="selected.field.pattern" :model-value="selected.field.patternMessage ?? ''" :label="locale.formBuilderPatternMessage" @update:model-value="update({ patternMessage: $event as string })" />
            </template>
            <MNumberField v-if="selected.field.type === 'textarea'" :model-value="selected.field.rows ?? null" :label="locale.formBuilderRows" :min="1" @update:model-value="update({ rows: numOrUndef($event) })" />
            <div>
              <div class="mb-1 text-body-small text-on-surface-variant">{{ locale.formBuilderWidth }}</div>
              <MSegmentedButton :model-value="selected.field.width ?? 'full'" :options="widthOptions" density="compact" @update:model-value="update({ width: $event === 'full' ? undefined : ($event as FormFieldSchema['width']) })" />
            </div>
          </template>
          <template v-if="selected.field.type !== 'divider' && conditionFields.length">
            <MSelect
              :model-value="condition?.field ?? null"
              :options="[{ value: null, label: locale.formBuilderAlways }, ...conditionFields]"
              :label="locale.formBuilderShowWhen"
              @update:model-value="setConditionField"
            />
            <template v-if="condition">
              <MSelect
                v-if="conditionChoices"
                :model-value="condition.equals ?? null"
                :options="conditionChoices"
                :label="locale.formBuilderEquals"
                @update:model-value="setConditionValue"
              />
              <MTextField v-else :model-value="condition.equals == null ? '' : String(condition.equals)" :label="locale.formBuilderEquals" @update:model-value="setConditionValue" />
            </template>
          </template>
        </template>

        <template v-else>
          <h3 class="text-title-small text-on-surface-variant">{{ locale.formBuilderForm }}</h3>
          <MTextField :model-value="modelValue.title ?? ''" :label="locale.formBuilderTitle" @update:model-value="emitSchema({ title: ($event as string) || undefined })" />
          <MTextField :model-value="modelValue.description ?? ''" :label="locale.formBuilderDescription" multiline auto-grow @update:model-value="emitSchema({ description: ($event as string) || undefined })" />
          <MTextField :model-value="modelValue.submitLabel ?? ''" :label="locale.formBuilderSubmitLabel" :placeholder="locale.formSubmit" @update:model-value="emitSchema({ submitLabel: ($event as string) || undefined })" />
          <p class="text-body-small text-on-surface-variant">{{ locale.formBuilderSelectField }}</p>
        </template>
      </section>
    </div>

    <!-- Preview: the real form -->
    <div v-else-if="view === 'preview'" class="min-h-0 flex-1 overflow-auto p-4 @3xl:p-6">
      <div class="mx-auto max-w-2xl">
        <MFormRenderer v-model="previewValues" :schema="modelValue" @submit="submitted = $event" />
        <div v-if="submitted" class="mt-6 rounded-lg bg-surface-container p-4">
          <div class="mb-2 text-title-small">{{ locale.formBuilderSubmitted }}</div>
          <pre class="overflow-auto font-mono text-body-small">{{ JSON.stringify(submitted, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- JSON: what v-model holds -->
    <pre v-else class="min-h-0 flex-1 overflow-auto bg-surface-container-lowest p-4 font-mono text-body-small" tabindex="0">{{ json }}</pre>
  </div>
</template>

<style>
@layer base {
  .m3-form-builder {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}
</style>
