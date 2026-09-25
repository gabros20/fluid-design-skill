// Types for fluid-zoom.js, so TypeScript projects with `allowJs: false`
// (Next's default template among them) can import it. Copy both files.

/** Stand-ins for the globals, for tests; pages pass nothing. */
export interface FluidZoomEnv {
  window?: Window
  document?: Document
  navigator?: Navigator
}

/** Detect the page zoom, write it to `--fluid-zoom` on :root (an adopted
 * stylesheet, or <html>'s style attribute where those are missing), and keep
 * it current on resize and display changes. Returns a cleanup function. */
export declare function installFluidZoom(env?: FluidZoomEnv): () => void

/** `installFluidZoom` as an inline <script> body, for <head>. A string
 * literal fixed at generate time, so its hash is stable. */
export declare const FLUID_ZOOM_INLINE: string

/** The CSP hash of FLUID_ZOOM_INLINE, `'sha256-<base64>'` without the
 * quotes: add `'${FLUID_ZOOM_SHA256}'` to script-src for a hash-based CSP. */
export declare const FLUID_ZOOM_SHA256: string
