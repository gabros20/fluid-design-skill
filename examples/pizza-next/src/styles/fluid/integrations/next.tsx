// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.
// integrations/next.tsx

import { FLUID_ZOOM_INLINE } from '../runtime/zoom.js'

/**
 * Browser-zoom compensation for fluid type (WCAG 1.4.4). Render it first in
 * <head> in app/layout.tsx, so a page opened at a remembered zoom level
 * paints its type at the right size from the first frame:
 *
 *   <html><head><FluidHead /></head>…
 *
 * It writes an adopted stylesheet, not an attribute on <html>, so it needs
 * no suppressHydrationWarning. Under a strict CSP, pass the request's nonce,
 * set by your middleware:
 *
 *   const nonce = (await headers()).get('x-nonce') ?? undefined
 *   <FluidHead nonce={nonce} />
 *
 * or, for a hash-based CSP, allow FLUID_ZOOM_SHA256 (runtime/zoom.js) in
 * script-src.
 */
export function FluidHead({ nonce }: { nonce?: string } = {}) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: FLUID_ZOOM_INLINE }} />
}
