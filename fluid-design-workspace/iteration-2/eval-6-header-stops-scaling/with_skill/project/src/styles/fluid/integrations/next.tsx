// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.
// integrations/next.tsx

import { FLUID_ZOOM_INLINE } from '../runtime/zoom.js'

/**
 * Browser-zoom compensation for fluid type (WCAG 1.4.4). Render it first in
 * <head> in app/layout.tsx, so a page opened at a remembered zoom level
 * paints its type at the right size from the first frame:
 *
 *   <html><head><FluidHead /></head>…
 */
export function FluidHead() {
  return <script dangerouslySetInnerHTML={{ __html: FLUID_ZOOM_INLINE }} />
}
