// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.
// integrations/vite.ts

import type { Plugin } from 'vite'
import { FLUID_ZOOM_INLINE } from '../runtime/zoom.js'

/**
 * vite.config.ts:  plugins: [fluidPlugin()]
 *
 * Inlines the browser-zoom runtime as the first classic <script> in <head>
 * (a module script is deferred, so a page opened zoomed would paint small
 * type first and then jump).
 */
export function fluidPlugin(): Plugin {
  return {
    name: 'fluid-design',
    transformIndexHtml() {
      return [{ tag: 'script', children: FLUID_ZOOM_INLINE, injectTo: 'head-prepend' }]
    }
  }
}
