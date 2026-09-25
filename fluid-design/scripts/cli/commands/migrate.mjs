// migrate.mjs — fluid migrate [--write]: a v1 config to v2.

import { writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { jsonSchema, CONFIG_VERSION } from '../../lib/spec.mjs'
import { readJson, isV1, migrateV1 } from '../../lib/model.mjs'
import { num } from '../../lib/emit/engine.mjs'
import { c, fail, prettyJson } from '../ui.mjs'
import { findConfig, minimalStructure } from '../project.mjs'
import { detectProject } from './init.mjs'

export function cmdMigrate(flags) {
  const path = findConfig(flags)
  if (!path) fail('No fluid.config.json found.', 2)
  const json = readJson(path)
  if (!isV1(json)) {
    console.log(`${relative(process.cwd(), path)} is already v${CONFIG_VERSION}.`)
    return
  }
  const { $schema, ...v1 } = json
  let m
  try {
    m = migrateV1(v1)
  } catch (err) {
    fail(err.message, 2)
  }
  const det = detectProject(dirname(path))
  const structure = { ...m.structure, output: { dir: det.outDir, stack: det.stack, integration: det.integration } }
  const out = { $schema: './fluid.config.schema.json', ...minimalStructure(structure) }
  const text = prettyJson(out) + '\n'
  const settings = Object.entries(m.settings)
  const snippet = settings.length ? `:root {\n${settings.map(([k, v]) => `  ${k}: ${num(v)};`).join('\n')}\n}` : null
  console.log(c.bold('What moved:'))
  for (const n of m.notes) console.log(`  - ${n}`)
  console.log('')
  console.log(c.bold('fluid.config.json (v2):'))
  console.log(text)
  if (snippet) {
    console.log(c.bold("Settings your v1 config set — put these in your globals.css :root, next to your tokens:"))
    console.log(snippet)
    console.log('')
  } else console.log(c.dim('Every v1 number you set matches a v2 default: no settings to carry over.\n'))
  if (flags.write) {
    const backup = path.replace(/\.json$/, '.v1.json')
    copyFileSync(path, backup)
    writeFileSync(path, text)
    writeFileSync(join(dirname(path), 'fluid.config.schema.json'), JSON.stringify(jsonSchema(), null, 2) + '\n')
    console.log(`${c.green('✓')} wrote ${relative(process.cwd(), path)} (v1 kept as ${relative(process.cwd(), backup)}) and fluid.config.schema.json`)
    console.log(`Next: add the settings above to your CSS, run ${c.bold('fluid generate')}, and replace your old fluid imports with the one ${c.bold("@import './fluid/fluid.css'")}.`)
  } else console.log(c.dim('Dry run. Re-run with --write to replace fluid.config.json (the v1 file is kept as fluid.config.v1.json).'))
}
