import { defineConfig } from 'vite'

// fluidPlugin() inlines fluid-design's browser-zoom runtime as the first
// classic <script> in <head>, so a page opened zoomed paints its type right.
import { fluidPlugin } from './src/styles/fluid/integrations/vite'

export default defineConfig({
  plugins: [fluidPlugin()],
  css: {
    preprocessorOptions: {
      // Lets `@use 'fluid'` (styles/fluid/_index.scss) and `@use 'tokens'` resolve from src/styles.
      scss: { loadPaths: ['src/styles'] }
    }
  },
  preview: { port: 4320, strictPort: true }
})
