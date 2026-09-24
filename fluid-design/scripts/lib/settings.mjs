// settings.mjs — find and lint every --fluid-* declaration a project writes.
//
//   scanDeclarations(css, file)   -> [{ name, value, line, file, context: [prelude…] }]
//   lintSettings(structure, decls) -> { findings: [{ level, file, line, message }], overrides }
//
// `overrides` is what the static tools (explain, calc) use: the values set
// at the top-level :root, last one wins, each with its file:line.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { settingsSpec, unitNames, didYouMean } from './spec.mjs'

/** Every custom-property declaration whose name starts with --fluid or
 * --_fluid, with its line and the stack of selectors/at-rules around it. */
export function scanDeclarations(css, file = '<css>') {
  // Blank out comments but keep newlines, so offsets and lines survive.
  // SCSS/Sass also have // line comments (not after a ':' — a url's //).
  let text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  if (/\.s[ac]ss$/.test(file)) text = text.replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))
  const lineAt = (idx) => text.slice(0, idx).split('\n').length
  const out = []
  const stack = []
  let from = 0
  const flush = (to) => {
    const chunk = text.slice(from, to)
    const m = /^\s*(--_?fluid[\w-]*)\s*:\s*([\s\S]*?)\s*(!important)?\s*$/.exec(chunk)
    if (m) out.push({ name: m[1], value: m[2].trim(), line: lineAt(from + chunk.indexOf(m[1])), file, context: [...stack] })
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      stack.push(text.slice(from, i).trim().replace(/\s+/g, ' '))
      from = i + 1
    } else if (c === '}') {
      flush(i)
      stack.pop()
      from = i + 1
    } else if (c === ';') {
      flush(i)
      from = i + 1
    }
  }
  return out
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/

const isRootContext = (ctx) => ctx.length === 1 && /^(:root|html)$/.test(ctx[0])

/** Lint declarations against the structure's settings. */
export function lintSettings(structure, decls) {
  const specs = settingsSpec(structure)
  const byName = new Map(specs.map((s) => [s.name, s]))
  const units = new Set(unitNames(structure))
  const prefix = structure.prefix
  const findings = []
  const overrides = {}
  const at = (d) => ({ file: d.file, line: d.line })
  for (const d of decls) {
    if (d.name.startsWith('--_fluid')) {
      findings.push({ level: 'warn', ...at(d), message: `${d.name} is a private engine variable; set the public setting it reads instead (see settings.reference.css)` })
      continue
    }
    const spec = byName.get(d.name)
    if (!spec) {
      if (units.has(d.name)) {
        findings.push({ level: 'warn', ...at(d), message: `${d.name} is a generated unit, not a setting: declaring it replaces the engine's formula. Change the settings it is built from instead.` })
        continue
      }
      const hint = didYouMean(d.name, [...byName.keys()])
      findings.push({ level: 'error', ...at(d), message: `${d.name} is not a fluid setting${hint ? ` — did you mean ${hint}?` : ''} (it does nothing; see settings.reference.css)` })
      continue
    }
    if (!NUMBER.test(d.value)) {
      findings.push({ level: 'error', ...at(d), message: `${d.name}: "${d.value}" is not a plain number. Settings are unitless${spec.registered ? '; the browser ignores this and uses the default' : ''}.` })
      continue
    }
    const v = Number(d.value)
    if (spec.min !== undefined && v < spec.min) findings.push({ level: 'error', ...at(d), message: `${d.name}: ${v} is below ${spec.min}` })
    else if (spec.max !== undefined && v > spec.max) findings.push({ level: 'error', ...at(d), message: `${d.name}: ${v} is above ${spec.max}` })
    else if (spec.integer && !Number.isInteger(v)) findings.push({ level: 'error', ...at(d), message: `${d.name}: must be 0 or 1` })
    const media = d.context.find((c) => c.startsWith('@media'))
    if (media) {
      findings.push({ level: 'warn', ...at(d), message: `${d.name} is set inside ${media}: settings are already per band (${spec.band ? `this one is ${spec.band}'s` : 'this one is global'}), so a media query is redundant and hides the value from \`fluid explain\`` })
    } else if (!isRootContext(d.context)) {
      const sel = d.context[d.context.length - 1] ?? '(top level)'
      if (!sel.includes(`${prefix}-scope`)) {
        findings.push({ level: 'warn', ...at(d), message: `${d.name} is set on "${sel}": it only takes effect on :root, or on an element with class="${prefix}-scope"` })
      }
    }
    if (isRootContext(d.context)) {
      if (overrides[d.name]) findings.push({ level: 'info', ...at(d), message: `${d.name} is also set at ${overrides[d.name].source}; this one wins only if it loads later` })
      overrides[d.name] = { value: v, source: `${d.file}:${d.line}` }
    }
  }
  // Cross-checks on the resolved top-level values.
  for (const band of ['phone', 'tablet', 'landscape', 'desktop']) {
    const get = (k) => overrides[`--fluid-${band}-${k}`]?.value ?? byName.get(`--fluid-${band}-${k}`)?.default
    const min = get('scale-min')
    const max = get('scale-max')
    if (min != null && max != null && min > max) {
      const src = overrides[`--fluid-${band}-scale-min`] ?? overrides[`--fluid-${band}-scale-max`]
      findings.push({ level: 'error', file: src?.source.split(':')[0] ?? '(defaults)', line: Number(src?.source.split(':').pop()) || 0, message: `--fluid-${band}-scale-min (${min}) is above --fluid-${band}-scale-max (${max})` })
    }
  }
  return { findings, overrides }
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.vercel', 'verify-out', 'screenshots'])

/** Every .css/.scss/.sass file under `root`, except the generated folder. */
export function projectStyleFiles(root, generatedDir) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue
      const abs = join(dir, name)
      if (generatedDir && abs === generatedDir) continue
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else if (['.css', '.scss', '.sass'].includes(extname(name))) out.push(abs)
    }
  }
  walk(root)
  return out.sort()
}

/** Scan a project: every style file under root except output.dir. */
export function scanProject(structure, root, generatedDir) {
  const decls = []
  for (const f of projectStyleFiles(root, generatedDir)) {
    decls.push(...scanDeclarations(readFileSync(f, 'utf8'), relative(root, f)))
  }
  return lintSettings(structure, decls)
}
