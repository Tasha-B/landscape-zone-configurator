import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The API runs on its own port (npm run dev:backend). The page calls /api on
// its own origin and Vite forwards it, so the browser needs no CORS.
const proxy = { '/api': 'http://localhost:3000' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
