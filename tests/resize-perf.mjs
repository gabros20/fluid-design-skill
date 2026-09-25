#!/usr/bin/env node
// resize-perf.mjs — the engine's resize cost, in WebKit and Chromium: a
// 2000-element page spending the units (30 classes × 4 declarations, 50
// sections), timed per forced style+layout while the viewport steps
// through 21 widths, median of 7 rounds. Compared: the same page with and
// without 50 limit scopes. With the --_fluid-m-* mirrors inherited, WebKit
// took 4.5× longer with the scopes (45 vs 10 ms a step); non-inherited, the
// two are about equal. The guard is that ratio, so machine speed cancels.
//
//   node resize-perf.mjs [--browsers webkit,chromium] [--extra-css file.css]
//
// Needs playwright (run from examples/pizza-next).

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { normaliseStructure } from '../skills/fluid-design/scripts/lib/spec.mjs'
import { engineCss } from '../skills/fluid-design/scripts/lib/emit/engine.mjs'

const args = process.argv.slice(2)
const flag = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const browsers = flag('--browsers', 'webkit,chromium').split(',')
const extra = args.includes('--extra-css') ? readFileSync(flag('--extra-css'), 'utf8') : ''
const MAX_RATIO = 1.6

const pw = createRequire(join(process.cwd(), 'package.json'))('playwright')
const css = engineCss(normaliseStructure({ version: 2 })) + '\n' + extra
const units = ['var(--fluid)', 'var(--fluid-display)', 'var(--fluid-copy)', 'var(--fluid-ui)']
const classes = Array.from({ length: 30 }, (_, i) => `.c${i} { padding: calc(${8 + i} * ${units[i % 4]}); margin-top: calc(${4 + i} * ${units[(i + 1) % 4]}); font-size: calc(${12 + (i % 20)} * ${units[(i + 2) % 4]}); gap: calc(${i} * ${units[(i + 3) % 4]}); }`).join('\n')
const page = (scopes) => `<!doctype html><html><head><style>${css}\n${classes}\nbody{margin:0}</style></head><body>${Array.from({ length: 50 }, (_, s) => `<section ${scopes ? 'class="fluid-grow-until-1680" style="--fluid-grow-until:1680"' : ''}>${Array.from({ length: 40 }, (_, i) => `<div class="c${(s * 40 + i) % 30}">x</div>`).join('')}</section>`).join('')}</body></html>`
const pages = { plain: page(false), scopes: page(true), host: '<!doctype html><iframe id="f" style="border:0"></iframe>' }
const server = createServer((req, res) => res.end(pages[req.url.slice(1)] ?? '')).listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
const base = `http://127.0.0.1:${server.address().port}/`

let failures = 0
try {
  for (const name of browsers) {
    const browser = await pw[name].launch()
    const p = await browser.newPage({ viewport: { width: 2700, height: 1600 } })
    await p.goto(base + 'host')
    const out = {}
    for (const v of ['plain', 'scopes']) {
      await p.evaluate((src) => new Promise((res) => { const f = document.getElementById('f'); f.style.width = '1440px'; f.style.height = '900px'; f.onload = () => res(); f.src = src }), base + v)
      out[v] = await p.evaluate(() => {
        const f = document.getElementById('f')
        const d = f.contentDocument
        const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]
        const rounds = []
        for (let r = 0; r < 7; r++) {
          let t = 0
          for (let i = 0; i <= 20; i++) {
            f.style.width = `${1100 + i * 70}px`
            const t0 = performance.now()
            void d.body.offsetHeight
            t += performance.now() - t0
          }
          rounds.push(t / 21)
        }
        return med(rounds)
      })
    }
    await browser.close()
    const ratio = out.scopes / out.plain
    const ok = ratio <= MAX_RATIO
    if (!ok) failures++
    console.log(`${ok ? 'ok  ' : 'FAIL'} [${name}] resize step: ${out.plain.toFixed(2)} ms without scopes, ${out.scopes.toFixed(2)} ms with 50 limit scopes (×${ratio.toFixed(2)}, limit ×${MAX_RATIO})`)
  }
} finally {
  server.close()
}
process.exit(failures ? 1 : 0)
