import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useId, watch, type InjectionKey } from 'vue'
import { useLocale } from './useLocale'
import { isEmpty, runRules, type ValidateOn, type ValidationRule } from './validation'

/** @internal What a field registers with its `MForm` */
export interface FormField {
  name: () => string | undefined
  value: () => unknown
  /** Checks the rules, shows the result, resolves to whether its own rules pass */
  validate: () => Promise<boolean>
  resetValidation: () => void
  reset: () => Promise<void>
  focus: () => void
  el: () => Element | null | undefined
  /** The message on display, if any */
  error: () => string | null
  /** Whether its rules pass right now (checked silently, whether or not it's shown yet) */
  valid: () => boolean
  pending: () => boolean
}

/** @internal Provided by `MForm` */
export interface FormContext {
  register: (field: FormField) => () => void
  /** Every named field's value, by name */
  values: () => Record<string, unknown>
  /** An error given from outside (`MForm`'s `errors` prop) */
  externalError: (name: string) => string | null
  hasSchema: () => boolean
  /** The form schema's first issue for this field */
  schemaError: (name: string) => Promise<string | null>
  validateOn: () => ValidateOn | undefined
  disabled: () => boolean
}

/** @internal */
export const FORM_KEY: InjectionKey<FormContext> = Symbol('m3-form')

/**
 * @internal "Blur" for a field made of several focusable parts (stepper buttons, chips, a popup panel): calls
 * `onLeave` once focus has left `root` for good, not while it moves between its parts or while `open` (its
 * teleported panel, which sits outside `root` in the DOM) is showing. Closing the panel with focus outside
 * counts as leaving. Bind the returned handler to the root's `@focusout`.
 */
export function useFocusLeave(root: () => Element | null | undefined, onLeave: () => void, open?: () => boolean) {
  function check() {
    if (open?.()) return
    const r = root()
    const active = document.activeElement
    if (r && active && r.contains(active)) return
    onLeave()
  }
  if (open) watch(open, (now, was) => { if (!now && was) setTimeout(check) })
  // Focus lands on its next element after focusout: look once it has
  return () => { setTimeout(check) }
}

export interface FieldValidationOptions {
  value: () => unknown
  rules: () => ValidationRule | ValidationRule[] | undefined
  required: () => boolean | undefined
  error: () => boolean | string | undefined
  errorLabel: () => string | undefined
  name: () => string | undefined
  validateOn: () => ValidateOn | undefined
  disabled: () => boolean | undefined
  focus: () => void
  el: () => Element | null | undefined
  /** Writes a value back through v-model (used by `MForm`'s `reset()`) */
  setValue?: (value: unknown) => void
  /** What "not filled in" means for `required`, when `isEmpty` isn't it (a date range needs both ends) */
  isEmpty?: (value: unknown) => boolean
  /** Called when the field is validated on demand (`validate()`, an `MForm` submit), to reveal sub-parts' own errors */
  onValidate?: () => void
}

/**
 * @internal The validation every form field shares: its own `rules` (plus `required` inside an `MForm` or
 * next to other rules), errors from outside (the `error` prop, `MForm`'s `errors`, its `schema`), when to show
 * them (`validateOn`), and registration with the surrounding `MForm`.
 *
 * Priority of what's shown: a string `error` → `error: true` with `errorLabel` → `MForm`'s `errors[name]`
 * → the field's own rules.
 */
export function useFieldValidation(opts: FieldValidationOptions) {
  const form = inject(FORM_KEY, null)
  const locale = useLocale()
  const messageId = useId()

  const disabled = computed(() => !!opts.disabled() || !!form?.disabled())

  const ruleList = computed<ValidationRule[]>(() => {
    const r = opts.rules()
    const list = r ? (Array.isArray(r) ? r : [r]) : []
    // `required` only validates where validation is in use, so a plain field keeps today's behavior
    // (just the asterisk and the native attribute)
    if (!(opts.required() && (form || list.length))) return list
    const empty = opts.isEmpty ?? isEmpty
    const required: ValidationRule = (value, { locale }) => !empty(value) || locale.validationRequired
    return [required, ...list]
  })
  const active = computed(() => ruleList.value.length > 0 || (!!form && !!opts.name() && form.hasSchema()))

  /** The rules' verdict, kept up to date silently; only displayed once `shown` */
  const result = ref<string | null>(null)
  const shown = ref(false)
  const pending = ref(false)
  /** Names of other fields the rules read through `ctx.values` (e.g. `sameAs('password')`) */
  const deps = ref<string[]>([])
  let token = 0

  async function run(): Promise<string | null> {
    const t = ++token
    if (disabled.value || !active.value) {
      result.value = null
      pending.value = false
      return null
    }
    pending.value = true
    const read = new Set<string>()
    const all = form?.values() ?? {}
    const values = new Proxy(all, {
      get(target, key) {
        if (typeof key === 'string') read.add(key)
        return Reflect.get(target, key)
      },
    })
    let message: string | null = null
    try {
      message = await runRules(ruleList.value, opts.value(), { locale, values })
      const name = opts.name()
      if (!message && form && name && form.hasSchema()) message = await form.schemaError(name)
    } catch (e) {
      console.error('[m3ui] a validation rule threw:', e)
    }
    if (t === token) {
      result.value = message
      pending.value = false
      const next = [...read]
      // Only a real change: a new array every run would re-trigger the deps watcher below, forever
      if (next.length !== deps.value.length || next.some((k, i) => k !== deps.value[i])) deps.value = next
    }
    return message
  }

  const mode = () => opts.validateOn() ?? form?.validateOn() ?? 'blur'
  let resetting = false

  watch(opts.value, () => {
    if (mode() === 'input' && !resetting) shown.value = true
    run()
  }, { deep: true })
  watch([ruleList, disabled], () => run())
  // Cross-field rules: re-check when a field they read changes, but only once this one is on display
  // (compared value by value: the getter returns a new array whenever any field of the form changes)
  watch(
    () => (form ? deps.value.map((k) => form.values()[k]) : []),
    (now, before) => {
      const changed = now.length !== before.length || now.some((v, i) => !Object.is(v, before[i]))
      if (changed && shown.value) run()
    },
  )
  onMounted(run)

  function onBlur() {
    if (mode() !== 'submit') shown.value = true
  }

  async function validate(): Promise<boolean> {
    shown.value = true
    opts.onValidate?.()
    return !(await run())
  }

  function resetValidation() {
    token++
    shown.value = false
    pending.value = false
    run()
  }

  const initial = (() => {
    const v = opts.value()
    return Array.isArray(v) ? [...v] : v
  })()

  async function reset() {
    if (opts.setValue) {
      resetting = true
      opts.setValue(Array.isArray(initial) ? [...initial] : initial)
      await nextTick()
      resetting = false
    }
    resetValidation()
  }

  const external = computed(() => {
    const name = opts.name()
    return form && name ? form.externalError(name) : null
  })
  const own = computed(() => (shown.value ? result.value : null))

  /** The message to show under the field (null = none) */
  const message = computed<string | null>(() => {
    const e = opts.error()
    if (typeof e === 'string' && e) return e
    if (e === true) return opts.errorLabel() || own.value || external.value
    return external.value || own.value
  })
  const hasError = computed(() => !!opts.error() || !!external.value || !!own.value)

  if (form) {
    let unregister: (() => void) | undefined
    onMounted(() => {
      unregister = form.register({
        name: opts.name,
        value: opts.value,
        validate,
        resetValidation,
        reset,
        focus: opts.focus,
        el: opts.el,
        error: () => (hasError.value ? message.value ?? '' : null),
        valid: () => !result.value && !pending.value,
        pending: () => pending.value,
      })
    })
    onBeforeUnmount(() => unregister?.())
  }

  return {
    /** Error state (red border/label) */
    hasError,
    /** Message under the field, or null */
    message,
    /** id for the message element, to point `aria-describedby` at */
    messageId,
    /** Whether async rules are still running */
    pending,
    /** The field's own disabled state merged with its `MForm`'s */
    disabled,
    /** Call from the field's blur */
    onBlur,
    validate,
    resetValidation,
    reset,
  }
}
