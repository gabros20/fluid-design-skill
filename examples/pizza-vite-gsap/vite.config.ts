import { defineConfig } from 'vite'

export default defineConfig({
  css: {
    preprocessorOptions: {
      // Lets `@use 'fluid/scss/fluid'` and `@use 'tokens'` resolve from src/styles.
      scss: { loadPaths: ['src/styles'] }
    }
  },
  preview: { port: 4320, strictPort: true }
})
