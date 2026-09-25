// args.mjs — argument parsing and validation: flags, WxH, zoom, --set settings, prompt answers.

import { settingsSpec, didYouMean } from '../lib/spec.mjs'
import { fail } from './ui.mjs'

/** --flag value, --flag=value, --flag (true). A repeated flag collects an
 * array. --set always takes the next argument, even one starting with --
 * (--set --fluid-desktop-scale-max=1.4). */
const REPEATABLE = new Set(['set'])
export function parse(argv) {
  const out = { _: [], flags: {} }
  const put = (k, v) => {
    if (REPEATABLE.has(k)) (out.flags[k] ??= []).push(v)
    else out.flags[k] = v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 2) {
        put(a.slice(2, eq), a.slice(eq + 1))
        continue
      }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && (REPEATABLE.has(key) || !next.startsWith('--'))) {
        put(key, next)
        i++
      } else put(key, true)
    } else out._.push(a)
  }
  return out
}

export function parseWxH(s) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(s ?? ''))
  if (!m) fail(`expected a viewport like 390x844, got ${JSON.stringify(s)}`, 2)
  return [Number(m[1]), Number(m[2])]
}

export function parseZoom(v) {
  if (v === undefined) return 1
  const z = Number(v)
  if (!Number.isFinite(z) || z < 0.25 || z > 5) fail(`--zoom wants a factor between 0.25 and 5 (1.5 = 150%), got ${JSON.stringify(v)}`, 2)
  return z
}

/** --set name=value (repeatable) and --fluid-*=value → { '--fluid-…': number },
 * validated against the settings spec. */
export function settingsFromFlags(structure, flags) {
  const specs = settingsSpec(structure)
  const byName = new Map(specs.map((x) => [x.name, x]))
  const pairs = [...(flags.set ?? []).map((a) => String(a)), ...Object.entries(flags).filter(([k]) => k.startsWith('fluid-')).map(([k, v]) => `${k}=${v}`)]
  const out = {}
  for (const pair of pairs) {
    const eq = pair.lastIndexOf('=')
    if (eq < 1) fail(`--set wants name=value, got ${JSON.stringify(pair)} (e.g. --set --fluid-desktop-scale-max=1.4)`, 2)
    const bare = pair.slice(0, eq).replace(/^-+/, '')
    const name = [`--${bare}`, `--fluid-${bare}`].find((n) => byName.has(n))
    if (!name) {
      const guess = didYouMean(`--${bare.startsWith('fluid-') ? bare : `fluid-${bare}`}`, [...byName.keys()])
      fail(`unknown setting ${pair.slice(0, eq)}${guess ? ` — did you mean ${guess}?` : ''} (fluid settings lists them)`, 2)
    }
    out[name] = checkSettingValue(byName.get(name), pair.slice(eq + 1))
  }
  return out
}

export function checkSettingValue(spec, raw) {
  const v = Number(String(raw).trim())
  const bad = (why) => fail(`${spec.name}: ${JSON.stringify(raw)} ${why}`, 2)
  if (String(raw).trim() === '' || !Number.isFinite(v)) bad('is not a plain number (settings take no units)')
  if (spec.min !== undefined && v < spec.min) bad(`is below ${spec.min}`)
  if (spec.max !== undefined && v > spec.max) bad(`is above ${spec.max}`)
  if (spec.integer && !Number.isInteger(v)) bad('must be a whole number')
  return v
}

export const oneOf = (list) => (v) => (list.includes(v) ? v : undefined)
export const yesNo = (v) => (/^(y|yes)$/i.test(v) ? true : /^(n|no)$/i.test(v) ? false : undefined)
export const posInt = (v) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined)
export const wxh = (v) => {
  const m = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(v)
  return m ? [Number(m[1]), Number(m[2])] : undefined
}
