// Writing filled signature fields into a PDF (MPdfSigner). Uses pdf-lib, an optional peer dependency loaded only
// when a document is saved

/** A field placed on a page to sign or fill */
export interface PdfSignField {
  id: string
  type: 'signature' | 'initials' | 'name' | 'date' | 'text' | 'checkbox'
  /** 1-based page */
  page: number
  /** Where it is, as fractions (0–1) of the page as shown (its own rotation included): left, top, width, height */
  x: number
  y: number
  width: number
  height: number
  /** What it asks for (shown in the empty field, and to screen readers) */
  label?: string
  /** Must be filled before the document is complete. Default true for signature fields */
  required?: boolean
  /** Who fills it, for documents several people sign; `signer` on MPdfSigner picks whose fields are active */
  signer?: string
  /** What it holds: a PNG data URL for a signature or initials, text otherwise, `'true'` for a ticked checkbox */
  value?: string
}

/** Whether a field needs filling and is empty */
export const fieldMissing = (f: PdfSignField) => (f.required ?? (f.type === 'signature' || f.type === 'initials')) && !f.value

type Rect = { x: number; y: number; width: number; height: number }

/**
 * A rectangle on the page as shown (top-left origin, y down, in points) to PDF user space (bottom-left origin):
 * where to anchor something drawn upright on screen, and the rotation to draw it with, for a page with its own
 * `/Rotate` and a crop box. `box` is the crop box, `rotate` the page's rotation in degrees
 */
export function shownToUser(r: Rect, box: Rect, rotate: number): { x: number; y: number; rotate: number } {
  const rot = ((rotate % 360) + 360) % 360
  // The shown rectangle's bottom-left corner, mapped back into the unrotated page
  const sx = r.x
  const sy = r.y + r.height
  let ux: number
  let uy: number
  if (rot === 90) { ux = sy; uy = sx }
  else if (rot === 180) { ux = box.width - sx; uy = sy }
  else if (rot === 270) { ux = box.width - sy; uy = box.height - sx }
  else { ux = sx; uy = box.height - sy }
  return { x: box.x + ux, y: box.y + uy, rotate: rot }
}

/** Draws a field's value into a PNG (text in the page's font stack; any script works, unlike PDF standard fonts) */
async function fieldImage(f: PdfSignField, wPt: number, hPt: number, font: string): Promise<Uint8Array | null> {
  if (!f.value) return null
  if ((f.type === 'signature' || f.type === 'initials') && f.value.startsWith('data:image/png')) return dataUrlBytes(f.value)
  const ratio = 4 // px per point: sharp when printed
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(wPt * ratio))
  canvas.height = Math.max(1, Math.round(hPt * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#111'
  ctx.textBaseline = 'middle'
  if (f.type === 'checkbox') {
    if (f.value !== 'true') return null
    const s = Math.min(canvas.width, canvas.height)
    ctx.lineWidth = s * 0.12
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
    ctx.beginPath()
    ctx.moveTo(s * 0.2, s * 0.55)
    ctx.lineTo(s * 0.42, s * 0.76)
    ctx.lineTo(s * 0.82, s * 0.26)
    ctx.stroke()
  } else {
    let size = canvas.height * 0.62
    ctx.font = `${size}px ${font}`
    while (size > 6 && ctx.measureText(f.value).width > canvas.width * 0.96) {
      size *= 0.92
      ctx.font = `${size}px ${font}`
    }
    ctx.fillText(f.value, canvas.width * 0.02, canvas.height / 2)
  }
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

function dataUrlBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export interface SignPdfOptions {
  /** The font for text fields (a CSS font list). Default the page's sans-serif */
  font?: string
  /** Written into the document's metadata */
  producer?: string
}

/**
 * Writes the filled fields into a copy of the PDF and returns its bytes: signatures and initials as the images
 * drawn, text, dates and ticks drawn the same way. A visual signature (what an e-signature flow shows and prints),
 * not a cryptographic one: for a certificate-based digital signature (PAdES), sign the result on your server.
 * Needs the `pdf-lib` package
 */
export async function signPdf(pdf: ArrayBuffer | Uint8Array, fields: PdfSignField[], options: SignPdfOptions = {}): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib')
  const doc = await PDFDocument.load(pdf)
  const pages = doc.getPages()
  const font = options.font ?? 'system-ui, sans-serif'
  for (const f of fields) {
    const page = pages[f.page - 1]
    if (!page || !f.value) continue
    const box = page.getCropBox()
    const rot = page.getRotation().angle
    const swap = ((rot % 180) + 180) % 180 !== 0
    const shownW = swap ? box.height : box.width
    const shownH = swap ? box.width : box.height
    const rect = { x: f.x * shownW, y: f.y * shownH, width: f.width * shownW, height: f.height * shownH }
    const png = await fieldImage(f, rect.width, rect.height, font)
    if (!png) continue
    const image = await doc.embedPng(png)
    // Signatures keep their shape, centered in the field
    let { width, height } = rect
    let dx = 0
    let dy = 0
    if (f.type === 'signature' || f.type === 'initials') {
      const s = Math.min(rect.width / image.width, rect.height / image.height)
      width = image.width * s
      height = image.height * s
      dx = (rect.width - width) / 2
      dy = (rect.height - height) / 2
    }
    const at = shownToUser({ x: rect.x + dx, y: rect.y + dy, width, height }, { x: box.x, y: box.y, width: box.width, height: box.height }, rot)
    page.drawImage(image, { x: at.x, y: at.y, width, height, rotate: degrees(at.rotate) })
  }
  if (options.producer) doc.setProducer(options.producer)
  doc.setModificationDate(new Date())
  return doc.save()
}
