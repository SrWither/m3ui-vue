import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        m3ui: resolve(__dirname, 'src/index.ts'),
        chart: resolve(__dirname, 'src/chart.ts'),
        'code-editor': resolve(__dirname, 'src/code-editor.ts'),
        markdown: resolve(__dirname, 'src/markdown.ts'),
        'rich-text-editor': resolve(__dirname, 'src/rich-text-editor.ts'),
        terminal: resolve(__dirname, 'src/terminal.ts'),
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
      ],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
})
