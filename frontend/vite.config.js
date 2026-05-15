import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: true, // importante para redes locales / mobile testing
  },

  build: {
    outDir: "dist",      // Render necesita esto
    sourcemap: false,    // más rápido en producción
  },

  preview: {
    port: 4173,
    host: true,
  },
})