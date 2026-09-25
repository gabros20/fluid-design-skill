// init.mjs — fluid init: detect, ask (on a terminal), write the config, generate, wire the import and settings.

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { createInterface } from 'node:readline'
import { normaliseStructure, settingsSpec, jsonSchema, structureDefaults, CONFIG_VERSION, STACKS, INTEGRATIONS } from '../../lib/spec.mjs'
import { readJson, isV1 } from '../../lib/model.mjs'
import { buildOutput } from '../../lib/emit/project.mjs'
import { findImportInsertion, findRootBlock, hasBaseRules } from '../../lib/css-scan.mjs'
import { num } from '../../lib/emit/engine.mjs'
import { c, fail, toImport, prettyJson } from '../ui.mjs'
import { settingsFromFlags, checkSettingValue, oneOf, yesNo, posInt, wxh } from '../args.mjs'
import { project, diffOutput, ignoreForFormatter, minimalStructure } from '../project.mjs'
import { cmdGenerate } from './generate.mjs'

const GLOBALS_CANDIDATES = [
  // Node frameworks
  'src/app/globals.css', 'app/globals.css', 'src/styles/globals.css', 'styles/globals.css', 'src/index.css', 'src/main.css', 'src/styles/main.css', 'src/style.css',
  'src/app/globals.scss', 'app/globals.scss', 'styles/globals.scss', 'src/styles/main.scss', 'src/main.scss', 'styles/main.scss',
  // no Node: Rails, Phoenix, Hugo, Django, plain HTML
  'app/assets/stylesheets/application.css', 'app/assets/stylesheets/application.scss', 'app/assets/tailwind/application.css', 'assets/css/app.css', 'assets/css/main.css', 'assets/scss/main.scss', 'static/css/main.css', 'static/css/style.css', 'css/style.css', 'style.css', 'styles.css'
]

export function detectProject(root) {
  let pkg = {}
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const integration = deps.next ? 'next' : deps.vite ? 'vite' : 'none'
  const globals = GLOBALS_CANDIDATES.find((f) => existsSync(join(root, f))) ?? null
  const globalsText = globals ? readFileSync(join(root, globals), 'utf8') : ''
  // Tailwind 3 has no @utility/@custom-variant: the css stack, spent through arbitrary values.
  const twVersion = String(deps.tailwindcss ?? '').replace(/^[^\d]*/, '')
  const tailwind3 = /^[0-3](\.|$)/.test(twVersion) || /@tailwind\s+(base|utilities)/.test(globalsText)
  const tailwind4 = !tailwind3 && (!!deps.tailwindcss || /@import\s+['"]tailwindcss['"]/.test(globalsText))
  const stack = tailwind4 ? 'tailwind-v4' : deps.sass || deps['sass-embedded'] || /\.s[ac]ss$/.test(globals ?? '') ? 'scss' : deps['@stylexjs/stylex'] ? 'stylex' : 'css'
  const srcStyles = existsSync(join(root, 'src')) ? 'src/styles/fluid' : 'styles/fluid'
  // An existing site styles html/body itself: leave the base layer out.
  const brownfield = hasBaseRules(globalsText)
  // Breakpoints the site declares itself: keep them, leave the ladder out.
  const ownBreakpoints = [...globalsText.matchAll(/--breakpoint-([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  return { integration, stack, tailwind3, ownBreakpoints, globals, brownfield, node: !!pkg.name || Object.keys(deps).length > 0, outDir: globals && !['src/app', 'app', '.'].includes(dirname(globals)) ? `${dirname(globals)}/fluid` : srcStyles }
}

/** Questions on a TTY (or --interactive); answers come line by line, so a
 * script can pipe them in. EOF or an empty line takes the default. */
function prompter() {
  const rl = createInterface({ input: process.stdin, terminal: false })
  const lines = rl[Symbol.asyncIterator]()
  let closed = false
  return {
    async ask(question, def, check = (v) => v) {
      for (let tries = 0; tries < 5; tries++) {
        process.stdout.write(`${c.bold('?')} ${question} ${c.dim(`(${def === '' ? 'none' : def})`)} `)
        const next = closed ? { done: true } : await lines.next()
        if (next.done) closed = true
        const raw = next.done ? '' : next.value.trim()
        if (!process.stdin.isTTY) process.stdout.write(`${raw}\n`)
        if (raw === '') return def
        const v = check(raw)
        if (v !== undefined) return v
        console.log(c.red(`  ${JSON.stringify(raw)} is not one of the options`))
      }
      return def
    },
    close: () => rl.close()
  }
}

export async function cmdInit(flags) {
  const root = process.cwd()
  const configPath = join(root, 'fluid.config.json')
  const existingV1 = existsSync(configPath) && isV1(readJson(configPath))
  if (existsSync(configPath) && !flags.force) fail(`fluid.config.json already exists. ${existingV1 ? `It is v1: run ${c.bold('fluid migrate --write')}.` : `Run ${c.bold('fluid generate')}, or init --force to start over.`}`, 2)
  const det = detectProject(root)
  if (det.tailwind3) console.log(c.yellow(`! Tailwind 3 found: the fluid utilities need Tailwind 4 (@utility). Using the css stack: spend the units in arbitrary values, e.g. p-[calc(24*var(--fluid))].`))
  const defaults = Object.fromEntries(settingsSpec(normaliseStructure({})).map((x) => [x.name, x.default]))
  const flagWxH = (k) => (flags[k] === undefined ? undefined : wxh(String(flags[k])) ?? fail(`--${k} wants WIDTHxHEIGHT, e.g. 1440x900`, 2))
  const flagInt = (k) => (flags[k] === undefined ? undefined : posInt(String(flags[k])) ?? fail(`--${k} wants a whole number of px`, 2))
  const a = {
    stack: flags.stack ?? det.stack,
    integration: flags.integration ?? det.integration,
    css: flags.css ?? det.globals ?? '',
    brownfield: flags.brownfield ? true : det.brownfield,
    desktop: flagWxH('desktop') ?? [defaults['--fluid-desktop-base-width'], defaults['--fluid-desktop-base-height']],
    desktopAt: flagInt('desktop-at') ?? structureDefaults().bands.desktop.minWidth,
    mobile: !flags['no-mobile'],
    phone: flagInt('phone') ?? defaults['--fluid-phone-base-width'],
    maxWidth: flagInt('max-width') ?? defaults['--fluid-desktop-container-width'],
    out: flags.out
  }
  const interactive = (process.stdin.isTTY && !flags.yes) || !!flags.interactive
  if (interactive) {
    console.log(`${c.bold('fluid init')} ${c.dim('— Enter keeps the default in brackets. Everything here can be changed later.')}\n`)
    const q = prompter()
    a.stack = await q.ask('Styling: tailwind-v4, css, scss or stylex?', a.stack, oneOf(STACKS))
    a.integration = await q.ask('Framework, for the browser-zoom head script: next, vite or none?', a.integration, oneOf(INTEGRATIONS))
    a.css = await q.ask('Global stylesheet (gets the import and your settings; empty = print them instead)', a.css, (v) => v)
    a.brownfield = await q.ask('Does this site already style html and body itself? (y = leave the base layer out)', a.brownfield ? 'y' : 'n', yesNo)
    if (typeof a.brownfield === 'string') a.brownfield = a.brownfield === 'y'
    a.desktop = await q.ask('Desktop design frame, width x height', a.desktop.join('x'), wxh)
    if (typeof a.desktop === 'string') a.desktop = wxh(a.desktop)
    a.desktopAt = await q.ask('The desktop layout starts at this window width (px)', a.desktopAt, posInt)
    a.mobile = await q.ask('Scale the phone, tablet and landscape layouts too? (n = 1px below desktop)', a.mobile ? 'y' : 'n', yesNo)
    if (typeof a.mobile === 'string') a.mobile = a.mobile === 'y'
    if (a.mobile) a.phone = await q.ask('Phone design frame width', a.phone, posInt)
    a.maxWidth = await q.ask('The page stops widening at (drawn px)', a.maxWidth, posInt)
    const outDefault = a.out ?? (a.css && !['src/app', 'app', '.'].includes(dirname(a.css)) ? `${dirname(a.css)}/fluid` : det.outDir)
    a.out = await q.ask('Generated files go in', outDefault, (v) => v)
    q.close()
    console.log('')
  }
  const brownfield = !!a.brownfield
  const structure = {
    $schema: './fluid.config.schema.json',
    version: CONFIG_VERSION,
    bands: a.mobile ? { desktop: { minWidth: a.desktopAt } } : { phone: false, tablet: false, landscape: false, desktop: { minWidth: a.desktopAt } },
    output: {
      dir: a.out ?? (a.css && !['src/app', 'app', '.'].includes(dirname(a.css)) ? `${dirname(a.css)}/fluid` : det.outDir),
      stack: a.stack,
      base: !brownfield,
      integration: a.integration
    },
    // The site's own --breakpoint-* stay; the px ladder would compete with them.
    ...(a.stack === 'tailwind-v4' && det.ownBreakpoints.length ? { tailwind: { breakpoints: 'none' } } : {})
  }
  let normalised
  try {
    normalised = normaliseStructure(structure)
  } catch (err) {
    fail(err.message, 2)
  }
  // Answers that are settings become declarations in your :root; only what
  // differs from the default is written.
  const byName = new Map(settingsSpec(normalised).map((x) => [x.name, x]))
  const chosen = {
    '--fluid-desktop-base-width': a.desktop[0],
    '--fluid-desktop-base-height': a.desktop[1],
    '--fluid-desktop-container-width': a.maxWidth,
    ...(a.mobile ? { '--fluid-phone-base-width': a.phone } : {}),
    ...settingsFromFlags(normalised, flags)
  }
  const settings = Object.entries(chosen).filter(([k, v]) => byName.has(k) && v !== byName.get(k).default)
  for (const [k, v] of settings) checkSettingValue(byName.get(k), v)

  // Everything is decided and validated before anything is written: the
  // hand-edit guard runs on the target folder first, so a refusal leaves
  // the project exactly as it was.
  const outDir = resolvePath(root, normalised.output.dir)
  const pre = diffOutput(outDir, buildOutput(normalised).files).rows.filter((r) => r.state === 'hand-edited' || r.state === 'unowned')
  if (pre.length && !flags.force) fail(`${c.red('Refusing to overwrite hand-edited files')} in ${relative(root, outDir)}:\n${pre.map((r) => `  ${r.rel}`).join('\n')}\nNothing was written. Run init --force to replace them.`, 2)
  if (existingV1) {
    copyFileSync(configPath, configPath.replace(/\.json$/, '.v1.json'))
    console.log(`${c.yellow('!')} the v1 config is kept as fluid.config.v1.json (fluid migrate would have carried its numbers over; see its notes there)`)
  }
  const { $schema, ...rest } = structure
  writeFileSync(configPath, prettyJson({ $schema, ...minimalStructure(rest) }) + '\n')
  writeFileSync(join(root, 'fluid.config.schema.json'), JSON.stringify(jsonSchema(), null, 2) + '\n')
  console.log(`${c.green('✓')} fluid.config.json (${structure.output.stack}, ${structure.output.integration === 'none' ? 'no framework integration' : structure.output.integration}${brownfield ? ', brownfield: base off' : ''}${a.mobile ? '' : ', flat below desktop'}${structure.tailwind ? ', your own breakpoints kept' : ''})`)
  if (structure.tailwind) {
    const lg = det.ownBreakpoints.find(([k]) => k === 'lg')
    console.log(c.dim(`  your @theme declares --breakpoint-${det.ownBreakpoints.map(([k]) => k).join('/-')}: the px ladder is off ("breakpoints": "none").${lg && lg[1] !== `${normalised.bands.desktop.minWidth}px` ? ` Set --breakpoint-lg: ${normalised.bands.desktop.minWidth}px so lg: and the desktop band switch together (now ${lg[1]}); fluid check enforces it.` : ''}`))
  }
  cmdGenerate({ config: configPath, force: flags.force })
  const fmt = ignoreForFormatter(root, outDir)
  if (fmt) console.log(fmt)

  const p = project({ config: configPath })
  const tw = p.structure.output.stack === 'tailwind-v4'
  const globalsPath = a.css ? resolvePath(root, a.css) : null
  const importPath = globalsPath ? toImport(relative(dirname(globalsPath), join(p.outDir, 'fluid.css'))) : `./${p.structure.output.dir}/fluid.css`
  const refPath = toImport(relative(globalsPath ? dirname(globalsPath) : root, join(p.outDir, 'settings.reference.css')))
  const settingLines = settings.map(([k, v]) => `  ${k}: ${num(v)};`)
  const starterLines = [
    `  /* fluid settings — every one, with its default, is in ${refPath} */`,
    ...settingLines,
    ...(settingLines.length ? [] : ['  /* --fluid-phone-scale-min: 0.82; */', '  /* --fluid-desktop-display-damping: 0.62; */'])
  ]
  const importLine = `@import '${importPath}';`
  const editable = globalsPath && existsSync(globalsPath) && !brownfield && /\.css$/.test(globalsPath)
  if (editable) {
    let css = readFileSync(globalsPath, 'utf8')
    if (!css.includes(importPath)) {
      // Right after @import 'tailwindcss' when there is one, else after any
      // @charset / @import / @layer header (never above @charset).
      const tailwindImport = /@import\s+['"]tailwindcss['"][^;]*;\n?/.exec(css)
      if (tailwindImport) css = css.replace(tailwindImport[0], `${tailwindImport[0].trimEnd()}\n${importLine}\n`)
      else {
        const at = findImportInsertion(css)
        css = `${css.slice(0, at)}${at && !css.slice(0, at).endsWith('\n') ? '\n' : ''}${importLine}\n${css.slice(at)}`
      }
      // Settings sit with your tokens: inside your first top-level :root, or a new one.
      const block = findRootBlock(css)
      if (block) {
        const before = css.slice(0, block.closeIndex).replace(/\s*$/, '')
        css = `${before}\n\n${starterLines.join('\n')}\n${css.slice(block.closeIndex)}`
      } else css = `${css.trimEnd()}\n\n:root {\n${starterLines.join('\n')}\n}\n`
      writeFileSync(globalsPath, css)
      console.log(`${c.green('✓')} ${relative(root, globalsPath)}: added ${importLine}, and ${settingLines.length ? `${settingLines.length} setting(s)` : 'a commented settings starter'} in your :root`)
    }
  } else {
    const scssFile = globalsPath && /\.s[ac]ss$/.test(globalsPath)
    console.log('')
    if (scssFile) {
      console.log(c.bold('Load the engine once, as plain CSS (from your entry: import \'…/fluid.css\', or a <link>):'))
      console.log(`  ${p.structure.output.dir}/fluid.css`)
      console.log(c.bold(`and in ${relative(root, globalsPath)} (and any .scss that draws on the scale):`))
      console.log(`  @use '${toImport(relative(dirname(globalsPath), p.outDir))}' as fd;`)
    } else {
      console.log(c.bold(`Add to ${globalsPath ? relative(root, globalsPath) : 'your global CSS'}${tw ? ", after @import 'tailwindcss';" : ''}:`))
      console.log(`  ${importLine}`)
    }
    console.log(c.bold('and in your :root, next to your tokens:'))
    console.log(`:root {\n${starterLines.join('\n')}\n}`)
  }
  // An existing cn (shadcn's lib/utils.ts, …): keep it, add the plugin.
  if (tw) {
    const { runAudit } = await import('../../tools/audit.mjs')
    const existing = [...new Set(runAudit({ root, prefix: p.structure.prefix, stack: p.structure.output.stack, outDir: p.outDir, rules: ['cn-without-withfluid'] }).map((f) => f.file))]
    if (existing.length) {
      const cnImport = toImport(relative(dirname(existing[0]), join(p.outDir, 'cn'))).replace(/\.ts$/, '')
      console.log('')
      console.log(c.bold(`You already have a cn: ${relative(root, existing[0])}. Keep it and teach it the fluid classes:`))
      console.log(`  import { extendTailwindMerge } from 'tailwind-merge'`)
      console.log(`  import { withFluid } from '${cnImport}'`)
      console.log(`  const twMerge = extendTailwindMerge(withFluid)   // instead of importing twMerge directly`)
      console.log(c.dim('  (already extending it? pass withFluid as the next argument: extendTailwindMerge({ extend: … }, withFluid))'))
    }
  }

  // Editor autocomplete for the settings in CSS files (VS Code custom data).
  const vsc = join(root, '.vscode/settings.json')
  const dataRel = toImport(relative(root, join(p.outDir, 'fluid.css-data.json'))).replace(/^\.\//, '')
  if (existsSync(vsc)) {
    try {
      const cur = JSON.parse(readFileSync(vsc, 'utf8'))
      const list = new Set([...(cur['css.customData'] ?? []), dataRel])
      cur['css.customData'] = [...list]
      writeFileSync(vsc, JSON.stringify(cur, null, 2) + '\n')
      console.log(`${c.green('✓')} .vscode/settings.json: settings autocomplete (css.customData)`)
    } catch {
      console.log(c.dim(`  (could not parse .vscode/settings.json; add "css.customData": ["${dataRel}"] for settings autocomplete)`))
    }
  } else console.log(c.dim(`  settings autocomplete in VS Code: add "css.customData": ["${dataRel}"] to .vscode/settings.json`))
  if (p.structure.zoom) {
    console.log('')
    console.log(c.bold('Browser zoom:'))
    if (p.structure.output.integration === 'next') console.log(`  app/layout.tsx:  import { FluidHead } from '…/${p.structure.output.dir}/integrations/next'  →  <head><FluidHead /></head>`)
    else if (p.structure.output.integration === 'vite') console.log(`  vite.config.ts:  import { fluidPlugin } from './${p.structure.output.dir}/integrations/vite'  →  plugins: [fluidPlugin()]`)
    else console.log(`  first thing in <head>:  <script src="/…/${p.structure.output.dir}/runtime/zoom.classic.js"></script>  (served from wherever your static files live; a classic script, not a module, so a page opened zoomed paints right the first time)`)
  }
  console.log('')
  console.log(`Then: ${c.bold('fluid check')} · ${c.bold('fluid explain 390x844')} · change a structure key and ${c.bold('fluid generate')} (or keep ${c.bold('fluid generate --watch')} running)`)
}
