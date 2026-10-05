import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where ../server runs (its PORT); override to point the app at another instance.
const api = process.env.API_URL ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The catalog (../catalog) and its types (../shared) live outside the app folder.
  server: {
    fs: { allow: ['..'] },
    // User data comes from ../server (npm run dev there).
    proxy: { '/api': api },
  },
  preview: { proxy: { '/api': api } },
})
