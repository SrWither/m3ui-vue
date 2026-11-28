import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import MFormRenderer, { fieldVisible, emptyValue } from '../components/MFormRenderer.vue'
import MFormBuilder from '../components/MFormBuilder.vue'
import type { FormSchema } from '../components/MFormRenderer.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

const schema: FormSchema = {
  title: 'Book a table',
  submitLabel: 'Book',
  fields: [
    { type: 'text', name: 'name', label: 'Name', required: true, width: 'half' },
    { type: 'email', name: 'email', label: 'Email', width: 'half' },
    { type: 'number', name: 'guests', label: 'Guests', min: 1, max: 12, default: 2 },
    { type: 'heading', label: 'Extras' },
    { type: 'checkbox', name: 'birthday', label: 'It’s a birthday' },
    { type: 'text', name: 'cake', label: 'Message on the cake', visibleWhen: { field: 'birthday', equals: true }, maxLength: 5 },
    { type: 'select', name: 'zone', label: 'Zone', options: ['Inside', { label: 'Terrace', value: 'out' }] },
    { type: 'divider' },
  ],
}

function setup(s: FormSchema = schema) {
  const values = ref<Record<string, unknown>>({})
  const submitted: Record<string, unknown>[] = []
  const invalid: unknown[] = []
  const wrapper = mount(() => h(MFormRenderer, {
    schema: s,
    modelValue: values.value,
    'onUpdate:modelValue': (v: Record<string, unknown>) => (values.value = v),
    onSubmit: (v: Record<string, unknown>) => submitted.push(v),
    onInvalid: (e: unknown) => invalid.push(e),
  }), { attachTo: document.body })
  return { wrapper, values, submitted, invalid }
}

describe('MFormRenderer', () => {
  it('renders each field with its label, defaults its values, lays out widths', async () => {
    const { wrapper, values } = setup()
    await nextTick()
    expect(wrapper.text()).toContain('Book a table')
    expect(wrapper.text()).toContain('Extras')
    expect(values.value).toMatchObject({ name: '', email: '', guests: 2, birthday: false, zone: null })
    expect(wrapper.find('[data-field="name"]').classes()).toContain('@lg:col-span-6')
    expect(wrapper.find('button[type="submit"]').text()).toContain('Book')
  })

  it('blocks submit on its rules (required, email, maxLength) and submits the values of the fields on show', async () => {
    const { wrapper, values, submitted, invalid } = setup()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitted).toHaveLength(0)
    expect(Object.keys(invalid[0] as object)).toContain('name')

    await wrapper.find('[data-field="name"] input').setValue('Ana')
    await wrapper.find('[data-field="email"] input').setValue('not-an-email')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitted).toHaveLength(0)
    expect(Object.keys(invalid.at(-1) as object)).toEqual(['email'])

    await wrapper.find('[data-field="email"] input').setValue('ana@example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitted[0]).toEqual({ name: 'Ana', email: 'ana@example.com', guests: 2, birthday: false, zone: null })
    expect(values.value.name).toBe('Ana')
  })

  it('a field shows only while its condition holds, and is checked only then', async () => {
    const { wrapper, submitted } = setup()
    expect(wrapper.find('[data-field="cake"]').exists()).toBe(false)
    await wrapper.find('[data-field="name"] input').setValue('Ana')
    await wrapper.find('[data-field="birthday"] input').setValue(true)
    await nextTick()
    expect(wrapper.find('[data-field="cake"]').exists()).toBe(true)
    await wrapper.find('[data-field="cake"] input').setValue('Happy birthday!')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitted).toHaveLength(0) // maxLength 5
    await wrapper.find('[data-field="cake"] input').setValue('Yay')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitted[0]).toMatchObject({ birthday: true, cake: 'Yay' })
  })

  it('field-{name} slots replace a field', () => {
    const wrapper = mount(MFormRenderer, {
      props: { schema: { fields: [{ type: 'text', name: 'code', label: 'Code' }] } },
      slots: { 'field-code': (p: { field: { label: string } }) => h('b', { class: 'mine' }, p.field.label) },
    })
    expect(wrapper.find('.mine').text()).toBe('Code')
  })

  it('helpers: conditions and empty values', () => {
    expect(fieldVisible({ type: 'text', visibleWhen: { field: 'a', in: [1, 2] } }, { a: 2 })).toBe(true)
    expect(fieldVisible({ type: 'text', visibleWhen: [{ field: 'a', filled: true }, { field: 'b', notEquals: 'x' }] }, { a: 'y', b: 'x' })).toBe(false)
    expect(emptyValue({ type: 'slider', min: 10 })).toBe(10)
    expect(emptyValue({ type: 'switch' })).toBe(false)
  })
})

describe('MFormBuilder', () => {
  function setupBuilder(initial: FormSchema = { fields: [] }) {
    const value = ref<FormSchema>(initial)
    const wrapper = mount(() => h(MFormBuilder, {
      modelValue: value.value,
      'onUpdate:modelValue': (v: FormSchema) => (value.value = v),
    }), { attachTo: document.body })
    return { wrapper, value }
  }

  it('adds fields from the palette with a name from the label, unique', async () => {
    const { wrapper, value } = setupBuilder()
    await wrapper.find('[data-type="email"]').trigger('click')
    await wrapper.find('[data-type="email"]').trigger('click')
    await wrapper.find('[data-type="select"]').trigger('click')
    expect(value.value.fields.map((f) => f.name)).toEqual(['email', 'email2', 'dropdown'])
    expect(value.value.fields[2]!.options).toHaveLength(3)
  })

  it('the inspector edits the selected field: label (the name follows), required, options', async () => {
    const { wrapper, value } = setupBuilder()
    await wrapper.find('[data-type="text"]').trigger('click')
    const inspector = () => wrapper.findAll('section').at(2)!
    await inspector().findAll('input').at(0)!.setValue('Full name')
    expect(value.value.fields[0]).toMatchObject({ label: 'Full name', name: 'fullName' })
    // the required switch
    await inspector().find('input[type="checkbox"]').setValue(true)
    expect(value.value.fields[0]!.required).toBe(true)

    await wrapper.find('[data-type="radio"]').trigger('click')
    const options = inspector().find('textarea')
    await options.setValue('Small\nLarge=L')
    expect(value.value.fields[1]!.options).toEqual(['Small', { label: 'Large', value: 'L' }])
  })

  it('duplicates and deletes fields', async () => {
    const { wrapper, value } = setupBuilder({ fields: [{ type: 'text', name: 'a', label: 'A' }] })
    await wrapper.find('[data-field-id] button[aria-label="Duplicate"]').trigger('click')
    expect(value.value.fields.map((f) => f.name)).toEqual(['a', 'a2'])
    await wrapper.findAll('[data-field-id] button[aria-label="Delete"]')[0]!.trigger('click')
    expect(value.value.fields.map((f) => f.name)).toEqual(['a2'])
  })

  it('preview renders the schema; JSON shows it', async () => {
    const { wrapper } = setupBuilder({ fields: [{ type: 'text', name: 'city', label: 'City' }] })
    const tabs = wrapper.findAll('[role="radio"], button').filter((b) => /Preview|JSON/.test(b.text()))
    await tabs.find((b) => b.text().includes('Preview'))!.trigger('click')
    expect(wrapper.find('form [data-field="city"]').exists()).toBe(true)
    await tabs.find((b) => b.text().includes('JSON'))!.trigger('click')
    expect(wrapper.find('pre').text()).toContain('"name": "city"')
  })
})
