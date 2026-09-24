#!/usr/bin/env node
// cli.mjs — the `fluid` command end to end, in throwaway projects:
// init (greenfield + brownfield), check (clean, then a bad setting, then a
// hand edit), generate's hand-edit guard, migrate (a v1 fixture), explain,
// settings. No browser, no network.

import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, appendFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const FLUID = join(dirname(fileURLToPath(import.meta.url)), '../../bin/fluid')
let failures = 0
const expect = (ok, what, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && extra ? `\n${extra}` : ''}`)
}
const run = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [FLUID, ...args], { cwd, encoding: 'utf8' })
  return { code: r.status, out: r.stdout + r.stderr }
}

const root = mkdtempSync(join(tmpdir(), 'fluid-cli-'))
try {
  // greenfield Next + Tailwind
  const g = join(root, 'green')
  mkdirSync(join(g, 'src/app'), { recursive: true })
  writeFileSync(join(g, 'package.json'), JSON.stringify({ dependencies: { next: '16', tailwindcss: '4' } }))
  writeFileSync(join(g, 'src/app/globals.css'), `@import 'tailwindcss';\n\n:root {\n  --background: white;\n}\n`)
  let r = run(g, 'init')
  expect(r.code === 0, 'init (greenfield) exits 0', r.out)
  const css = readFileSync(join(g, 'src/app/globals.css'), 'utf8')
  expect(css.includes("@import '../styles/fluid/fluid.css';"), 'init adds the one import after tailwindcss')
  expect(/:root \{\n  --background: white;\n\n  \/\* fluid settings/.test(css), 'init puts the settings starter inside the existing :root')
  const cfg = JSON.parse(readFileSync(join(g, 'fluid.config.json'), 'utf8'))
  expect(cfg.version === 2 && cfg.output?.integration === 'next', 'init detects Next and writes a minimal v2 config', JSON.stringify(cfg))
  for (const f of ['fluid.css', 'base.css', 'settings.reference.css', 'fluid.ts', 'cn.ts', 'runtime/units.js', 'runtime/zoom.js', 'integrations/next.tsx', '.fluid.lock.json']) {
    expect(existsSync(join(g, 'src/styles/fluid', f)), `generated ${f}`)
  }
  r = run(g, 'check')
  expect(r.code === 0, 'check passes on a fresh project', r.out)

  appendFileSync(join(g, 'src/app/globals.css'), `:root { --fluid-phone-scle-min: .8; --fluid-tablet-scale-max: 2px; }\n`)
  r = run(g, 'check')
  expect(r.code === 1 && r.out.includes('did you mean --fluid-phone-scale-min') && r.out.includes('not a plain number'), 'check fails on a typo and on a unit, with a suggestion', r.out)
  writeFileSync(join(g, 'src/app/globals.css'), css + `:root { --fluid-phone-scale-min: 0.9; }\n`)
  r = run(g, 'explain', '320x568')
  expect(r.code === 0 && /--fluid-phone-scale-min\s+0\.9\s+← src\/app\/globals\.css:\d+/.test(r.out), 'explain shows a setting with its file:line', r.out)
  expect(/--fluid\s+0\.9000/.test(r.out), 'explain applies the override (320 wide: 0.82 raised to the 0.9 minimum)', r.out)

  appendFileSync(join(g, 'src/styles/fluid/fluid.css'), '/* hand edit */\n')
  r = run(g, 'generate')
  expect(r.code === 1 && r.out.includes('Refusing to overwrite hand-edited files'), 'generate refuses to overwrite a hand edit', r.out)
  r = run(g, 'generate', '--force')
  expect(r.code === 0, 'generate --force restores it')
  r = run(g, 'settings')
  expect(r.code === 0 && r.out.includes('--fluid-desktop-display-damping: 0.62;'), 'settings prints the reference')

  // brownfield: prints, does not edit
  const b = join(root, 'brown')
  mkdirSync(join(b, 'src/app'), { recursive: true })
  writeFileSync(join(b, 'package.json'), JSON.stringify({ dependencies: { next: '16', tailwindcss: '4' } }))
  const before = `@import 'tailwindcss';\n`
  writeFileSync(join(b, 'src/app/globals.css'), before)
  r = run(b, 'init', '--brownfield')
  expect(r.code === 0 && readFileSync(join(b, 'src/app/globals.css'), 'utf8') === before && r.out.includes("@import '../styles/fluid/fluid.css';"), 'init --brownfield prints the import and leaves globals.css alone', r.out)
  expect(!existsSync(join(b, 'src/styles/fluid/base.css')), 'init --brownfield turns the base layer off')

  // migrate a v1 config
  const m = join(root, 'v1')
  mkdirSync(m)
  writeFileSync(join(m, 'package.json'), JSON.stringify({ devDependencies: { vite: '8', sass: '1' } }))
  writeFileSync(join(m, 'fluid.config.json'), JSON.stringify({ canvas: { width: 1600, gutter: 64 }, ceiling: 1.6, mobile: { enabled: true } }))
  r = run(m, 'check')
  expect(r.code === 1 && r.out.includes('fluid migrate'), 'check on a v1 config points at migrate')
  r = run(m, 'migrate', '--write')
  const v2 = JSON.parse(readFileSync(join(m, 'fluid.config.json'), 'utf8'))
  expect(r.code === 0 && v2.version === 2 && v2.output.stack === 'scss' && v2.output.integration === 'vite' && v2.aliases === true, 'migrate writes v2 with the detected stack and aliases on', JSON.stringify(v2))
  expect(r.out.includes('--fluid-desktop-scale-max: 1.6;') && r.out.includes('--fluid-desktop-container-width: 1600;'), 'migrate prints the non-default settings')
  expect(existsSync(join(m, 'fluid.config.v1.json')), 'migrate keeps the v1 file')
  r = run(m, 'generate')
  expect(r.code === 0 && existsSync(join(m, 'styles/fluid/_index.scss')) && existsSync(join(m, 'styles/fluid/integrations/vite.ts')), 'generate after migrate writes the SCSS module and the Vite plugin', r.out)
} finally {
  rmSync(root, { recursive: true, force: true })
}
console.log(failures ? `${failures} failure(s)` : 'all passed')
process.exit(failures ? 1 : 0)
