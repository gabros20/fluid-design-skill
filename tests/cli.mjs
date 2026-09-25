#!/usr/bin/env node
// cli.mjs — the `fluid` command end to end, in throwaway projects:
// init (greenfield + brownfield), check (clean, then a bad setting, then a
// hand edit), generate's hand-edit guard, migrate (a v1 fixture), explain,
// settings. No browser, no network.

import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, appendFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const FLUID = join(dirname(fileURLToPath(import.meta.url)), '../skills/fluid-design/bin/fluid')
let failures = 0
const expect = (ok, what, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && extra ? `\n${extra}` : ''}`)
}
const run = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [FLUID, ...args], { cwd, encoding: 'utf8' })
  return { code: r.status, out: r.stdout + r.stderr }
}
const runWithInput = (cwd, input, ...args) => {
  const r = spawnSync(process.execPath, [FLUID, ...args], { cwd, encoding: 'utf8', input })
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

  // init by flags (automation): artboard, no mobile, max width, --set; settings land as declarations
  const f = join(root, 'flags')
  mkdirSync(join(f, 'src/app'), { recursive: true })
  writeFileSync(join(f, 'package.json'), JSON.stringify({ dependencies: { next: '16', tailwindcss: '4' } }))
  writeFileSync(join(f, 'src/app/globals.css'), `@import 'tailwindcss';\n`)
  r = run(f, 'init', '--yes', '--desktop', '1600x1000', '--desktop-at', '1200', '--no-mobile', '--max-width', '1920', '--set', '--fluid-desktop-scale-max=1.4', '--set', 'desktop-display-damping=0.7')
  const fcfg = JSON.parse(readFileSync(join(f, 'fluid.config.json'), 'utf8'))
  const fcss = readFileSync(join(f, 'src/app/globals.css'), 'utf8')
  expect(r.code === 0 && fcfg.bands.phone === false && fcfg.bands.tablet === false && fcfg.bands.desktop.minWidth === 1200, 'init --no-mobile --desktop-at writes the bands', r.out + JSON.stringify(fcfg))
  expect(['--fluid-desktop-base-width: 1600;', '--fluid-desktop-base-height: 1000;', '--fluid-desktop-container-width: 1920;', '--fluid-desktop-scale-max: 1.4;', '--fluid-desktop-display-damping: 0.7;'].every((l) => fcss.includes(l)) && !fcss.includes('--fluid-phone-base-width'), 'init writes answers and --set as real declarations, defaults left out', fcss)
  r = run(f, 'check')
  expect(r.code === 0, 'check passes after a flag-driven init', r.out)
  r = run(f, 'explain', '1920x1080', '--set', '--fluid-grow-until=1600')
  expect(r.code === 0 && /--fluid-grow-until\s+1600\s+← --set/.test(r.out) && /--fluid\s+1\.0000/.test(r.out), 'explain --set: grow-until at the artboard width holds the unit at 1', r.out)
  const bad = join(root, 'bad')
  mkdirSync(bad)
  r = run(bad, 'init', '--yes', '--set', '--fluid-desktop-scle-max=1.4')
  expect(r.code === 2 && r.out.includes('did you mean --fluid-desktop-scale-max'), 'init --set with a typo exits 2 with a suggestion', r.out)
  r = run(bad, 'init', '--yes', '--set', '--fluid-desktop-fit-height=0.5')
  expect(r.code === 2 && r.out.includes('whole number'), 'init --set validates the value against the spec', r.out)

  // init by answers (a human at a terminal; --interactive reads them from stdin)
  const q = join(root, 'asked')
  mkdirSync(join(q, 'src'), { recursive: true })
  writeFileSync(join(q, 'package.json'), JSON.stringify({ devDependencies: { vite: '8' } }))
  writeFileSync(join(q, 'src/style.css'), `html { color: black; }\n`)
  //                stack  framework  css  brownfield  desktop     at   mobile  phone  max   out
  const answers = ['css', '', '', 'n', '1280x800', '', 'y', '375', '', ''].join('\n') + '\n'
  r = runWithInput(q, answers, 'init', '--interactive')
  const qcfg = JSON.parse(readFileSync(join(q, 'fluid.config.json'), 'utf8'))
  const qcss = readFileSync(join(q, 'src/style.css'), 'utf8')
  expect(r.code === 0 && qcfg.output.stack === 'css' && qcfg.output.integration === 'vite' && qcfg.output.base !== false, 'interactive init: typed answers win, Enter keeps the detected default', r.out + JSON.stringify(qcfg))
  expect(qcss.startsWith("@import './fluid/fluid.css';") && qcss.includes('--fluid-desktop-base-width: 1280;') && qcss.includes('--fluid-phone-base-width: 375;'), 'interactive init writes the import and the answered settings', qcss)
  expect(r.out.includes('site already style html and body'), 'the brownfield question is asked (default detected from the html rule)', r.out)

  // a project without Node (Rails-style): css stack, no integration, the classic zoom script
  const n = join(root, 'rails')
  mkdirSync(join(n, 'app/assets/stylesheets'), { recursive: true })
  writeFileSync(join(n, 'app/assets/stylesheets/application.css'), `:root {\n  --brand: red;\n}\n`)
  r = run(n, 'init', '--yes')
  const ncfg = JSON.parse(readFileSync(join(n, 'fluid.config.json'), 'utf8'))
  expect(r.code === 0 && ncfg.output.stack === 'css' && ncfg.output.dir === 'app/assets/stylesheets/fluid' && (ncfg.output.integration ?? 'none') === 'none', 'no package.json: css stack, output next to the stylesheet', r.out + JSON.stringify(ncfg))
  const classic = join(n, 'app/assets/stylesheets/fluid/runtime/zoom.classic.js')
  expect(existsSync(classic) && !readFileSync(classic, 'utf8').includes('export ') && r.out.includes('zoom.classic.js'), 'no integration: a classic zoom script, and init says how to load it')
  expect(readFileSync(join(n, 'app/assets/stylesheets/application.css'), 'utf8').startsWith("@import './fluid/fluid.css';"), 'the import goes at the top of a plain stylesheet')

  // version pinning: a lock from another CLI version is named, not just "stale"
  const lockPath = join(g, 'src/styles/fluid/.fluid.lock.json')
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  writeFileSync(lockPath, JSON.stringify({ ...lock, generator: 'fluid-design 1.9.0' }))
  r = run(g, 'check')
  expect(r.out.includes('was generated by fluid-design 1.9.0'), 'check names a generator version mismatch', r.out)
  run(g, 'generate', '--force')

  // generate --watch regenerates on a config save
  const child = spawn(process.execPath, [FLUID, 'generate', '--watch'], { cwd: f })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  await new Promise((res) => setTimeout(res, 600))
  const cfgPath = join(f, 'fluid.config.json')
  writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(readFileSync(cfgPath, 'utf8')), roles: ['display', 'copy', 'caption'] }, null, 2))
  for (let i = 0; i < 40 && !readFileSync(join(f, 'src/styles/fluid/fluid.css'), 'utf8').includes('--fluid-caption:'); i++) await new Promise((res) => setTimeout(res, 100))
  child.kill()
  expect(readFileSync(join(f, 'src/styles/fluid/fluid.css'), 'utf8').includes('--fluid-caption:'), 'generate --watch regenerates when fluid.config.json changes', log)

  // ── Phase 3 regressions (docs/designs/FIX-PLAN-2026-09.md) ──
  const R = join(root, 'robust')
  mkdirSync(join(R, 'src/app'), { recursive: true })
  writeFileSync(join(R, 'package.json'), JSON.stringify({ dependencies: { next: '16', tailwindcss: '4' }, devDependencies: { prettier: '3' } }))
  writeFileSync(join(R, 'src/app/globals.css'), `@charset "utf-8";\n@import 'tailwindcss';\n`)
  r = run(R, 'init', '--yes')
  expect(r.code === 0 && readFileSync(join(R, '.prettierignore'), 'utf8').includes('src/styles/fluid/'), 'init keeps Prettier off the generated folder (.prettierignore)', r.out)
  expect(existsSync(join(R, 'src/styles/fluid/.gitattributes')) && readFileSync(join(R, 'src/styles/fluid/.gitattributes'), 'utf8').includes('-text'), 'generate writes a .gitattributes that stops CRLF conversion')
  const gcss = readFileSync(join(R, 'src/app/globals.css'), 'utf8')
  expect(gcss.startsWith('@charset "utf-8";\n@import \'tailwindcss\';\n@import'), 'the import goes after @charset and tailwindcss, never above @charset', gcss)
  const fcssPath = join(R, 'src/styles/fluid/fluid.css')
  const orig = readFileSync(fcssPath, 'utf8')
  writeFileSync(fcssPath, orig.replace(/\n/g, '\r\n'))
  r = run(R, 'check')
  expect(r.code === 0 && r.out.includes('generated files match'), 'CRLF line endings are not an edit (check passes)', r.out)
  r = run(R, 'generate')
  expect(r.code === 0, 'CRLF: generate runs without --force', r.out)
  writeFileSync(fcssPath, orig.replace(/: /g, ':  ').replace(/'/g, '"'))
  r = run(R, 'check')
  expect(r.code === 0 && r.out.includes('reformatted by a formatter'), "a formatter's rewrite is a warning naming the ignore file, not a failure", r.out)
  r = run(R, 'generate')
  expect(r.code === 0 && readFileSync(fcssPath, 'utf8') === orig, 'generate restores a reformatted file without --force', r.out)
  // missing lock + a real edit: refuse
  rmSync(join(R, 'src/styles/fluid/.fluid.lock.json'))
  writeFileSync(fcssPath, orig + '/* mine */\n')
  r = run(R, 'generate')
  expect(r.code === 1 && r.out.includes('no .fluid.lock.json to tell'), 'no lock and a differing file: generate refuses instead of overwriting', r.out)
  run(R, 'generate', '--force')
  // an orphan edited since: kept
  writeFileSync(join(R, 'src/styles/fluid/cn.ts'), readFileSync(join(R, 'src/styles/fluid/cn.ts'), 'utf8') + '// mine\n')
  const rcfg = JSON.parse(readFileSync(join(R, 'fluid.config.json'), 'utf8'))
  writeFileSync(join(R, 'fluid.config.json'), JSON.stringify({ ...rcfg, output: { ...rcfg.output, stack: 'css' } }))
  r = run(R, 'generate', '--force')
  expect(existsSync(join(R, 'src/styles/fluid/cn.ts')) && r.out.includes('kept cn.ts'), 'an orphan edited since is kept, and named', r.out)
  // own breakpoints: ladder off; a rung with the ladder on is an error
  const B = join(root, 'bps')
  mkdirSync(join(B, 'src/app'), { recursive: true })
  writeFileSync(join(B, 'package.json'), JSON.stringify({ dependencies: { next: '16', tailwindcss: '^4.1' } }))
  writeFileSync(join(B, 'src/app/globals.css'), `@import 'tailwindcss';\n@theme {\n  --breakpoint-md: 50rem;\n  --breakpoint-lg: 1024px;\n}\n`)
  r = run(B, 'init', '--yes')
  expect(r.code === 0 && JSON.parse(readFileSync(join(B, 'fluid.config.json'), 'utf8')).tailwind?.breakpoints === 'none', 'init keeps a site\'s own breakpoints (breakpoints: none)', r.out)
  const bcfg = JSON.parse(readFileSync(join(B, 'fluid.config.json'), 'utf8'))
  delete bcfg.tailwind
  writeFileSync(join(B, 'fluid.config.json'), JSON.stringify(bcfg))
  run(B, 'generate')
  r = run(B, 'check')
  expect(r.code === 1 && r.out.includes('competes with the fluid px ladder'), 'check: a --breakpoint-* next to the ladder is an error', r.out)
  // Tailwind 3: css stack
  const T = join(root, 'tw3')
  mkdirSync(join(T, 'src'), { recursive: true })
  writeFileSync(join(T, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^3.4.1', vite: '5' } }))
  writeFileSync(join(T, 'src/index.css'), `@tailwind base;\n@tailwind utilities;\n`)
  r = run(T, 'init', '--yes')
  expect(r.code === 0 && JSON.parse(readFileSync(join(T, 'fluid.config.json'), 'utf8')).output.stack === 'css' && r.out.includes('Tailwind 3'), 'Tailwind 3 is detected: css stack, and a note', r.out)
  // init --force over a v1 config keeps a backup; a hand edit refuses before writing
  const V = join(root, 'v1force')
  mkdirSync(V)
  writeFileSync(join(V, 'fluid.config.json'), JSON.stringify({ canvas: { width: 1600 }, mobile: { enabled: true } }))
  r = run(V, 'init', '--yes', '--force')
  expect(r.code === 0 && existsSync(join(V, 'fluid.config.v1.json')) && JSON.parse(readFileSync(join(V, 'fluid.config.json'), 'utf8')).version === 2, 'init --force over v1 keeps fluid.config.v1.json', r.out)
  const beforeCfg = readFileSync(join(V, 'fluid.config.json'), 'utf8')
  appendFileSync(join(V, 'styles/fluid/fluid.css'), '/* mine */\n')
  rmSync(join(V, 'fluid.config.json'))
  r = run(V, 'init', '--yes', '--desktop', '1600x900')
  expect(r.code === 2 && !existsSync(join(V, 'fluid.config.json')) && r.out.includes('Nothing was written'), 'init refuses over hand-edited output and writes nothing', r.out)
  writeFileSync(join(V, 'fluid.config.json'), beforeCfg)
  // explain --zoom is validated; watch survives an invalid save
  r = run(g, 'explain', '1440x900', '--zoom', 'big')
  expect(r.code === 2 && r.out.includes('--zoom wants a factor'), 'explain --zoom validates its value', r.out)
  const wchild = spawn(process.execPath, [FLUID, 'generate', '--watch'], { cwd: R })
  let wlog = ''
  wchild.stdout.on('data', (d) => (wlog += d))
  wchild.stderr.on('data', (d) => (wlog += d))
  await new Promise((res) => setTimeout(res, 800))
  const rcfg2 = readFileSync(join(R, 'fluid.config.json'), 'utf8')
  writeFileSync(join(R, 'fluid.config.json'), '{"version": 2, "bandz": {}}')
  for (let i = 0; i < 40 && !wlog.includes('did you mean "bands"'); i++) await new Promise((res) => setTimeout(res, 100))
  const alive = wchild.exitCode === null
  writeFileSync(join(R, 'fluid.config.json'), rcfg2)
  await new Promise((res) => setTimeout(res, 500))
  wchild.kill()
  expect(alive && wlog.includes('did you mean "bands"'), 'generate --watch survives an invalid save and reports it', wlog)
} finally {
  rmSync(root, { recursive: true, force: true })
}
console.log(failures ? `${failures} failure(s)` : 'all passed')
process.exit(failures ? 1 : 0)
