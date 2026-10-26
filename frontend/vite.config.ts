import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin API calls in development, so the httpOnly auth cookie just works.
    // API_TARGET points at a backend on another port, e.g. API_TARGET=http://127.0.0.1:8010
    proxy: {
      '/api': { target: process.env.API_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: true, ws: true },
    },
  },
})
