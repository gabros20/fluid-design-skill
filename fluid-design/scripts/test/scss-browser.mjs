#!/usr/bin/env node
// scss-browser.mjs — the generated SCSS stack's `_index.scss` (functions,
// band mixins, the limit/scope mixins fluid-grow-until()/fluid-shrink-until()/
// fluid-ui-grow-until()/fluid-off/fluid-scope, fluid-container, fluid-type,
// and, with aliases on, the v1 alias fluid-up) against model.evaluate(),
// compiled by real Sass and rendered in real browsers.
//
//   node scss-browser.mjs [--browsers chromium,webkit,firefox]
//
// Needs sass and playwright, resolved from the current directory first (run
// it from a project that has both, e.g. examples/pizza-vite-gsap).
//
// buildOutput(structure).files is written to a temp dir INSIDE the cwd (so
// Sass's file-based module resolution works) as fluid/_index.scss,
// fluid/fluid.css, etc. — exactly the layout `@use 'fluid' as fd;` expects
// with that folder's parent on loadPaths. fluid.css (the engine: @property
// registrations + the :root/.fluid-scope formulas) is loaded on the page
// like any consumer would; _index.scss only adds functions and mixins on
// top of it, and the limit/scope mixins re-emit the engine's formulas
// (self-contained, var()-with-fallback) directly onto whatever selector
// includes them, so a wrapper class scopes its children by inheritance.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { normaliseStructure } from '../lib/spec.mjs'
import { evaluateDefaults, bandAt } from '../lib/model.mjs'
import { buildOutput } from '../lib/emit/project.mjs'

const TOL = 5e-5 // per drawn px, ×1000 probes (matches engine-matrix.mjs)
const CTOL = 0.06 // raw-px probes (container, type, band mixins) — a hair over engine-matrix's
// 0.05 cw/cp/hh tolerance: Firefox's computed-style getPropertyValue rounds font-size/line-height
// to a coarser grid than getBoundingClientRect, and a large role/zoom combination can land exactly
// on 0.05 (e.g. 76.75 vs 76.8 at 2560x1440 z1.5) — a real rounding artefact, not drift.
const BANDS = ['phone', 'tablet', 'landscape', 'desktop']

const args = process.argv.slice(2)
const browsers = (args.includes('--browsers') ? args[args.indexOf('--browsers') + 1] : 'chromium,webkit,firefox').split(',')

function loadFromCwd(name, hint) {
  for (const base of [join(process.cwd(), 'package.json'), import.meta.url]) {
    try {
      return createRequire(base)(name)
    } catch {}
  }
  console.error(`${name} not found: run from a project that has it (e.g. ${hint})`)
  process.exit(2)
}
const sass = loadFromCwd('sass', 'examples/pizza-vite-gsap')
const pw = loadFromCwd('playwright', 'examples/pizza-vite-gsap')

const viewports = [[320, 568], [375, 812], [430, 932], [599, 900], [600, 900], [844, 390], [932, 430], [820, 1180], [1023, 700], [1024, 640], [1200, 500], [1280, 1080], [1440, 900], [1440, 700], [1920, 1080], [2560, 1440], [3000, 700]]
const zooms = [1, 1.5]

// ── one probe page per structure ────────────────────────────────────────
//
// checks: [{ id, kind: 'width' | 'computed', computedProps?, expect(w,h,z) -> number | [number,number], scaled }]

function buildStructureCase(label, extra) {
  const structure = normaliseStructure({ version: 2, output: { stack: 'scss' }, ...extra })
  const p = structure.prefix
  const roles = structure.roles
  const ui = structure.ui

  const scss = [`@use 'fluid' as fd;`, `.p { position: fixed; left: 0; top: 0; height: 1px; visibility: hidden; }`]
  const html = []
  const checks = []

  const widthProbe = (id, expr, expect, selPrefix = '') => {
    scss.push(`${selPrefix}#${id} { width: ${expr}; }`)
    html.push(`<div class="p" id="${id}"></div>`)
    checks.push({ id, kind: 'width', scaled: true, expect })
  }

  // functions: fluid(), fluid-<role>() per role, fluid-ui()
  const fnProbes = [['fluid', `fd.${p}(1000)`, (w, h, z) => evaluateDefaults(structure, w, h, z).fluid * 1000]]
  for (const r of roles) fnProbes.push([`role-${r}`, `fd.${p}-${r}(1000)`, (w, h, z) => evaluateDefaults(structure, w, h, z).roles[r] * 1000])
  if (ui) fnProbes.push(['ui', `fd.${p}-ui(1000)`, (w, h, z) => evaluateDefaults(structure, w, h, z).ui * 1000])
  for (const [id, expr, expect] of fnProbes) widthProbe(id, expr, expect)

  // band mixins: one per band, plus the v1 alias fluid-up (= desktop) when aliases are on
  for (const b of BANDS) {
    const id = `band-${b}`
    scss.push(`#${id} { width: 1px; @include fd.${p}-${b} { width: fd.${p}(500); } }`)
    html.push(`<div class="p" id="${id}"></div>`)
    checks.push({ id, kind: 'width', scaled: false, expect: (w, h, z) => (bandAt(structure, w, h) === b ? evaluateDefaults(structure, w, h, z).fluid * 500 : 1) })
  }
  if (structure.aliases) {
    const id = 'band-up'
    scss.push(`#${id} { width: 1px; @include fd.${p}-up { width: fd.${p}(500); } }`)
    html.push(`<div class="p" id="${id}"></div>`)
    checks.push({ id, kind: 'width', scaled: false, expect: (w, h, z) => (bandAt(structure, w, h) === 'desktop' ? evaluateDefaults(structure, w, h, z).fluid * 500 : 1) })
  }

  // limit/scope mixins: a wrapper class, probes nested as children (inherit the recomputed vars)
  const scopeCases = [
    ['limit-grow', `@include fd.${p}-grow-until(1680);`, { '--fluid-grow-until': 1680 }],
    ['limit-shrink', `@include fd.${p}-shrink-until(1280);`, { '--fluid-shrink-until': 1280 }],
    ...(ui ? [['limit-ui', `@include fd.${p}-ui-grow-until(1680);`, { '--fluid-ui-grow-until': 1680 }]] : []),
    ['off', `@include fd.${p}-off;`, { '--fluid-off': 1 }]
  ]
  for (const [scope, body, overrides] of scopeCases) {
    scss.push(`.${scope} { ${body} }`)
    const children = []
    for (const [fid, expr] of fnProbes) {
      const id = `${scope}-${fid}`
      scss.push(`.${scope} #${id} { width: ${expr}; }`)
      children.push(`<div class="p" id="${id}"></div>`)
      checks.push({
        id,
        kind: 'width',
        scaled: true,
        expect: (w, h, z) => {
          const e = evaluateDefaults(structure, w, h, z, overrides)
          return fid === 'fluid' ? e.fluid * 1000 : fid === 'ui' ? e.ui * 1000 : e.roles[fid.slice(5)] * 1000
        }
      })
    }
    html.push(`<div class="${scope}">${children.join('')}</div>`)
  }

  // fluid-scope, directly: a damping override, held the same across every band so it is
  // viewport-independent (mirrors tailwind-compile.mjs's "fluid-scope re-scopes damping" check).
  {
    const scope = 'scope-damp'
    const overrides = Object.fromEntries(BANDS.map((b) => [`--fluid-${b}-display-damping`, 1]))
    const body = `@include fd.${p}-scope;\n  ${Object.entries(overrides).map(([k, v]) => `${k}: ${v};`).join('\n  ')}`
    scss.push(`.${scope} { ${body} }`)
    const inner = [['fluid', `fd.${p}(1000)`], ['role-display', `fd.${p}-display(1000)`]]
    const children = []
    for (const [fid, expr] of inner) {
      const id = `${scope}-${fid}`
      scss.push(`.${scope} #${id} { width: ${expr}; }`)
      children.push(`<div class="p" id="${id}"></div>`)
      checks.push({
        id,
        kind: 'width',
        scaled: true,
        expect: (w, h, z) => {
          const e = evaluateDefaults(structure, w, h, z, overrides)
          return fid === 'fluid' ? e.fluid * 1000 : e.roles.display * 1000
        }
      })
    }
    html.push(`<div class="${scope}">${children.join('')}</div>`)
  }

  // fluid-container
  {
    scss.push(`.container { @include fd.${p}-container; }`)
    html.push(`<div class="container" id="container"></div>`)
    checks.push({
      id: 'container',
      kind: 'computed',
      computedProps: ['max-width', 'padding-left'],
      scaled: false,
      expect: (w, h, z) => {
        const e = evaluateDefaults(structure, w, h, z)
        return [e.containerWidth, e.containerPadding]
      }
    })
  }

  // fluid-type: the default role, 'text' (the zoom-blended function), and 'ui' if present —
  // covers every branch of the mixin's @if/@else chain.
  const typeCases = [[roles[0], 32, 40], ['text', 18, 24], ...(ui ? [['ui', 16, 20]] : [])]
  for (const [unit, size, lh] of typeCases) {
    const id = `type-${unit}`
    scss.push(`.${id} { @include fd.${p}-type(${size}, ${lh}, ${unit}); }`)
    html.push(`<div class="${id}" id="${id}"></div>`)
    checks.push({
      id,
      kind: 'computed',
      computedProps: ['font-size', 'line-height'],
      scaled: false,
      expect: (w, h, z) => {
        const e = evaluateDefaults(structure, w, h, z)
        if (unit === 'ui') return [size * e.ui, lh * e.ui]
        if (unit === 'text') {
          const full = 24
          const none = 48
          const blend = e.fluid + (e.fluidZ - e.fluid) * Math.max(0, Math.min(1, (none - size) / (none - full)))
          return [size * blend, lh * blend]
        }
        return [size * e.roles[unit], lh * e.roles[unit]]
      }
    })
  }

  return { label, structure, scss: scss.join('\n') + '\n', html: html.join('\n'), checks }
}

const cases = [
  buildStructureCase('SCSS default (roles: display, copy)', {}),
  buildStructureCase('SCSS custom roles (display, copy, caption) + aliases', { roles: ['display', 'copy', 'caption'], aliases: true })
]

// ── build fluid/ for each structure + compile the probe scss ───────────

function page(fluidCss, compiledCss, html) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fluidCss}
${compiledCss}
body { margin: 0 }</style></head><body>
${html}
</body></html>`
}

const workDir = mkdtempSync(join(process.cwd(), '.fluid-scss-test-'))
let checks = 0
let failures = 0
try {
  for (const c of cases) {
    const fluidDir = join(workDir, c.label.replace(/\W+/g, '-'), 'fluid')
    mkdirSync(fluidDir, { recursive: true })
    const { files } = buildOutput(c.structure)
    for (const [rel, content] of Object.entries(files)) {
      const dest = join(fluidDir, rel)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, content)
    }
    const loadRoot = dirname(fluidDir)
    const compiled = sass.compileString(c.scss, { loadPaths: [loadRoot] })
    c.pageHtml = page(files['fluid.css'], compiled.css, c.html)
  }

  for (const name of browsers) {
    const browser = await pw[name].launch()
    for (const c of cases) {
      const file = join(workDir, `${c.label.replace(/\W+/g, '-')}.html`)
      writeFileSync(file, c.pageHtml)
      let worst = 0
      let worstAt = ''
      for (const [w, h] of viewports) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } })
        const p2 = await ctx.newPage()
        await p2.goto(pathToFileURL(file).href)
        for (const z of zooms) {
          const got = await p2.evaluate(
            ({ z, chks }) => {
              document.documentElement.style.setProperty('--fluid-zoom', String(z))
              const out = {}
              for (const ch of chks) {
                const el = document.getElementById(ch.id)
                if (ch.kind === 'width') out[ch.id] = el.getBoundingClientRect().width
                else out[ch.id] = ch.computedProps.map((prop) => parseFloat(getComputedStyle(el).getPropertyValue(prop)))
              }
              return out
            },
            { z, chks: c.checks.map((ch) => ({ id: ch.id, kind: ch.kind, computedProps: ch.computedProps })) }
          )
          for (const ch of c.checks) {
            const exp = ch.expect(w, h, z)
            const gotVals = ch.kind === 'computed' ? got[ch.id] : [got[ch.id]]
            const expVals = ch.kind === 'computed' ? exp : [exp]
            const props = ch.kind === 'computed' ? ch.computedProps : [ch.kind]
            for (let i = 0; i < expVals.length; i++) {
              checks++
              const scale = ch.scaled ? 1000 : 1
              const d = Math.abs(gotVals[i] - expVals[i]) / scale
              const tol = ch.scaled ? TOL : CTOL
              if (d > worst) {
                worst = d
                worstAt = `${w}x${h} z${z} ${ch.id}/${props[i]} got ${gotVals[i]} exp ${expVals[i]}`
              }
              if (!(d <= tol)) {
                failures++
                if (failures <= 25) console.error(`FAIL [${name}] ${c.label} ${w}x${h} z${z} ${ch.id}/${props[i]}: got ${gotVals[i]} expected ${expVals[i]}`)
              }
            }
          }
        }
        await ctx.close()
      }
      console.log(`[${name}] ${c.label.padEnd(44)} worst ${worst.toExponential(2)}  ${worst > 0 ? worstAt : ''}`)
    }
    await browser.close()
  }
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
console.log(`${checks} checks, ${failures} failures`)
process.exit(failures ? 1 : 0)
