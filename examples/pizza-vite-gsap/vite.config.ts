import { defineConfig, type Plugin } from 'vite'

import { FLUID_ZOOM_INLINE } from './src/lib/fluid-zoom.js'

// Browser-zoom compensation for the fluid type units (fluid-scale.md §12,
// Browser zoom). It has to run in <head> before first paint, or a page opened
// at a remembered zoom level renders small type and then jumps, and a
// <script type="module"> is deferred. So the runtime is inlined as a classic
// script at the top of <head>, from the same source file.
function fluidZoom(): Plugin {
  return {
    name: 'fluid-zoom-inline',
    transformIndexHtml() {
      return [{ tag: 'script', children: FLUID_ZOOM_INLINE, injectTo: 'head-prepend' }]
    }
  }
}

export default defineConfig({
  plugins: [fluidZoom()],
  css: {
    preprocessorOptions: {
      // Lets `@use 'fluid/scss/fluid'` and `@use 'tokens'` resolve from src/styles.
      scss: { loadPaths: ['src/styles'] }
    }
  },
  preview: { port: 4320, strictPort: true }
})
