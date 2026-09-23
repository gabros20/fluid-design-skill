// fluid-units.js — the fluid units as numbers, for code that needs a scaled
// DISTANCE: a GSAP tween's x, a ScrollTrigger end, a canvas font size, a
// Motion transform. CSS spends the units through calc(); script cannot,
// because --fluid is an unregistered custom property and getPropertyValue
// returns its formula text ("max(0.58px, min(…))"), not a number.
//
//   fluidPx(600)             600 drawn px on --fluid, in CSS px right now
//   fluidPx(24, 'copy')      on --fluid-copy (display, copy, chrome too)
//   fluidUnits()             { fluid, display, copy, chrome } px per drawn px
//   onFluidChange(cb)        cb(units) whenever any unit changes; returns unsubscribe
//
// How it reads them: one hidden, fixed-position probe per unit, sized
// `calc(1000 * var(--fluid…))`, measured once and cached. The cache is
// marked dirty on window resize and re-measured on the next read, and a
// ResizeObserver on the probes catches every other change (a stylesheet
// arriving late, --fluid-zoom being set after load) and notifies
// onFluidChange listeners. Reads are therefore cheap: one layout read per
// change, not per call.
//
// Without the fluid-design stylesheet every unit reads 1 (`var(--fluid, 1px)`
// fallbacks), and on the server (no document) too, so distances stay plain
// reference px rather than NaN.
//
// With GSAP, pass FUNCTIONS so ScrollTrigger re-reads them on refresh
// (which it already does on resize):
//   gsap.to(el, { x: () => fluidPx(600), scrollTrigger: { scrub: true, invalidateOnRefresh: true,
//                 end: () => '+=' + fluidPx(1800) } })
// With Motion, the scroll-animation skill's useFluidUnit() wraps this in a
// MotionValue. Both skills' references/fluid-interop.md have the recipes.

var UNITS = ['fluid', 'display', 'copy', 'chrome']
var VARS = {
  fluid: 'var(--fluid, 1px)',
  display: 'var(--fluid-display, var(--fluid, 1px))',
  copy: 'var(--fluid-copy, var(--fluid, 1px))',
  chrome: 'var(--fluid-chrome, var(--fluid, 1px))'
}
var ONE = { fluid: 1, display: 1, copy: 1, chrome: 1 }

var probes = null
var cache = null
var dirty = true
var listeners = new Set()
var resizeWired = false

function ensureProbes() {
  if (probes && probes.root.isConnected) return probes
  var root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.setAttribute('data-fluid-probe', '')
  root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;contain:layout style'
  var els = {}
  for (var i = 0; i < UNITS.length; i++) {
    var el = document.createElement('div')
    el.style.cssText = 'position:absolute;left:0;top:0;height:0;width:calc(1000 * ' + VARS[UNITS[i]] + ')'
    root.appendChild(el)
    els[UNITS[i]] = el
  }
  ;(document.body || document.documentElement).appendChild(root)
  probes = { root: root, els: els }
  dirty = true

  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function () {
      var before = cache
      measure()
      if (!before || changed(before, cache)) notify()
    })
    for (var j = 0; j < UNITS.length; j++) ro.observe(els[UNITS[j]])
  }
  if (!resizeWired) {
    resizeWired = true
    window.addEventListener('resize', function () {
      dirty = true
    })
  }
  return probes
}

function measure() {
  var p = ensureProbes()
  var next = {}
  for (var i = 0; i < UNITS.length; i++) {
    var w = p.els[UNITS[i]].getBoundingClientRect().width / 1000
    next[UNITS[i]] = w > 0 && isFinite(w) ? w : 1
  }
  cache = next
  dirty = false
  return cache
}

function changed(a, b) {
  for (var i = 0; i < UNITS.length; i++) if (Math.abs(a[UNITS[i]] - b[UNITS[i]]) > 1e-6) return true
  return false
}

function notify() {
  listeners.forEach(function (cb) {
    cb(cache)
  })
}

/** Every unit in CSS px per drawn px: { fluid, display, copy, chrome }. */
export function fluidUnits() {
  if (typeof document === 'undefined') return ONE
  ensureProbes()
  return dirty || !cache ? measure() : cache
}

/** `n` drawn px on `unit` (default 'fluid'), in CSS px at the current viewport. */
export function fluidPx(n, unit) {
  if (n === undefined) n = 1
  return n * fluidUnits()[unit || 'fluid']
}

/** Call `cb(units)` whenever any unit changes. Returns an unsubscribe function. */
export function onFluidChange(cb) {
  if (typeof document === 'undefined') return function () {}
  ensureProbes()
  listeners.add(cb)
  return function () {
    listeners.delete(cb)
  }
}
