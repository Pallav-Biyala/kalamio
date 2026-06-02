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
            const path = id.replace(/\\/g, '/');
            if (path.includes('/node_modules/react/') || path.includes('/node_modules/react-dom/') || path.includes('/node_modules/react-router')) {
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
