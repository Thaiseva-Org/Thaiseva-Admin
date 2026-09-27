import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@icons': fileURLToPath(new URL('./src/icons/index.jsx', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
