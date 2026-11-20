import { defineConfig } from 'vite'

const buildId = Date.now().toString(36)

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    // Chunk three.js (~190 kB gzip) dimuat lazy, hanya saat Maket / Tur 360° dibuka.
    chunkSizeWarningLimit: 900,
  },
})
