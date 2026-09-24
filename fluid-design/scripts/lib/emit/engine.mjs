// engine.mjs — the generated unit engine: registered settings, band
// mapping, and every formula written once.
//
//   a) @property per setting: the default lives in the registration, and an
//      invalid value (0.8px, a typo) falls back to it instead of breaking
//      every unit.
//   b) band blocks: each only points the private --_fluid-* parameters at
//      its own band's settings. No numbers.
//   c) formulas, once, on `:root, .<prefix>-scope`.
//
// PRECISION: every comparison (min/max) compares lengths scaled ×1000 and
// divides once outside. Firefox stores lengths in 1/60px steps and rounds a
// comparison's result to that grid; on a ~0.7px unit that is up to 1.6% off,
// multiplied by every drawn number. At ×1000 the error is ~0.02px.
// No clamp(), no round(): min(), max() and calc() only.

import { settingsSpec, bandBlurb, BAND_NAMES } from '../spec.mjs'
import { bandMedia } from '../model.mjs'

const S = 1000
const NO_MAX = 1000000 // an unset desktop scale-max: effectively no ceiling

export function num(n) {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e6) / 1e6)
}

// Where the formulas run: the root, and every SCOPE — an element whose
// settings differ from the page's. A scope is made by the plain class
// `<prefix>-scope`, a `data-fluid-scope` attribute, or implicitly by any
// limit utility (matched by substring, so Tailwind variants and a Tailwind
// prefix — `lg:fluid-grow-until-1680`, `tw:fluid-off` — still match; `off`
// is matched as a whole class so an unrelated `fluid-offset…` never is).
// Being a scope where no setting differs is harmless: same numbers.
export function scopeSelector(prefix) {
  return [':root', `.${prefix}-scope`, '[data-fluid-scope]', `[class*="${prefix}-grow-until-"]`, `[class*="${prefix}-ui-grow-until-"]`, `[class*="${prefix}-shrink-until-"]`, `[class~="${prefix}-off"]`, `[class*=":${prefix}-off"]`].join(',\n')
}
const LIMIT_KEYS = new Set(['grow-until', 'shrink-until', 'ui-grow-until'])

/** var(--setting, default) — the default repeated as a fallback, for a
 * pipeline that drops @property. Optional settings fall back to "off". */
function ref(spec) {
  // Unset optional settings mean "off": no ceiling, no floor, no limit (-1 never lies in a band).
  const fallback = spec.default === null ? (spec.key === 'scale-max' ? NO_MAX : LIMIT_KEYS.has(spec.key) ? -1 : 0) : spec.default
  return `var(${spec.name}, ${num(fallback)})`
}

function bandVars(structure, band, specs) {
  const get = (key) => specs.find((s) => s.band === band && s.key === key)
  const r = (key) => ref(get(key))
  const desktop = band === 'desktop'
  const flat = band === 'phone' && !structure.bands.phone.enabled
  const out = []
  const push = (k, v) => out.push([k, v])
  // The band's window-width range [lo, hi): a width limit applies only in
  // the band that contains it.
  const edges = flat ? [0, 0] : bandEdges(structure)[band] // flat: nothing scales, so no limit applies
  push('--_fluid-lo', num(edges[0]))
  push('--_fluid-hi', num(edges[1]))
  if (flat) {
    push('--_fluid-base-w', '1')
    push('--_fluid-base-h', '1')
    push('--_fluid-fit-h', '0')
    push('--_fluid-min', '1')
    push('--_fluid-max', '1')
    push('--_fluid-knee', '1')
    push('--_fluid-ui-min', '1')
    for (const role of structure.roles) {
      push(`--_fluid-${role}-d`, '1')
      push(`--_fluid-${role}-floor`, '0')
    }
  } else {
    push('--_fluid-base-w', r('base-width'))
    if (desktop) {
      push('--_fluid-base-h', r('base-height'))
      push('--_fluid-fit-h', r('fit-height'))
    } else if (band === 'phone') {
      // Width-only bands: the height arm is gated off (fit-h 0 adds 1e9px).
      push('--_fluid-base-h', 'var(--_fluid-base-w)')
      push('--_fluid-fit-h', '0')
    }
    push('--_fluid-min', r('scale-min'))
    push('--_fluid-max', r('scale-max'))
    // The type knee: damping is read at no less than the band's lower edge.
    // On mobile that is scale-min (the unit never goes lower, so it is a
    // no-op); on desktop it is minWidth / base-width, where v1's "auto
    // floor" sat, now exact and live.
    if (desktop) push('--_fluid-knee', `calc(${num(structure.bands.desktop.minWidth)} / var(--_fluid-base-w))`)
    else if (band === 'phone') push('--_fluid-knee', 'var(--_fluid-min-x)')
    if (desktop) push('--_fluid-ui-min', '0')
    else if (band === 'phone') push('--_fluid-ui-min', 'var(--_fluid-min-x)')
    for (const role of structure.roles) {
      push(`--_fluid-${role}-d`, r(`${role}-damping`))
      push(`--_fluid-${role}-floor`, r(`${role}-floor`))
    }
  }
  push('--_fluid-cw', r('container-width'))
  if (desktop) push('--_fluid-cw-grow', '1')
  else if (band === 'phone') push('--_fluid-cw-grow', '0')
  push('--_fluid-pad', r('container-padding'))
  const row = get('header-height')
  push('--_fluid-header-row', desktop ? `calc(${ref(row)} * var(${structure.ui ? '--fluid-ui' : '--fluid'}))` : `calc(${ref(row)} * 1px)`)
  return out
}

function formulas(structure, specs, aliases) {
  const zoom = structure.zoom
  const g = (name) => ref(specs.find((s) => s.name === name))
  const base = zoom ? 'var(--fluid-z)' : 'var(--fluid)'
  const unit = (w, h) => `calc(max(calc(var(--_fluid-min-x) * ${S}px), min(${h}, ${w}, calc(var(--_fluid-max-x) * ${S}px))) / ${S})`
  // A width limit W holds the unit at W / base-width, in the band whose
  // range contains W. The band test is arithmetic on plain numbers (1 when
  // lo <= W < hi, else 0; W is a whole number, unset is -1), so there is no
  // sign() or clamp() here either. `off` then pulls min and max to 1.
  const inBand = (w) => `calc(min(1, max(0, ${w} - var(--_fluid-lo) + 1)) * min(1, max(0, var(--_fluid-hi) - ${w})))`
  const lim = (k) => g(`--fluid-${k}`)
  const st = g('--fluid-off')
  const out = [
    ['--_fluid-in-grow', inBand(lim('grow-until'))],
    ['--_fluid-in-shrink', inBand(lim('shrink-until'))],
    ['--_fluid-max-l', `min(var(--_fluid-max), calc(${lim('grow-until')} / var(--_fluid-base-w) + (1 - var(--_fluid-in-grow)) * ${NO_MAX}))`],
    ['--_fluid-min-l', `max(var(--_fluid-min), calc(${lim('shrink-until')} / var(--_fluid-base-w) * var(--_fluid-in-shrink)))`],
    ['--_fluid-max-x', `calc(var(--_fluid-max-l) + (1 - var(--_fluid-max-l)) * ${st})`],
    ['--_fluid-min-x', `calc(var(--_fluid-min-l) + (1 - var(--_fluid-min-l)) * ${st})`],
    ['--_fluid-w', `calc(100vw * ${S} / var(--_fluid-base-w))`],
    ['--_fluid-h', `calc(100svh * ${S} / var(--_fluid-base-h) + (1 - var(--_fluid-fit-h)) * 1e9px)`],
    ['--fluid', unit('var(--_fluid-w)', 'var(--_fluid-h)')]
  ]
  if (zoom) {
    out.push(['--fluid-z', unit('calc(var(--_fluid-w) * var(--fluid-zoom, 1))', 'calc(var(--_fluid-h) * var(--fluid-zoom, 1))')])
  }
  for (const role of structure.roles) {
    const d = `var(--_fluid-${role}-d)`
    out.push([
      `--fluid-${role}`,
      `calc(max(calc(${base} * ${S}), calc(${d} * max(calc(${base} * ${S}), calc(var(--_fluid-knee) * ${S}px)) + (1 - ${d}) * ${S}px), calc(var(--_fluid-${role}-floor) * ${S}px)) / ${S})`
    ])
  }
  if (structure.ui) {
    out.push(['--_fluid-in-ui', inBand(lim('ui-grow-until'))])
    out.push(['--_fluid-ui-max', `min(var(--_fluid-max-x), calc(${lim('ui-grow-until')} / var(--_fluid-base-w) + (1 - var(--_fluid-in-ui)) * ${NO_MAX}))`])
    // shrink-until floors ui too; off pulls it to 1.
    out.push(['--_fluid-ui-min-l', `max(var(--_fluid-ui-min), calc(${lim('shrink-until')} / var(--_fluid-base-w) * var(--_fluid-in-shrink)))`])
    out.push(['--_fluid-ui-min-x', `calc(var(--_fluid-ui-min-l) + (1 - var(--_fluid-ui-min-l)) * ${st})`])
    out.push(['--fluid-ui', `calc(max(calc(var(--_fluid-ui-min-x) * ${S}px), min(var(--_fluid-w), max(${S}px, var(--_fluid-h)), calc(var(--_fluid-ui-max) * ${S}px))) / ${S})`])
  }
  out.push(['--fluid-container-width', 'max(calc(var(--_fluid-cw) * var(--_fluid-cw-grow) * 1px), calc(var(--_fluid-cw) * var(--fluid)))'])
  out.push(['--fluid-container-padding', 'calc(var(--_fluid-pad) * var(--fluid))'])
  out.push(['--safe-top', 'env(safe-area-inset-top, 0px)'])
  out.push(['--safe-bottom', 'env(safe-area-inset-bottom, 0px)'])
  out.push(['--browser-bar', 'calc(100lvh - 100svh)'])
  out.push(['--header-h', `calc(${g('--fluid-header-inset')} * var(--fluid) + var(--safe-top) + var(--_fluid-header-row))`])
  // Registered <length> mirrors (×1000) so script can read a unit AT AN
  // ELEMENT, scopes included, with getComputedStyle: fluidPx(n, unit, el).
  for (const u of measuredUnits(structure)) out.push([`--_fluid-m-${u}`, `calc(var(--fluid${u === 'fluid' ? '' : '-' + u}) * ${S})`])
  if (aliases) {
    if (structure.ui) out.push(['--fluid-chrome', 'var(--fluid-ui)'])
    if (structure.bands.phone.enabled) out.push(['--fluid-column', 'var(--fluid-container-width)'])
  }
  return out
}

/** Each band's window-width range [lo, hi); a width limit applies in the band containing it. */
export function bandEdges(structure) {
  const b = structure.bands
  const D = b.desktop.minWidth
  return { phone: [0, b.tablet.enabled ? b.tablet.minWidth : D], tablet: [b.tablet.minWidth, D], landscape: [0, D], desktop: [D, NO_MAX] }
}

export function measuredUnits(structure) {
  return ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
}

const decls = (pairs, indent) => pairs.map(([k, v]) => `${indent}${k}: ${v};`).join('\n')

/**
 * The engine as structured parts, so each stack can place them:
 *   { properties: string (the @property block),
 *     rules: [{ media: string|null, comment, pairs: [[name, value]] }] }
 */
export function engineParts(structure, { buildId, aliases = structure.aliases } = {}) {
  const specs = settingsSpec(structure)
  const properties = [
    ...specs.filter((s) => s.registered).map((s) => `@property ${s.name} { syntax: '<number>'; inherits: true; initial-value: ${num(s.default)}; }`),
    ...measuredUnits(structure).map((u) => `@property --_fluid-m-${u} { syntax: '<length>'; inherits: true; initial-value: 1000px; }`)
  ].join('\n')
  const media = bandMedia(structure)
  const rules = []
  rules.push({
    media: null,
    comment: `${bandBlurb(structure, 'phone')} (the default band)`,
    pairs: [...(buildId ? [['--fluid-build', `"${buildId}"`]] : []), ...bandVars(structure, 'phone', specs)]
  })
  rules.push({ media: null, comment: 'the formulas, written once — every band only changes the parameters above', pairs: formulas(structure, specs, aliases) })
  for (const band of BAND_NAMES.slice(1)) {
    if (!media[band]) continue
    const pairs = bandVars(structure, band, specs)
    if (band === 'desktop' && aliases && structure.bands.phone.enabled) pairs.push(['--fluid-column', 'none'])
    rules.push({ media: media[band], comment: bandBlurb(structure, band), pairs })
  }
  return { properties, rules }
}

/** The engine as plain CSS. */
export function engineCss(structure, opts = {}) {
  const sel = scopeSelector(structure.prefix)
  const { properties, rules } = engineParts(structure, opts)
  const blocks = rules.map((r) => {
    const c = `/* ${r.comment} */\n`
    if (!r.media) return `${c}${sel} {\n${decls(r.pairs, '  ')}\n}`
    return `${c}@media ${r.media} {\n  ${sel.replace(/\n/g, '\n  ')} {\n${decls(r.pairs, '    ')}\n  }\n}`
  })
  return `/* Settings: every tuning number, registered with its default. Override any of
   them in your own :root (see settings.reference.css) — no regenerate. */
${properties}

${blocks.join('\n\n')}
`
}

/** fluid-text's unit for a drawn size expression: --fluid, blended toward
 * --fluid-z by the size's share of browser zoom (all of it up to
 * --fluid-zoom-text-full, none from --fluid-zoom-text-none), because its box
 * does not zoom and big type zoomed inside it runs over its neighbours. */
export function textUnitExpr(structure, sizeExpr) {
  if (!structure.zoom) return 'var(--fluid)'
  const full = 'var(--fluid-zoom-text-full, 24)'
  const none = 'var(--fluid-zoom-text-none, 48)'
  return `(var(--fluid) + (var(--fluid-z) - var(--fluid)) * max(0, min(1, (${none} - ${sizeExpr}) / (${none} - ${full}))))`
}
