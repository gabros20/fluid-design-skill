// explain.mjs — fluid explain <W>x<H> [--url …] and fluid probe <url>

import { settingsSpec, bandBlurb } from '../../lib/spec.mjs'
import { resolveSettings, evaluate, valuesOf, bandMedia } from '../../lib/model.mjs'
import { buildOutput } from '../../lib/emit/project.mjs'
import { scanProject } from '../../lib/settings.mjs'
import { num } from '../../lib/emit/engine.mjs'
import { c, fail, IS_BINARY, needsNode } from '../ui.mjs'
import { parseWxH, parseZoom, settingsFromFlags } from '../args.mjs'
import { project } from '../project.mjs'

function printExplain(structure, resolved, w, h, zoom, label) {
  const e = evaluate(structure, valuesOf(resolved), w, h, zoom)
  const band = e.band
  const flat = band === 'phone' && !structure.bands.phone.enabled
  console.log(`${c.bold(`${w}×${h}`)}${zoom !== 1 ? ` (CSS px) at ${Math.round(zoom * 100)}% zoom` : ''} → ${c.bold(band)}: ${bandBlurb(structure, band).replace(/^\S+ — /, '')}${label ? c.dim(`  (${label})`) : ''}`)
  const media = bandMedia(structure)[band]
  if (media) console.log(c.dim(`  @media ${media}`))
  console.log('')
  const row = (name, v, note = '') => console.log(`  ${name.padEnd(26)} ${v.padEnd(12)} ${c.dim(note)}`)
  row('--fluid', `${e.fluid.toFixed(4)}`, `100 drawn px = ${(100 * e.fluid).toFixed(1)} CSS px`)
  if (structure.zoom && zoom !== 1) row('--fluid-z', `${e.fluidZ.toFixed(4)}`, 'the layout unit with the zoom undone, what type reads')
  for (const r of structure.roles) row(`--fluid-${r}`, `${e.roles[r].toFixed(4)}`, `64 drawn px = ${(64 * e.roles[r]).toFixed(1)} CSS px`)
  if (structure.ui) row('--fluid-ui', `${e.ui.toFixed(4)}`)
  row('--fluid-container-width', `${e.containerWidth.toFixed(1)}px`)
  row('--fluid-container-padding', `${e.containerPadding.toFixed(1)}px`)
  row('--fluid-header-h', `${e.headerHeight.toFixed(1)}px`, '+ safe-area inset')
  console.log('')
  console.log(`  settings in play (${band}${flat ? ', flat' : ''}):`)
  for (const [name, r] of Object.entries(resolved)) {
    if (r.spec.band !== band && r.spec.band !== null) continue
    const v = r.value === null ? 'unset' : num(r.value)
    const src = r.source === 'default' ? c.dim('default') : c.green(`← ${r.source}`)
    console.log(`    ${name.padEnd(38)} ${v.padEnd(8)} ${src}`)
  }
}

export async function cmdExplain(flags, args) {
  const [w, h] = parseWxH(args[0])
  const zoom = parseZoom(flags.zoom)
  if (flags.at && !flags.url) fail('--at reads an element on a live page: add --url http://localhost:3000 (offline, --set --fluid-grow-until=1680 asks the same what-if)', 2)
  if (flags.url) return explainLive(flags, w, h, zoom)
  const p = project(flags)
  const extra = Object.fromEntries(Object.entries(settingsFromFlags(p.structure, flags)).map(([k, v]) => [k, { value: v, source: '--set' }]))
  const { overrides, variants = [] } = scanProject(p.structure, p.dir, p.outDir)
  printExplain(p.structure, resolveSettings(p.structure, { ...overrides, ...extra }), w, h, zoom, Object.keys(extra).length ? 'settings from your CSS, top-level :root, plus --set' : 'settings from your CSS, top-level :root')
  if (variants.length) {
    console.log('')
    console.log(c.dim('  also set under a condition (not applied above):'))
    for (const v of variants) console.log(c.dim(`    ${v.name}: ${num(v.value)}  on ${v.selector}  ← ${v.source}`))
  }
}

/** explain --url (and probe): the live page against the model. Verdicts and
 * exit codes: OK 0 · STALE / MISMATCH / V1 1 · MISSING 2. A v1 config works
 * too: its migrated numbers are the expectation (a v1 page has no v2
 * settings to read). */
async function explainLive(flags, w, h, zoom) {
  if (IS_BINARY) needsNode('fluid explain --url')
  const { readLive, LiveError } = await import('../../lib/live.mjs')
  const { loadContext } = await import('../../lib/context.mjs')
  let ctx
  try {
    ctx = loadContext(flags.config)
  } catch (err) {
    fail(err.message, 2)
  }
  const structure = ctx.structure
  const at = typeof flags.at === 'string' ? flags.at : null
  const extra = Object.fromEntries(Object.entries(settingsFromFlags(structure, flags)).map(([k, v]) => [k, { value: v, source: '--set' }]))
  let live
  try {
    live = await readLive(flags.url, { w, h, structure, at, zoom: flags.zoom === undefined ? null : zoom })
  } catch (err) {
    if (err instanceof LiveError) fail(err.message, 2)
    throw err
  }
  let resolved
  if (ctx.migration) resolved = ctx.resolved
  else {
    // Registered settings always compute to a value; only a non-default one was set by the page.
    const defaults = Object.fromEntries(settingsSpec(structure).map((x) => [x.name, x.default]))
    for (const [k, o] of Object.entries(live.overrides)) if (o.value === defaults[k]) delete live.overrides[k]
    resolved = resolveSettings(structure, { ...live.overrides, ...extra })
  }
  const label = `${ctx.migration ? 'v1 config (migrated in memory); ' : ''}settings read ${at ? `at ${at} on` : 'from'} ${flags.url}${flags.zoom !== undefined ? `, emulated zoom ${zoom} (the runtime's variable, not browser zoom: fluid verify covers that)` : ''}`
  if (!flags.brief) printExplain(structure, resolved, w, h, zoom, label)
  const e = evaluate(structure, valuesOf(resolved), w, h, zoom)
  const got = live.units
  const rows = [['--fluid', e.fluid, got.fluid], ...structure.roles.map((r) => [`--fluid-${r}`, e.roles[r], got[r]]), ...(structure.ui ? [['--fluid-ui', e.ui, got.ui]] : [])]
  let worst = 0
  for (const [, exp, g] of rows) worst = Math.max(worst, Math.abs(exp - g))
  const expectedBuild = ctx.migration ? null : buildOutput(structure).buildId
  console.log('')
  if (flags.brief) {
    console.log(`  ${flags.url} @ ${w}x${h} (${e.band})`)
    for (const [n, exp, g] of rows) console.log(`  ${n.padEnd(18)} page ${Number.isFinite(g) ? g.toFixed(4) : 'NaN'}   expected ${exp.toFixed(4)}`)
    console.log('')
  }
  let verdict
  if (!(got.fluid > 0)) verdict = 'MISSING'
  else if (!ctx.migration && !live.build) verdict = 'V1'
  else if (expectedBuild && live.build !== expectedBuild) verdict = 'STALE'
  else if (worst >= 0.002 && !Object.keys(extra).length) verdict = at && !live.isScope ? 'NOT-A-SCOPE' : 'MISMATCH'
  else verdict = 'OK'
  const say = {
    OK: c.green(`  ✓ OK: the ${at ? 'element' : 'page'}'s units match (worst drift ${worst.toExponential(1)})${Object.keys(extra).length ? c.dim(' — --set changes the prediction only; the page is measured as it is') : ''}`),
    MISSING: c.red('  ✗ MISSING: no fluid unit resolves here — this page does not load the fluid stylesheet (wrong URL or build, or not wired up)'),
    V1: c.yellow('  ! V1: the page runs a stylesheet with no --fluid-build stamp (v1, or hand-written); this config is v2: fluid generate, then load the new fluid.css'),
    STALE: c.red(`  ✗ STALE: the page was built from ${live.build}; this config generates ${expectedBuild}. Run fluid generate, then close the tab and open a fresh one; if it persists, clear the build cache (rm -rf .next) and restart the dev server`),
    MISMATCH: c.red(`  ✗ MISMATCH: current build, but the units drift by up to ${worst.toFixed(4)} — a hand-edited fluid.css, or a setting redeclared where fluid check doesn't look`),
    'NOT-A-SCOPE': c.red(`  ✗ ${at} sets fluid settings but is not a scope, so its units are its nearest scope's. Add a limit utility, class="${structure.prefix}-scope" or data-fluid-scope to it.`)
  }[verdict]
  console.log(say)
  if (!at && !flags.brief) printScopes(structure, live)
  process.exitCode = verdict === 'OK' ? 0 : verdict === 'MISSING' ? 2 : 1
}

/** fluid probe <url> [--width 1440] [--height 900]: the one-shot freshness
 * check, now explain --url --brief. */
export async function cmdProbe(flags, args) {
  if (!args[0]) fail('fluid probe <url> [--width 1440] [--height 900]  (the same as: fluid explain 1440x900 --url <url> --brief)', 2)
  return explainLive({ ...flags, url: args[0], brief: true }, Number(flags.width ?? 1440), Number(flags.height ?? 900), 1)
}

/** Every scope on the page (limit utilities, fluid-scope, data-fluid-scope):
 * its settings, its units against the page's, and how many elements inside
 * follow the scale. A limit with nothing to limit is a warning. */
function printScopes(structure, live) {
  if (!live.scopes.length) return
  console.log('')
  console.log(`  scopes on this page (${live.scopes.length}${live.scopesTruncated ? '+' : ''}):`)
  for (const s of live.scopes) {
    const units = ['fluid', ...(structure.ui ? ['ui'] : [])].map((u) => `${u} ${s.units[u].toFixed(4)}${Math.abs(s.units[u] - live.units[u]) > 5e-4 ? c.dim(` (page ${live.units[u].toFixed(4)})`) : ''}`).join('  ')
    const set = Object.entries(s.settings).map(([k, v]) => `${k}: ${v}`).join('; ')
    console.log(`    ${c.bold(s.label)}`)
    console.log(`      ${set || c.dim('no settings of its own')}`)
    console.log(`      ${units}`)
    if (s.following === null) console.log(c.dim(`      the unit is 1 here, so what follows it can't be told apart; try another viewport`))
    else if (s.following === 0) console.log(`      ${c.yellow('!')} nothing inside is sized with fluid units: this ${s.limit ? 'limit' : 'scope'} does nothing. Move it to the element whose children use the fluid classes, or remove it.`)
    else console.log(c.dim(`      ${s.following} element(s) inside follow the scale`))
  }
}
