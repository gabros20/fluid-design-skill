#!/usr/bin/env node
// cli/index.mjs — the `fluid` command: argument routing, help, error
// handling. bin/fluid (node) and dev/bin-entry.mjs (the binary) run this.
//
//   commands/init.mjs      fluid init
//   commands/generate.mjs  fluid generate [--watch]
//   commands/check.mjs     fluid check
//   commands/settings.mjs  fluid settings
//   commands/explain.mjs   fluid explain, fluid probe
//   commands/migrate.mjs   fluid migrate
//   ../tools/              fluid calc | verify | audit (also runnable on their own)
//
//   ui.mjs · args.mjs · project.mjs   what the commands share
//
// Every command finds fluid.config.json by walking up from the current
// directory, or takes --config <file>.

import { resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ConfigError, SKILL_VERSION } from '../lib/spec.mjs'
import { CliError, fail, IS_BINARY, needsNode } from './ui.mjs'
import { parse } from './args.mjs'
import { cmdGenerate, cmdWatch } from './commands/generate.mjs'
import { cmdCheck } from './commands/check.mjs'
import { cmdSettings } from './commands/settings.mjs'
import { cmdExplain, cmdProbe } from './commands/explain.mjs'
import { cmdMigrate } from './commands/migrate.mjs'
import { cmdInit } from './commands/init.mjs'

// In process, not as child processes: inside a compiled binary there is no
// node to spawn and no script files on disk. Each tool reads process.argv
// and runs on import.
const TOOLS = {
  calc: () => import('../tools/calc.mjs'),
  verify: () => import('../tools/verify.mjs'),
  audit: () => import('../tools/audit.mjs')
}
const BROWSER_TOOLS = new Set(['verify'])

async function runTool(name, args) {
  if (IS_BINARY && BROWSER_TOOLS.has(name)) needsNode(`fluid ${name}`)
  process.argv = [process.argv[0], name, ...args]
  globalThis.__fluidTool = name
  await TOOLS[name]()
}


const HELP = `fluid ${SKILL_VERSION} — fluid-design

  fluid init [--yes] [--brownfield] [--stack tailwind-v4|css|scss|stylex] [--integration next|vite|none]
             [--css path/to/globals.css] [--out dir] [--desktop 1440x900] [--desktop-at 1024]
             [--no-mobile] [--phone 390] [--max-width 1680] [--set --fluid-<setting>=<n> …]
      write fluid.config.json, generate, and wire the one import + your settings. Asks on a
      terminal (Enter keeps each default); --yes, or no terminal, takes the defaults and flags.
  fluid generate [--dry] [--force] [--watch]
                                        write output.dir from fluid.config.json (--watch: on every save)
  fluid check [--verbose]               config, generated files, settings lint, source rules — non-zero on problems (CI)
  fluid settings [--json]               every setting with its default
  fluid explain <W>x<H> [--zoom 1.5] [--set --fluid-grow-until=1680]
                [--url http://localhost:3000 [--at 'header'] [--brief]]
                                        the band, every unit, and where each value came from; --url
                                        reads the live page (and every limited scope on it), --at one
                                        element; ends with a verdict: OK 0 · STALE/MISMATCH/V1 1 · MISSING 2
  fluid migrate [--write]               convert a v1 config
  fluid probe <url> [--width 1440] [--height 900]
                                        one-shot freshness verdict (explain --url --brief)
  fluid calc | verify | audit           the tools (scripts/tools/calc.mjs, verify.mjs, audit.mjs)

  --config <file>   use this config instead of the nearest fluid.config.json`

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv
  if (TOOLS[cmd]) return runTool(cmd, rest)
  const { _, flags } = parse(rest)
  switch (cmd) {
    case 'init':
      return cmdInit(flags)
    case 'generate':
      return flags.watch ? cmdWatch(flags) : cmdGenerate(flags)
    case 'check':
      return cmdCheck(flags)
    case 'settings':
      return cmdSettings(flags)
    case 'explain':
      return cmdExplain(flags, _)
    case 'probe':
      return cmdProbe(flags, _)
    case 'migrate':
      return cmdMigrate(flags)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return
    case '--version':
    case '-v':
      console.log(SKILL_VERSION)
      return
    default:
      fail(`unknown command "${cmd}"\n\n${HELP}`, 2)
  }
}

/** main() with the CLI's error handling: config errors are messages, not stacks. */
export function run(argv) {
  return main(argv).catch((err) => {
    if (err instanceof CliError) {
      console.error(err.message)
      process.exitCode = err.code
    } else if (err instanceof ConfigError) {
      console.error(err.message)
      process.exitCode = 2
    } else {
      console.error(err.stack ?? String(err))
      process.exitCode = 2
    }
  })
}

const isMain = process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url
// In the binary every module shares the entry's URL: bin-entry.mjs is the only caller there.
if (isMain && !IS_BINARY) run()
