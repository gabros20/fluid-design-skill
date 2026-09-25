// spec.mjs — the ONE place every fluid-design name and default lives.
//
// Two kinds of thing, split by one rule (references/config.md):
//
//   STRUCTURE  changes which CSS rules exist         fluid.config.json, regenerate
//   SETTINGS   changes a number inside those rules    a CSS variable, live, no regenerate
//
// Everything else is generated from this file: the JSON Schema, the
// `@property` registrations and their `var()` fallbacks, the settings
// reference, fluid.ts's SETTINGS table, the settings lint and the docs
// table. `fluid check` fails if any of those drift from it.

export const SKILL_VERSION = '2.0.0'
export const CONFIG_VERSION = 2

export const BAND_NAMES = ['phone', 'tablet', 'landscape', 'desktop']
export const MOBILE_BANDS = ['phone', 'tablet', 'landscape']
export const UTILITY_FAMILIES = ['negative', 'logical', 'basis', 'scroll', 'space', 'rounded']
export const STACKS = ['tailwind-v4', 'css', 'scss', 'stylex']
export const INTEGRATIONS = ['none', 'next', 'vite']

// Names a custom type role may not take: they are units, utilities or
// settings words already, and `fluid-<role>-*` would collide with them.
export const RESERVED_ROLE_NAMES = new Set([
  'fluid', 'z', 'ui', 'chrome', 'text', 'container', 'column', 'zoom', 'scope', 'cap', 'build',
  'phone', 'tablet', 'landscape', 'desktop', 'header', 'base', 'scale', 'fit',
  'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'ms', 'me',
  'gap', 'w', 'h', 'size', 'min', 'max', 'inset', 'top', 'right', 'bottom', 'left', 'start', 'end',
  'translate', 'basis', 'scroll', 'space', 'rounded', 'grow', 'shrink', 'off', 'step', 'width', 'until'
])

// ── structure: fluid.config.json ────────────────────────────────────────
//
// A tiny descriptor language, just enough for this config:
//   { type: 'boolean' | 'number' | 'string' | 'const' | 'roles' | 'object', ... }
//   toggle: true on an object means the user may also write `true`/`false`
//   for it (true = the defaults, false = { enabled: false }).

const px = (doc, dflt, extra = {}) => ({ type: 'number', min: 1, integer: true, default: dflt, doc, ...extra })

export const STRUCTURE = {
  type: 'object',
  props: {
    $schema: { type: 'string', optional: true, doc: 'Path to fluid.config.schema.json, for editor autocomplete.' },
    version: { type: 'const', value: CONFIG_VERSION, default: CONFIG_VERSION, doc: 'Config format version. A file without it is read as v1 and migrated (`fluid migrate`).' },
    prefix: { type: 'string', pattern: '^[a-z][a-z0-9-]*$', default: 'fluid', doc: 'Utility, class, variant and Sass function prefix. Custom-property names never change with it.' },
    bands: {
      type: 'object',
      doc: 'Which bands exist and where they switch. Cascade order: phone, tablet, landscape, desktop.',
      props: {
        phone: {
          type: 'object', toggle: true,
          doc: 'Portrait phones: the mobile artboard, scaled. false = a flat 1px below desktop (no mobile scaling).',
          props: { enabled: { type: 'boolean', default: true, doc: 'Scale the mobile design on phones.' } }
        },
        tablet: {
          type: 'object', toggle: true,
          doc: 'The phone design scaled up for portrait tablets and wide phones.',
          props: {
            enabled: { type: 'boolean', default: true, doc: 'Turn the tablet band on.' },
            minWidth: px('Viewport width (CSS px) where the tablet band starts.', 600)
          }
        },
        landscape: {
          type: 'object', toggle: true,
          doc: 'A phone on its side: the phone design, scaled a bit. Wins over tablet when both match.',
          props: {
            enabled: { type: 'boolean', default: true, doc: 'Turn the landscape band on.' },
            maxHeight: px('Landscape viewports this short or shorter (CSS px) are a phone on its side.', 500)
          }
        },
        desktop: {
          type: 'object',
          doc: 'The desktop artboard, scaled. Every width from minWidth up.',
          props: { minWidth: px('Viewport width (CSS px) where the desktop design takes over; the Tailwind lg: breakpoint is set to it.', 1024) }
        }
      }
    },
    roles: {
      type: 'roles', default: ['display', 'copy'],
      doc: 'Damped type roles. Each becomes --fluid-<role>, a fluid-<role>-* text utility and fluidPx(n, "<role>"). Add e.g. "caption".'
    },
    ui: { type: 'boolean', default: true, doc: 'Emit --fluid-ui, the unit for the header, nav and footer: follows width, never shrinks for a short window.' },
    zoom: { type: 'boolean', default: true, doc: 'Browser-zoom compensation: type reads --fluid-z so text grows with Cmd/Ctrl +.' },
    output: {
      type: 'object',
      doc: 'What `fluid generate` writes, and where.',
      props: {
        dir: { type: 'string', default: 'src/styles/fluid', doc: 'Output folder, relative to this config file. Generated; never edit inside it.' },
        stack: { type: 'string', enum: STACKS, default: 'tailwind-v4', doc: 'Styling stack.' },
        base: { type: 'boolean', default: true, doc: 'Include base.css (box-sizing, overflow guard, focus ring) in fluid.css as layer(base). Brownfield: often false.' },
        integration: { type: 'string', enum: INTEGRATIONS, default: 'none', doc: 'Emit a head-script integration for browser zoom: next (<FluidHead/>) or vite (fluidPlugin()).' }
      }
    },
    tailwind: {
      type: 'object',
      doc: 'Tailwind v4 stack only.',
      props: {
        breakpoints: { type: 'string', enum: ['ladder', 'none'], default: 'ladder', doc: 'ladder: emit the whole sm-2xl ladder in px with lg = the desktop band (v4 cannot sort mixed px/rem). none: leave @theme breakpoints to you.' },
        variants: { type: 'boolean', default: true, doc: 'Emit the band variants below desktop: <prefix>-phone:, <prefix>-tablet:, <prefix>-landscape: (desktop is lg:). Do not mix one with sm:/md: on a property: a band variant always wins.' },
        utilities: {
          type: 'object',
          doc: 'Optional utility families.',
          props: {
            negative: { type: 'boolean', default: true, doc: 'Leading-minus negatives: -fluid-mt-8.' },
            logical: { type: 'boolean', default: true, doc: 'ps/pe/ms/me/start/end/inset-x/inset-y.' },
            basis: { type: 'boolean', default: true, doc: 'fluid-basis-*.' },
            scroll: { type: 'boolean', default: true, doc: 'scroll-mt/pt/mb/pb.' },
            space: { type: 'boolean', default: true, doc: 'fluid-space-x/y-*.' },
            rounded: { type: 'boolean', default: true, doc: 'Scaled radii: fluid-rounded-*.' }
          }
        }
      }
    },
    aliases: { type: 'boolean', default: false, doc: 'Also emit the older names in every stack: --fluid-chrome, --fluid-column, --header-h, --safe-top, --safe-bottom, --browser-bar, fluid-frame (class/mixin), fluid-chrome() and fluid-up (SCSS), ENGAGE_PX/ENGAGE_QUERY (fluid.ts), the chrome unit (fluidPx). `fluid migrate` turns this on.' }
  }
}

function defaultsOf(node) {
  if (node.type === 'object') {
    const out = {}
    for (const [k, child] of Object.entries(node.props)) {
      if (child.optional) continue
      out[k] = defaultsOf(child)
    }
    return out
  }
  if (node.type === 'roles') return [...node.default]
  return node.default
}

export function structureDefaults() {
  return defaultsOf(STRUCTURE)
}

// ── validation, with paths and did-you-mean ─────────────────────────────

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

export function didYouMean(name, candidates) {
  let best = null
  let bestD = Infinity
  for (const c of candidates) {
    const dist = editDistance(name, c)
    if (dist < bestD) {
      bestD = dist
      best = c
    }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(name.length / 4)) ? best : null
}

export class ConfigError extends Error {
  constructor(problems) {
    super(`[fluid-design] invalid fluid.config.json:\n${problems.map((p) => `  ${p}`).join('\n')}`)
    this.problems = problems
  }
}

/** Merge a user structure over the defaults, validating as it goes.
 * Returns the full, normalised structure; throws ConfigError listing every
 * problem (not just the first). */
export function normaliseStructure(input = {}) {
  const problems = []
  const out = walk(STRUCTURE, input, '', problems)
  if (!problems.length) crossCheck(out, problems)
  if (problems.length) throw new ConfigError(problems)
  return out
}

function walk(node, value, path, problems) {
  const at = path || '(root)'
  if (node.type === 'object') {
    if (node.toggle && typeof value === 'boolean') value = { enabled: value }
    if (value === undefined) value = {}
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      problems.push(`${at}: expected ${node.toggle ? 'true, false or an object' : 'an object'}, got ${JSON.stringify(value)}`)
      return defaultsOf(node)
    }
    const out = {}
    const known = Object.keys(node.props)
    for (const key of Object.keys(value)) {
      if (!known.includes(key)) {
        const hint = didYouMean(key, known)
        problems.push(`${path ? path + '.' : ''}${key}: unknown key${hint ? ` — did you mean "${hint}"?` : ''} (known: ${known.filter((k) => k !== '$schema').join(', ')})`)
      }
    }
    for (const [key, child] of Object.entries(node.props)) {
      if (child.optional && value[key] === undefined) continue
      out[key] = walk(child, value[key], path ? `${path}.${key}` : key, problems)
    }
    return out
  }
  if (value === undefined) return node.type === 'roles' ? [...node.default] : node.default
  switch (node.type) {
    case 'const':
      if (value !== node.value) problems.push(`${at}: must be ${JSON.stringify(node.value)}, got ${JSON.stringify(value)}`)
      return node.value
    case 'boolean':
      if (typeof value !== 'boolean') problems.push(`${at}: expected true or false, got ${JSON.stringify(value)}`)
      return value
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${at}: expected a number, got ${JSON.stringify(value)}`)
      else if (node.integer && !Number.isInteger(value)) problems.push(`${at}: expected a whole number of px, got ${value}`)
      else if (node.min !== undefined && value < node.min) problems.push(`${at}: must be >= ${node.min}, got ${value}`)
      return value
    case 'string':
      if (typeof value !== 'string') problems.push(`${at}: expected a string, got ${JSON.stringify(value)}`)
      else if (node.enum && !node.enum.includes(value)) {
        const hint = didYouMean(value, node.enum)
        problems.push(`${at}: must be one of ${node.enum.map((e) => JSON.stringify(e)).join(', ')}, got ${JSON.stringify(value)}${hint ? ` — did you mean "${hint}"?` : ''}`)
      } else if (node.pattern && !new RegExp(node.pattern).test(value)) problems.push(`${at}: must match /${node.pattern}/, got ${JSON.stringify(value)}`)
      return value
    case 'roles': {
      if (!Array.isArray(value) || value.length === 0) {
        problems.push(`${at}: expected a non-empty list of role names, e.g. ["display", "copy"]`)
        return [...node.default]
      }
      const seen = new Set()
      for (const r of value) {
        if (typeof r !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(r)) problems.push(`${at}: role ${JSON.stringify(r)} must be lowercase kebab-case`)
        // The first segment too: min-w, gap-x, ui-text, grow-until would
        // collide with a utility family (fluid-min-w-*) or a unit.
        else if (RESERVED_ROLE_NAMES.has(r) || RESERVED_ROLE_NAMES.has(r.split('-')[0])) problems.push(`${at}: "${r}" is reserved (${RESERVED_ROLE_NAMES.has(r) ? 'it is' : `"${r.split('-')[0]}" is`} already a unit, utility or setting word); pick another name`)
        else if (seen.has(r)) problems.push(`${at}: "${r}" is listed twice`)
        seen.add(r)
      }
      return [...value]
    }
    default:
      throw new Error(`spec: unknown node type ${node.type}`)
  }
}

function crossCheck(s, problems) {
  const b = s.bands
  const d = b.desktop.minWidth
  if (b.tablet.enabled && b.tablet.minWidth >= d) problems.push(`bands.tablet.minWidth (${b.tablet.minWidth}) must be below bands.desktop.minWidth (${d})`)
  if (!b.phone.enabled && (b.tablet.enabled || b.landscape.enabled)) {
    problems.push('bands.phone is false (flat 1px below desktop), so bands.tablet and bands.landscape must be false too: both scale the phone design')
  }
}

// ── JSON Schema, generated ──────────────────────────────────────────────

function schemaOf(node) {
  const base = node.doc ? { description: node.doc } : {}
  switch (node.type) {
    case 'object': {
      const obj = {
        ...base,
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(Object.entries(node.props).map(([k, c]) => [k, schemaOf(c)]))
      }
      return node.toggle ? { ...base, oneOf: [{ type: 'boolean' }, { ...obj, description: undefined }] } : obj
    }
    case 'const':
      return { ...base, const: node.value }
    case 'boolean':
      return { ...base, type: 'boolean', default: node.default }
    case 'number':
      return { ...base, type: node.integer ? 'integer' : 'number', ...(node.min !== undefined ? { minimum: node.min } : {}), default: node.default }
    case 'string':
      return { ...base, type: 'string', ...(node.enum ? { enum: node.enum } : {}), ...(node.pattern ? { pattern: node.pattern } : {}), ...(node.default !== undefined ? { default: node.default } : {}) }
    case 'roles':
      return { ...base, type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$', not: { enum: [...RESERVED_ROLE_NAMES] } }, default: node.default }
  }
}

export function jsonSchema() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://github.com/gabros20/fluid-design-skill/fluid.config.schema.json',
    title: 'fluid-design structure config (v2)',
    description: 'Structure only: which bands exist, their breakpoints, type roles, output. Every tuning number is a CSS variable (settings.reference.css).',
    ...schemaOf(STRUCTURE),
    required: ['version']
  }
}

// ── settings: the CSS variables ─────────────────────────────────────────
//
// Every setting is `--fluid-<band>-<key>` or `--fluid-<key>`. Numbers only.
// `registered` settings get an @property with their default as initial-value;
// `optional` ones stay unregistered so "unset" can mean "off".

const ROLE_DAMPING = {
  display: { mobile: 0.85, desktop: 0.62 },
  copy: { mobile: 0.6, desktop: 0.33 }
}

const BAND_DEFAULTS = {
  phone: { 'base-width': 390, 'scale-min': 0.82, 'scale-max': 1.1, 'container-width': 560, 'container-padding': 24, 'header-height': 34 },
  tablet: { 'base-width': 700, 'scale-min': 1.1, 'scale-max': 1.3, 'container-width': 560, 'container-padding': 24, 'header-height': 34 },
  landscape: { 'base-width': 780, 'scale-min': 1, 'scale-max': 1.2, 'container-width': 560, 'container-padding': 24, 'header-height': 34 },
  desktop: { 'base-width': 1440, 'base-height': 900, 'fit-height': 1, 'scale-min': 0.58, 'container-width': 1680, 'container-padding': 80, 'header-height': 48 }
}

const BAND_BLURB = {
  phone: (s) => `phone — portrait phones: your phone design frame (default ${BAND_DEFAULTS.phone['base-width']} wide)`,
  tablet: (s) => `tablet — ${s.bands.tablet.minWidth}px and wider: the phone design, scaled up`,
  landscape: (s) => `landscape — a phone on its side (${s.bands.landscape.maxHeight}px tall or less): the phone design, scaled a bit`,
  desktop: (s) => `desktop — ${s.bands.desktop.minWidth}px and wider: your desktop design frame (default ${BAND_DEFAULTS.desktop['base-width']}×${BAND_DEFAULTS.desktop['base-height']})`
}
export function bandBlurb(structure, band) {
  if (band === 'phone' && !structure.bands.phone.enabled) return `below ${structure.bands.desktop.minWidth}px — flat 1px, no mobile scaling (bands.phone is false)`
  return BAND_BLURB[band](structure)
}

/** The full settings list for a structure: [{ name, band, key, role?, default,
 * min, max, registered, optional, doc, v1? }]. Order is stable and is the
 * order every generated file lists them in. */
export function settingsSpec(structure) {
  const s = structure
  const list = []
  const add = (band, key, spec) => list.push({ name: band ? `--fluid-${band}-${key}` : `--fluid-${key}`, band, key, registered: !spec.optional, ...spec })
  const flat = !s.bands.phone.enabled
  for (const band of BAND_NAMES) {
    if (band === 'tablet' && !s.bands.tablet.enabled) continue
    if (band === 'landscape' && !s.bands.landscape.enabled) continue
    const d = BAND_DEFAULTS[band]
    const mobile = band !== 'desktop'
    if (band === 'phone' && flat) {
      add(band, 'container-width', { default: BAND_DEFAULTS.desktop['container-width'], min: 0, doc: 'page container max width below desktop, CSS px (flat: nothing scales here)' })
      add(band, 'container-padding', { default: d['container-padding'], min: 0, doc: 'page container side padding below desktop, CSS px' })
      add(band, 'header-height', { default: d['header-height'], min: 0, doc: 'header row height below desktop, CSS px' })
      continue
    }
    add(band, 'base-width', { default: d['base-width'], min: 1, doc: band === 'phone' || band === 'desktop' ? 'your design frame\'s width: at this window width 1 drawn px = 1 CSS px' : 'viewport width where the phone design is drawn 1:1 in this band' })
    if (!mobile) {
      add(band, 'base-height', { default: d['base-height'], min: 1, doc: 'your design frame\'s height: a section drawn this tall fits the window exactly' })
      add(band, 'fit-height', { default: d['fit-height'], min: 0, max: 1, integer: true, doc: '1 = a section drawn as tall as the artboard always fits the window; 0 = scale by width only' })
    }
    add(band, 'scale-min', { default: d['scale-min'], min: 0.01, doc: mobile ? 'the unit never goes below this (smallest phones stop shrinking)' : 'the unit never goes below this (small, short windows stop shrinking)' })
    if (mobile) add(band, 'scale-max', { default: d['scale-max'], min: 0.01, doc: 'the unit never goes above this' })
    else add(band, 'scale-max', { default: null, optional: true, min: 0.01, doc: 'optional ceiling: stop growing on huge screens (unset = no ceiling)' })
    for (const role of s.roles) {
      const damp = ROLE_DAMPING[role] ?? ROLE_DAMPING.copy
      add(band, `${role}-damping`, { role, default: mobile ? damp.mobile : damp.desktop, min: 0, max: 1, doc: `${role} type: 1 = shrinks with the layout, 0 = never shrinks below its drawn size` })
      // Desktop only: on a mobile band the knee is scale-min, so a floor
      // could only bind above scale-min, which the damping says better.
      if (!mobile) add(band, `${role}-floor`, { role, default: null, optional: true, min: 0.01, doc: `optional hard minimum for ${role} type, as a scale factor (unset = none; the damping already holds type up)` })
    }
    // Tablet and landscape share the phone's container and header unless
    // set: optional there, falling back to the phone value.
    const shared = band === 'tablet' || band === 'landscape'
    const sh = (spec) => (shared ? { ...spec, default: null, optional: true, fallback: `--fluid-phone-${spec.key}`, doc: `${spec.doc} (unset = the phone value)` } : spec)
    const addS = (key, spec) => add(band, key, sh({ key, ...spec }))
    addS('container-width', { default: d['container-width'], min: 0, doc: mobile ? 'the content box\'s widest size, side margins included, drawn px (holds the phone design to a column on wide screens)' : 'the content box\'s widest size, side margins included, drawn px (grows with the unit, never below this in CSS px)' })
    addS('container-padding', { default: d['container-padding'], min: 0, doc: 'page container side padding, drawn px' })
    addS('header-height', { default: d['header-height'], min: 0, doc: mobile ? 'header row height, CSS px (not scaled on mobile)' : `header row height, drawn px (scaled by ${s.ui ? '--fluid-ui' : '--fluid'})` })
  }
  add(null, 'header-inset', { default: 24, min: 0, doc: 'space above the header row, drawn px (plus the safe-area inset)' })
  // Limits, in WINDOW px. Usually set on an element by a utility
  // (fluid-grow-until-1680, fluid-shrink-until-1280, fluid-off), which
  // also makes it a scope; on :root they limit the whole page. A width limit
  // applies in the band that contains that width, so a desktop width never
  // touches the phone bands and a phone width never touches desktop.
  add(null, 'grow-until', { default: null, optional: true, min: 1, integer: true, doc: 'window width (CSS px) past which the units stop growing: they keep the size they had at that width (unset = no limit)' })
  add(null, 'shrink-until', { default: null, optional: true, min: 1, integer: true, doc: 'window width (CSS px) below which the units stop shrinking (unset = no limit). Overrides fit-height: a section sized to the screen can then outgrow a short window' })
  if (s.ui) add(null, 'ui-grow-until', { default: null, optional: true, min: 1, integer: true, doc: 'window width past which --fluid-ui stops growing. On :root it keeps the header, nav and footer (and --fluid-header-h) at their size at that width' })
  add(null, 'off', { default: null, optional: true, min: 0, max: 1, integer: true, doc: '1 = nothing scales here: every drawn px is one CSS px (browser zoom still works)' })
  // Read by fluid-text (Tailwind utility, SCSS/StyleX helper); plain CSS has no fluid-text.
  if (s.zoom && s.output.stack !== 'css') {
    add(null, 'zoom-text-full', { default: 24, min: 0, doc: 'fluid-text at or below this drawn size zooms fully with browser zoom' })
    add(null, 'zoom-text-none', { default: 48, min: 1, doc: 'fluid-text at or above this drawn size keeps fitting its box instead' })
  }
  return list
}

/** The unit custom properties the engine OWNS (a user declaring one of these
 * overrides the generated unit; the lint warns). */
export function unitNames(structure) {
  return [
    '--fluid', '--fluid-z',
    ...structure.roles.map((r) => `--fluid-${r}`),
    '--fluid-ui', '--fluid-container-width', '--fluid-container-padding',
    '--fluid-header-h', '--fluid-safe-top', '--fluid-safe-bottom', '--fluid-browser-bar',
    '--fluid-chrome', '--fluid-column',
    '--fluid-zoom', '--fluid-build'
  ]
}
