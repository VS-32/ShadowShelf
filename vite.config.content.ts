import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { content: resolve(__dirname, 'src/content/content-script.ts') },
      output: {
        format: 'iife',
        entryFileNames: 'content/content-script.js',
      },
    },
  },
})
