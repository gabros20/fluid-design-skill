// settings.mjs — find and lint every --fluid-* declaration a project writes.
//
//   scanDeclarations(css, file, { prefix })  -> [{ name, value, line, file, context, selectorList, atRules, inScopeBlock }]
//   lintSettings(structure, decls)           -> { findings: [{ level, file, line, message }], overrides, variants }
//
// `overrides` is what the static tools (explain, calc) use: the values set on
// an unconditional :root or html (a list like `:root, .light` counts; @layer
// and @supports are transparent), last one wins, each with its file:line.
// `variants` lists the values set on a qualified root (`:root.dark`,
// `html[data-theme=x]`) or a sibling part of a root list: listed, not applied.
//
// The policy (docs/FIX-PLAN-2026-09.md P4): --fluid-* is not a reserved
// namespace. An unknown name is an error only when it is a near-miss of a real
// setting (a typo) or an engine-owned variable; otherwise it is the project's
// own token and gets an info note.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname, sep } from 'node:path'
import { settingsSpec, unitNames } from './spec.mjs'
import { cssDeclarations } from './css-scan.mjs'

/** Every custom-property declaration whose name starts with --fluid or
 * --_fluid, with its line, the enclosing selectors and at-rules, and whether
 * its rule is a fluid scope. `context` (every enclosing prelude) is kept for
 * older callers. */
export function scanDeclarations(css, file = '<css>', { prefix = 'fluid' } = {}) {
  return cssDeclarations(css, { file, prefix }).filter((d) => /^--_?fluid(?![\w])/.test(d.name))
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/

// Engine-owned variables beyond the units in spec.unitNames: the namespaced
// chrome variables (P9). Declaring any of them overrides the engine.
const ENGINE_OWNED_EXTRA = ['--fluid-header-h', '--fluid-safe-top', '--fluid-safe-bottom', '--fluid-browser-bar']

// Removed in v2 (S2a): the mobile bands' per-role floors. Name the replacement.
const REMOVED_FLOOR = /^--fluid-(phone|tablet|landscape)-([\w-]+)-floor$/

// At-rules that condition a declaration on the viewport. The engine's
// settings are per band already, so these are redundant and not applied.
const CONDITIONAL = new Set(['media', 'container'])
// At-rules that change nothing about where a declaration applies.
const TRANSPARENT = new Set(['layer', 'supports'])

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

function nearest(name, candidates) {
  let best = null
  let bestD = Infinity
  for (const c of candidates) {
    const dist = editDistance(name, c)
    if (dist < bestD) [best, bestD] = [c, dist]
  }
  return bestD <= 2 ? best : null
}

const isRootPart = (s) => s === ':root' || s === 'html'
// `:root.dark`, `html[data-theme="a b"]`, `:root:has(.x)`: one compound, no combinator.
const flat = (s) => { let t = s; for (let k = 0; k < 4; k++) t = t.replace(/\[[^\[\]]*\]|\([^()]*\)/g, '_'); return t }
const isQualifiedRoot = (s) => /^(:root|html)(?![\w-])\S/.test(s) && !/[\s>+~]/.test(flat(s))

/** Where a declaration applies: 'root' | 'variant' | 'conditional' | 'scope' | 'element' | 'bare'. */
function placement(d, bandMixin) {
  const atRules = d.atRules ?? []
  const cond = atRules.find((a) => CONDITIONAL.has(a.name) || (a.name === 'include' && bandMixin.test(a.params)))
  if (cond) return { kind: 'conditional', where: `@${cond.name} ${cond.params}`.trim() }
  const opaque = atRules.find((a) => !TRANSPARENT.has(a.name))
  const sels = d.selectorList ?? []
  if (!sels.length) return { kind: opaque ? 'element' : 'bare', where: opaque ? `@${opaque.name} ${opaque.params}`.trim() : '(top level)' }
  if (!opaque && sels.some(isRootPart)) return { kind: 'root', variants: sels.filter((s) => !isRootPart(s)) }
  if (!opaque && sels.every(isQualifiedRoot)) return { kind: 'variant', where: sels.join(', ') }
  if (d.inScopeBlock) return { kind: 'scope' }
  return { kind: 'element', where: sels.join(', ') }
}

/** Lint declarations against the structure's settings. */
export function lintSettings(structure, decls) {
  const specs = settingsSpec(structure)
  const byName = new Map(specs.map((s) => [s.name, s]))
  const settingNames = [...byName.keys()]
  const owned = new Set([...unitNames(structure), ...ENGINE_OWNED_EXTRA])
  const prefix = structure.prefix ?? 'fluid'
  const bandMixin = new RegExp(`^(?:[\\w-]+\\.)?(?:${prefix}|fluid)-(?:phone|tablet|landscape|desktop|up)\\b`)
  const findings = []
  const overrides = {}
  const variants = []
  const at = (d) => ({ file: d.file, line: d.line })
  for (const d of decls) {
    if (d.name.startsWith('--_fluid')) {
      findings.push({ level: 'warn', ...at(d), message: `${d.name} is a private engine variable; set the public setting it reads instead (see settings.reference.css)` })
      continue
    }
    const spec = byName.get(d.name)
    if (!spec) {
      const removed = REMOVED_FLOOR.exec(d.name)
      if (removed) {
        const [, band, role] = removed
        findings.push({ level: 'error', ...at(d), message: `${d.name} was removed in v2: a mobile floor can only bind above scale-min, which damping expresses better. Use --fluid-${band}-${role}-damping (how much ${role} type shrinks with the layout) or --fluid-${band}-scale-min (the unit's own minimum).` })
        continue
      }
      if (owned.has(d.name)) {
        findings.push({ level: 'error', ...at(d), message: `${d.name} is owned by the engine, not a setting: declaring it replaces the engine's value. Change the settings it is built from instead (see settings.reference.css).` })
        continue
      }
      const hint = nearest(d.name, settingNames)
      if (hint) {
        findings.push({ level: 'error', ...at(d), message: `${d.name} is not a fluid setting — did you mean ${hint}? (as written it does nothing; see settings.reference.css)` })
        continue
      }
      findings.push({ level: 'info', ...at(d), message: `${d.name} is not a fluid-design setting; fine if it's your own token (consider another prefix, since --fluid-* is where fluid-design's settings live)` })
      continue
    }
    if (!NUMBER.test(d.value)) {
      findings.push({ level: 'error', ...at(d), message: `${d.name}: "${d.value}" is not a plain number. Settings are unitless${spec.registered ? '; the browser ignores this and uses the default' : ''}.` })
      continue
    }
    const v = Number(d.value)
    const binary = spec.key === 'fit-height' || spec.key === 'off'
    if (spec.min !== undefined && v < spec.min) findings.push({ level: 'error', ...at(d), message: `${d.name}: ${v} is below ${spec.min}` })
    else if (spec.max !== undefined && v > spec.max) findings.push({ level: 'error', ...at(d), message: `${d.name}: ${v} is above ${spec.max}` })
    else if (spec.integer && !Number.isInteger(v)) findings.push({ level: 'error', ...at(d), message: `${d.name}: must be ${binary ? '0 or 1' : 'a whole number'}` })

    const p = placement(d, bandMixin)
    if (p.kind === 'conditional') {
      findings.push({ level: 'info', ...at(d), message: `${d.name} is set inside ${p.where}: settings are already per band (${spec.band ? `this one is ${spec.band}'s` : 'this one is global'}), so the condition is redundant, and \`fluid explain\` does not apply the value` })
    } else if (p.kind === 'variant') {
      variants.push({ name: d.name, value: v, selector: p.where, source: `${d.file}:${d.line}` })
      if (!findings.some((f) => f.file === d.file && f.line === d.line)) {
        findings.push({ level: 'info', ...at(d), message: `${d.name} is set on the variant "${p.where}": \`fluid explain\` lists it but applies only the unconditional :root values` })
      }
    } else if (p.kind === 'element') {
      findings.push({ level: 'info', ...at(d), message: `${d.name} is set on "${p.where}": it applies only where this element is also a scope (class="${prefix}-scope" or data-fluid-scope, or the SCSS ${prefix}-scope mixin); on :root it applies to the page` })
    } else if (p.kind === 'bare') {
      findings.push({ level: 'info', ...at(d), message: `${d.name} is declared outside any rule; put it in :root (the page) or in a scope` })
    } else if (p.kind === 'root') {
      if (overrides[d.name]) findings.push({ level: 'info', ...at(d), message: `${d.name} is also set at ${overrides[d.name].source}; this one wins only if it loads later` })
      overrides[d.name] = { value: v, source: `${d.file}:${d.line}` }
      for (const sel of p.variants) variants.push({ name: d.name, value: v, selector: sel, source: `${d.file}:${d.line}` })
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
  return { findings, overrides, variants }
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
    decls.push(...scanDeclarations(readFileSync(f, 'utf8'), relative(root, f).split(sep).join("/"), { prefix: structure.prefix }))
  }
  return lintSettings(structure, decls)
}
