import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/; local serving (npm run serve,
  // Docker, the Mac binary) stays at root. The Pages workflow sets GH_PAGES.
  base: process.env.GH_PAGES ? '/kibitz/' : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:5173' } },
  test: { environment: 'jsdom', globals: true },
})
