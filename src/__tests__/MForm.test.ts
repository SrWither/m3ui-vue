import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import MForm from '../components/MForm.vue'
import MTextField from '../components/MTextField.vue'
import { email, minLength, required, sameAs, type StandardSchemaV1 } from '../composables/validation'
import { defaultLocale } from '../composables/useLocale'

/** A minimal object Standard Schema: `checks` maps a path to a test returning a message or null */
function objectSchema(checks: Record<string, (v: any) => string | null>, transform?: (v: any) => any): StandardSchemaV1 {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate(value: any) {
        const issues = Object.entries(checks).flatMap(([path, test]) => {
          const v = path.split('.').reduce((o, k) => o?.[k], value)
          const message = test(v)
          return message ? [{ message, path: path.split('.') }] : []
        })
        return issues.length ? { issues } : { value: transform ? transform(value) : value }
      },
    },
  }
}

const errorText = (w: ReturnType<typeof mount>) => w.findAll('[role="alert"]').map((p) => p.text())

describe('MTextField validation', () => {
  it('emits blur to the consumer (vee-validate/Vuelidate touch)', async () => {
    const onBlur = vi.fn()
    const w = mount(MTextField, { props: { modelValue: '', label: 'Name', onBlur } })
    await w.find('input').trigger('blur')
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('a string error is also the message', () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'Email', error: 'Taken' } })
    expect(errorText(w)).toEqual(['Taken'])
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
    expect(w.find('input').attributes('aria-describedby')).toBe(w.find('[role="alert"]').attributes('id'))
  })

  it('error + errorLabel keeps working as before', () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'X', error: true, errorLabel: 'Bad' } })
    expect(errorText(w)).toEqual(['Bad'])
    const off = mount(MTextField, { props: { modelValue: '', label: 'X', error: false, errorLabel: 'Bad', hint: 'Hint' } })
    expect(errorText(off)).toEqual([])
    expect(off.text()).toContain('Hint')
  })

  it('required alone (no MForm, no rules) does not validate', async () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'X', required: true } })
    await w.find('input').trigger('blur')
    await flushPromises()
    expect(errorText(w)).toEqual([])
  })

  it('rules show on blur, then live while typing', async () => {
    const w = mount(MTextField, { props: { modelValue: 'a', label: 'X', rules: [minLength(3)], 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    await flushPromises()
    expect(errorText(w)).toEqual([]) // not touched yet
    await w.find('input').trigger('blur')
    await flushPromises()
    expect(errorText(w)).toEqual(['Enter at least 3 characters'])
    await w.find('input').setValue('abc')
    await flushPromises()
    expect(errorText(w)).toEqual([])
  })

  it("validateOn: 'input' shows while typing, before any blur", async () => {
    const w = mount(MTextField, { props: { modelValue: '', label: 'X', validateOn: 'input', rules: [email()], 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    await w.find('input').setValue('nope')
    await flushPromises()
    expect(errorText(w)).toEqual([defaultLocale.validationEmail])
  })

  it('async rules: only the latest run wins', async () => {
    let resolveFirst!: (v: string) => void
    const rule = vi.fn((v: string) => (v === 'slow' ? new Promise<string>((r) => (resolveFirst = r)) : true))
    const w = mount(MTextField, { props: { modelValue: 'slow', label: 'X', rules: [rule] } })
    const field = w.vm as any
    const first = field.validate()
    await w.setProps({ modelValue: 'fast' })
    await flushPromises()
    resolveFirst('Stale error')
    await first
    await flushPromises()
    expect(errorText(w)).toEqual([])
  })
})

function formWith(fields: (model: any) => any, formProps: Record<string, unknown> = {}) {
  const onSubmit = vi.fn()
  const onInvalid = vi.fn()
  const model = ref<Record<string, string>>({})
  const C = defineComponent({
    setup: (_, { expose }) => {
      const form = ref()
      expose({ form, model })
      return () => h(MForm, { ref: form, onSubmit, onInvalid, ...formProps }, () => fields(model))
    },
  })
  const w = mount(C, { attachTo: document.body })
  return { w, onSubmit, onInvalid, model }
}

const field = (model: any, name: string, extra: Record<string, unknown> = {}) =>
  h(MTextField, {
    name,
    label: name,
    modelValue: model.value[name] ?? '',
    'onUpdate:modelValue': (v: string) => (model.value = { ...model.value, [name]: v }),
    ...extra,
  })

describe('MForm', () => {
  it('blocks submit, shows every error and focuses the first invalid field', async () => {
    const { w, onSubmit, onInvalid } = formWith((m) => [
      field(m, 'name', { required: true }),
      field(m, 'email', { rules: [required(), email()] }),
    ])
    await flushPromises()
    expect(errorText(w)).toEqual([]) // nothing shown before submit
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onInvalid).toHaveBeenCalledWith({ name: defaultLocale.validationRequired, email: defaultLocale.validationRequired })
    expect(errorText(w)).toHaveLength(2)
    expect(document.activeElement).toBe(w.findAll('input')[0].element)
    w.unmount()
  })

  it('submits the values by name (dotted names nest) once valid', async () => {
    const { w, onSubmit } = formWith((m) => [field(m, 'name', { required: true }), field(m, 'address.city')])
    const inputs = w.findAll('input')
    await inputs[0].setValue('Ana')
    await inputs[1].setValue('Rosario')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual({ name: 'Ana', address: { city: 'Rosario' } })
    w.unmount()
  })

  it('sameAs re-checks the confirmation when the other field changes', async () => {
    const { w } = formWith((m) => [field(m, 'password'), field(m, 'confirm', { rules: [sameAs('password')] })])
    const [pw, confirm] = w.findAll('input')
    await pw.setValue('secret')
    await confirm.setValue('secre')
    await confirm.trigger('blur')
    await flushPromises()
    expect(errorText(w)).toEqual([defaultLocale.validationSameAs])
    await pw.setValue('secre')
    await flushPromises()
    expect(errorText(w)).toEqual([])
    w.unmount()
  })

  it('external errors by name show over the rules and do not block submit', async () => {
    const { w, onSubmit } = formWith((m) => [field(m, 'email')], { errors: { email: ['Already registered'] } })
    await flushPromises()
    expect(errorText(w)).toEqual(['Already registered'])
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit).toHaveBeenCalled()
    w.unmount()
  })

  it('a form schema validates the fields and submits its output', async () => {
    const schema = objectSchema({ age: (v) => (Number(v) >= 18 ? null : 'Adults only') }, (v) => ({ ...v, age: Number(v.age) }))
    const { w, onSubmit } = formWith((m) => [field(m, 'age')], { schema })
    const input = w.find('input')
    await input.setValue('12')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(errorText(w)).toEqual(['Adults only'])
    expect(onSubmit).not.toHaveBeenCalled()
    await input.setValue('20')
    await flushPromises()
    expect(errorText(w)).toEqual([]) // live after the first submit
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit.mock.calls[0][0]).toEqual({ age: 20 })
    w.unmount()
  })

  it("validateOn: 'submit' keeps quiet on blur", async () => {
    const { w } = formWith((m) => [field(m, 'name', { required: true })], { validateOn: 'submit' })
    await w.find('input').trigger('blur')
    await flushPromises()
    expect(errorText(w)).toEqual([])
    w.unmount()
  })

  it('reset() restores the first values and hides the errors; valid tracks silently', async () => {
    const { w, model } = formWith((m) => [field(m, 'name', { required: true })])
    const form = (w.vm as any).form
    await flushPromises()
    expect(form.valid).toBe(false)
    await w.find('input').setValue('Ana')
    await flushPromises()
    expect(form.valid).toBe(true)
    await w.find('input').setValue('')
    await w.find('input').trigger('blur')
    await flushPromises()
    expect(errorText(w)).toHaveLength(1)
    await form.reset()
    await flushPromises()
    expect(model.value.name).toBe('')
    expect(errorText(w)).toEqual([])
    w.unmount()
  })

  it('disabled disables the controls and skips validation', async () => {
    const { w, onSubmit, onInvalid } = formWith((m) => [field(m, 'name', { required: true })], { disabled: true })
    expect(w.find('fieldset').attributes('disabled')).toBeDefined()
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onInvalid).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('MForm extras (1.7.0)', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  it('validateDebounce: one check after typing stops, pending meanwhile', async () => {
    const rule = vi.fn(async () => true)
    const { w } = formWith((m) => [field(m, 'user', { rules: [rule] })], { validateDebounce: 40 })
    const form = (w.vm as any).form
    await flushPromises()
    rule.mockClear()
    const input = w.find('input')
    await input.setValue('a')
    await input.setValue('ab')
    await input.setValue('abc')
    expect(form.pending).toBe(true)
    expect(rule).not.toHaveBeenCalled()
    await wait(60)
    await flushPromises()
    expect(rule).toHaveBeenCalledTimes(1)
    expect(rule.mock.calls[0][0]).toBe('abc')
    expect(form.pending).toBe(false)
    w.unmount()
  })

  it('validate() skips the wait', async () => {
    const { w } = formWith((m) => [field(m, 'user', { rules: [() => 'Bad'], validateDebounce: 10_000 })])
    await w.find('input').setValue('x')
    expect(await (w.vm as any).form.validate()).toBe(false)
    await flushPromises()
    expect(errorText(w)).toEqual(['Bad'])
    w.unmount()
  })

  it("an inline rules array doesn't re-check every field on each render of the parent", async () => {
    const rule = vi.fn(() => true)
    const { w } = formWith((m) => [field(m, 'a'), field(m, 'b', { rules: [rule] })])
    await flushPromises()
    rule.mockClear()
    await w.findAll('input')[0].setValue('typing in a') // the parent re-renders: b gets a new rules array
    await flushPromises()
    expect(rule).not.toHaveBeenCalled()
    w.unmount()
  })

  it('an outside error hides once its field changes, and a new errors object shows it again', async () => {
    const errors = ref<Record<string, string>>({ email: 'Taken' })
    const C = defineComponent({
      setup() {
        const v = ref('')
        return () => h(MForm, { errors: errors.value }, () => h(MTextField, { name: 'email', label: 'Email', modelValue: v.value, 'onUpdate:modelValue': (x: string) => (v.value = x) }))
      },
    })
    const w = mount(C)
    await flushPromises()
    expect(errorText(w)).toEqual(['Taken'])
    await w.find('input').setValue('other@m3ui.dev')
    await flushPromises()
    expect(errorText(w)).toEqual([])
    errors.value = { email: 'Taken' } // the next response
    await flushPromises()
    expect(errorText(w)).toEqual(['Taken'])
  })

  it('keepErrors keeps an outside error while its field changes', async () => {
    const { w } = formWith((m) => [field(m, 'email')], { errors: { email: 'Taken' }, keepErrors: true })
    await w.find('input').setValue('x')
    await flushPromises()
    expect(errorText(w)).toEqual(['Taken'])
    w.unmount()
  })

  it('validate(names) checks only those fields (dotted ones included), and can focus the first error', async () => {
    const { w } = formWith((m) => [
      field(m, 'name', { required: true }),
      field(m, 'address.city', { required: true }),
      field(m, 'card', { required: true }),
    ])
    const form = (w.vm as any).form
    await flushPromises()
    expect(await form.validate(['name', 'address'], { focus: true })).toBe(false)
    await flushPromises()
    expect(errorText(w)).toHaveLength(2) // name and address.city, not card
    expect(document.activeElement).toBe(w.findAll('input')[0].element)
    await w.findAll('input')[0].setValue('Ana')
    await w.findAll('input')[1].setValue('Rosario')
    expect(await form.validate(['name', 'address'])).toBe(true)
    form.resetValidation(['card'])
    expect(await form.validate()).toBe(false) // the whole form still checks card
    w.unmount()
  })
})

describe('required prop + required() in rules', () => {
  it("shows the rules' own message, not the generic one", async () => {
    const { w } = formWith((m) => [field(m, 'name', { required: true, rules: [required('Enter your name')] })])
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(errorText(w)).toEqual(['Enter your name'])
    w.unmount()
  })
})
