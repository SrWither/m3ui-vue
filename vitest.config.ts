import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    // material-color-utilities 0.4.0 ships an extensionless ESM import Node can't resolve; let Vite process it
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
})
