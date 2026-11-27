<script setup lang="ts">
/**
 * A `<form>` that validates the fields inside it. Each field registers itself (by its `name`) and checks its
 * own `rules`; the form adds a whole-form `schema` (zod, valibot… any Standard Schema), errors from outside
 * (`errors`: a server's 422, vee-validate's `errors`), and on submit validates everything, emitting `submit`
 * only when it all passes, or `invalid` and focusing the first field in error.
 *
 * @slot default The fields and buttons (a `<MButton type="submit">` submits it, as does Enter in a text field)
 * @event submit Emitted when every field is valid, with the values by name (dotted names nest:
 *   `address.city` → `{ address: { city } }`), or the schema's output when there's a `schema`
 * @event invalid Emitted when a submit fails validation, with the error messages by name
 * @event reset Emitted after `reset()` (or a `type="reset"` button) put every field back to its first value
 */
import { computed, provide, shallowReactive } from 'vue'
import { FORM_KEY, type FormField } from '../composables/_useFieldValidation'
import { issueKey, type StandardSchemaIssue, type StandardSchemaResult, type StandardSchemaV1, type ValidateOn } from '../composables/validation'

const props = defineProps<{
  /** Errors from outside, by field name (a string or the first of an array): a server's response, vee-validate's `errors`. Shown over the fields' own rules */
  errors?: Record<string, string | string[] | null | undefined>
  /** A schema for the whole form (zod, valibot, arktype… any Standard Schema), run against the values by name */
  schema?: StandardSchemaV1
  /** When the fields check and show their rules, unless a field sets its own: on leaving it (default), while typing, or only on submit */
  validateOn?: ValidateOn
  /** Disables every control inside (through a native `<fieldset disabled>`) and skips their validation */
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [values: any, event: SubmitEvent]
  invalid: [errors: Record<string, string>]
  reset: []
}>()

const fields = shallowReactive(new Set<FormField>())

/** Flat values by name, as the fields' rules see them (`ctx.values`) */
const values = computed(() => {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const name = f.name()
    if (name) out[name] = f.value()
  }
  return out
})

function nest(flat: Record<string, unknown>) {
  const out: Record<string, any> = {}
  for (const [name, value] of Object.entries(flat)) {
    const keys = name.split('.')
    let node = out
    const last = keys.pop()!
    keys.forEach((k) => (node = node[k] ??= {}))
    node[last] = value
  }
  return out
}

// One schema run per set of values, however many fields ask for their part of it
let schemaCache: { values: object; result: Promise<StandardSchemaResult<unknown>> } | null = null
function runSchema() {
  if (schemaCache?.values !== values.value) {
    schemaCache = { values: values.value, result: Promise.resolve(props.schema!['~standard'].validate(nest(values.value))) }
  }
  return schemaCache.result
}

const issuePath = (issue: StandardSchemaIssue) => (issue.path ?? []).map((s) => String(issueKey(s))).join('.')
const belongsTo = (path: string, name: string) => path === name || path.startsWith(name + '.')

provide(FORM_KEY, {
  register(field) {
    fields.add(field)
    return () => fields.delete(field)
  },
  values: () => values.value,
  externalError(name) {
    const e = props.errors?.[name]
    return (Array.isArray(e) ? e[0] : e) || null
  },
  hasSchema: () => !!props.schema,
  async schemaError(name) {
    if (!props.schema) return null
    const result = await runSchema()
    return result.issues?.find((i) => belongsTo(issuePath(i), name))?.message ?? null
  },
  validateOn: () => props.validateOn,
  disabled: () => !!props.disabled,
})

/** Schema issues no field owns, by path ('' for the form itself) */
async function orphanIssues(): Promise<Record<string, string>> {
  if (!props.schema) return {}
  const result = await runSchema()
  const names = [...fields].map((f) => f.name()).filter((n): n is string => !!n)
  const out: Record<string, string> = {}
  for (const issue of result.issues ?? []) {
    const path = issuePath(issue)
    if (!names.some((n) => belongsTo(path, n)) && !(path in out)) out[path] = issue.message
  }
  return out
}

const errors = computed(() => {
  const out: Record<string, string> = {}
  for (const f of fields) {
    const name = f.name()
    const error = f.error()
    if (name && error !== null) out[name] = error
  }
  return out
})

/** Fields in page order */
function ordered() {
  return [...fields].sort((a, b) => {
    const ea = a.el(), eb = b.el()
    if (!ea || !eb) return 0
    return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
}

/** Validates every field (showing their errors); resolves to whether all pass */
async function validate(): Promise<boolean> {
  const results = await Promise.all([...fields].map((f) => f.validate()))
  const orphans = await orphanIssues()
  return results.every(Boolean) && Object.keys(orphans).length === 0
}

async function onSubmit(event: SubmitEvent) {
  event.preventDefault()
  if (props.disabled) return
  if (await validate()) {
    const nested = nest(values.value)
    let output: unknown = nested
    if (props.schema) {
      const result = await runSchema()
      if (!result.issues) output = result.value
    }
    emit('submit', output, event)
  } else {
    emit('invalid', { ...errors.value, ...(await orphanIssues()) })
    ordered().find((f) => f.error() !== null)?.focus()
  }
}

/** Puts every field back to the value it had when it mounted and clears their errors */
async function reset() {
  await Promise.all([...fields].map((f) => f.reset()))
  emit('reset')
}

function onReset(event: Event) {
  event.preventDefault()
  reset()
}

/** Hides every error without touching the values */
function resetValidation() {
  fields.forEach((f) => f.resetValidation())
}

defineExpose({
  validate,
  reset,
  resetValidation,
  /** Whether every field's rules pass right now (checked silently, shown or not) */
  valid: computed(() => [...fields].every((f) => f.valid())),
  /** Whether async rules are still running */
  pending: computed(() => [...fields].some((f) => f.pending())),
  /** The messages on display, by field name */
  errors,
  /** The values by name (dotted names nested) */
  values: computed(() => nest(values.value)),
})
</script>

<template>
  <form novalidate @submit="onSubmit" @reset="onReset">
    <!-- display: contents keeps the fieldset out of the layout; it's only here for its native `disabled` -->
    <fieldset :disabled="disabled" class="contents">
      <slot />
    </fieldset>
  </form>
</template>
