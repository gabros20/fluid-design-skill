#!/usr/bin/env node
// explain-live.mjs — `fluid explain --url` against a real page: the scopes
// report (class and attribute scopes, and a limit with nothing fluid inside,
// which must warn) and --at on one element. examples/pizza-vite-gsap's footer
// covers a mixin scope (no class), found where its settings change.
//
//   node explain-live.mjs      (needs playwright: run from a project that has it,
//                               e.g. examples/pizza-next)

import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { normaliseStructure } from '../lib/spec.mjs'
import { buildOutput } from '../lib/emit/project.mjs'

const FLUID = join(dirname(fileURLToPath(import.meta.url)), '../../bin/fluid')
const structure = normaliseStructure({ version: 2, output: { stack: 'css', dir: 'fluid' } })
const css = buildOutput(structure).files['fluid.css']
const html = `<!doctype html><html><head><style>${css}</style></head><body>
<section class="fluid-scope" id="empty" style="--fluid-grow-until:1680"><p>nothing fluid here</p></section>
<section class="fluid-scope" id="used" style="--fluid-grow-until:1680"><p style="padding:calc(40*var(--fluid))">fluid</p></section>
<footer id="foot" data-fluid-scope style="--fluid-ui-grow-until:1920"><p style="font-size:calc(16*var(--fluid-ui))">ui</p></footer>
</body></html>`

const dir = mkdtempSync(join(process.cwd(), '.fluid-explain-'))
writeFileSync(join(dir, 'fluid.config.json'), JSON.stringify({ version: 2, output: { stack: 'css', dir: 'fluid' } }))
const server = createServer((_, res) => res.end(html)).listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
const url = `http://127.0.0.1:${server.address().port}/`
const run = (...args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [FLUID, ...args], { cwd: dir })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', (code) => resolve({ code, out: out.replace(/\x1b\[\d+m/g, '') }))
  })

let failures = 0
const expect = (ok, what, extra) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : `\n${extra}`}`)
}
try {
  await run('generate')
  let r = await run('explain', '2560x1440', '--url', url)
  const block = (id) => r.out.split(/\n    (?=\S)/).find((b) => b.includes(`#${id}`)) ?? ''
  expect(r.code === 0 && r.out.includes('scopes on this page (3)'), 'lists every scope', r.out)
  expect(/nothing inside is sized with fluid units/.test(block('empty')), 'a limit with nothing fluid inside warns', block('empty'))
  expect(/fluid 1\.1667/.test(block('used')) && /1 element\(s\) inside follow the scale/.test(block('used')), 'a used limit: its unit (1680/1440) and what follows it', block('used'))
  expect(/ui 1\.3333/.test(block('foot')) && /follow the scale/.test(block('foot')), 'a ui limit on a data-fluid-scope', block('foot'))
  r = await run('explain', '2560x1440', '--url', url, '--at', '#used')
  expect(r.code === 0 && /--fluid-grow-until\s+1680\s+← the page, at #used/.test(r.out) && r.out.includes("element's units match"), '--at reads and checks one element', r.out)
  r = await run('explain', '2560x1440', '--url', url, '--at', '#nope')
  expect(r.code === 2 && r.out.includes('matches nothing'), '--at with no match exits 2', r.out)
} finally {
  server.close()
  rmSync(dir, { recursive: true, force: true })
}
console.log(failures ? `${failures} failure(s)` : 'all passed')
process.exit(failures ? 1 : 0)
