// generate.mjs — fluid generate [--dry] [--force] [--watch]

import { writeFileSync, mkdirSync, rmSync, watchFile } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { ConfigError, SKILL_VERSION } from '../../lib/spec.mjs'
import { buildOutput, fileHash } from '../../lib/emit/project.mjs'
import { c, CliError, fail } from '../ui.mjs'
import { LOCK, findConfig, project, diffOutput, formatterHint } from '../project.mjs'

export function cmdGenerate(flags) {
  const p = project(flags)
  const { files, buildId } = buildOutput(p.structure)
  const { rows } = diffOutput(p.outDir, files)
  const edited = rows.filter((r) => r.state === 'hand-edited' || r.state === 'unowned')
  if (edited.length && !flags.force) {
    const why = (r) => (r.state === 'unowned' ? `${r.rel} (no ${LOCK} to tell whether it was edited)` : r.rel)
    fail(`${c.red('Refusing to overwrite hand-edited files')} in ${relative(process.cwd(), p.outDir) || '.'}:\n${edited.map((r) => `  ${why(r)}`).join('\n')}\nThese are generated. Move your change into fluid.config.json or a setting, then run ${c.bold('fluid generate --force')}.`)
  }
  const changed = rows.filter((r) => r.state !== 'ok' && r.state !== 'orphan-edited')
  if (flags.dry) {
    for (const r of changed) console.log(`${r.state.padEnd(12)} ${r.rel}`)
    console.log(changed.length ? `${changed.length} file(s) would change` : 'up to date')
    return
  }
  mkdirSync(p.outDir, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(p.outDir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  for (const r of rows.filter((r) => r.state === 'orphan')) rmSync(join(p.outDir, r.rel), { force: true })
  for (const r of rows.filter((r) => r.state === 'orphan-edited')) console.log(c.yellow(`! kept ${r.rel}: no longer generated, but edited since — delete it yourself if it's unused`))
  const reformatted = rows.filter((r) => r.state === 'reformatted')
  if (reformatted.length) console.log(c.yellow(`! ${reformatted.length} file(s) had been reformatted by a formatter; regenerated. ${formatterHint(p)}`))
  const lock = { generator: `fluid-design ${SKILL_VERSION}`, build: buildId, stack: p.structure.output.stack, files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, fileHash(v)])) }
  writeFileSync(join(p.outDir, LOCK), JSON.stringify(lock, null, 2) + '\n')
  const out = relative(process.cwd(), p.outDir) || '.'
  console.log(`${c.green('✓')} ${out}: ${Object.keys(files).length} files (${changed.length} changed) · build ${buildId}`)
}


export function cmdWatch(flags) {
  const path = findConfig(flags)
  if (!path) fail(`No fluid.config.json found here or above. Start with ${c.bold('fluid init')}.`, 2)
  // An invalid save (a typo'd key, JSON half-written) prints its error and
  // keeps watching: the next save retries.
  const once = () => {
    try {
      cmdGenerate({ ...flags, config: path, watch: undefined })
    } catch (err) {
      console.error(err instanceof CliError || err instanceof ConfigError ? err.message : c.red(err.stack ?? String(err)))
    }
  }
  once()
  console.log(c.dim(`watching ${relative(process.cwd(), path)} — Ctrl+C to stop`))
  // Polling one file's stat, not fs.watch: it sees an editor that replaces
  // the file as well as one that writes it, and fs.watch on Windows missed
  // saves and could crash libuv on a short (8.3) temp path (fs-event.c).
  watchFile(path, { interval: 250 }, (cur, prev) => {
    if (cur.mtimeMs !== prev.mtimeMs || cur.size !== prev.size) once()
  })
}
