#!/usr/bin/env node
// engine-matrix.mjs — the generated engine CSS against model.evaluate(), in
// real browsers. For each structure (defaults, flat, zoom off, ui off, a
// custom role, width-only, ceiling, every migrated v1 fixture) it renders a
// probe page and measures every unit at a viewport grid and three zooms.
// Then, on the defaults: a live setting override, an invalid value falling
// back to its default, and the same numbers with @property stripped.
//
//   node engine-matrix.mjs [--browsers chromium,webkit,firefox]
//
// Needs playwright, resolved from the current directory first (run it from
// a project that has it, e.g. examples/pizza-next).

import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { normaliseStructure } from '../skills/fluid-design/scripts/lib/spec.mjs'
import { migrateV1, evaluateDefaults } from '../skills/fluid-design/scripts/lib/model.mjs'
import { engineCss, engineParts } from '../skills/fluid-design/scripts/lib/emit/engine.mjs'
import { RUNTIME } from '../skills/fluid-design/scripts/lib/emit/runtime-assets.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const TOL = 5e-5 // per drawn px; the ×1000 form keeps every engine well inside this

const args = process.argv.slice(2)
const browsers = (args[args.indexOf('--browsers') + 1] && args.includes('--browsers') ? args[args.indexOf('--browsers') + 1] : 'chromium,webkit,firefox').split(',')

function loadPlaywright() {
  for (const base of [join(process.cwd(), 'package.json'), import.meta.url]) {
    try {
      return createRequire(base)('playwright')
    } catch {}
  }
  console.error('playwright not found: run from a project that has it (e.g. examples/pizza-next)')
  process.exit(2)
}

const cases = [
  ['defaults', {}, {}],
  ['flat below desktop', { bands: { phone: false, tablet: false, landscape: false } }, {}],
  ['zoom off', { zoom: false }, {}],
  ['ui off', { ui: false }, {}],
  ['custom role', { roles: ['display', 'copy', 'caption'] }, { '--fluid-desktop-caption-damping': 0.2, '--fluid-phone-caption-damping': 0.4 }],
  ['no tablet, no landscape', { bands: { tablet: false, landscape: false } }, {}],
  ['width only + ceiling', {}, { '--fluid-desktop-fit-height': 0, '--fluid-desktop-scale-max': 1.4 }],
  ['floors set', {}, { '--fluid-desktop-display-floor': 0.95, '--fluid-desktop-copy-floor': 1.02 }],
  ['tablet container falls back to phone', {}, { '--fluid-phone-container-width': 480, '--fluid-phone-container-padding': 20, '--fluid-landscape-header-height': 40 }],
  ['base-width 0 guarded', {}, { '--fluid-desktop-base-width': 0, '--fluid-phone-base-width': 0 }],
  ['desktop at 1280', { bands: { desktop: { minWidth: 1280 } } }, {}],
  // Limits (window px): each applies only in the band that contains its width.
  ['grow-until 1680', {}, { '--fluid-grow-until': 1680 }],
  ['shrink-until 1280', {}, { '--fluid-shrink-until': 1280 }],
  ['ui-grow-until 1680', {}, { '--fluid-ui-grow-until': 1680 }],
  ['grow-until 430 (a phone width)', {}, { '--fluid-grow-until': 430 }],
  ['shrink-until 700 (tablet + landscape)', {}, { '--fluid-shrink-until': 700 }],
  ['off', {}, { '--fluid-off': 1 }],
  ['off + ceiling + floors', {}, { '--fluid-off': 1, '--fluid-desktop-scale-max': 1.4, '--fluid-desktop-display-floor': 0.95 }],
  ['flat + limits (no effect)', { bands: { phone: false, tablet: false, landscape: false } }, { '--fluid-grow-until': 800, '--fluid-shrink-until': 900 }],
  ['limit + moved desktop band', { bands: { desktop: { minWidth: 1280 } } }, { '--fluid-grow-until': 1100, '--fluid-shrink-until': 1600 }]
]
const v1dir = join(here, './fixtures/v1-configs')
for (const f of readdirSync(v1dir).filter((f) => f.endsWith('.json')).sort()) {
  const json = JSON.parse(readFileSync(join(v1dir, f), 'utf8'))
  delete json.$schema
  const m = migrateV1(json)
  cases.push([`v1 ${f}`, m.structure, m.settings])
}

const viewports = [[320, 568], [375, 812], [430, 932], [599, 900], [600, 900], [844, 390], [932, 430], [820, 1180], [1023, 700], [1024, 640], [1200, 500], [1280, 1080], [1440, 900], [1440, 700], [1920, 1080], [2560, 1440], [3000, 700]]
const zooms = [1, 1.5]

function page(structure, overrides, css) {
  const probes = [['fluid', 'calc(1000 * var(--fluid))'], ...structure.roles.map((r) => [r, `calc(1000 * var(--fluid-${r}))`]), ...(structure.ui ? [['ui', 'calc(1000 * var(--fluid-ui))']] : []), ['cw', 'var(--fluid-container-width)'], ['cp', 'var(--fluid-container-padding)'], ['hh', 'var(--fluid-header-h)']]
  const style = Object.entries(overrides).map(([k, v]) => `${k}: ${v};`).join(' ')
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
:root { ${style} }
body { margin: 0 } .p { position: fixed; left: 0; top: 0; height: 1px; visibility: hidden }</style></head><body>
${probes.map(([id, w]) => `<div class="p" id="${id}" style="width:${w}"></div>`).join('\n')}
</body></html>`
}

const pw = loadPlaywright()
const dir = mkdtempSync(join(tmpdir(), 'fluid-engine-'))
let failures = 0
let checks = 0
try {
  for (const name of browsers) {
    const browser = await pw[name].launch()
    for (const [label, raw, overrides] of cases) {
      const structure = normaliseStructure({ version: 2, ...raw })
      const file = join(dir, `${label.replace(/\W+/g, '-')}.html`)
      writeFileSync(file, page(structure, overrides, engineCss(structure)))
      let worst = 0
      let worstAt = ''
      for (const [w, h] of viewports) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } })
        const p = await ctx.newPage()
        await p.goto(pathToFileURL(file).href)
        for (const z of zooms) {
          const got = await p.evaluate((z) => {
            document.documentElement.style.setProperty('--fluid-zoom', String(z))
            return Object.fromEntries([...document.querySelectorAll('.p')].map((el) => [el.id, el.getBoundingClientRect().width]))
          }, z)
          const e = evaluateDefaults(structure, w, h, z, overrides)
          // Header: env(safe-area-inset-top) is 0 in a desktop browser.
          const exp = { fluid: e.fluid * 1000, ...Object.fromEntries(structure.roles.map((r) => [r, e.roles[r] * 1000])), ...(structure.ui ? { ui: e.ui * 1000 } : {}), cw: e.containerWidth, cp: e.containerPadding, hh: e.headerHeight }
          for (const k of Object.keys(exp)) {
            checks++
            const scale = ['fluid', 'ui', ...structure.roles].includes(k) ? 1000 : 1
            const d = Math.abs(got[k] - exp[k]) / scale
            const tol = scale === 1 ? 0.05 : TOL
            if (d > worst) {
              worst = d
              worstAt = `${w}x${h} z${z} ${k} got ${got[k]} exp ${exp[k]}`
            }
            if (!(d <= tol)) {
              failures++
              if (failures <= 25) console.error(`FAIL [${name}] ${label} ${w}x${h} z${z} ${k}: got ${got[k]} expected ${exp[k]}`)
            }
          }
        }
        await ctx.close()
      }
      console.log(`[${name}] ${label.padEnd(36)} worst ${worst.toExponential(2)}  ${worst > 0 ? worstAt : ''}`)
    }

    // Live override, invalid fallback, no-@property — on the defaults.
    const s = normaliseStructure({ version: 2 })
    const css = engineCss(s)
    for (const [variant, sheet] of [['@property', css], ['no @property', css.replace(/@property[^\n]*\n/g, '')]]) {
      const file = join(dir, `live-${variant.replace(/\W+/g, '-')}.html`)
      writeFileSync(file, page(s, {}, sheet))
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
      const p = await ctx.newPage()
      await p.goto(pathToFileURL(file).href)
      const r = await p.evaluate(() => {
        const f = () => document.getElementById('fluid').getBoundingClientRect().width / 1000
        const st = document.documentElement.style
        const out = { base: f() }
        st.setProperty('--fluid-phone-scale-max', '0.9')
        out.live = f()
        st.setProperty('--fluid-phone-scale-max', '0.9px')
        out.invalid = f()
        return out
      })
      await ctx.close()
      const e = evaluateDefaults(s, 375, 812).fluid
      const liveOk = Math.abs(r.live - 0.9) < TOL
      const baseOk = Math.abs(r.base - e) < TOL
      const invalidOk = variant === '@property' ? Math.abs(r.invalid - e) < TOL : true // without @property an invalid value is the lint's job
      checks += 3
      for (const [ok, what] of [[baseOk, 'base'], [liveOk, 'live override'], [invalidOk, 'invalid falls back to default']]) {
        if (!ok) {
          failures++
          console.error(`FAIL [${name}] ${variant}: ${what} ${JSON.stringify(r)}`)
        }
      }
      console.log(`[${name}] ${`live settings (${variant})`.padEnd(36)} base ${r.base.toFixed(4)}  scale-max .9 -> ${r.live.toFixed(4)}  "0.9px" -> ${r.invalid.toFixed(4)}`)
    }
    // Scopes: every way to make one, measured inside, and fluidPx(n, unit, el)'s
    // walk up to the nearest non-inherited mirror. A mixin scope (SCSS/StyleX)
    // is a plain rule carrying the engine's pairs, no class the selector knows.
    {
      const st = normaliseStructure({ version: 2 })
      const mixin = engineParts(st).rules.map((r) => (r.media ? `@media ${r.media} { .mixin-scope { ${r.pairs.map(([k, v]) => `${k}: ${v};`).join(' ')} } }` : `.mixin-scope { ${r.pairs.map(([k, v]) => `${k}: ${v};`).join(' ')} }`)).join('\n')
      const runtime = RUNTIME['fluid-units.js'].replace(/^export /gm, '')
      const scopes = [
        ['class', 'class="fluid-scope" style="--fluid-grow-until: 1680"', { '--fluid-grow-until': 1680 }],
        ['important off', 'class="fluid-off!" style="--fluid-off: 1"', { '--fluid-off': 1 }],
        ['variant off', 'class="lg:fluid-off" style="--fluid-off: 1"', { '--fluid-off': 1 }],
        ['arbitrary property', 'class="[--fluid-shrink-until:1280]" style="--fluid-shrink-until: 1280"', { '--fluid-shrink-until': 1280 }],
        ['mixin rule', 'class="mixin-scope" style="--fluid-ui-grow-until: 1680"', { '--fluid-ui-grow-until': 1680 }],
        ['not a scope (fluid-offset)', 'class="lg:fluid-offset-4" style="--fluid-grow-until: 1680"', {}]
      ]
      const body = scopes.map(([id, attrs], i) => `<div ${attrs}><div><span class="q" data-i="${i}" style="display:block;height:1px;width:calc(1000 * var(--fluid))"></span><span class="u" data-i="${i}" style="display:block;height:1px;width:calc(1000 * var(--fluid-ui))"></span></div></div>`).join('\n')
      const file = join(dir, 'scopes.html')
      writeFileSync(file, `<!doctype html><html><head><style>${engineCss(st)}\n${mixin}</style><script>${runtime}\nwindow.fluidPx = fluidPx</script></head><body style="margin:0">${body}</body></html>`)
      for (const [w, h] of [[1440, 900], [1920, 1080], [2560, 1440], [1100, 700], [390, 844]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } })
        const p = await ctx.newPage()
        await p.goto(pathToFileURL(file).href)
        const got = await p.evaluate(() => [...document.querySelectorAll('.q')].map((q) => {
          const u = q.nextElementSibling
          return { fluid: q.getBoundingClientRect().width / 1000, ui: u.getBoundingClientRect().width / 1000, px: window.fluidPx(1000, 'fluid', q) / 1000, pxUi: window.fluidPx(1000, 'ui', u) / 1000 }
        }))
        await ctx.close()
        scopes.forEach(([id, , ov], i) => {
          const e = evaluateDefaults(st, w, h, 1, ov)
          for (const [k, exp] of [['fluid', e.fluid], ['ui', e.ui], ['px', e.fluid], ['pxUi', e.ui]]) {
            checks++
            if (!(Math.abs(got[i][k] - exp) <= TOL * 2)) {
              failures++
              console.error(`FAIL [${name}] scope "${id}" ${w}x${h} ${k}: got ${got[i][k]} expected ${exp}`)
            }
          }
        })
      }
      console.log(`[${name}] ${'scopes + fluidPx(el)'.padEnd(36)} ${scopes.length} kinds × 5 viewports`)
    }
    await browser.close()
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(`${checks} checks, ${failures} failures`)
process.exit(failures ? 1 : 0)
