import { defineConfig } from 'vite'

export default defineConfig({
  root: 'public',
  publicDir: '../static',
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
