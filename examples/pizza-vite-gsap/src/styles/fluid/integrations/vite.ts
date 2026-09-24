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
 *
 * Under a strict CSP, fluidPlugin({ nonce }) puts that nonce on the tag (for
 * a per-request nonce, a placeholder your server replaces); or allow
 * FLUID_ZOOM_SHA256 (runtime/zoom.js) in script-src for a hash-based CSP.
 */
export function fluidPlugin({ nonce }: { nonce?: string } = {}): Plugin {
  return {
    name: 'fluid-design',
    transformIndexHtml() {
      return [{ tag: 'script', attrs: nonce ? { nonce } : {}, children: FLUID_ZOOM_INLINE, injectTo: 'head-prepend' }]
    }
  }
}
