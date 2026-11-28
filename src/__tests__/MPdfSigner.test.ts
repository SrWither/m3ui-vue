import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { PDFDocument, PDFName, PDFDict, degrees } from 'pdf-lib'
import { shownToUser, signPdf, fieldMissing, type PdfSignField } from '../composables/pdfSign'

vi.mock('pdfjs-dist', () => import('./pdfMock'))
const { fakeDoc } = await import('./pdfMock')
const { default: MPdfSigner } = await import('../components/MPdfSigner.vue')

// A 2×1 PNG (red, transparent)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGP4z8AARAwMAAz8Af9c/RSVAAAAAElFTkSuQmCC'

describe('shownToUser', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 }
  const r = { x: 100, y: 50, width: 200, height: 40 }
  it('no rotation: y flips (bottom-left origin)', () => {
    expect(shownToUser(r, box, 0)).toEqual({ x: 100, y: 800 - 90, rotate: 0 })
  })
  it('a crop box offsets it', () => {
    expect(shownToUser(r, { ...box, x: 10, y: 20 }, 0)).toEqual({ x: 110, y: 730, rotate: 0 })
  })
  it('a page shown turned 90°, 180°, 270°: anchored at the shown bottom-left corner, drawn turned with it', () => {
    expect(shownToUser(r, box, 90)).toEqual({ x: 90, y: 100, rotate: 90 })
    expect(shownToUser(r, box, 180)).toEqual({ x: 500, y: 90, rotate: 180 })
    expect(shownToUser(r, box, 270)).toEqual({ x: 510, y: 700, rotate: 270 })
  })
})

describe('signPdf', () => {
  it('draws the filled fields into a copy of the PDF, on their page; empty ones are skipped', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([600, 800])
    doc.addPage([600, 800])
    const bytes = await doc.save()
    const fields: PdfSignField[] = [
      { id: 's', type: 'signature', page: 2, x: 0.1, y: 0.8, width: 0.3, height: 0.06, value: PNG },
      { id: 'e', type: 'signature', page: 1, x: 0.1, y: 0.8, width: 0.3, height: 0.06 },
    ]
    const out = await signPdf(bytes, fields)
    const signed = await PDFDocument.load(out)
    const xobjects = (n: number) => {
      const res = signed.getPages()[n]!.node.Resources()
      const xo = res?.lookupMaybe(PDFName.of('XObject'), PDFDict)
      return xo ? xo.keys().length : 0
    }
    expect(xobjects(0)).toBe(0)
    expect(xobjects(1)).toBe(1)
    expect(signed.getPageCount()).toBe(2)
  })

  it('works on a page with its own rotation', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([600, 800]).setRotation(degrees(90))
    const out = await signPdf(await doc.save(), [{ id: 's', type: 'initials', page: 1, x: 0.5, y: 0.5, width: 0.1, height: 0.05, value: PNG }])
    expect((await PDFDocument.load(out)).getPage(0).getRotation().angle).toBe(90)
  })

  it('fieldMissing: signatures are required unless said otherwise', () => {
    expect(fieldMissing({ id: 'a', type: 'signature', page: 1, x: 0, y: 0, width: 0.1, height: 0.1 })).toBe(true)
    expect(fieldMissing({ id: 'a', type: 'text', page: 1, x: 0, y: 0, width: 0.1, height: 0.1 })).toBe(false)
    expect(fieldMissing({ id: 'a', type: 'text', page: 1, x: 0, y: 0, width: 0.1, height: 0.1, required: true, value: 'x' })).toBe(false)
  })
})

describe('MPdfSigner', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480)
    fakeDoc.password = ''
    fakeDoc.outline = []
    fakeDoc.pages = Array.from({ length: 2 }, () => ({ width: 612, height: 792, text: [] }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })
  const settle = async () => { for (let i = 0; i < 8; i++) await flushPromises() }

  function setup(initial: PdfSignField[], props: Record<string, unknown> = {}) {
    const fields = ref(initial)
    const events: string[] = []
    const w = mount(() => h(MPdfSigner, {
      src: '/contract.pdf',
      fields: fields.value,
      'onUpdate:fields': (f: PdfSignField[]) => (fields.value = f),
      onComplete: () => events.push('complete'),
      onFinish: () => events.push('finish'),
      ...props,
    }), { attachTo: document.body })
    return { w, fields, events }
  }

  const contract: PdfSignField[] = [
    { id: 'date', type: 'date', page: 1, x: 0.6, y: 0.85, width: 0.2, height: 0.03, required: true },
    { id: 'ok', type: 'checkbox', page: 1, x: 0.1, y: 0.7, width: 0.03, height: 0.02 },
    { id: 'sig', type: 'signature', page: 2, x: 0.1, y: 0.8, width: 0.3, height: 0.06 },
    { id: 'theirs', type: 'signature', page: 2, x: 0.5, y: 0.8, width: 0.3, height: 0.06, signer: 'landlord' },
  ]

  it('places the fields on their pages, as fractions of the page', async () => {
    const { w } = setup(contract)
    await settle()
    const date = w.find('[data-field="date"]')
    expect(date.exists()).toBe(true)
    expect((date.element as HTMLElement).style.left).toBe('60%')
    expect(w.findAll('.m3-pdf-page')[1]!.element.parentElement!.querySelector('[data-field="sig"]')).not.toBeNull()
  })

  it('signing: a date fills with today, a checkbox ticks, progress counts the required ones; other signers\' fields are off', async () => {
    const { w, fields, events } = setup(contract, { signer: 'tenant' })
    await settle()
    expect(w.text()).toContain('0 of 2 fields')
    await w.find('[data-field="date"]').trigger('click')
    expect(fields.value.find((f) => f.id === 'date')!.value).toBeTruthy()
    await w.find('[data-field="ok"]').trigger('click')
    expect(fields.value.find((f) => f.id === 'ok')!.value).toBe('true')
    await nextTick()
    expect(w.text()).toContain('1 of 2 fields')
    expect(w.find('[data-field="theirs"]').classes()).toContain('opacity-40')
    await w.find('[data-field="theirs"]').trigger('click')
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    // The signature: typed, adopted
    await w.find('[data-field="sig"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(events).not.toContain('complete')
    const finish = w.findAll('button').find((b) => b.text().includes('Finish'))!
    expect(finish.attributes('disabled')).toBeDefined()
  })

  it('a signature adopted once fills the next signature field with one click', async () => {
    const twice: PdfSignField[] = [
      { id: 'a', type: 'signature', page: 1, x: 0.1, y: 0.1, width: 0.3, height: 0.06 },
      { id: 'b', type: 'signature', page: 2, x: 0.1, y: 0.1, width: 0.3, height: 0.06 },
    ]
    // happy-dom has no canvas: the typed signature is stubbed
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 100 }) : () => {}),
      set: (t, k, v) => { t[k] = v; return true },
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG)
    const { w, fields, events } = setup(twice, { signerName: 'Ana Pérez' })
    await settle()
    await w.find('[data-field="a"]').trigger('click')
    await nextTick()
    const dialog = document.querySelector('[role="dialog"]')!
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes('Type'))!.click()
    await nextTick()
    expect((dialog.querySelector('input') as HTMLInputElement).value).toBe('Ana Pérez')
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sign')!.click()
    await settle()
    expect(fields.value[0]!.value).toBe(PNG)
    await w.find('[data-field="b"]').trigger('click')
    expect(fields.value[1]!.value).toBe(PNG)
    await nextTick()
    expect(events).toContain('complete')
  })

  it('prepare mode: adds a field on the current page, moves it with the keyboard, deletes it', async () => {
    const { w, fields } = setup([], { mode: 'prepare' })
    await settle()
    await w.find('[data-add="signature"]').trigger('click')
    expect(fields.value).toHaveLength(1)
    const f = fields.value[0]!
    expect(f).toMatchObject({ type: 'signature', page: 1, required: true })
    await nextTick()
    await w.find(`[data-field="${f.id}"]`).trigger('keydown', { key: 'ArrowRight' })
    expect(fields.value[0]!.x).toBeCloseTo(f.x + 0.005, 6)
    await w.find(`[data-field="${f.id}"]`).trigger('keydown', { key: 'Delete' })
    expect(fields.value).toHaveLength(0)
  })
})
