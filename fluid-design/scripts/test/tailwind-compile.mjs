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
const expect = (ok, what) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
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
    '-fluid-mt-8', 'fluid-rounded-12', 'fluid-space-y-4', 'fluid-cap-1680', 'lg:fluid-py-120', 'fluid-ps-10'
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
  const lg = css.indexOf('lg\\:fluid-py-120')
  const sm = css.indexOf('fluid-phone\\:fluid-p-11')
  expect(lg > 0 && sm > 0, 'lg: and band variants both present')

  // In a browser: exactly one band variant matches, and fluid-scope works.
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="out.css"></head><body>
<div id="v" class="fluid-phone:fluid-p-11 fluid-tablet:fluid-p-12 fluid-landscape:fluid-p-13 fluid-desktop:fluid-p-14"></div>
<section id="scoped" class="fluid-scope" style="--fluid-desktop-display-damping: 1; --fluid-phone-display-damping: 1"><p id="in" style="width: calc(1000 * var(--fluid-display))"></p></section>
<p id="out" style="width: calc(1000 * var(--fluid-display))"></p>
</body></html>`
  writeFileSync(join(dir, 'page.html'), html)
  const browser = await pw.chromium.launch()
  for (const [w, h, band, n] of [[375, 812, 'phone', 11], [820, 1180, 'tablet', 12], [844, 390, 'landscape', 13], [1280, 700, 'desktop', 14]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(pathToFileURL(join(dir, 'page.html')).href)
    const r = await page.evaluate(() => ({ pad: parseFloat(getComputedStyle(document.getElementById('v')).paddingTop), fluid: document.getElementById('v').getBoundingClientRect().width, inW: document.getElementById('in').getBoundingClientRect().width, outW: document.getElementById('out').getBoundingClientRect().width }))
    const e = evaluateDefaults(s, w, h)
    expect(Math.abs(r.pad - n * e.fluid) < 0.05, `${w}x${h}: only fluid-${band}: applies (padding ${r.pad.toFixed(2)} = ${n} × ${e.fluid.toFixed(4)})`)
    const scoped = evaluateDefaults(s, w, h, 1, { [`--fluid-${e.band}-display-damping`]: 1 }).roles.display * 1000
    expect(Math.abs(r.inW - scoped) < 0.1 && Math.abs(r.outW - e.roles.display * 1000) < 0.1, `${w}x${h}: fluid-scope re-scopes display damping (inside ${r.inW.toFixed(1)}, outside ${r.outW.toFixed(1)})`)
    await page.close()
  }
  await browser.close()
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(failures ? `${failures} failure(s)` : 'all passed')
process.exit(failures ? 1 : 0)
