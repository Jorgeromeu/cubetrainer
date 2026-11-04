import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { checkout, devPorts } from '../scripts/devenv.ts'

// This checkout's ports: 3001 / 5173 in the main checkout, a free pair kept per worktree
// (scripts/devenv.ts), so two checkouts run side by side. API_URL points the app at another server.
const ports = await devPorts(checkout(fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')))
const api = process.env.API_URL ?? `http://localhost:${ports.server}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tools (../tools, catalogs included) and shared libraries (../packages) live outside
  // the app folder.
  server: {
    port: ports.app,
    fs: { allow: ['..'] },
    // User data comes from ../server (npm run dev there).
    proxy: { '/api': api },
  },
  preview: { proxy: { '/api': api } },
  build: {
    // The preload helper adds <link rel=modulepreload> tags through `document`: not in a
    // worker (see below). Chunks then just load when imported.
    modulePreload: false,
    rolldownOptions: {
      output: {
        // cubing.js's scramble worker imports cubing.js code shared with the app, and Vite's
        // preload helper. Left alone, both land in the app's entry chunk, so the worker would
        // run the whole app (and fail on `document`). So both get chunks of their own;
        // cubing.js's lazy chunks (solvers, the worker itself) stay as they are.
        codeSplitting: {
          groups: [
            { name: 'vite', test: /preload-helper/ },
            { name: 'cubing', test: (id) => id.includes('/node_modules/cubing/') && !/-dynamic-|inside-|search-worker-entry|twips|big-puzzle-orientation/.test(id) },
          ],
        },
      },
    },
  },
})
