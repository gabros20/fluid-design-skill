#!/usr/bin/env node
// tailwind-compile.mjs — the generated Tailwind layer through the real
// Tailwind v4 compiler: band variants, every utility family, a custom role,
// the container, negatives. Then in a browser: exactly one band variant
// matches at each viewport, and `fluid-scope` re-scopes a setting to a subtree.
//
//   node tailwind-compile.mjs     (from a project with tailwindcss, @tailwindcss/postcss, postcss, playwright)

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { normaliseStructure } from '../lib/spec.mjs'
import { buildOutput } from '../lib/emit/project.mjs'
import { evaluateDefaults } from '../lib/model.mjs'

const req = createRequire(join(process.cwd(), 'package.json'))
const tailwind = req('@tailwindcss/postcss')
// postcss is usually a dependency of the plugin rather than of the project.
const postcss = (() => {
  try {
    return req('postcss')
  } catch {
    return createRequire(req.resolve('@tailwindcss/postcss'))('postcss')
  }
})()
const pw = req('playwright')

// Inside the project, so @import 'tailwindcss' resolves from its node_modules.
const dir = mkdtempSync(join(process.cwd(), '.fluid-tw-test-'))
let failures = 0
const expect = (ok, what, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && extra ? `\n${extra}` : ''}`)
}

try {
  const s = normaliseStructure({ version: 2, roles: ['display', 'copy', 'caption'] })
  const { files } = buildOutput(s)
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, 'fluid', rel, '..'), { recursive: true })
    writeFileSync(join(dir, 'fluid', rel), content)
  }
  const classes = [
    'fluid-phone:fluid-p-11', 'fluid-tablet:fluid-p-12', 'fluid-landscape:fluid-p-13', 'fluid-desktop:fluid-p-14',
    'fluid-caption-12/16', 'fluid-display-64/72', 'fluid-text-18', 'fluid-ui-h-48', 'fluid-ui-text-11', 'fluid-container',
    '-fluid-mt-8', 'fluid-rounded-12', 'fluid-space-y-4', 'fluid-cap-1680', 'lg:fluid-py-120', 'fluid-ps-10',
    'fluid-grow-until-1680', 'fluid-grow-until-1920', 'lg:fluid-grow-until-1680', 'fluid-shrink-until-1280', 'fluid-off', 'fluid-ui-grow-until-[1600]', 'fluid-p-37.5', 'fluid-p-24'
  ]
  const input = `@import 'tailwindcss';\n@import './fluid/fluid.css';\n@source inline("${classes.join(' ')}");\n`
  writeFileSync(join(dir, 'in.css'), input)
  const { css } = await postcss([tailwind({ base: dir })]).process(input, { from: join(dir, 'in.css') })
  writeFileSync(join(dir, 'out.css'), css)
  const has = (re) => re.test(css)
  expect(has(/@media \(width < 600px\) and \(not \(\(orientation: landscape\) and \(height <= 500px\)\)\)[\s\S]*?\.fluid-phone\\:fluid-p-11/), 'fluid-phone: compiles to its exclusive media query')
  expect(has(/\.fluid-tablet\\:fluid-p-12/) && has(/\.fluid-landscape\\:fluid-p-13/) && has(/\.fluid-desktop\\:fluid-p-14/), 'fluid-tablet:, fluid-landscape:, fluid-desktop: compile')
  expect(has(/\.fluid-caption-12\\\/16\s*\{[^}]*font-size: calc\(12 \* var\(--fluid-caption\)\)[^}]*line-height: calc\(16 \* var\(--fluid-caption\)\)/), 'custom role utility fluid-caption-12/16')
  expect(has(/\.fluid-ui-h-48\s*\{\s*height: calc\(48 \* var\(--fluid-ui\)\)/), 'fluid-ui-h-48')
  expect(has(/\.fluid-container\s*\{[^}]*max-width: var\(--fluid-container-width\)/), 'fluid-container')
  expect(has(/\.-fluid-mt-8\s*\{\s*margin-top: calc\(8 \* -1 \* var\(--fluid\)\)/), 'negative -fluid-mt-8')
  expect(has(/@property --fluid-phone-caption-damping/), 'custom role settings are registered')
  expect(has(/\.fluid-scope/), 'the fluid-scope selector survives the build')
  expect(!has(/\bclamp\(|\bround\(/), 'no clamp() / round() in the compiled engine')
  expect(!has(/--fluid-step-|--fluid-width-/), 'the autocomplete scale emits no CSS')
  expect(has(/\.fluid-grow-until-1680\s*\{\s*--fluid-grow-until: 1680;/) && has(/\.fluid-ui-grow-until-\\\[1600\\\]\s*\{\s*--fluid-ui-grow-until: 1600;/) && has(/\.fluid-off\s*\{\s*--fluid-off: 1;/), 'limit utilities compile (bare and arbitrary values)')
  expect(has(/\.fluid-p-37\\\.5\s*\{\s*padding: calc\(37\.5 \* var\(--fluid\)\)/), 'a number off the scale still works (fluid-p-37.5)')

  // The generated TypeScript typechecks strictly (cn.ts against the project's tailwind-merge).
  {
    const { spawnSync } = await import('node:child_process')
    const tsc = createRequire(join(process.cwd(), 'package.json')).resolve('typescript/bin/tsc')
    const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--lib', 'es2022,dom', join(dir, 'fluid/cn.ts'), join(dir, 'fluid/fluid.ts')], { encoding: 'utf8', cwd: process.cwd() })
    expect(r.status === 0, 'generated cn.ts and fluid.ts pass tsc --strict', r.stdout + r.stderr)
  }

  // Merging, for real: the generated cn, and a shadcn-style lib/utils.ts that keeps its own cn and
  // adds withFluid next to an extension it already had.
  {
    const ts = createRequire(join(process.cwd(), 'package.json'))('typescript')
    const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    writeFileSync(join(dir, 'fluid/cn.mjs'), js(files['cn.ts']))
    writeFileSync(join(dir, 'utils.mjs'), js(`import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { withFluid } from './fluid/cn.mjs'
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'shadow-brand': ['shadow-brand'] } } }, withFluid)
export function cn(...inputs) { return twMerge(clsx(inputs)) }`))
    const gen = await import(pathToFileURL(join(dir, 'fluid/cn.mjs')).href)
    const own = await import(pathToFileURL(join(dir, 'utils.mjs')).href)
    const cases = [
      [['lg:fluid-p-40', 'lg:fluid-p-24'], 'lg:fluid-p-24'],
      [['p-4', 'fluid-p-24'], 'fluid-p-24'],
      [['fluid-text-14', 'fluid-display-64/72'], 'fluid-display-64/72'],
      [['fluid-ui-h-48', 'fluid-h-40'], 'fluid-h-40'],
      [['fluid-grow-until-1680', 'fluid-grow-until-[1920]'], 'fluid-grow-until-[1920]'],
      [['max-w-xl', 'fluid-cap-1680'], 'fluid-cap-1680']
    ]
    for (const [name, cn] of [['generated cn', gen.cn], ['shadcn cn + withFluid', own.cn]]) {
      const bad = cases.filter(([a, e]) => cn(...a) !== e).map(([a, e]) => `${a.join(' ')} -> ${cn(...a)} (expected ${e})`)
      expect(bad.length === 0, `${name} merges fluid classes (${cases.length} cases)`, bad.join('\n'))
    }
    expect(own.cn('shadow-brand', 'fluid-off', 'px-2') === 'shadow-brand fluid-off px-2', 'withFluid keeps the project\'s own extension working')
  }

  // Editor autocomplete: Tailwind IntelliSense lists what the design system's getClassList returns.
  const node = createRequire(req.resolve('@tailwindcss/postcss'))('@tailwindcss/node')
  const ds = await node.__unstable__loadDesignSystem(input, { base: dir })
  const listed = new Map(ds.getClassList())
  for (const c of ['fluid-p-24', 'fluid-display-64', 'fluid-caption-12', 'fluid-ui-h-48', 'fluid-grow-until-1680', 'fluid-shrink-until-1280', 'fluid-off', 'fluid-container', '-fluid-mt-8']) expect(listed.has(c), `autocomplete lists ${c}`)
  expect((listed.get('fluid-display-64')?.modifiers ?? []).includes('72'), 'autocomplete lists the /72 line-height modifier for fluid-display-64')
  expect(ds.getVariants().some((v) => v.name === 'fluid-tablet'), 'autocomplete lists the fluid-tablet: variant')

  // A Tailwind prefix: classes become tw:fluid-…; the scope selector must still match.
  const pin = `@import 'tailwindcss' prefix(tw);\n@import './fluid/fluid.css';\n@source inline("tw:fluid-grow-until-1680 tw:fluid-p-24");\n`
  const pcss = (await postcss([tailwind({ base: dir })]).process(pin, { from: join(dir, 'in.css') })).css
  expect(/\.tw\\:fluid-grow-until-1680\s*\{\s*--fluid-grow-until: 1680;/.test(pcss) && /\[class\*="fluid-grow-until-"\]/.test(pcss), 'with prefix(tw): tw:fluid-grow-until-1680 compiles and the scope selector matches it')
  const lg = css.indexOf('lg\\:fluid-py-120')
  const sm = css.indexOf('fluid-phone\\:fluid-p-11')
  expect(lg > 0 && sm > 0, 'lg: and band variants both present')

  // In a browser: exactly one band variant matches, and fluid-scope works.
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="out.css"></head><body>
<div id="v" class="fluid-phone:fluid-p-11 fluid-tablet:fluid-p-12 fluid-landscape:fluid-p-13 fluid-desktop:fluid-p-14"></div>
<section id="scoped" class="fluid-scope" style="--fluid-desktop-display-damping: 1; --fluid-phone-display-damping: 1"><p id="in" style="width: calc(1000 * var(--fluid-display))"></p></section>
<p id="out" style="width: calc(1000 * var(--fluid-display))"></p>
<header id="capped" class="fluid-grow-until-1680"><div id="cap-ui" class="fluid-ui-h-48"></div><div id="cap-p" class="fluid-p-24"></div>
  <div id="nested-off" class="fluid-off"><div id="ns-p" class="fluid-p-24"></div></div>
  <div id="nested-wider" class="fluid-grow-until-1920"><div id="nw-p" class="fluid-p-24"></div></div></header>
<header id="gated" class="lg:fluid-grow-until-1680"><div id="g-p" class="fluid-p-24"></div></header>
<div id="free-p" class="fluid-p-24"></div>
</body></html>`
  writeFileSync(join(dir, 'page.html'), html)
  const browser = await pw.chromium.launch()
  for (const [w, h, band, n] of [[375, 812, 'phone', 11], [820, 1180, 'tablet', 12], [844, 390, 'landscape', 13], [1280, 700, 'desktop', 14], [2560, 1440, 'desktop', 14]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(pathToFileURL(join(dir, 'page.html')).href)
    const r = await page.evaluate(() => ({ pad: parseFloat(getComputedStyle(document.getElementById('v')).paddingTop), fluid: document.getElementById('v').getBoundingClientRect().width, inW: document.getElementById('in').getBoundingClientRect().width, outW: document.getElementById('out').getBoundingClientRect().width }))
    const e = evaluateDefaults(s, w, h)
    expect(Math.abs(r.pad - n * e.fluid) < 0.05, `${w}x${h}: only fluid-${band}: applies (padding ${r.pad.toFixed(2)} = ${n} × ${e.fluid.toFixed(4)})`)
    // The generated runtime, inlined (file:// pages cannot import modules).
    await page.addScriptTag({ type: 'module', content: `${files['runtime/units.js']}\nwindow.__fluidPx = fluidPx` })
    await page.waitForFunction(() => typeof window.__fluidPx === 'function')
    const lim = await page.evaluate(async () => {
      const q = (id, prop = 'paddingTop') => parseFloat(getComputedStyle(document.getElementById(id))[prop])
      const fluidPx = window.__fluidPx
      return { capUi: q('cap-ui', 'height'), capP: q('cap-p'), ns: q('ns-p'), nw: q('nw-p'), g: q('g-p'), free: q('free-p'), pxIn: fluidPx(24, 'fluid', document.getElementById('cap-p')), pxOut: fluidPx(24) }
    })
    const cap = evaluateDefaults(s, w, h, 1, { '--fluid-grow-until': 1680 })
    const wider = evaluateDefaults(s, w, h, 1, { '--fluid-grow-until': 1920 })
    expect(Math.abs(lim.capP - 24 * cap.fluid) < 0.05 && Math.abs(lim.capUi - 48 * cap.ui) < 0.05 && Math.abs(lim.free - 24 * e.fluid) < 0.05, `${w}x${h}: fluid-grow-until-1680 limits its children (${lim.capP.toFixed(2)}), the page does not (${lim.free.toFixed(2)})`)
    expect(Math.abs(lim.ns - 24) < 0.05 && Math.abs(lim.nw - 24 * wider.fluid) < 0.05, `${w}x${h}: nested fluid-off -> 24px, nested grow-until-1920 -> ${lim.nw.toFixed(2)} (innermost wins)`)
    expect(Math.abs(lim.g - (w >= 1024 ? 24 * cap.fluid : 24 * e.fluid)) < 0.05, `${w}x${h}: lg:fluid-grow-until-1680 applies only from lg`)
    expect(Math.abs(lim.pxIn - 24 * cap.fluid) < 0.05 && Math.abs(lim.pxOut - 24 * e.fluid) < 0.05, `${w}x${h}: fluidPx(24, 'fluid', el) reads the limited unit (${lim.pxIn.toFixed(2)}), fluidPx(24) the page's (${lim.pxOut.toFixed(2)})`)
    const scoped = evaluateDefaults(s, w, h, 1, { [`--fluid-${e.band}-display-damping`]: 1 }).roles.display * 1000
    expect(Math.abs(r.inW - scoped) < 0.1 && Math.abs(r.outW - e.roles.display * 1000) < 0.1, `${w}x${h}: fluid-scope re-scopes display damping (inside ${r.inW.toFixed(1)}, outside ${r.outW.toFixed(1)})`)
    await page.close()
  }
  // A limit on :root for the ui unit keeps --header-h in step with a limited header.
  {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } })
    await page.goto(pathToFileURL(join(dir, 'page.html')).href)
    const hh = await page.evaluate(() => {
      document.documentElement.style.setProperty('--fluid-ui-grow-until', '1680')
      const d = document.createElement('div')
      d.style.height = 'var(--header-h)'
      document.body.appendChild(d)
      return d.getBoundingClientRect().height
    })
    const e = evaluateDefaults(s, 2560, 1440, 1, { '--fluid-ui-grow-until': 1680 })
    expect(Math.abs(hh - e.headerHeight) < 0.05 && Math.abs(e.ui - 1680 / 1440) < 1e-9, `2560x1440: :root --fluid-ui-grow-until: 1680 holds ui at ${e.ui.toFixed(3)} and --header-h follows (${hh.toFixed(1)})`)
    await page.close()
  }
  await browser.close()
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(failures ? `${failures} failure(s)` : 'all passed')
process.exit(failures ? 1 : 0)
