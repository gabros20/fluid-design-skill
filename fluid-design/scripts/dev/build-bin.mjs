#!/usr/bin/env node
// build-bin.mjs — the standalone `fluid` binaries, for projects without Node
// (Rails, Django, Laravel, Phoenix, Hugo, plain HTML). One executable per
// platform, built by `bun build --compile` from scripts/dev/bin-entry.mjs, which
// bundles the CLI with its runtime files (runtime-assets.mjs) so nothing is
// read from the skill at run time. Bun cross-compiles every target from one
// machine; CI (.github/workflows/release.yml) runs this on a version tag and
// attaches the output to the GitHub Release.
//
//   node scripts/dev/build-bin.mjs                 every target → dist/
//   node scripts/dev/build-bin.mjs --target host   only this machine's
//   node scripts/dev/build-bin.mjs --smoke         then run the host binary through
//                                              init / generate / check / calc / explain / audit
//   --out <dir>                                instead of fluid-design/dist
//
// Needs bun (https://bun.sh). Commands that drive a browser (verify, probe,
// explain --url) need Playwright, a Node library: the binary says so and
// prints the npx command instead.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { SKILL_VERSION } from '../lib/spec.mjs'

const SKILL = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..')
const TARGETS = [
  ['darwin', 'arm64'],
  ['darwin', 'x64'],
  ['linux', 'x64'],
  ['linux', 'arm64'],
  ['windows', 'x64']
]
const hostOs = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform]
const assetName = (os, arch) => `fluid-${os}-${arch}${os === 'windows' ? '.exe' : ''}`

const args = process.argv.slice(2)
const flag = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const out = resolvePath(flag('--out') ?? join(SKILL, 'dist'))
const only = flag('--target')
const targets = only === 'host' ? TARGETS.filter(([os, arch]) => os === hostOs && arch === process.arch) : only ? TARGETS.filter(([os, arch]) => `${os}-${arch}` === only) : TARGETS
if (!targets.length) {
  console.error(`no target matches ${only} (targets: ${TARGETS.map((t) => t.join('-')).join(', ')}, host)`)
  process.exit(2)
}
if (spawnSync('bun', ['--version']).status !== 0) {
  console.error('bun is not installed: curl -fsSL https://bun.sh/install | bash')
  process.exit(2)
}

mkdirSync(out, { recursive: true })
const sums = []
for (const [os, arch] of targets) {
  const file = join(out, assetName(os, arch))
  const r = spawnSync('bun', ['build', '--compile', '--minify', `--target=bun-${os}-${arch}`, join(SKILL, 'scripts/dev/bin-entry.mjs'), '--outfile', file], { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(`✗ ${os}-${arch}\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
  sums.push(`${hash}  ${assetName(os, arch)}`)
  console.log(`✓ ${assetName(os, arch).padEnd(24)} ${(statSync(file).size / 1e6).toFixed(1)} MB`)
}
if (targets.length === TARGETS.length) writeFileSync(join(out, 'SHA256SUMS'), sums.join('\n') + '\n')
console.log(`fluid ${SKILL_VERSION} → ${out}`)

if (args.includes('--smoke')) {
  const bin = join(out, assetName(hostOs, process.arch))
  if (!existsSync(bin)) {
    console.error(`--smoke: no host binary at ${bin}`)
    process.exit(2)
  }
  const dir = mkdtempSync(join(tmpdir(), 'fluid-bin-'))
  let failures = 0
  const step = (what, argv, ok) => {
    const r = spawnSync(bin, argv, { cwd: dir, encoding: 'utf8' })
    const text = r.stdout + r.stderr
    const pass = ok(r.status, text)
    if (!pass) failures++
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${what}${pass ? '' : `\n${text}`}`)
  }
  try {
    mkdirSync(join(dir, 'assets/css'), { recursive: true })
    writeFileSync(join(dir, 'assets/css/main.css'), ':root {\n  --brand: teal;\n}\n')
    step('--version', ['--version'], (code, t) => code === 0 && t.trim() === SKILL_VERSION)
    step('init --yes (no package.json: css stack)', ['init', '--yes', '--desktop', '1600x900'], (code) => code === 0 && readFileSync(join(dir, 'assets/css/main.css'), 'utf8').includes('--fluid-desktop-base-width: 1600;'))
    step('the runtime is embedded', [], () => readFileSync(join(dir, 'assets/css/fluid/runtime/zoom.classic.js'), 'utf8').includes('function installFluidZoom'))
    step('check', ['check'], (code, t) => code === 0 && t.includes('OK'))
    step('calc table', ['calc', 'table', '--w', '1600', '--h', '900'], (code, t) => code === 0 && /1600\s+900\s+desktop\s+\S+\s+1\.000/.test(t))
    step('explain --set', ['explain', '1920x1080', '--set', '--fluid-grow-until=1600'], (code, t) => code === 0 && /--fluid\s+1\.0000/.test(t))
    step('audit', ['audit', '.'], (code) => code === 0)
    step('verify says it needs Node', ['verify', '--url', 'http://localhost:1'], (code, t) => code === 2 && t.includes('npx fluid-design-cli@'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(failures ? `${failures} smoke failure(s)` : 'smoke: all passed')
  process.exit(failures ? 1 : 0)
}
