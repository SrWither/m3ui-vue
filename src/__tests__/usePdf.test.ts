import { describe, it, expect, beforeEach, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'

vi.mock('pdfjs-dist', () => import('./pdfMock'))
const { fakeDoc } = await import('./pdfMock')
const { usePdf } = await import('../composables/usePdf')

beforeEach(() => {
  fakeDoc.pages = [
    { width: 612, height: 792, text: [{ str: 'Pocket gardens grow ' }, { str: 'basil and', hasEOL: true }, { str: 'tomatoes.' }] },
    { width: 612, height: 792, text: [{ str: 'Café crème and BASIL pesto' }] },
    { width: 842, height: 595, text: [{ str: 'A wide page' }] },
  ]
  fakeDoc.password = ''
  fakeDoc.outline = [
    { title: 'One', dest: [{ num: 0 }, { name: 'XYZ' }, 0, 700, null], url: null, items: [{ title: 'One.a', dest: 'ch2', url: null, items: [] }] },
    { title: 'Site', dest: null, url: 'https://m3ui.dev', items: [] },
  ]
})

function setup(src: Parameters<typeof usePdf>[0], options?: Parameters<typeof usePdf>[1]) {
  const scope = effectScope()
  const pdf = scope.run(() => usePdf(src, options))!
  return { pdf, stop: () => scope.stop() }
}

async function settle() {
  for (let i = 0; i < 6; i++) await flushPromises()
}

describe('usePdf', () => {
  it('loads pages, their own sizes, the outline (resolved to pages) and metadata', async () => {
    const { pdf } = setup('/doc.pdf')
    expect(pdf.loading.value).toBe(true)
    await settle()
    expect(pdf.loading.value).toBe(false)
    expect(pdf.numPages.value).toBe(3)
    expect(pdf.pageSizes.value.map((s) => s.width)).toEqual([612, 612, 842])
    expect(pdf.metadata.value.title).toBe('Fake document')
    expect(pdf.outline.value[0]).toMatchObject({ title: 'One', page: 1, top: 700 })
    expect(pdf.outline.value[0]!.children[0]).toMatchObject({ title: 'One.a', page: 2, top: 700 })
    expect(pdf.outline.value[1]).toMatchObject({ title: 'Site', url: 'https://m3ui.dev', page: undefined })
  })

  it('searches every page, case and accent insensitive, across line breaks, with context', async () => {
    const { pdf } = setup('/doc.pdf')
    await settle()
    const basil = await pdf.search('basil')
    expect(basil.map((m) => m.page)).toEqual([1, 2])
    expect(basil[0]!.context).toContain('grow basil and tomatoes')
    // The line break between items reads as a space
    expect((await pdf.search('and tomatoes')).length).toBe(1)
    expect((await pdf.search('cafe creme')).length).toBe(1)
    expect((await pdf.search('BASIL', { caseSensitive: true })).map((m) => m.page)).toEqual([2])
    // Offsets point into the page's text
    const t = await pdf.pageText(2)
    const m = (await pdf.search('pesto'))[0]!
    expect(t.text.slice(m.start, m.end)).toBe('pesto')
  })

  it('asks for a password, and again when it is wrong', async () => {
    fakeDoc.password = 'm3ui'
    const { pdf } = setup('/locked.pdf')
    await settle()
    expect(pdf.needsPassword.value).toBe(true)
    expect(pdf.wrongPassword.value).toBe(false)
    pdf.submitPassword('nope')
    await settle()
    expect(pdf.needsPassword.value).toBe(true)
    expect(pdf.wrongPassword.value).toBe(true)
    pdf.submitPassword('m3ui')
    await settle()
    expect(pdf.needsPassword.value).toBe(false)
    expect(pdf.numPages.value).toBe(3)
  })

  it('a new source replaces the document; null clears it', async () => {
    const src = ref<string | null>('/a.pdf')
    const { pdf } = setup(src)
    await settle()
    expect(pdf.numPages.value).toBe(3)
    fakeDoc.pages = fakeDoc.pages.slice(0, 1)
    src.value = '/b.pdf'
    await nextTick()
    expect(pdf.doc.value).toBe(null)
    await settle()
    expect(pdf.numPages.value).toBe(1)
    src.value = null
    await settle()
    expect(pdf.numPages.value).toBe(0)
    expect(pdf.loading.value).toBe(false)
  })

  it('resolves named and explicit destinations', async () => {
    const { pdf } = setup('/doc.pdf')
    await settle()
    expect(await pdf.resolveDest('ch2')).toEqual({ page: 2, top: 700 })
    expect(await pdf.resolveDest([{ num: 2 }, { name: 'Fit' }])).toEqual({ page: 3, top: undefined })
    expect(await pdf.resolveDest('missing')).toBe(null)
  })
})
