// MPdfSigner lives in its own entry point: it needs pdf-lib (an optional peer) on top of pdfjs-dist, and a bundler
// resolves even a dynamic import, so keeping it in /pdf broke every app using MPdfViewer without pdf-lib installed
export { default as MPdfSigner } from './components/MPdfSigner.vue'
export { signPdf, shownToUser, fieldMissing } from './composables/pdfSign'
export type { PdfSignField, SignPdfOptions } from './composables/pdfSign'
