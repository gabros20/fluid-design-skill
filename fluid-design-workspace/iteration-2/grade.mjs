// grade.mjs — scripted assertions for evals 5 and 6 (iteration-2). Writes grading.json per run.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const W = dirname(fileURLToPath(import.meta.url))
const FLUID = join(W, '../../fluid-design/bin/fluid')
const sh = (cwd, cmd) => execSync(cmd, { cwd, encoding: 'utf8' })
const check = (cwd) => { const r = spawnSync(process.execPath, [FLUID, 'check'], { cwd, encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr } }

function grade(dir, rows) {
  const results = rows.map(([text, passed, evidence]) => ({ text, passed: !!passed, evidence }))
  writeFileSync(join(dir, 'grading.json'), JSON.stringify({ expectations: results, summary: { passed: results.filter((r) => r.passed).length, total: results.length } }, null, 2))
  console.log(`\n${dir.split('/').slice(-2).join('/')}`)
  for (const r of results) console.log(`  ${r.passed ? 'PASS' : 'FAIL'} ${r.text} — ${r.evidence}`)
}

{ // eval 5
  const run = join(W, 'eval-5-shadcn-cn-with-fluid/with_skill')
  const p = join(run, 'project')
  const utils = readFileSync(join(p, 'src/lib/utils.ts'), 'utf8')
  const resp = existsSync(join(run, 'outputs/response.md')) ? readFileSync(join(run, 'outputs/response.md'), 'utf8') : ''
  const diffNames = sh(p, 'git status --porcelain').trim()
  const cnDefs = sh(p, "grep -rlE 'export (function|const) cn\\b' src --include=*.ts --include=*.tsx || true").trim().split('\n').filter(Boolean)
  const handGroups = sh(p, "grep -rl 'classGroups' src --include=*.ts --include=*.tsx | grep -v 'src/styles/fluid' || true").trim()
  const c = check(p)
  grade(run, [
    ['edits src/lib/utils.ts to use extendTailwindMerge(withFluid)', /import\s*\{[^}]*\bwithFluid\b[^}]*\}\s*from\s*['"][^'"]*styles\/fluid\/cn['"]/.test(utils) && /extendTailwindMerge\([^)]*\bwithFluid\b/.test(utils), utils.replace(/\n/g, ' ⏎ ').slice(0, 300)],
    ['keeps a single cn: no second cn function, callers unchanged', cnDefs.filter((f) => !f.startsWith('src/styles/fluid')).length === 1 && readFileSync(join(p, 'src/components/ui/button.tsx'), 'utf8').includes("from '@/lib/utils'"), `cn defined in: ${cnDefs.join(', ')}`],
    ['does not hand-write fluid class groups or edit the generated cn.ts', !handGroups && !/src\/styles\/fluid/.test(diffNames), `changed: ${diffNames.replace(/\n/g, '; ')}; hand classGroups: ${handGroups || 'none'}`],
    ['verifies with fluid check (no tailwind-merge warning)', /fluid check/.test(resp) && c.code === 0 && !c.out.includes('without withFluid'), `check exit ${c.code}: ${c.out.trim().split('\n').pop()}`]
  ])
}

{ // eval 6
  const run = join(W, 'eval-6-header-stops-scaling/with_skill')
  const p = join(run, 'project')
  const css = readFileSync(join(p, 'src/app/globals.css'), 'utf8')
  const resp = existsSync(join(run, 'outputs/response.md')) ? readFileSync(join(run, 'outputs/response.md'), 'utf8') : ''
  const headerDiff = sh(p, 'git diff -U0 -- src/components src/app/page.tsx')
  const added = headerDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n')
  const c = check(p)
  const rootBlocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n')
  grade(run, [
    ['sets --fluid-ui-grow-until: 1680 on :root', /--fluid-ui-grow-until:\s*1680\s*;/.test(rootBlocks), rootBlocks.match(/--fluid-ui-grow-until[^;]*;/)?.[0] ?? 'not in a :root rule'],
    ['explains why not a limit class on <header> (--header-h would not follow)', /--header-h/.test(resp) && !/<header[^>]*grow-until/.test(added), resp.match(/[^.\n]*--header-h[^.\n]*/)?.[0]?.slice(0, 200) ?? 'no mention'],
    ['does not replace fluid utilities on the header\'s children with fixed px or max() caps', !/\[\d+px\]|\bmin\(|\bmax\(/.test(added), added ? added.slice(0, 200) : 'header markup unchanged'],
    ['names the per-component tool for other parts (fluid-grow-until-* on a wrapper)', /fluid-grow-until-/.test(resp), resp.match(/[^\n]*fluid-grow-until-[^\n]*/)?.[0]?.slice(0, 200) ?? 'no mention'],
    ['fluid check passes after the change', c.code === 0 && !c.out.includes('grow-until limit on <header>'), c.out.trim().split('\n').pop()]
  ])
}
