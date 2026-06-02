import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@tiptap/')) {
              return 'vendor-editor';
            }
            if (id.includes('lowlight') || id.includes('highlight.js')) {
              return 'vendor-highlight';
            }
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
          }
        },
      },
    },
  },
})
