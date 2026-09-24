#!/usr/bin/env node
// calc.mjs — a standalone calculator over fluid-math.mjs. No browser, no
// project needed: given a config (or the shipped defaults) it prints the
// resolved factors, a single rendered px value, or checks whether a drawn
// row of widths fits the content budget at the reference viewport.
//
// Usage:
//   node calc.mjs [--config f] table [--w 1024,1280,1440,1680,2560] [--h 640,700,800,900,1440] [--raw]
//   node calc.mjs [--config f] px <N> --unit display|copy|chrome|fluid --at WxH
//   node calc.mjs [--config f] budget --widths 429,77,157,48,115,32,115,104,440
//
// Exit codes: 0 = ok, 1 = budget OVER, 2 = usage/invocation error.

import { loadConfig, factors, resolveFloors, num } from './lib/fluid-math.mjs'

// factors() from the lib returns a flat {1,1,1,1} below engageAt — the real
// generated-CSS behaviour. --raw mode instead continues the same formula
// past that cutoff, which is what fluid-scale.md §3's "Resolved factors"
// table shows (it is exposition, not a claim about what ships below `lg`).
// This mirrors factors()'s body exactly, minus its top engageAt gate, and
// still sources floors from the lib's resolveFloors() rather than
// re-deriving them.
function rawFactors(cfg, w, h) {
  const widthArm = w / cfg.reference.width
  const heightArm = h / cfg.reference.height
  const fluidRaw = cfg.heightAxis ? Math.min(widthArm, heightArm) : widthArm
  let fluid = Math.max(cfg.units.fluid.floor, fluidRaw)
  if (cfg.ceiling !== null) fluid = Math.min(cfg.ceiling, fluid)

  const floors = resolveFloors(cfg)
  const display = Math.max(floors.display, fluid, cfg.units.display.damping * fluid + (1 - cfg.units.display.damping))
  const copy = Math.max(floors.copy, fluid, cfg.units.copy.damping * fluid + (1 - cfg.units.copy.damping))
  let chrome = cfg.units.chrome.enabled ? Math.min(widthArm, Math.max(1, heightArm)) : fluid
  if (cfg.ceiling !== null) chrome = Math.min(cfg.ceiling, chrome) // chrome does not read --fluid, so the ceiling wraps it separately — see fluid-math.mjs's factors()

  return { fluid, display, copy, chrome }
}

function parseArgs(argv) {
  const out = { _: [], config: undefined, w: undefined, h: undefined, widths: undefined, unit: 'fluid', at: undefined, raw: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--config') out.config = argv[++i]
    else if (a === '--w') out.w = argv[++i]
    else if (a === '--h') out.h = argv[++i]
    else if (a === '--widths') out.widths = argv[++i]
    else if (a === '--unit') out.unit = argv[++i]
    else if (a === '--at') out.at = argv[++i]
    else if (a === '--raw') out.raw = true
    else if (a.startsWith('--')) { console.error(`[calc] unknown flag ${a}`); process.exit(2) }
    else out._.push(a)
  }
  return out
}

function parseNumberList(s, fallback) {
  if (!s) return fallback
  return s.split(',').map((x) => Number(x.trim()))
}

function parseAt(s) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(s ?? ''))
  if (!m) {
    console.error(`[calc] --at must look like WxH, e.g. 1280x800 (got ${JSON.stringify(s)})`)
    process.exit(2)
  }
  return { w: Number(m[1]), h: Number(m[2]) }
}

function fmt(n) {
  return n.toFixed(3)
}

// ── table ───────────────────────────────────────────────────────────────
//
// Zips --w and --h index-wise (one row per pair) when the lists are the same
// length — this is what reproduces fluid-scale.md §3's "Resolved factors"
// table, whose rows are (height, width) pairs chosen to land on the SAME
// --fluid value from either axis. If the lists differ in length, falls back
// to a full width x height cross product (the "verify the matrix" shape from
// fluid-scale.md §9.12).
//
// --raw ignores the engageAt cutoff (computes the formula as a continuous
// function of viewport size, the way fluid-scale.md §3's table does) instead
// of the real generated-CSS behaviour of flattening to 1 below engageAt.
function cmdTable(cfg, args) {
  const widths = parseNumberList(args.w, [1024, 1280, 1440, 1680, 2560])
  const heights = parseNumberList(args.h, [640, 700, 800, 900, 1440])

  const rows = []
  if (widths.length === heights.length) {
    for (let i = 0; i < widths.length; i++) rows.push([widths[i], heights[i]])
  } else {
    for (const h of heights) for (const w of widths) rows.push([w, h])
  }

  const floors = resolveFloors(cfg)
  console.log(`config: reference ${cfg.reference.width}x${cfg.reference.height}, engageAt ${cfg.engageAt}${args.raw ? ' (ignored: --raw)' : ''}, floors fluid=${floors.fluid} display=${floors.display} copy=${floors.copy}`)
  console.log('')
  const header = ['width', 'height', 'arm', 'fluid', 'display', 'copy', 'chrome']
  console.log(header.map((h, i) => h.padEnd(i === 2 ? 14 : 9)).join(''))
  for (const [w, h] of rows) {
    const f = args.raw ? rawFactors(cfg, w, h) : factors(cfg, w, h)
    let arm
    if (!args.raw && w < cfg.engageAt) {
      if (!cfg.mobile.enabled) arm = 'below-engage'
      else arm = f.band ?? 'phone'
    } else {
      const widthArm = w / cfg.reference.width
      const heightArm = cfg.heightAxis ? h / cfg.reference.height : Infinity
      const raw = cfg.heightAxis ? Math.min(widthArm, heightArm) : widthArm
      const floored = Math.max(cfg.units.fluid.floor, raw)
      if (cfg.ceiling !== null && floored >= cfg.ceiling) {
        arm = 'ceiling'
      } else {
        arm = raw < cfg.units.fluid.floor ? 'floor' : (widthArm <= heightArm ? 'width' : 'height')
      }
    }
    console.log([String(w), String(h), arm, fmt(f.fluid), fmt(f.display), fmt(f.copy), fmt(f.chrome)].map((c, i) => c.padEnd(i === 2 ? 14 : 9)).join(''))
  }
}

// ── px ──────────────────────────────────────────────────────────────────

function cmdPx(cfg, args) {
  const n = Number(args._[1])
  if (!Number.isFinite(n)) {
    console.error('[calc] px requires a number, e.g. node calc.mjs px 64 --unit display --at 1280x800')
    process.exit(2)
  }
  if (!['fluid', 'display', 'copy', 'chrome'].includes(args.unit)) {
    console.error(`[calc] --unit must be one of fluid|display|copy|chrome (got ${JSON.stringify(args.unit)})`)
    process.exit(2)
  }
  const { w, h } = parseAt(args.at ?? `${cfg.reference.width}x${cfg.reference.height}`)
  const f = factors(cfg, w, h)
  const rendered = n * f[args.unit]
  console.log(`${n} * var(--${cfg.prefix}${args.unit === 'fluid' ? '' : '-' + args.unit}) at ${w}x${h}  ->  ${num(rendered)}px  (factor ${fmt(f[args.unit])})`)
}

// ── budget ──────────────────────────────────────────────────────────────
//
// fluid-scale.md §2: the drawn frame is wider than the reference, so a row
// must be checked against the CONTENT budget at the reference (reference.width
// - 2*gutter), not against canvas.width. When it overflows, §4.1's cqw escape
// expresses each width as a fraction of the canvas content box
// (canvas.width - 2*gutter) instead — exact at the frame width, and
// incapable of overflowing because nothing is stated in absolute px anymore.
function cmdBudget(cfg, args) {
  const widths = parseNumberList(args.widths, undefined)
  if (!widths || widths.length === 0) {
    console.error('[calc] budget requires --widths, e.g. --widths 429,77,157,48,115,32,115,104,440')
    process.exit(2)
  }
  const sum = widths.reduce((a, b) => a + b, 0)
  const referenceBudget = cfg.reference.width - 2 * cfg.canvas.gutter
  const diff = sum - referenceBudget

  console.log(`row: ${widths.join(' + ')} = ${sum}`)
  console.log(`content budget at reference (${cfg.reference.width} - 2*${cfg.canvas.gutter}) = ${referenceBudget}`)

  if (diff <= 0) {
    console.log(`PASS — ${-diff}px of margin at the reference.`)
    return
  }

  console.log(`OVER by ${diff}`)
  const canvasBudget = cfg.canvas.width - 2 * cfg.canvas.gutter
  console.log('')
  console.log(`Suggested cqw fractions (N / (canvas.width - 2*gutter) = N / ${canvasBudget}), fluid-scale.md §4.1:`)
  for (const wdt of widths) {
    const cqw = (wdt / canvasBudget) * 100
    console.log(`  ${wdt}  ->  ${cqw.toFixed(3)}cqw`)
  }
  process.exitCode = 1
}

// ── help ────────────────────────────────────────────────────────────────

const USAGE = `calc.mjs — a standalone calculator over fluid-math.mjs.

Usage:
  node calc.mjs [--config f] table [--w 1024,1280,1440,1680,2560] [--h 640,700,800,900,1440] [--raw]
  node calc.mjs [--config f] px <N> --unit display|copy|chrome|fluid --at WxH
  node calc.mjs [--config f] budget --widths 429,77,157,48,115,32,115,104,440

Commands:
  table   print the resolved factors (fluid/display/copy/chrome) at a matrix of viewports
  px      render one drawn number through a unit at one viewport
  budget  check whether a drawn row of widths fits the content budget at the reference viewport

Options:
  --config <file>   config file to load instead of the shipped defaults
  -h, --help        print this message and exit

Exit codes: 0 = ok, 1 = budget OVER, 2 = usage/invocation error.`

// ── main ────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    process.exit(0)
  }

  const args = parseArgs(argv)
  const cmd = args._[0]
  if (!cmd) {
    console.error('usage: node calc.mjs [--config f] table|px|budget ...')
    process.exit(2)
  }

  let cfg
  try {
    cfg = loadConfig(args.config)
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }

  if (cmd === 'table') cmdTable(cfg, args)
  else if (cmd === 'px') cmdPx(cfg, args)
  else if (cmd === 'budget') cmdBudget(cfg, args)
  else {
    console.error(`[calc] unknown command ${JSON.stringify(cmd)} (expected table|px|budget)`)
    process.exit(2)
  }
}

main()
