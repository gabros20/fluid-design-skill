// fluid-math.mjs — pure, zero-dependency math for the fluid-design scale.
//
// Every unit here is a CSS length equal to exactly 1px at `reference`, so a
// drawn number from a design file is written as that number times the unit
// (`64px in the frame` -> `calc(64 * var(--fluid-display))`). See
// references/fluid-scale.md for the full model; this module only computes
// the numbers, in a form the generator, a standalone calculator and a
// verifier can all import.
//
// No dependencies, no I/O beyond `loadConfig`'s optional file read.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_CONFIG = Object.freeze({
  prefix: 'fluid',
  reference: Object.freeze({ width: 1440, height: 900 }),
  canvas: Object.freeze({ width: 1680, gutter: 80 }),
  engageAt: 1024,
  heightAxis: true,
  units: Object.freeze({
    fluid: Object.freeze({ floor: 0.58 }),
    display: Object.freeze({ damping: 0.62, floor: 'auto' }),
    copy: Object.freeze({ damping: 0.33, floor: 'auto' }),
    chrome: Object.freeze({ enabled: true })
  }),
  ceiling: null,
  mobile: Object.freeze({ enabled: false, reference: 390, min: 0.85, max: 1.25 }),
  zoomCompensation: true,
  zoomTextRange: Object.freeze([24, 48])
})

export const DEFAULT_CONFIG_PATH = resolvePath(__dirname, '../../assets/fluid.config.json')

// ── validation ──────────────────────────────────────────────────────────

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function assert(condition, message) {
  if (!condition) throw new Error(`[fluid-design] invalid config: ${message}`)
}

function assertPositiveNumber(v, path) {
  assert(isFiniteNumber(v), `${path} must be a finite number, got ${JSON.stringify(v)}`)
  assert(v > 0, `${path} must be > 0, got ${v}`)
}

function assertDamping(v, path) {
  assert(isFiniteNumber(v), `${path} must be a finite number, got ${JSON.stringify(v)}`)
  assert(v > 0 && v <= 1, `${path} must be in (0, 1], got ${v}`)
}

function assertFloor(v, path) {
  if (v === 'auto') return
  assertPositiveNumber(v, path)
}

/**
 * Deep-merge a partial config over DEFAULT_CONFIG, then validate the result.
 * Only known keys are merged; unknown top-level or nested keys are rejected
 * so a typo in fluid.config.json fails loudly instead of being silently
 * ignored.
 */
export function mergeConfig(partial = {}) {
  const known = new Set(['$schema', 'prefix', 'reference', 'canvas', 'engageAt', 'heightAxis', 'units', 'ceiling', 'mobile', 'zoomCompensation', 'zoomTextRange'])
  for (const key of Object.keys(partial)) {
    assert(known.has(key), `unknown top-level key "${key}"`)
  }

  const cfg = {
    prefix: partial.prefix ?? DEFAULT_CONFIG.prefix,
    reference: { ...DEFAULT_CONFIG.reference, ...(partial.reference ?? {}) },
    canvas: { ...DEFAULT_CONFIG.canvas, ...(partial.canvas ?? {}) },
    engageAt: partial.engageAt ?? DEFAULT_CONFIG.engageAt,
    heightAxis: partial.heightAxis ?? DEFAULT_CONFIG.heightAxis,
    units: {
      fluid: { ...DEFAULT_CONFIG.units.fluid, ...(partial.units?.fluid ?? {}) },
      display: { ...DEFAULT_CONFIG.units.display, ...(partial.units?.display ?? {}) },
      copy: { ...DEFAULT_CONFIG.units.copy, ...(partial.units?.copy ?? {}) },
      chrome: { ...DEFAULT_CONFIG.units.chrome, ...(partial.units?.chrome ?? {}) }
    },
    ceiling: partial.ceiling === undefined ? DEFAULT_CONFIG.ceiling : partial.ceiling,
    mobile: { ...DEFAULT_CONFIG.mobile, ...(partial.mobile ?? {}) },
    zoomCompensation: partial.zoomCompensation ?? DEFAULT_CONFIG.zoomCompensation,
    zoomTextRange: [...(partial.zoomTextRange ?? DEFAULT_CONFIG.zoomTextRange)]
  }

  validateConfig(cfg)
  return cfg
}

export function validateConfig(cfg) {
  assert(typeof cfg.prefix === 'string' && /^[a-z][a-z0-9-]*$/.test(cfg.prefix), 'prefix must be a lowercase kebab-case string')

  assertPositiveNumber(cfg.reference?.width, 'reference.width')
  assertPositiveNumber(cfg.reference?.height, 'reference.height')

  assertPositiveNumber(cfg.canvas?.width, 'canvas.width')
  assert(isFiniteNumber(cfg.canvas?.gutter) && cfg.canvas.gutter >= 0, 'canvas.gutter must be a finite number >= 0')

  assertPositiveNumber(cfg.engageAt, 'engageAt')
  assert(cfg.engageAt <= cfg.reference.width, `engageAt (${cfg.engageAt}) must be <= reference.width (${cfg.reference.width})`)

  assert(typeof cfg.heightAxis === 'boolean', 'heightAxis must be a boolean')

  assertPositiveNumber(cfg.units?.fluid?.floor, 'units.fluid.floor')

  assertDamping(cfg.units?.display?.damping, 'units.display.damping')
  assertFloor(cfg.units?.display?.floor, 'units.display.floor')

  assertDamping(cfg.units?.copy?.damping, 'units.copy.damping')
  assertFloor(cfg.units?.copy?.floor, 'units.copy.floor')

  assert(typeof cfg.units?.chrome?.enabled === 'boolean', 'units.chrome.enabled must be a boolean')

  if (cfg.ceiling !== null) {
    assertPositiveNumber(cfg.ceiling, 'ceiling')
  }

  const mo = cfg.mobile
  assert(typeof mo?.enabled === 'boolean', 'mobile.enabled must be a boolean')
  assertPositiveNumber(mo.reference, 'mobile.reference')
  assert(mo.reference < cfg.engageAt, `mobile.reference (${mo.reference}) must be < engageAt (${cfg.engageAt})`)
  assert(isFiniteNumber(mo.min) && mo.min > 0 && mo.min <= 1, 'mobile.min must be in (0, 1]')
  assert(isFiniteNumber(mo.max) && mo.max >= 1, 'mobile.max must be >= 1')

  assert(typeof cfg.zoomCompensation === 'boolean', 'zoomCompensation must be a boolean')
  const r = cfg.zoomTextRange
  assert(Array.isArray(r) && r.length === 2 && r.every(isFiniteNumber) && r[0] >= 0 && r[0] < r[1], 'zoomTextRange must be [full, none] drawn px with 0 <= full < none')
}

/**
 * How much of the browser zoom a `fluid-text-*` size takes: 1 at or below
 * zoomTextRange[0] drawn px, 0 at or above zoomTextRange[1], linear between.
 * `fluid-text` is type inside a box that scales on --fluid, and that box is
 * NOT zoom-compensated, so large type zoomed with it outgrows the box and
 * runs over its neighbours (measured: a 200px hero title at 2560x1440, 200%,
 * wrapped to two lines over the body copy). Reading-size text still zooms
 * 1:1. The display and copy units zoom fully: they sit in fixed measures and
 * can wrap. The weight is always taken from the FONT size, for the
 * line-height too, so a line box never zooms differently from its text.
 */
export function textZoomWeight(cfg, n) {
  if (!cfg.zoomCompensation) return 0
  const [full, none] = cfg.zoomTextRange
  return Math.min(1, Math.max(0, (none - n) / (none - full)))
}

/** The CSS factor a fluid-text size is multiplied by, for a compile-time
 * drawn size `n` (SCSS, StyleX). '' when it is exactly 1. */
export function textZoomFactor(cfg, n) {
  const w = textZoomWeight(cfg, n)
  if (w === 0) return ''
  if (w === 1) return ' * var(--fluid-zoom, 1)'
  return ` * (1 + (var(--fluid-zoom, 1) - 1) * ${num(w)})`
}

/** The unit a fluid-text size of drawn `n` px is multiplied by: --fluid,
 * --fluid-z (the zoom-compensated base, fluid-scale.md §12), or a blend by
 * the size's share of the zoom. Blending the two bases, not multiplying
 * --fluid by the zoom, keeps it exact where the floor or ceiling binds. */
export function textUnitExpr(cfg, n) {
  const w = textZoomWeight(cfg, n)
  if (w === 0) return 'var(--fluid)'
  if (w === 1) return 'var(--fluid-z)'
  return `(var(--fluid) + (var(--fluid-z) - var(--fluid)) * ${num(w)})`
}

/** The same factor for a runtime size expression (Tailwind's --value(number)). */
export function textZoomFactorExpr(cfg, sizeExpr) {
  if (!cfg.zoomCompensation) return ''
  const [full, none] = cfg.zoomTextRange
  return ` * (1 + (var(--fluid-zoom, 1) - 1) * clamp(0, (${num(none)} - ${sizeExpr}) / ${num(none - full)}, 1))`
}

/** textUnitExpr for a runtime size expression (Tailwind's --value(number)). */
export function textUnitExprRuntime(cfg, sizeExpr) {
  if (!cfg.zoomCompensation) return 'var(--fluid)'
  const [full, none] = cfg.zoomTextRange
  return `(var(--fluid) + (var(--fluid-z) - var(--fluid)) * clamp(0, (${num(none)} - ${sizeExpr}) / ${num(none - full)}, 1))`
}

/**
 * Load a config file (defaults to assets/fluid.config.json) and merge it
 * over DEFAULT_CONFIG. `path` may be omitted to load only the defaults.
 */
export function loadConfig(path) {
  if (path === undefined) return mergeConfig({})
  const raw = readFileSync(path, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`[fluid-design] could not parse config at ${path}: ${err.message}`)
  }
  return mergeConfig(parsed)
}

// ── derived numbers ─────────────────────────────────────────────────────

export function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * "auto" floor = round2(d * engageAt/reference.width + (1 - d)) — the value
 * the damped curve reaches exactly at `engageAt`, i.e. what the role hands
 * over at the breakpoint where the flat-1px mobile layout takes over. At the
 * shipped defaults (reference 1440, engageAt 1024, damping .62/.33) this is
 * 0.82 and 0.90.
 */
/** The type floors below engageAt when the mobile arm is on: the damped
 * curve read at mobile.min, the same derivation as the desktop floors read
 * at engageAt (fluid-scale.md §5). */
export function resolveMobileFloors(cfg) {
  const m = cfg.mobile.min
  const resolve = (unit) => round2(unit.damping * m + (1 - unit.damping))
  return { display: resolve(cfg.units.display), copy: resolve(cfg.units.copy) }
}

export function resolveFloors(cfg) {
  const ratio = cfg.engageAt / cfg.reference.width
  const resolve = (unit) => (unit.floor === 'auto' ? round2(unit.damping * ratio + (1 - unit.damping)) : unit.floor)
  return {
    fluid: cfg.units.fluid.floor,
    display: resolve(cfg.units.display),
    copy: resolve(cfg.units.copy)
  }
}

/**
 * factors(cfg, w, h) -> { fluid, display, copy, chrome } for a viewport
 * w x h (CSS px). Mirrors the CSS exactly:
 *
 *   below engageAt          -> every value is 1 (flat 1px)
 *   --fluid                 max(floor, min(heightArm, widthArm))   [heightAxis:false -> max(floor, widthArm)]
 *   --fluid-display/-copy   max(floor, fluid, damping*fluid + (1-damping))
 *   --fluid-chrome          min(ceiling, min(widthArm, max(1, heightArm)))   [independent of FLOOR only — see below]
 *
 * `ceiling`, if set, wraps `--fluid` in min(ceiling, ...) BEFORE the type
 * units read it, so display/copy inherit the cap through `fluid` the same
 * way they do in the generated CSS (`var(--fluid)`). The ceiling ALSO wraps
 * `--fluid-chrome` directly (chrome does not read
 * `var(--fluid)`, so it needs its own `min(ceiling, ...)`) — without this,
 * chrome keeps growing past the point every other role on the page stopped,
 * which reads as site chrome (header, footer) visibly outgrowing the
 * content it sits beside on exactly the large displays a ceiling exists
 * for. Chrome still ignores the FLOOR (`units.fluid.floor`) — that half of
 * "independent of floor/ceiling" stands: chrome's own height-never-below-1
 * clause already does that role's floor job.
 */
export function factors(cfg, w, h, zoom = 1) {
  // `w`/`h` are CSS px (already divided by any browser zoom); `zoom` is what
  // fluid-zoom.js writes to --fluid-zoom (1 without it). The type units read
  // the viewport arms times the zoom, clamped exactly like --fluid.
  const z = cfg.zoomCompensation ? zoom : 1
  const typeUnits = (tf, dFloor, cFloor) => ({
    display: Math.max(dFloor, tf, cfg.units.display.damping * tf + (1 - cfg.units.display.damping)),
    copy: Math.max(cFloor, tf, cfg.units.copy.damping * tf + (1 - cfg.units.copy.damping))
  })

  if (w < cfg.engageAt) {
    if (!cfg.mobile.enabled) return { fluid: 1, display: 1, copy: 1, chrome: 1 }
    const { reference, min, max } = cfg.mobile
    const clampM = (v) => Math.min(max, Math.max(min, v))
    const fluid = clampM(w / reference)
    const mf = resolveMobileFloors(cfg)
    return { fluid, ...typeUnits(clampM((w * z) / reference), mf.display, mf.copy), chrome: fluid }
  }

  const clampD = (widthArm, heightArm) => {
    const raw = cfg.heightAxis ? Math.min(widthArm, heightArm) : widthArm
    const floored = Math.max(cfg.units.fluid.floor, raw)
    return cfg.ceiling !== null ? Math.min(cfg.ceiling, floored) : floored
  }
  const widthArm = w / cfg.reference.width
  const heightArm = h / cfg.reference.height
  const fluid = clampD(widthArm, heightArm)
  const floors = resolveFloors(cfg)
  const { display, copy } = typeUnits(clampD(widthArm * z, heightArm * z), floors.display, floors.copy)

  let chrome = cfg.units.chrome.enabled ? Math.min(widthArm, Math.max(1, heightArm)) : fluid
  if (cfg.ceiling !== null) chrome = Math.min(cfg.ceiling, chrome)

  return { fluid, display, copy, chrome }
}

// ── CSS string generation ───────────────────────────────────────────────

// Deterministic, minimal-decimal number formatting shared by every stack
// generator, so re-running the generator never changes a digit.
export function num(n) {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e6) / 1e6)
}

function px(n) {
  return `${num(n)}px`
}

/**
 * cssUnits(cfg) -> the exact custom-property strings, fixed names (§1 of
 * references/contract.md — the names never change with `prefix`; only utility/class
 * names do). Returns the flat `:root` values, the engaged
 * `@media (width >= engageAt)` values, and the pieces needed to assemble
 * both blocks in any stack.
 */
export function cssUnits(cfg) {
  const { reference, engageAt } = cfg
  const floors = resolveFloors(cfg)
  const d = cfg.units.display.damping
  const c = cfg.units.copy.damping
  const zc = cfg.zoomCompensation
  const Z = ' * var(--fluid-zoom, 1)'

  const arm = (vp, n, zoomed) => `calc(${vp} / ${num(n)}${zoomed ? Z : ''})`
  const widthArm = arm('100vw', reference.width, false)
  const heightArm = arm('100svh', reference.height, false)

  // --fluid, and the same expression with each viewport arm multiplied by
  // the zoom BEFORE the floor/ceiling clamp. Browser zoom shrinks the CSS
  // viewport by z, so an arm times z is exactly its unzoomed value, and the
  // clamp then lands where it did at 100%. Multiplying the clamped --fluid
  // instead would count the zoom twice wherever the floor or the ceiling
  // binds (there the unit is plain px, which zooms by itself).
  const desktopBase = (zoomed) => {
    const w = arm('100vw', reference.width, zoomed)
    const h = arm('100svh', reference.height, zoomed)
    const raw = cfg.heightAxis ? `min(${h}, ${w})` : w
    const floored = `max(${px(floors.fluid)}, ${raw})`
    return cfg.ceiling !== null ? `min(${px(cfg.ceiling)}, ${floored})` : floored
  }
  const fluidExpr = desktopBase(false)

  // The type units read the zoom-compensated base (fluid-scale.md §12): each
  // resolves to the CSS px it had at 100% and renders z times larger, so text
  // zooms 1:1. Layout (`--fluid`), chrome and `fluid-text-*` (by size) stay
  // uncompensated on purpose: they keep fitting the zoomed viewport.
  const typeUnit = (damping, floor, base) => `max(${px(floor)}, ${base}, calc(${num(damping)} * ${base} + ${px(1 - damping)}))`
  // Emitted once as --fluid-z (only with zoomCompensation), so the type
  // units and fluid-text all read the same compensated base.
  const typeBase = zc ? 'var(--fluid-z)' : 'var(--fluid)'
  const displayExpr = typeUnit(d, floors.display, typeBase)
  const copyExpr = typeUnit(c, floors.copy, typeBase)
  // Chrome does not read var(--fluid), so a ceiling has to wrap IT directly
  // — otherwise chrome keeps growing past the point the rest
  // of the page's ceiling-capped units stopped.
  const chromeExprRaw = `min(${widthArm}, max(1px, ${heightArm}))`
  const chromeExpr = cfg.ceiling !== null ? `min(${px(cfg.ceiling)}, ${chromeExprRaw})` : chromeExprRaw

  // Below engageAt: a flat 1px, or with the mobile arm a width-only scale off
  // the phone frame, clamped so a small phone stops shrinking and a tablet
  // stops growing (fluid-scale.md §13). Height never enters: below the
  // breakpoint sections stack and scroll, so there is nothing to fit.
  let root
  if (cfg.mobile.enabled) {
    const mo = cfg.mobile
    const mf = resolveMobileFloors(cfg)
    const mobileBase = (zoomed) => `clamp(${px(mo.min)}, ${arm('100vw', mo.reference, zoomed)}, ${px(mo.max)})`
    root = {
      '--fluid': mobileBase(false),
      ...(zc ? { '--fluid-z': mobileBase(true) } : {}),
      '--fluid-display': typeUnit(d, mf.display, typeBase),
      '--fluid-copy': typeUnit(c, mf.copy, typeBase),
      ...(cfg.units.chrome.enabled ? { '--fluid-chrome': 'var(--fluid)' } : {})
    }
  } else {
    root = {
      '--fluid': '1px',
      ...(zc ? { '--fluid-z': '1px' } : {}),
      '--fluid-display': '1px',
      '--fluid-copy': '1px',
      ...(cfg.units.chrome.enabled ? { '--fluid-chrome': '1px' } : {})
    }
  }

  // The header row itself: a flat 34px below `engageAt`, `48 * --fluid-chrome`
  // above it — fixed numbers from the reference build, independent of the
  // config knobs above; a consumer overrides `--header-h` downstream if its
  // header draws a different row height.
  const headerRoot = `calc(24 * var(--fluid) + var(--safe-top) + 34px)`
  const headerEngaged = cfg.units.chrome.enabled
    ? `calc(24 * var(--fluid) + var(--safe-top) + 48 * var(--fluid-chrome))`
    : `calc(24 * var(--fluid) + var(--safe-top) + 48 * var(--fluid))`

  return {
    engageAt,
    prefix: cfg.prefix,
    root: {
      ...root,
      '--safe-top': 'env(safe-area-inset-top, 0px)',
      '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      '--browser-bar': 'calc(100lvh - 100svh)',
      '--header-h': headerRoot
    },
    engaged: {
      '--fluid': fluidExpr,
      ...(zc ? { '--fluid-z': desktopBase(true) } : {}),
      '--fluid-display': displayExpr,
      '--fluid-copy': copyExpr,
      ...(cfg.units.chrome.enabled ? { '--fluid-chrome': chromeExpr } : {}),
      '--header-h': headerEngaged
    }
  }
}
