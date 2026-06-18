import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'm3ui',
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
