#!/usr/bin/env node
// calc.mjs — the maths, with no browser. Reads the nearest fluid.config.json
// and the settings your CSS sets (top-level :root), or --config.
//
//   node calc.mjs table [--w 320,390,820,1024,1440,2560] [--h 568,844,1180,640,900,1440] [--zoom 1] [--raw]
//   node calc.mjs px <N> [--unit fluid|<role>|ui] --at WxH [--zoom 1]
//   node calc.mjs budget --widths 429,77,157,48,115,32,115,104,440
//
// Exit codes: 0 ok, 1 budget OVER, 2 usage error.

import { loadContext } from '../lib/context.mjs'
import { evaluate, valuesOf } from '../lib/model.mjs'
import { ConfigError } from '../lib/spec.mjs'
import { num } from '../lib/emit/engine.mjs'

function parseArgs(argv) {
  const out = { _: [], config: undefined, w: undefined, h: undefined, widths: undefined, unit: 'fluid', at: undefined, zoom: 1, raw: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--config') out.config = argv[++i]
    else if (a === '--w') out.w = argv[++i]
    else if (a === '--h') out.h = argv[++i]
    else if (a === '--widths') out.widths = argv[++i]
    else if (a === '--unit') out.unit = argv[++i]
    else if (a === '--at') out.at = argv[++i]
    else if (a === '--zoom') out.zoom = Number(argv[++i])
    else if (a === '--raw') out.raw = true
    else if (a === '-h' || a === '--help') out.help = true
    else if (a.startsWith('--')) usage(`unknown flag ${a}`)
    else out._.push(a)
  }
  return out
}

const USAGE = `calc.mjs — the fluid maths, no browser.

  table   [--w list] [--h list] [--zoom z] [--raw]   every unit at a set of viewports (zipped if the lists match)
  px <N>  [--unit fluid|<role>|ui] --at WxH          one drawn number through one unit
  budget  --widths N,N,…                             does a drawn desktop row fit the container at the artboard?

  --config <file>   instead of the nearest fluid.config.json
  --raw             run the desktop formula below the desktop band too (to see the curve's shape)`

function usage(msg) {
  if (msg) console.error(`[calc] ${msg}`)
  console.error(USAGE)
  process.exit(2)
}

const list = (s, d) => (s ? s.split(',').map((x) => Number(x.trim())) : d)
const f3 = (n) => n.toFixed(3)

function parseAt(s) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(s ?? ''))
  if (!m) usage(`--at must look like 1280x800 (got ${JSON.stringify(s)})`)
  return [Number(m[1]), Number(m[2])]
}

/** Which arm of the unit binds: min, max, width, height. */
function binding(structure, v, band, w, h, fluid) {
  if (band === 'phone' && !structure.bands.phone.enabled) return 'flat'
  const g = (k) => v[`--fluid-${band}-${k}`]
  const min = g('scale-min')
  const max = g('scale-max') ?? Infinity
  if (fluid <= min + 1e-12 && w / g('base-width') < min) return 'min'
  if (fluid >= max - 1e-12) return 'max'
  if (band === 'desktop' && g('fit-height') && h / g('base-height') < w / g('base-width')) return 'height'
  return 'width'
}

function cmdTable(ctx, args) {
  const s = ctx.structure
  const v = valuesOf(ctx.resolved)
  const widths = list(args.w, [320, 390, 430, 820, 844, 1024, 1280, 1440, 1440, 1920, 2560])
  const heights = list(args.h, [568, 844, 932, 1180, 390, 640, 800, 900, 700, 1080, 1440])
  const rows = widths.length === heights.length ? widths.map((w, i) => [w, heights[i]]) : heights.flatMap((h) => widths.map((w) => [w, h]))
  const cols = ['width', 'height', 'band', 'binds', 'fluid', ...s.roles, ...(s.ui ? ['ui'] : []), 'container']
  console.log(cols.map((c) => c.padEnd(10)).join(''))
  for (const [w, h] of rows) {
    const e = evaluate(s, v, w, h, args.zoom, args.raw ? 'desktop' : undefined)
    console.log(
      [String(w), String(h), e.band, binding(s, v, e.band, w, h, e.fluid), f3(e.fluid), ...s.roles.map((r) => f3(e.roles[r])), ...(s.ui ? [f3(e.ui)] : []), `${Math.round(e.containerWidth)}px`]
        .map((c) => c.padEnd(10))
        .join('')
    )
  }
  const set = Object.entries(ctx.resolved).filter(([, r]) => r.source !== 'default')
  if (set.length) console.log(`\nsettings from your CSS: ${set.map(([k, r]) => `${k}=${num(r.value)}`).join(', ')}`)
}

function cmdPx(ctx, args) {
  const n = Number(args._[1])
  if (!Number.isFinite(n)) usage('px needs a number: calc.mjs px 64 --unit display --at 1280x800')
  const s = ctx.structure
  const units = ['fluid', ...s.roles, ...(s.ui ? ['ui'] : [])]
  if (!units.includes(args.unit)) usage(`--unit must be one of ${units.join('|')}`)
  const [w, h] = parseAt(args.at ?? '1440x900')
  const e = evaluate(s, valuesOf(ctx.resolved), w, h, args.zoom)
  const f = args.unit === 'fluid' ? e.fluid : args.unit === 'ui' ? e.ui : e.roles[args.unit]
  console.log(`${n} * var(--fluid${args.unit === 'fluid' ? '' : '-' + args.unit}) at ${w}x${h} (${e.band})  ->  ${num(n * f)}px  (unit ${f3(f)})`)
}

// A drawn desktop row must fit the container's content box AT THE ARTBOARD
// (base-width − 2 × padding). When it does not, express each width as a
// fraction of the container's content box instead (cqw): exact at the
// container width, and unable to overflow.
function cmdBudget(ctx, args) {
  const widths = list(args.widths)
  if (!widths?.length) usage('budget needs --widths, e.g. --widths 429,77,157,48,115,32,115,104,440')
  const v = valuesOf(ctx.resolved)
  const base = v['--fluid-desktop-base-width']
  const pad = v['--fluid-desktop-container-padding']
  const cw = v['--fluid-desktop-container-width']
  const sum = widths.reduce((a, b) => a + b, 0)
  const budget = Math.min(base, cw) - 2 * pad
  console.log(`row: ${widths.join(' + ')} = ${sum}`)
  console.log(`budget at the artboard: min(base-width ${base}, container-width ${cw}) − 2 × padding ${pad} = ${budget}`)
  if (sum <= budget) {
    console.log(`PASS — ${budget - sum}px to spare.`)
    return
  }
  console.log(`OVER by ${sum - budget}`)
  const box = cw - 2 * pad
  console.log(`\nAs fractions of the container's content box (N / ${box}), in cqw:`)
  for (const w of widths) console.log(`  ${w}  ->  ${((w / box) * 100).toFixed(3)}cqw`)
  process.exitCode = 1
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }
  let ctx
  try {
    ctx = loadContext(args.config)
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : String(err))
    process.exit(2)
  }
  const cmd = args._[0]
  if (cmd === 'table') cmdTable(ctx, args)
  else if (cmd === 'px') cmdPx(ctx, args)
  else if (cmd === 'budget') cmdBudget(ctx, args)
  else usage(cmd ? `unknown command ${cmd}` : '')
}

main()
