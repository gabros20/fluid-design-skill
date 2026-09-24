// model.mjs — structure + settings in, numbers out.
//
//   loadProject(path)          fluid.config.json (v2, or v1 migrated) -> { structure, settings, migration, dir }
//   resolveSettings(s, over)   defaults + overrides -> { name: { value, source } }
//   bandAt(s, w, h)            which band a viewport lands in (same precedence as the CSS)
//   evaluate(s, values, w, h, zoom)  every unit at a viewport, in CSS px per drawn px
//
// evaluate() mirrors the generated engine (emit/engine.mjs) formula for
// formula; the browser matrix checks the two against each other.

import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { normaliseStructure, settingsSpec, structureDefaults, ConfigError, CONFIG_VERSION } from './spec.mjs'

// ── loading ─────────────────────────────────────────────────────────────

export function readJson(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new ConfigError([`could not read ${path}: ${err.code ?? err.message}`])
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new ConfigError([`${path} is not valid JSON: ${err.message}`])
  }
}

/** A v1 config has no `version`; any file with v1-only keys is v1 too. */
export function isV1(json) {
  if (json.version === CONFIG_VERSION) return false
  if (json.version !== undefined) return false // let validation report the bad version
  return true
}

/** Load a project config. `path` undefined = the built-in defaults. A v1
 * file is migrated in memory; `migration` lists what moved where. */
export function loadProject(path) {
  if (path === undefined) return { structure: normaliseStructure({}), settings: {}, migration: null, dir: process.cwd() }
  const json = readJson(path)
  const dir = dirname(resolvePath(path))
  if (isV1(json)) {
    const m = migrateV1(json)
    return { structure: normaliseStructure(m.structure), settings: m.settings, migration: m, dir }
  }
  return { structure: normaliseStructure(json), settings: {}, migration: null, dir }
}

// ── v1 migration ────────────────────────────────────────────────────────

const V1_KEYS = new Set(['$schema', 'prefix', 'reference', 'canvas', 'engageAt', 'heightAxis', 'units', 'ceiling', 'mobile', 'utilities', 'zoomCompensation', 'zoomTextRange'])

/** v1 config JSON -> { structure (v2 JSON), settings { name: value } (only
 * values that differ from the v2 defaults), notes [string] }. */
export function migrateV1(v1) {
  const problems = Object.keys(v1).filter((k) => !V1_KEYS.has(k)).map((k) => `${k}: unknown v1 key`)
  if (problems.length) throw new ConfigError(problems)
  const notes = []
  const mobileOn = v1.mobile?.enabled === true
  const mo = v1.mobile ?? {}
  const engageAt = v1.engageAt ?? 1024
  const structure = {
    version: CONFIG_VERSION,
    prefix: v1.prefix ?? 'fluid',
    bands: {
      phone: mobileOn,
      tablet: mobileOn && mo.tablet?.enabled !== false ? { minWidth: mo.tablet?.from ?? 600 } : false,
      landscape: mobileOn && mo.landscape?.enabled !== false ? { maxHeight: mo.landscape?.maxHeight ?? 500 } : false,
      desktop: { minWidth: engageAt }
    },
    roles: ['display', 'copy'],
    ui: v1.units?.chrome?.enabled ?? true,
    zoom: v1.zoomCompensation ?? true,
    aliases: true,
    ...(v1.utilities ? { tailwind: { utilities: { ...v1.utilities } } } : {})
  }
  notes.push(`engageAt ${engageAt} -> bands.desktop.minWidth`)
  if (!mobileOn) notes.push('mobile arm off -> bands.phone: false (flat 1px below desktop). v1 .fluid-frame stepped its padding 24px -> 32px at 640px; v2 uses one --fluid-phone-container-padding (24). Add your own sm: class if you relied on the step.')
  if (v1.units?.chrome?.enabled === false) notes.push('units.chrome.enabled false -> ui: false')
  notes.push('aliases: true keeps --fluid-chrome, --fluid-column and fluid-frame working')

  const s = normaliseStructure(structure)
  const defaults = Object.fromEntries(settingsSpec(s).map((x) => [x.name, x.default]))
  const settings = {}
  const set = (name, value, from) => {
    if (value === undefined || value === null) return
    if (!(name in defaults)) return
    if (defaults[name] === value) return
    settings[name] = value
    notes.push(`${from} ${value} -> ${name}`)
  }
  const ref = v1.reference ?? {}
  set('--fluid-desktop-base-width', ref.width, 'reference.width')
  set('--fluid-desktop-base-height', ref.height, 'reference.height')
  if (v1.heightAxis === false) {
    set('--fluid-desktop-fit-height', 0, 'heightAxis false')
    notes.push('heightAxis false: --fluid-ui now scales by width only too (v1 chrome still read the height, so a short wide window kept the header at 1x while the layout grew)')
  }
  set('--fluid-desktop-scale-min', v1.units?.fluid?.floor, 'units.fluid.floor')
  set('--fluid-desktop-scale-max', v1.ceiling ?? undefined, 'ceiling')
  for (const role of ['display', 'copy']) {
    const u = v1.units?.[role] ?? {}
    set(`--fluid-desktop-${role}-damping`, u.damping, `units.${role}.damping`)
    if (typeof u.floor === 'number') set(`--fluid-desktop-${role}-floor`, u.floor, `units.${role}.floor`)
  }
  const canvas = v1.canvas ?? {}
  set('--fluid-desktop-container-width', canvas.width, 'canvas.width')
  set('--fluid-desktop-container-padding', canvas.gutter, 'canvas.gutter')
  if (!mobileOn && canvas.width !== undefined) set('--fluid-phone-container-width', canvas.width, 'canvas.width (below desktop)')
  if (mobileOn) {
    set('--fluid-phone-base-width', mo.reference, 'mobile.reference')
    set('--fluid-phone-scale-min', mo.min, 'mobile.min')
    set('--fluid-phone-scale-max', mo.max, 'mobile.max')
    for (const band of ['phone', 'tablet', 'landscape']) {
      for (const role of ['display', 'copy']) set(`--fluid-${band}-${role}-damping`, mo.damping?.[role], `mobile.damping.${role}`)
      if (band !== 'phone' && mo.column !== undefined) set(`--fluid-${band}-container-width`, mo.column === null ? canvas.width ?? 1680 : mo.column, 'mobile.column')
    }
    for (const band of ['tablet', 'landscape']) {
      const b = mo[band] ?? {}
      set(`--fluid-${band}-base-width`, b.reference, `mobile.${band}.reference`)
      set(`--fluid-${band}-scale-min`, b.min, `mobile.${band}.min`)
      set(`--fluid-${band}-scale-max`, b.max, `mobile.${band}.max`)
    }
  }
  if (Array.isArray(v1.zoomTextRange)) {
    set('--fluid-zoom-text-full', v1.zoomTextRange[0], 'zoomTextRange[0]')
    set('--fluid-zoom-text-none', v1.zoomTextRange[1], 'zoomTextRange[1]')
  }
  return { structure, settings, notes }
}

// ── settings resolution ─────────────────────────────────────────────────

/** defaults + overrides -> { name: { value, source, spec } }. `overrides`
 * is { name: value } or { name: { value, source } } (from the settings
 * parser, which carries file:line). */
export function resolveSettings(structure, overrides = {}) {
  const out = {}
  for (const spec of settingsSpec(structure)) {
    const o = overrides[spec.name]
    if (o === undefined) out[spec.name] = { value: spec.default, source: 'default', spec }
    else if (typeof o === 'object' && o !== null) out[spec.name] = { value: o.value, source: o.source ?? 'override', spec }
    else out[spec.name] = { value: o, source: 'override', spec }
  }
  return out
}

const valuesOf = (resolved) => Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, v.value]))

// ── bands ───────────────────────────────────────────────────────────────

/** Media queries for the engine's band blocks (cascade order after :root). */
export function bandMedia(structure) {
  const b = structure.bands
  return {
    tablet: b.tablet.enabled ? `(width >= ${b.tablet.minWidth}px)` : null,
    landscape: b.landscape.enabled ? `(orientation: landscape) and (height <= ${b.landscape.maxHeight}px)` : null,
    desktop: `(width >= ${b.desktop.minWidth}px)`
  }
}

/** Mutually exclusive media queries, one per band: what the Tailwind band
 * variants, the SCSS band mixins and fluid.ts's MEDIA use. */
export function exclusiveMedia(structure) {
  const b = structure.bands
  const D = b.desktop.minWidth
  const land = b.landscape.enabled ? `(orientation: landscape) and (height <= ${b.landscape.maxHeight}px)` : null
  const notLand = land ? ` and (not (${land}))` : ''
  const out = { desktop: `(width >= ${D}px)` }
  if (b.tablet.enabled) out.tablet = `(${b.tablet.minWidth}px <= width < ${D}px)${notLand}`
  if (land) out.landscape = `(width < ${D}px) and ${land}`
  out.phone = `(width < ${b.tablet.enabled ? b.tablet.minWidth : D}px)${notLand}`
  return out
}

export function bandAt(structure, w, h) {
  const b = structure.bands
  if (w >= b.desktop.minWidth) return 'desktop'
  if (b.landscape.enabled && w > h && h <= b.landscape.maxHeight) return 'landscape'
  if (b.tablet.enabled && w >= b.tablet.minWidth) return 'tablet'
  return 'phone'
}

// ── evaluate ────────────────────────────────────────────────────────────

/**
 * Every unit at a viewport w×h (CSS px), with the zoom fluid-zoom.js would
 * write. `values` is { settingName: number|null } (resolveSettings()'s
 * values, or valuesOf it). Returns CSS px per drawn px, plus container and
 * header in CSS px:
 *   { band, fluid, fluidZ, roles: { display, copy, … }, ui, containerWidth, containerPadding, headerHeight }
 */
export function evaluate(structure, values, w, h, zoom = 1, band = bandAt(structure, w, h)) {
  const v = values && Object.values(values)[0]?.value !== undefined ? valuesOf(values) : values
  const z = structure.zoom ? zoom : 1
  const g = (key) => v[`--fluid-${band}-${key}`]
  const inset = v['--fluid-header-inset']

  if (band === 'phone' && !structure.bands.phone.enabled) {
    const roles = Object.fromEntries(structure.roles.map((r) => [r, 1]))
    return { band, fluid: 1, fluidZ: 1, roles, ui: 1, containerWidth: g('container-width'), containerPadding: g('container-padding'), headerHeight: inset + g('header-height') }
  }

  const desktop = band === 'desktop'
  const baseW = g('base-width')
  const baseH = desktop ? g('base-height') : baseW
  const fitH = desktop ? g('fit-height') : 0
  const min = g('scale-min')
  const max = g('scale-max') ?? Infinity
  const arms = (zz) => {
    const wa = (w * zz) / baseW
    const ha = fitH ? (h * zz) / baseH : Infinity
    return { wa, ha }
  }
  const unit = ({ wa, ha }) => Math.max(min, Math.min(ha, wa, max))
  const a1 = arms(1)
  const fluid = unit(a1)
  const fluidZ = unit(arms(z))
  const knee = desktop ? structure.bands.desktop.minWidth / baseW : min
  const roles = {}
  for (const r of structure.roles) {
    const d = g(`${r}-damping`)
    const floor = g(`${r}-floor`) ?? 0
    roles[r] = Math.max(fluidZ, d * Math.max(fluidZ, knee) + (1 - d), floor)
  }
  const ui = structure.ui ? Math.max(desktop ? 0 : min, Math.min(a1.wa, Math.max(1, a1.ha), max)) : fluid
  const cw = g('container-width')
  return {
    band,
    fluid,
    fluidZ,
    roles,
    ui,
    containerWidth: desktop ? Math.max(cw, cw * fluid) : cw * fluid,
    containerPadding: g('container-padding') * fluid,
    headerHeight: inset * fluid + (desktop ? g('header-height') * ui : g('header-height'))
  }
}

/** Convenience: evaluate with the defaults (plus optional overrides). */
export function evaluateDefaults(structure, w, h, zoom = 1, overrides = {}) {
  return evaluate(structure, valuesOf(resolveSettings(structure, overrides)), w, h, zoom)
}

export { valuesOf, structureDefaults }
