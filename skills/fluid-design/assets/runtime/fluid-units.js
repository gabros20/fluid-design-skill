// fluid-units.js — the fluid units as numbers, for code that needs a scaled
// DISTANCE: a GSAP tween's x, a ScrollTrigger end, a canvas font size, a
// Motion transform. CSS spends the units through calc(); script cannot,
// because --fluid is an unregistered custom property and getPropertyValue
// returns its formula text, not a number.
//
//   fluidPx(600)             600 drawn px on --fluid, in CSS px right now
//   fluidPx(24, 'copy')      on --fluid-copy (any role, or 'ui')
//   fluidUnits()             { fluid, display, copy, ui, … } px per drawn px
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
// reference px rather than NaN. Changing a setting (--fluid-phone-scale-min,
// …) resizes the probes, so onFluidChange fires for that too.
//
// `fluid generate` writes this file with UNITS set to the project's roles.
//
// With GSAP, pass FUNCTIONS so ScrollTrigger re-reads them on refresh
// (which it already does on resize):
//   gsap.to(el, { x: () => fluidPx(600), scrollTrigger: { scrub: true, invalidateOnRefresh: true,
//                 end: () => '+=' + fluidPx(1800) } })
// With Motion, wrap fluidPx() in a MotionValue and update it from
// onFluidChange. references/fluid-scale.md §11 has the details.

var UNITS = ['fluid', 'display', 'copy', 'ui'] // @fluid-units
var VARS = {}
var ONE = {}
for (var u = 0; u < UNITS.length; u++) {
  VARS[UNITS[u]] = UNITS[u] === 'fluid' ? 'var(--fluid, 1px)' : 'var(--fluid-' + UNITS[u] + ', var(--fluid, 1px))'
  ONE[UNITS[u]] = 1
}
// v1 name for the ui unit.
var ALIASES = { chrome: 'ui' } // @fluid-aliases

var probes = null
var observer = null
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
    // One observer: probes rebuilt (a framework replaced <body>) re-use it.
    if (observer) observer.disconnect()
    else
      observer = new ResizeObserver(function () {
        var before = cache
        measure()
        if (!before || changed(before, cache)) notify()
      })
    for (var j = 0; j < UNITS.length; j++) observer.observe(els[UNITS[j]])
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
  cache = Object.freeze(next)
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

/** Every unit in CSS px per drawn px: { fluid, display, copy, ui, … }. */
export function fluidUnits() {
  if (typeof document === 'undefined') return ONE
  ensureProbes()
  return dirty || !cache ? measure() : cache
}

/** `n` drawn px on `unit` (default 'fluid'), in CSS px at the current viewport.
 * Pass `el` to read the unit as it applies AT that element: inside a limit or
 * a scope (fluid-grow-until-1680, fluid-off, fluid-scope, an SCSS mixin
 * scope) the units differ from the page's. The engine sets a registered,
 * NON-inherited length (--_fluid-m-<unit>, 0px elsewhere) on :root and every
 * scope, so this walks up from `el` to the first element that has one: one
 * getComputedStyle per ancestor, so cache it per frame, not per tween tick.
 * Without @property (Firefox < 128) the mirror is never a length, and this
 * falls back to the page's units. */
export function fluidPx(n, unit, el) {
  if (n === undefined) n = 1
  var key = ALIASES[unit] || unit || 'fluid'
  if (UNITS.indexOf(key) < 0) throw new Error('fluid-units: unknown unit "' + unit + '" (known: ' + UNITS.join(', ') + ')')
  if (el && typeof getComputedStyle !== 'undefined') {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var v = parseFloat(getComputedStyle(e).getPropertyValue('--_fluid-m-' + key))
      if (v > 0 && isFinite(v)) return (n * v) / 1000
    }
  }
  return n * fluidUnits()[key]
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
