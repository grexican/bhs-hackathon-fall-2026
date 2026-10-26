import { defineConfig } from "vite"

// Phaser alone is about 1.2 MB (zipped to ~340 KB on the wire): expected for a game, so no size warning.
export default defineConfig({
  build: { chunkSizeWarningLimit: 2000 },
})
