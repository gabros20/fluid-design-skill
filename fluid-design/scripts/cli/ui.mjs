// ui.mjs — output and errors: colours, CliError/fail, path and JSON helpers, the binary flag.

import { sep } from 'node:path'
import { SKILL_VERSION } from '../lib/spec.mjs'

export const c = {
  red: (s) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  green: (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  dim: (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s)
}

/** A message for the user and an exit code. Thrown, never exited on the
 * spot: only run() turns it into an exit, so the watcher and init can catch
 * it and carry on (or roll back). */
export class CliError extends Error {
  constructor(message, code = 1) {
    super(message)
    this.code = code
  }
}

export function fail(message, code = 1) {
  throw new CliError(message, code)
}

export function toImport(rel) {
  const p = rel.split(sep).join('/')
  return p.startsWith('.') ? p : `./${p}`
}


/** JSON with small objects and arrays kept on one line. */
export function prettyJson(value, indent = '') {
  const inner = indent + '  '
  if (Array.isArray(value)) {
    const flat = JSON.stringify(value)
    return flat.length <= 72 ? flat.replace(/,/g, ', ') : `[\n${value.map((v) => inner + prettyJson(v, inner)).join(',\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const flat = `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v).replace(/,/g, ', ').replace(/:/g, ': ')}`).join(', ')} }`
    if (flat.length <= 72 && entries.every(([, v]) => typeof v !== 'object' || v === null || JSON.stringify(v).length < 40)) return flat
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${prettyJson(v, inner)}`).join(',\n')}\n${indent}}`
  }
  return JSON.stringify(value)
}

/** A standalone binary (bun build --compile) rather than node running the skill. */
export const IS_BINARY = globalThis.__fluidBinary === true

export function needsNode(what) {
  fail(`${what} drives a real browser through Playwright, a Node library, so it runs under Node, not in the standalone binary:\n  npx fluid-design-cli@${SKILL_VERSION.split('.')[0]} ${process.argv.slice(2).join(' ')}\n(in a project with playwright installed: npm i -D playwright && npx playwright install chromium)`, 2)
}
