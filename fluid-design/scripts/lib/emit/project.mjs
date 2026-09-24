// project.mjs — assemble everything `fluid generate` writes into output.dir.
//
//   fluid.css                the ONE import: base (layer), engine, and for
//                            Tailwind the theme + utilities too
//   base.css                 box-sizing, overflow guard, focus ring (output.base)
//   settings.reference.css   every setting, commented, with its default (never imported)
//   fluid.css-data.json      editor autocomplete for the settings (VS Code css.customData)
//   fluid.ts                 typed structure + SETTINGS + fluidPx re-export
//   cn.ts                    tailwind-merge groups (tailwind-v4)
//   _index.scss              functions + band mixins (scss): @use 'fluid' as fd
//   fluid.stylex.ts          typed helpers (stylex)
//   runtime/…                zoom + units runtime, stamped
//   integrations/…           next.tsx (<FluidHead/>) or vite.ts (fluidPlugin())
//   README.md                how to use it, and why it is built this way

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { settingsSpec, bandBlurb, SKILL_VERSION, BAND_NAMES } from '../spec.mjs'
import { engineCss, num } from './engine.mjs'
import { themeCss, utilitiesCss, cnTs } from './tailwind.mjs'
import { vanillaClassesCss, scss, stylex, fluidTs } from './stacks.mjs'
import { readmeMd } from './readme.mjs'

const RUNTIME_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../assets/runtime')

export function structureHash(structure) {
  return createHash('sha256').update(JSON.stringify(structure)).digest('hex').slice(0, 8)
}

export function fileHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

const stamp = (structure) => `fluid-design ${SKILL_VERSION} · GENERATED from fluid.config.json — do not edit. Run \`fluid generate\`.`
const cssHeader = (structure, what) => `/* ${stamp(structure)}\n   ${what} */\n\n`
const tsHeader = (structure, what) => `// ${stamp(structure)}\n// ${what}\n\n`

// ── settings.reference.css ──────────────────────────────────────────────

export function settingsReferenceCss(structure) {
  const specs = settingsSpec(structure)
  const groups = [...BAND_NAMES.filter((b) => specs.some((s) => s.band === b)), null]
  const width = Math.max(...specs.map((s) => `${s.name}: ${s.default === null ? 'unset' : num(s.default)};`.length)) + 2
  const lines = []
  for (const band of groups) {
    const title = band ? bandBlurb(structure, band) : 'everywhere'
    lines.push('', `  /* ── ${title} ${'─'.repeat(Math.max(3, 74 - title.length))} */`)
    for (const s of specs.filter((x) => x.band === band)) {
      const decl = `${s.name}: ${s.default === null ? 'unset' : num(s.default)};`
      lines.push(`  /* ${decl.padEnd(width)}${s.doc} */`)
    }
  }
  return `${cssHeader(structure, 'settings.reference.css — every setting, with its default. NOT imported.')}/* To change one, copy its line into the :root in your own CSS (globals.css,
   next to your tokens), uncomment it and set the number. Order does not
   matter: the defaults are registered with @property, so your value wins.
   Numbers only, no units. An invalid value falls back to the default.
   \`fluid check\` lints them; \`fluid explain 390x844\` shows what each
   resolves to. Changes apply live: no regenerate. */
:root {${lines.join('\n')}
}
`
}

// ── editor autocomplete for settings ──────────────────────────────────
//
// VS Code's CSS language service (and editors built on it) reads "custom
// data": every setting then completes in any CSS/SCSS declaration, with its
// default and what it does on hover. `fluid init` wires it into
// .vscode/settings.json ("css.customData").
export function cssCustomData(structure) {
  const specs = settingsSpec(structure)
  const properties = specs.map((s) => ({
    name: s.name,
    description: `${s.doc}. Default: ${s.default === null ? 'unset' : num(s.default)}${s.band ? ` (${s.band} band)` : ''}. fluid-design setting: set it in your :root, number only.`
  }))
  return JSON.stringify({ version: 1.1, properties }, null, 2) + '\n'
}

// ── base.css ────────────────────────────────────────────────────────────

export function baseCss(structure) {
  return `${cssHeader(structure, 'base.css — imported by fluid.css as layer(base) when output.base is true.')}/* The render half of a base layer: box-sizing, the overflow guard, iOS
   quirks, focus. Nothing here is a tuning number. */

/* Tailwind's Preflight sets this already; other stacks usually have no reset
   that does, and without it the container's max-width caps the CONTENT box:
   the page renders at max-width + 2 × padding, wider than drawn. */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  /* No rubber-band past the page edge (nothing is painted back there). */
  overscroll-behavior: none;
  /* The horizontal-overflow guard lives HERE and only here: on body, or any
     ancestor of a position: sticky element, it makes that element a scroll
     container with a scroll range of 0 and sticky silently stops working.
     Clip a single element with \`overflow-x: clip\` instead. */
  overflow-x: hidden;
}

body {
  position: relative;
  /* NO background-color here, on purpose: iOS 26 Safari tints its toolbar
     from the page's edge backgrounds, falling back to body's. Let every
     section carry its own surface. */
  min-height: -webkit-fill-available;
}

button,
a,
input,
select,
textarea {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

button:not(:disabled),
[role='button']:not([aria-disabled='true']),
summary {
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
}

/* --focus-ring is a token: define it with your colours. */
:focus-visible {
  outline: 2px solid var(--focus-ring, #2563eb);
  outline-offset: 2px;
}
:focus:not(:focus-visible) {
  outline: none;
}
`
}

// ── fluid.css ───────────────────────────────────────────────────────────

function fluidCss(structure, buildId) {
  const tw = structure.output.stack === 'tailwind-v4'
  const parts = []
  if (structure.output.base) parts.push(`@import './base.css' layer(base);`)
  if (tw) {
    const theme = themeCss(structure)
    if (theme) parts.push(theme)
  }
  parts.push(engineCss(structure, { buildId }).trimEnd())
  parts.push(`/* Settings apply to a subtree too: put class="${structure.prefix}-scope" on an
   element and set any --fluid-* setting on it. */`)
  parts.push(tw ? utilitiesCss(structure) : vanillaClassesCss(structure))
  const importLine = tw ? `@import 'tailwindcss';\n     @import './fluid/fluid.css';` : `@import './fluid/fluid.css';`
  return `${cssHeader(structure, `fluid.css — import this once, globally:
     ${importLine}
   Then set any setting you want to change in your own :root (settings.reference.css).`)}${parts.join('\n\n')}\n`
}

// ── runtime + integrations ──────────────────────────────────────────────

function runtimeFiles(structure) {
  const read = (f) => readFileSync(join(RUNTIME_DIR, f), 'utf8')
  const units = ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
  const head = (c) => `// ${stamp(structure)}\n\n${c}`
  const files = {
    'runtime/units.js': head(read('fluid-units.js').replace(/^var UNITS = .*\/\/ @fluid-units$/m, `var UNITS = [${units.map((u) => `'${u}'`).join(', ')}] // @fluid-units`)),
    'runtime/units.d.ts': head(read('fluid-units.d.ts').replace(/^export type FluidUnit = .*\/\/ @fluid-units$/m, `export type FluidUnit = ${units.map((u) => `'${u}'`).join(' | ')} // @fluid-units`))
  }
  if (structure.zoom) {
    files['runtime/zoom.js'] = head(read('fluid-zoom.js'))
    files['runtime/zoom.d.ts'] = head(read('fluid-zoom.d.ts'))
  }
  return files
}

function integrationFiles(structure) {
  const i = structure.output.integration
  if (i === 'next') {
    return {
      'integrations/next.tsx': `${tsHeader(structure, 'integrations/next.tsx')}${structure.zoom ? `import { FLUID_ZOOM_INLINE } from '../runtime/zoom.js'

/**
 * Browser-zoom compensation for fluid type (WCAG 1.4.4). Render it first in
 * <head> in app/layout.tsx, so a page opened at a remembered zoom level
 * paints its type at the right size from the first frame:
 *
 *   <html><head><FluidHead /></head>…
 */
export function FluidHead() {
  return <script dangerouslySetInnerHTML={{ __html: FLUID_ZOOM_INLINE }} />
}
` : `/** Zoom compensation is off (zoom: false in fluid.config.json); nothing to render. */
export function FluidHead() {
  return null
}
`}`
    }
  }
  if (i === 'vite') {
    return {
      'integrations/vite.ts': `${tsHeader(structure, 'integrations/vite.ts')}import type { Plugin } from 'vite'
${structure.zoom ? `import { FLUID_ZOOM_INLINE } from '../runtime/zoom.js'
` : ''}
/**
 * vite.config.ts:  plugins: [fluidPlugin()]
 *
 * Inlines the browser-zoom runtime as the first classic <script> in <head>
 * (a module script is deferred, so a page opened zoomed would paint small
 * type first and then jump).
 */
export function fluidPlugin(): Plugin {
  return {
    name: 'fluid-design',
    transformIndexHtml() {
      return ${structure.zoom ? `[{ tag: 'script', children: FLUID_ZOOM_INLINE, injectTo: 'head-prepend' }]` : '[]'}
    }
  }
}
`
    }
  }
  return {}
}

// ── everything ──────────────────────────────────────────────────────────

/** { relativePath: content } for a structure. Deterministic. */
export function buildOutput(structure) {
  const buildId = `${SKILL_VERSION}+${structureHash(structure)}`
  const stack = structure.output.stack
  const files = {}
  files['fluid.css'] = fluidCss(structure, buildId)
  if (structure.output.base) files['base.css'] = baseCss(structure)
  files['settings.reference.css'] = settingsReferenceCss(structure)
  files['fluid.css-data.json'] = cssCustomData(structure)
  files['fluid.ts'] = fluidTs(structure, tsHeader(structure, 'fluid.ts — the structure as typed constants.'))
  if (stack === 'tailwind-v4') files['cn.ts'] = cnTs(structure, tsHeader(structure, 'cn.ts — class merging that knows the fluid utilities.'))
  if (stack === 'scss') files['_index.scss'] = scss(structure, `// ${stamp(structure)}\n// _index.scss — functions and band mixins: @use 'fluid' as fd;\n\n`)
  if (stack === 'stylex') files['fluid.stylex.ts'] = stylex(structure, tsHeader(structure, 'fluid.stylex.ts — typed helpers.'))
  Object.assign(files, runtimeFiles(structure), integrationFiles(structure))
  files['README.md'] = readmeMd(structure, Object.keys(files))
  return { files, buildId }
}
