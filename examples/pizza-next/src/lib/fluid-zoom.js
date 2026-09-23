// fluid-zoom.js — give fluid type back its response to browser zoom.
//
// Why: desktop browser zoom (Cmd/Ctrl +) shrinks the CSS viewport by the
// zoom factor. `--fluid` is built only from vw and svh, so it shrinks by the
// same factor and type renders at the SAME physical size at every zoom level
// until the CSS viewport drops below `engageAt` and the mobile CSS takes over.
// On a 2560-wide display that is 250% zoom, a WCAG 1.4.4 failure
// (references/fluid-scale.md §12). This script measures the zoom factor and
// writes it to `--fluid-zoom` on <html>. With `zoomCompensation` on in
// fluid.config.json, the generated type units read their base as
// `--fluid × --fluid-zoom`, which is the unzoomed value, so text zooms 1:1.
// Layout is not compensated: it keeps fitting the zoomed viewport, and the
// larger text reflows inside it.
//
// How it detects zoom: no browser exposes the page zoom directly. Two
// signals carry it in Chromium and Firefox:
//   r   = outerWidth / innerWidth     (window px ÷ CSS px)
//   dpr = devicePixelRatio            (native display ratio × zoom)
// Each alone is ambiguous: a side panel or docked devtools inflates r, and
// dpr 2 is either a Retina screen or 200% on a 1x screen. The zoom is
// accepted only when the two AGREE within 4% for a plausible native ratio.
// Anything else — a side panel, an iframe (outerWidth is the top window's),
// a browser that keeps dpr fixed under zoom — falls back to 1, which is
// exactly today's behaviour. It can fail to compensate; it cannot inflate
// type on an unzoomed page unless a side panel happens to match a native
// ratio within 4% (see NATIVE below for how that is narrowed).
//
// Verified with real Chromium zoom (Preferences default_zoom_level, headless
// and headed) at 110–300% on 1x and 2x: see scripts/verify-matrix.mjs --zoom.
// Safari and Firefox are expected to work if they expose zoom in dpr; if not,
// they fall back to 1. Check on the real browser before promising compliance.
//
// Install it BEFORE first paint, or a zoomed page loads with small type and
// then jumps:
//   Next (app/layout.tsx):
//     import { FLUID_ZOOM_INLINE } from '@/styles/fluid-zoom.js'
//     <head><script dangerouslySetInnerHTML={{ __html: FLUID_ZOOM_INLINE }} /></head>
//   Anything else: paste FLUID_ZOOM_INLINE into a <script> in <head>, or
//     import { installFluidZoom } from './fluid-zoom.js'; installFluidZoom()
//     as early as your entry allows.
//
// installFluidZoom must stay self-contained (no imports, no outer
// variables): FLUID_ZOOM_INLINE is its own source text.

/** Detect the page zoom, write it to `--fluid-zoom` on <html>, and keep it
 * current on resize and display changes. Returns a cleanup function. */
export function installFluidZoom() {
  var root = document.documentElement
  // macOS only ever reports whole native ratios; narrowing the candidates
  // there is what stops a Retina screen plus a side panel reading as zoom.
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  var NATIVE = MAC ? [1, 2, 3] : [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4]
  var TOLERANCE = 0.04

  function detect() {
    var ow = window.outerWidth
    var iw = window.innerWidth
    var dpr = window.devicePixelRatio || 1
    if (!ow || !iw || window.top !== window.self) return null
    var r = ow / iw
    var best = 1
    var bestErr = Infinity
    for (var i = 0; i < NATIVE.length; i++) {
      var z = dpr / NATIVE[i]
      var err = Math.abs(z - r) / r
      if (err < bestErr) {
        bestErr = err
        best = z
      }
    }
    if (bestErr > TOLERANCE) return 1
    // Zoom-in only. Zooming out needs no help (text shrinks with the layout
    // anyway), and a value below 1 is also what device emulation
    // (DevTools responsive mode, Playwright viewports) produces by accident.
    return Math.min(4, Math.max(1, best))
  }

  var last = ''
  var tries = 0
  function apply() {
    var z = detect()
    if (z === null) {
      // outerWidth reads 0 until the window is shown: measured in Chromium
      // at head/DOMContentLoaded/load, non-zero one frame later, with no
      // resize event in between. Retry on the next frames, then give up.
      if (window.top === window.self && tries++ < 30) requestAnimationFrame(apply)
      z = 1
    }
    var value = String(Math.round(z * 1000) / 1000)
    if (value === last) return
    last = value
    root.style.setProperty('--fluid-zoom', value)
  }

  var mq = null
  function watchDpr() {
    // A dpr-only change (the window moved to another display, or a zoom
    // step that left innerWidth unchanged) fires no resize event.
    if (mq) mq.removeEventListener('change', onDpr)
    mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)')
    mq.addEventListener('change', onDpr)
  }
  function onDpr() {
    apply()
    watchDpr()
  }

  apply()
  watchDpr()
  window.addEventListener('resize', apply)
  window.addEventListener('load', apply)
  return function cleanup() {
    window.removeEventListener('resize', apply)
    window.removeEventListener('load', apply)
    if (mq) mq.removeEventListener('change', onDpr)
  }
}

/** The same function as an inline <script> body, for <head>. */
export const FLUID_ZOOM_INLINE = '(' + installFluidZoom.toString() + ')();'
