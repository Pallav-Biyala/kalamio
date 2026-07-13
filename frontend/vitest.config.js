import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Dedicated test config (kept separate from vite.config.js so the app's build
// chunking doesn't affect tests). Vitest bundles its own Vite, so this coexists
// with the project's Vite 4 without conflict.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    css: false,
    clearMocks: true,
    // Give api.js a real base URL so it doesn't hit the missing-env guard and
    // so MSW handlers can target a concrete origin.
    env: {
      VITE_SERVER_DOMAIN: 'http://localhost:8080/',
    },
  },
})
