import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        m3ui: resolve(import.meta.dirname, 'src/index.ts'),
        chart: resolve(import.meta.dirname, 'src/chart.ts'),
        'code-editor': resolve(import.meta.dirname, 'src/code-editor.ts'),
        markdown: resolve(import.meta.dirname, 'src/markdown.ts'),
        'rich-text-editor': resolve(import.meta.dirname, 'src/rich-text-editor.ts'),
        terminal: resolve(import.meta.dirname, 'src/terminal.ts'),
        qrcode: resolve(import.meta.dirname, 'src/qrcode.ts'),
        barcode: resolve(import.meta.dirname, 'src/barcode.ts'),
        'locales/index': resolve(import.meta.dirname, 'src/locales/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        /^@tiptap\//,
        /^@codemirror\//,
        'codemirror',
        /^@xterm\//,
        'markdown-it',
        'chart.js',
        'vue-chartjs',
        'qrcode-generator',
        'jsbarcode',
      ],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
})
