import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Chunk three.js (~190 kB gzip) dimuat lazy, hanya saat Maket / Tur 360° dibuka.
    chunkSizeWarningLimit: 900,
  },
})
