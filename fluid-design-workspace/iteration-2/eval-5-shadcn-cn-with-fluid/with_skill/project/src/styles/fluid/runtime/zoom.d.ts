// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.

// Types for fluid-zoom.js, so TypeScript projects with `allowJs: false`
// (Next's default template among them) can import it. Copy both files.

/** Detect the page zoom, write it to `--fluid-zoom` on <html>, and keep it
 * current on resize and display changes. Returns a cleanup function. */
export declare function installFluidZoom(): () => void

/** `installFluidZoom` as an inline <script> body, for <head>. */
export declare const FLUID_ZOOM_INLINE: string
