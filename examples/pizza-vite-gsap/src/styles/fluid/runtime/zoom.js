// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.

// fluid-zoom.js — give fluid type back its response to browser zoom.
//
// Why: desktop browser zoom (Cmd/Ctrl +) shrinks the CSS viewport by the
// zoom factor. `--fluid` is built only from vw and svh, so it shrinks by the
// same factor and type renders at the SAME physical size at every zoom level
// until the CSS viewport drops below `engageAt` and the mobile CSS takes over.
// On a 2560-wide display that is 250% zoom, a WCAG 1.4.4 failure
// (references/fluid-scale.md §12). This script measures the zoom factor and
// writes it to `--fluid-zoom` on :root. With `zoomCompensation` on in
// fluid.config.json, the generated type units read their base as
// `--fluid × --fluid-zoom`, which is the unzoomed value, so text zooms 1:1.
// Layout is not compensated: it keeps fitting the zoomed viewport, and the
// larger text reflows inside it.
//
// Where the value lives: a constructable stylesheet in
// document.adoptedStyleSheets holding `:root { --fluid-zoom: z }`. It changes
// no DOM, so React sees no extra attribute on <html> (no hydration warning),
// and a CSSOM replaceSync is not an inline style, so a CSP `style-src` does
// not apply. Where adoptedStyleSheets is missing (Safari < 16.4, Firefox <
// 101) it falls back to <html>'s style attribute, written only once the zoom
// is not 1, so an unzoomed page gets no attribute. Read it with
// getComputedStyle, which sees both; element.style sees only the fallback.
//
// How it detects zoom: no browser exposes the page zoom directly. Two
// signals carry it in Chromium and Firefox:
//   r   = outerWidth / innerWidth     (window px ÷ CSS px)
//   dpr = devicePixelRatio            (native display ratio × zoom)
// Each alone is ambiguous: a side panel or docked devtools inflates r, and
// dpr 2 is either a Retina screen or 200% on a 1x screen. The zoom is
// accepted only when the two AGREE within 4% for a plausible native ratio,
// AND the height axis agrees too (see detect). Anything else — a side panel,
// an iframe (outerWidth is the top window's), a browser that keeps dpr fixed
// under zoom — falls back to 1, which is exactly today's behaviour. It can
// fail to compensate; it is built not to inflate type on an unzoomed page.
//
// Verified with real Chromium zoom (Preferences default_zoom_level, new
// headless) at 110–300% on 1440, 1920 and 2560 windows, on the fixture page
// and both example builds: see scripts/tools/verify.mjs's zoom row.
// Safari has its own path (see detectSafari), verified on Safari 26 by driving
// real zoom steps and the sidebar through Cua Driver. Firefox is gated off: it
// reported 2.222 at 110%, and it exposes no unambiguous signal. The false
// positive geometries (display scaling plus a side panel, docked devtools)
// are a table in scripts/test/zoom-detect.mjs.
//
// Install it BEFORE first paint, or a zoomed page loads with small type and
// then jumps. `fluid generate` writes it with an integration:
//   Next: <FluidHead nonce={nonce} /> first in <head> (integrations/next.tsx)
//   Vite: plugins: [fluidPlugin()] (integrations/vite.ts)
//   Anything else: runtime/zoom.classic.js as the first classic <script> in
//     <head>, or FLUID_ZOOM_INLINE pasted into one.
// Under a hash-based CSP, allow FLUID_ZOOM_SHA256 in script-src: the
// generated runtime/zoom.js carries FLUID_ZOOM_INLINE as a string literal and
// its hash, both fixed at generate time, so no bundler or minifier can change
// the script text out from under the hash.
//
// installFluidZoom must stay self-contained (no imports, no outer
// variables): FLUID_ZOOM_INLINE is its own source text.

/** Detect the page zoom, write it to `--fluid-zoom` on :root, and keep it
 * current on resize and display changes. Returns a cleanup function.
 * `env` ({ window, document, navigator }) replaces the globals; it exists for
 * scripts/test/zoom-detect.mjs, and pages call it with no argument. */
export function installFluidZoom(env) {
  env = env || {}
  var w = env.window || window
  var doc = env.document || document
  var nav = env.navigator || navigator
  // macOS only ever reports whole native ratios; narrowing the candidates
  // there is what stops a Retina screen plus a side panel reading as zoom.
  var MAC = /Mac|iPhone|iPad/.test(nav.platform || nav.userAgent)
  var NATIVE = MAC ? [1, 2, 3] : [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4]
  var TOLERANCE = 0.04

  // Safari keeps devicePixelRatio fixed under zoom, but outerWidth stays in
  // window points while innerWidth shrinks by the zoom, so ow/iw IS the zoom
  // (measured on Safari 26: 1.1507, 1.2506, 1.5000, 1.7500 at its 115-175%
  // steps). The sidebar and a right-docked inspector also shrink innerWidth,
  // but only the width: zoom shrinks innerHeight by the same factor. So the
  // width ratio is accepted only when the toolbar height it implies,
  // outerHeight - innerHeight * z, is a real toolbar (0-150 points) and z is
  // one of Safari's zoom steps. Measured: sidebar open at 100% gives a width
  // ratio of 1.2038 and an implied toolbar of -131, rejected.
  var SAFARI = !nav.userAgentData && /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(nav.userAgent)
  var SAFARI_STEPS = [1.15, 1.25, 1.5, 1.75, 2, 2.5, 3]

  function detectSafari() {
    var ow = w.outerWidth
    var iw = w.innerWidth
    var oh = w.outerHeight
    var ih = w.innerHeight
    if (!ow || !iw || !oh || !ih || w.top !== w.self) return null
    var z = ow / iw
    if (z < 1.05) return 1
    var step = 1
    for (var i = 0; i < SAFARI_STEPS.length; i++) if (Math.abs(SAFARI_STEPS[i] - z) / SAFARI_STEPS[i] < 0.01) step = SAFARI_STEPS[i]
    if (step === 1) return 1
    var toolbar = oh - ih * step
    return toolbar >= 0 && toolbar <= 150 ? step : 1
  }

  function detect() {
    // Which engines: Chromium (navigator.userAgentData) and Safari, each on
    // its own signal. Firefox reports even outerWidth and screen.width in
    // zoomed CSS px, so zoom shows only in devicePixelRatio, entangled with
    // the display's own ratio (a 2.0 is Retina at 100% or 1x at 200%); a
    // real Firefox reported 2.222 at 110%. A wrong factor inflates type,
    // which is worse than none, so Firefox and anything unknown read 1:
    // uncompensated, never wrong.
    if (SAFARI) return detectSafari()
    if (!nav.userAgentData) return 1
    var ow = w.outerWidth
    var iw = w.innerWidth
    var oh = w.outerHeight
    var ih = w.innerHeight
    var dpr = w.devicePixelRatio || 1
    if (!ow || !iw || !oh || !ih || w.top !== w.self) return null
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
    best = Math.min(4, Math.max(1, best))
    if (best === 1) return 1
    // The width match alone is fooled whenever a side panel's share of the
    // window happens to equal a display-scaling ratio: Windows at 125% with
    // a 20% side panel gives r = 1.25 = dpr 1.25 / native 1; 150% with a 1/6
    // panel gives 1.2 = 1.5 / 1.25; 200% with a 25% panel 1.333 = 2 / 1.5; a
    // Retina Mac with DevTools docked right at 50% gives 2 = 2 / 1. Zoom
    // shrinks innerHeight by the same factor as innerWidth; a side panel or
    // right-docked DevTools shrinks only the width. So, as in Safari, accept
    // z only when the toolbar it implies, outerHeight - innerHeight * z, is a
    // real one: 0-200 window px (tab strip, omnibox, bookmarks bar and an
    // infobar or two). In the cases above it comes out tens to hundreds of
    // px negative. DevTools docked at the bottom with real zoom fails it too
    // and reads 1: uncompensated, the documented safe failure.
    var toolbar = oh - ih * best
    return toolbar >= 0 && toolbar <= 200 ? best : 1
  }

  // Where the value goes. A constructable stylesheet when the browser has
  // them (see the header for why); the <html> style attribute otherwise.
  var sheet = null
  var adopt = false
  try {
    if ('adoptedStyleSheets' in doc && typeof w.CSSStyleSheet === 'function') {
      sheet = new w.CSSStyleSheet()
      adopt = typeof sheet.replaceSync === 'function'
    }
  } catch (e) {
    // Safari < 16.4 has CSSStyleSheet but its constructor throws.
    adopt = false
  }
  function write(value) {
    if (adopt) {
      sheet.replaceSync(':root { --fluid-zoom: ' + value + ' }')
      // Adopt once; re-adopt if something replaced the list since.
      if (doc.adoptedStyleSheets.indexOf(sheet) < 0) doc.adoptedStyleSheets = doc.adoptedStyleSheets.concat([sheet])
    } else {
      doc.documentElement.style.setProperty('--fluid-zoom', value)
    }
  }

  var last = ''
  var tries = 0
  function apply() {
    var z = detect()
    if (z === null) {
      // outerWidth reads 0 until the window is shown: measured in Chromium
      // at head/DOMContentLoaded/load, non-zero one frame later, with no
      // resize event in between. Retry on the next frames, then give up.
      if (w.top === w.self && tries++ < 30) w.requestAnimationFrame(apply)
      z = 1
    }
    var value = String(Math.round(z * 1000) / 1000)
    if (value === last) return
    // The fallback leaves an unzoomed page untouched: no style attribute on
    // <html> until there is a zoom to write (the type units default to 1).
    // The adopted sheet does write 1, so a page with the runtime installed
    // reads --fluid-zoom: 1 and verify-matrix can tell it from one without.
    var first = last === ''
    last = value
    if (!adopt && first && value === '1') return
    write(value)
  }

  var mq = null
  function watchDpr() {
    // A dpr-only change (the window moved to another display, or a zoom
    // step that left innerWidth unchanged) fires no resize event.
    if (mq) mq.removeEventListener('change', onDpr)
    mq = w.matchMedia('(resolution: ' + (w.devicePixelRatio || 1) + 'dppx)')
    mq.addEventListener('change', onDpr)
  }
  function onDpr() {
    apply()
    watchDpr()
  }

  apply()
  watchDpr()
  w.addEventListener('resize', apply)
  w.addEventListener('load', apply)
  return function cleanup() {
    w.removeEventListener('resize', apply)
    w.removeEventListener('load', apply)
    if (mq) mq.removeEventListener('change', onDpr)
  }
}

/** The same function as an inline <script> body, for <head>. In this source
 * file it is built from the function text; `fluid generate` replaces both
 * lines below with string literals fixed at generate time (comment lines
 * stripped), which is what a CSP hash needs. */
export const FLUID_ZOOM_INLINE = "(function installFluidZoom(env) {\n  env = env || {}\n  var w = env.window || window\n  var doc = env.document || document\n  var nav = env.navigator || navigator\n  var MAC = /Mac|iPhone|iPad/.test(nav.platform || nav.userAgent)\n  var NATIVE = MAC ? [1, 2, 3] : [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4]\n  var TOLERANCE = 0.04\n\n  var SAFARI = !nav.userAgentData && /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(nav.userAgent)\n  var SAFARI_STEPS = [1.15, 1.25, 1.5, 1.75, 2, 2.5, 3]\n\n  function detectSafari() {\n    var ow = w.outerWidth\n    var iw = w.innerWidth\n    var oh = w.outerHeight\n    var ih = w.innerHeight\n    if (!ow || !iw || !oh || !ih || w.top !== w.self) return null\n    var z = ow / iw\n    if (z < 1.05) return 1\n    var step = 1\n    for (var i = 0; i < SAFARI_STEPS.length; i++) if (Math.abs(SAFARI_STEPS[i] - z) / SAFARI_STEPS[i] < 0.01) step = SAFARI_STEPS[i]\n    if (step === 1) return 1\n    var toolbar = oh - ih * step\n    return toolbar >= 0 && toolbar <= 150 ? step : 1\n  }\n\n  function detect() {\n    if (SAFARI) return detectSafari()\n    if (!nav.userAgentData) return 1\n    var ow = w.outerWidth\n    var iw = w.innerWidth\n    var oh = w.outerHeight\n    var ih = w.innerHeight\n    var dpr = w.devicePixelRatio || 1\n    if (!ow || !iw || !oh || !ih || w.top !== w.self) return null\n    var r = ow / iw\n    var best = 1\n    var bestErr = Infinity\n    for (var i = 0; i < NATIVE.length; i++) {\n      var z = dpr / NATIVE[i]\n      var err = Math.abs(z - r) / r\n      if (err < bestErr) {\n        bestErr = err\n        best = z\n      }\n    }\n    if (bestErr > TOLERANCE) return 1\n    best = Math.min(4, Math.max(1, best))\n    if (best === 1) return 1\n    var toolbar = oh - ih * best\n    return toolbar >= 0 && toolbar <= 200 ? best : 1\n  }\n\n  var sheet = null\n  var adopt = false\n  try {\n    if ('adoptedStyleSheets' in doc && typeof w.CSSStyleSheet === 'function') {\n      sheet = new w.CSSStyleSheet()\n      adopt = typeof sheet.replaceSync === 'function'\n    }\n  } catch (e) {\n    adopt = false\n  }\n  function write(value) {\n    if (adopt) {\n      sheet.replaceSync(':root { --fluid-zoom: ' + value + ' }')\n      if (doc.adoptedStyleSheets.indexOf(sheet) < 0) doc.adoptedStyleSheets = doc.adoptedStyleSheets.concat([sheet])\n    } else {\n      doc.documentElement.style.setProperty('--fluid-zoom', value)\n    }\n  }\n\n  var last = ''\n  var tries = 0\n  function apply() {\n    var z = detect()\n    if (z === null) {\n      if (w.top === w.self && tries++ < 30) w.requestAnimationFrame(apply)\n      z = 1\n    }\n    var value = String(Math.round(z * 1000) / 1000)\n    if (value === last) return\n    var first = last === ''\n    last = value\n    if (!adopt && first && value === '1') return\n    write(value)\n  }\n\n  var mq = null\n  function watchDpr() {\n    if (mq) mq.removeEventListener('change', onDpr)\n    mq = w.matchMedia('(resolution: ' + (w.devicePixelRatio || 1) + 'dppx)')\n    mq.addEventListener('change', onDpr)\n  }\n  function onDpr() {\n    apply()\n    watchDpr()\n  }\n\n  apply()\n  watchDpr()\n  w.addEventListener('resize', apply)\n  w.addEventListener('load', apply)\n  return function cleanup() {\n    w.removeEventListener('resize', apply)\n    w.removeEventListener('load', apply)\n    if (mq) mq.removeEventListener('change', onDpr)\n  }\n})();"
/** CSP hash of FLUID_ZOOM_INLINE for script-src ('sha256-…'). Empty in this
 * source file; the generated runtime/zoom.js carries the real one. */
export const FLUID_ZOOM_SHA256 = 'sha256-IGvZ4X7oIGqbqWVqOznVFn8SHDwLm50TJStwFJwEO/s='
