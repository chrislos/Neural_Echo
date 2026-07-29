import { defineConfig } from 'vite'

// root: 'src'          → unser Code (index.html, index.js, ...) liegt im src-Ordner
// publicDir: '../static' → alle Audio-Dateien; Vite liefert sie unter '/' aus,
//                          d.h. static/swoosh.wav ist im Browser '/swoosh.wav'
export default defineConfig({
  root: 'src',
  publicDir: '../static',
  server: {
    port: 3000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
